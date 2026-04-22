package auth

import (
	"context"
	"crypto/rand"
	"crypto/sha256"
	"encoding/hex"
	"fmt"
	"strings"
	"time"

	"github.com/golang-jwt/jwt/v5"
	"github.com/google/uuid"
	"github.com/redis/go-redis/v9"
	"github.com/rs/zerolog"
	"github.com/workived/services/internal/platform/middleware"
	"github.com/workived/services/pkg/apperr"
	"github.com/workived/services/pkg/email"
	"golang.org/x/crypto/bcrypt"
)

// Repo is the interface the auth service requires from its repository.
type Repo interface {
	CreateUser(ctx context.Context, email, passwordHash, fullName string) (*User, error)
	GetUserByEmail(ctx context.Context, email string) (*User, string, error)
	GetUserByID(ctx context.Context, id uuid.UUID) (*User, error)
	MarkEmailVerified(ctx context.Context, userID uuid.UUID) error
	UpdateLastLogin(ctx context.Context, userID uuid.UUID) error
	UpdatePassword(ctx context.Context, userID uuid.UUID, passwordHash string) error
	CreateToken(ctx context.Context, userID uuid.UUID, tokenHash, tokenType string, expiresAt time.Time) error
	GetValidToken(ctx context.Context, tokenHash, tokenType string) (*AuthToken, error)
	ConsumeToken(ctx context.Context, tokenHash string) error
	ConsumeAllPasswordResetTokens(ctx context.Context, userID uuid.UUID) error
	ConsumeAllTokensByType(ctx context.Context, userID uuid.UUID, tokenType string) error
	// OAuth methods
	CreateUserWithOAuth(ctx context.Context, email, fullName, provider string) (*User, error)
	UpsertOAuthProvider(ctx context.Context, provider *OAuthProvider) error
	GetOAuthProvider(ctx context.Context, userID uuid.UUID, provider AuthProvider) (*OAuthProvider, error)
}

// OrgRepo is the narrow interface the auth service needs from the organisation module.
type OrgRepo interface {
	GetMemberOrgID(ctx context.Context, userID uuid.UUID) (uuid.UUID, string, bool, error)
}

type Service struct {
	repo       Repo
	orgRepo    OrgRepo
	jwtSecret  string
	accessTTL  time.Duration
	refreshTTL time.Duration
	email      email.Sender
	appURL     string
	log        zerolog.Logger
	rdb        *redis.Client
	oauthCfg   OAuthConfig
}

type ServiceOption func(*Service)

func WithEmailSender(e email.Sender) ServiceOption {
	return func(s *Service) { s.email = e }
}

func WithAppURL(url string) ServiceOption {
	return func(s *Service) { s.appURL = url }
}

func WithLogger(log zerolog.Logger) ServiceOption {
	return func(s *Service) { s.log = log }
}

func WithRedis(rdb *redis.Client) ServiceOption {
	return func(s *Service) { s.rdb = rdb }
}

func WithOAuthConfig(cfg OAuthConfig) ServiceOption {
	return func(s *Service) { s.oauthCfg = cfg }
}

func NewService(repo Repo, orgRepo OrgRepo, jwtSecret string, accessTTL, refreshTTL time.Duration, opts ...ServiceOption) *Service {
	s := &Service{
		repo:       repo,
		orgRepo:    orgRepo,
		jwtSecret:  jwtSecret,
		accessTTL:  accessTTL,
		refreshTTL: refreshTTL,
	}
	for _, opt := range opts {
		opt(s)
	}
	return s
}

func (s *Service) Register(ctx context.Context, req RegisterRequest) (*User, error) {
	req.Email = strings.ToLower(req.Email)

	hash, err := bcrypt.GenerateFromPassword([]byte(req.Password), bcrypt.DefaultCost)
	if err != nil {
		// unreachable with DefaultCost; guard against future cost changes
		return nil, fmt.Errorf("hash password: %w", err)
	}

	user, err := s.repo.CreateUser(ctx, req.Email, string(hash), req.FullName)
	if err != nil {
		return nil, err
	}

	// Issue email verification token
	rawToken, tokenHash := generateToken()
	expiresAt := time.Now().UTC().Add(24 * time.Hour)
	if err := s.repo.CreateToken(ctx, user.ID, tokenHash, "email_verify", expiresAt); err != nil {
		return nil, fmt.Errorf("create verify token: %w", err)
	}

	// Send verification email asynchronously
	if s.email != nil {
		go s.sendVerificationEmail(context.Background(), user.FullName, user.Email, rawToken)
	}

	return user, nil
}

func (s *Service) GetUserByID(ctx context.Context, userID uuid.UUID) (*User, error) {
	return s.repo.GetUserByID(ctx, userID)
}

func (s *Service) Login(ctx context.Context, req LoginRequest) (*LoginResponse, string, error) {
	req.Email = strings.ToLower(req.Email)

	user, hash, err := s.repo.GetUserByEmail(ctx, req.Email)
	if err != nil {
		return nil, "", apperr.New(apperr.CodeUnauthorized, "invalid email or password")
	}

	if err := bcrypt.CompareHashAndPassword([]byte(hash), []byte(req.Password)); err != nil {
		return nil, "", apperr.New(apperr.CodeUnauthorized, "invalid email or password")
	}

	if !user.IsActive {
		return nil, "", apperr.New(apperr.CodeForbidden, "account is deactivated")
	}

	// Get org context — may be empty if user has not yet created/joined an org
	orgID, role, hasSubordinate, _ := s.orgRepo.GetMemberOrgID(ctx, user.ID)

	accessToken, err := s.IssueAccessToken(user.ID, orgID, role, hasSubordinate)
	if err != nil {
		// unreachable with HMAC-SHA256 and a non-nil key
		return nil, "", fmt.Errorf("issue access token: %w", err)
	}

	rawRefresh, refreshHash := generateToken()
	expiresAt := time.Now().UTC().Add(s.refreshTTL)
	if err := s.repo.CreateToken(ctx, user.ID, refreshHash, "refresh", expiresAt); err != nil {
		return nil, "", fmt.Errorf("create refresh token: %w", err)
	}

	_ = s.repo.UpdateLastLogin(ctx, user.ID)

	user.OrgRole = role
	return &LoginResponse{AccessToken: accessToken, User: user}, rawRefresh, nil
}

func (s *Service) Refresh(ctx context.Context, rawToken string) (*RefreshResponse, string, error) {
	tokenHash := hashToken(rawToken)
	stored, err := s.repo.GetValidToken(ctx, tokenHash, "refresh")
	if err != nil {
		return nil, "", err
	}

	user, err := s.repo.GetUserByID(ctx, stored.UserID)
	if err != nil {
		return nil, "", err
	}

	// Get org context
	orgID, role, hasSubordinate, _ := s.orgRepo.GetMemberOrgID(ctx, user.ID)

	accessToken, err := s.IssueAccessToken(user.ID, orgID, role, hasSubordinate)
	if err != nil {
		// unreachable with HMAC-SHA256 and a non-nil key
		return nil, "", fmt.Errorf("issue access token: %w", err)
	}

	// Rotate refresh token
	if err := s.repo.ConsumeToken(ctx, tokenHash); err != nil {
		return nil, "", err
	}
	rawNew, newHash := generateToken()
	expiresAt := time.Now().UTC().Add(s.refreshTTL)
	if err := s.repo.CreateToken(ctx, user.ID, newHash, "refresh", expiresAt); err != nil {
		return nil, "", fmt.Errorf("rotate refresh token: %w", err)
	}

	return &RefreshResponse{AccessToken: accessToken}, rawNew, nil
}

func (s *Service) Logout(ctx context.Context, rawToken string) error {
	tokenHash := hashToken(rawToken)
	return s.repo.ConsumeToken(ctx, tokenHash)
}

func (s *Service) VerifyEmail(ctx context.Context, req VerifyEmailRequest) error {
	tokenHash := hashToken(req.Token)
	stored, err := s.repo.GetValidToken(ctx, tokenHash, "email_verify")
	if err != nil {
		return err
	}
	if err := s.repo.ConsumeToken(ctx, tokenHash); err != nil {
		return err
	}
	return s.repo.MarkEmailVerified(ctx, stored.UserID)
}

// resendVerificationRateLimit returns an error when the per-user hourly limit is reached.
// Fails open on Redis errors so a Redis outage never blocks legitimate users.
func (s *Service) resendVerificationRateLimit(ctx context.Context, userID uuid.UUID) error {
	if s.rdb == nil {
		return nil
	}
	key := fmt.Sprintf("rate:resend_verify:%s:%d", userID, time.Now().UTC().Unix()/3600)
	count, err := s.rdb.Incr(ctx, key).Result()
	if err != nil {
		// Fail open — Redis outage must not block verification resends
		s.log.Warn().Err(err).Str("user_id", userID.String()).Msg("rate limit redis error, failing open")
		return nil
	}
	if count == 1 {
		// Set TTL on first hit; use 2h so it covers the full bucket window
		_ = s.rdb.Expire(ctx, key, 2*time.Hour)
	}
	const maxPerHour = 3
	if count > maxPerHour {
		return apperr.New(apperr.CodeRateLimit, "too many verification emails sent — please try again later")
	}
	return nil
}

func (s *Service) ResendVerificationEmail(ctx context.Context, userID uuid.UUID) error {
	// Rate limit before any DB lookup
	if err := s.resendVerificationRateLimit(ctx, userID); err != nil {
		return err
	}

	// Get user by ID
	user, err := s.repo.GetUserByID(ctx, userID)
	if err != nil {
		return err
	}

	// If already verified, return success (idempotent)
	if user.IsVerified {
		return nil
	}

	// Invalidate any existing email_verify tokens for this user
	if err := s.repo.ConsumeAllTokensByType(ctx, userID, "email_verify"); err != nil {
		s.log.Warn().Err(err).Str("user_id", userID.String()).Msg("failed to invalidate old verification tokens")
		// Non-fatal — proceed to issue new token
	}

	// Issue new email verification token
	rawToken, tokenHash := generateToken()
	expiresAt := time.Now().UTC().Add(24 * time.Hour)
	if err := s.repo.CreateToken(ctx, userID, tokenHash, "email_verify", expiresAt); err != nil {
		return fmt.Errorf("create verify token: %w", err)
	}

	// Send verification email asynchronously
	if s.email != nil {
		go s.sendVerificationEmail(context.Background(), user.FullName, user.Email, rawToken)
	}

	return nil
}

// forgotPasswordRateLimit returns an error when the per-email hourly limit is reached.
// Fails open on Redis errors so a Redis outage never blocks legitimate users.
func (s *Service) forgotPasswordRateLimit(ctx context.Context, email string) error {
	if s.rdb == nil {
		return nil
	}
	key := fmt.Sprintf("rate:forgot_pw:%s:%d", email, time.Now().UTC().Unix()/3600)
	count, err := s.rdb.Incr(ctx, key).Result()
	if err != nil {
		// Fail open — Redis outage must not block password resets
		s.log.Warn().Err(err).Str("email", email).Msg("rate limit redis error, failing open")
		return nil
	}
	if count == 1 {
		// Set TTL on first hit; use 2h so it covers the full bucket window
		_ = s.rdb.Expire(ctx, key, 2*time.Hour)
	}
	const maxPerHour = 5
	if count > maxPerHour {
		return apperr.New(apperr.CodeRateLimit, "too many password reset requests, try again later")
	}
	return nil
}

func (s *Service) ForgotPassword(ctx context.Context, req ForgotPasswordRequest) error {
	req.Email = strings.ToLower(req.Email)
	s.log.Info().Str("email", req.Email).Msg("auth.forgot_password_requested")

	// Rate limit before any DB lookup — no info leakage since we check regardless of email existence
	if err := s.forgotPasswordRateLimit(ctx, req.Email); err != nil {
		s.log.Warn().Str("email", req.Email).Msg("auth.forgot_password_rate_limited")
		return err
	}

	user, passwordHash, err := s.repo.GetUserByEmail(ctx, req.Email)
	if err != nil {
		// Silent — never reveal whether email exists
		s.log.Debug().Str("email", req.Email).Msg("auth.forgot_password_user_not_found")
		return nil
	}

	s.log.Info().Str("email", req.Email).Str("user_id", user.ID.String()).Bool("has_password", passwordHash != "").Msg("auth.forgot_password_user_found")

	// Skip OAuth users — they don't have passwords and should sign in with their OAuth provider
	if passwordHash == "" {
		s.log.Info().Str("email", req.Email).Msg("auth.forgot_password_oauth_user_skipped")
		// Silent — never reveal whether email exists or if it's an OAuth account
		return nil
	}

	// Invalidate any existing password_reset tokens — only the latest link is valid
	if err := s.repo.ConsumeAllPasswordResetTokens(ctx, user.ID); err != nil {
		s.log.Warn().Err(err).Str("user_id", user.ID.String()).Msg("failed to expire old password reset tokens")
		// Non-fatal — proceed to issue new token
	}

	rawToken, tokenHash := generateToken()
	expiresAt := time.Now().UTC().Add(time.Hour)
	if err := s.repo.CreateToken(ctx, user.ID, tokenHash, "password_reset", expiresAt); err != nil {
		s.log.Error().Err(err).Str("user_id", user.ID.String()).Msg("auth.forgot_password_token_creation_failed")
		return fmt.Errorf("create password reset token: %w", err)
	}

	s.log.Info().Str("user_id", user.ID.String()).Str("email", user.Email).Msg("auth.forgot_password_token_created")

	if s.email == nil {
		s.log.Warn().Str("email", user.Email).Msg("auth.forgot_password_email_sender_not_configured")
		return nil
	}

	s.log.Info().Str("email", user.Email).Str("user_id", user.ID.String()).Msg("auth.forgot_password_sending_email")
	go s.sendPasswordResetEmail(context.Background(), user.FullName, user.Email, rawToken)

	return nil
}

func (s *Service) ResetPassword(ctx context.Context, req ResetPasswordRequest) error {
	tokenHash := hashToken(req.Token)
	stored, err := s.repo.GetValidToken(ctx, tokenHash, "password_reset")
	if err != nil {
		return err
	}

	hash, err := bcrypt.GenerateFromPassword([]byte(req.NewPassword), bcrypt.DefaultCost)
	if err != nil {
		return fmt.Errorf("hash password: %w", err)
	}

	if err := s.repo.UpdatePassword(ctx, stored.UserID, string(hash)); err != nil {
		return fmt.Errorf("update password: %w", err)
	}

	if err := s.repo.ConsumeToken(ctx, tokenHash); err != nil {
		return fmt.Errorf("consume token: %w", err)
	}

	s.log.Info().Str("user_id", stored.UserID.String()).Msg("auth.password_reset")
	return nil
}

// ── Helpers ───────────────────────────────────────────────────────────────────

// IssueAccessToken creates a signed JWT with the given claims.
// Exported so the organisation service can issue tokens after invitation acceptance.
func (s *Service) IssueAccessToken(userID, orgID uuid.UUID, role string, hasSubordinate bool) (string, error) {
	now := time.Now().UTC()
	claims := middleware.Claims{
		RegisteredClaims: jwt.RegisteredClaims{
			Subject:   userID.String(),
			IssuedAt:  jwt.NewNumericDate(now),
			ExpiresAt: jwt.NewNumericDate(now.Add(s.accessTTL)),
		},
		UserID:         userID,
		OrgID:          orgID,
		Role:           role,
		HasSubordinate: hasSubordinate,
	}
	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	return token.SignedString([]byte(s.jwtSecret))
}

func generateToken() (raw, hash string) {
	b := make([]byte, 32)
	_, _ = rand.Read(b)
	raw = hex.EncodeToString(b)
	hash = hashToken(raw)
	return
}

func hashToken(raw string) string {
	sum := sha256.Sum256([]byte(raw))
	return hex.EncodeToString(sum[:])
}

func (s *Service) sendPasswordResetEmail(_ context.Context, fullName, userEmail, resetToken string) {
	resetURL := fmt.Sprintf("%s/reset-password?token=%s", s.appURL, resetToken)

	s.log.Info().Str("email", userEmail).Str("reset_url", resetURL).Msg("auth.rendering_password_reset_email")

	subject, body, _, err := email.PasswordResetTemplate.Render(struct {
		UserName string
		ResetURL string
	}{
		UserName: fullName,
		ResetURL: resetURL,
	})
	if err != nil {
		s.log.Error().Err(err).Str("email", userEmail).Msg("auth.failed_to_render_password_reset_email")
		return
	}

	s.log.Info().Str("email", userEmail).Str("subject", subject).Msg("auth.sending_password_reset_email")

	if err := s.email.Send(email.Message{
		To:      []string{userEmail},
		Subject: subject,
		Body:    body,
		IsHTML:  true,
	}); err != nil {
		s.log.Error().Err(err).Str("email", userEmail).Msg("auth.failed_to_send_password_reset_email")
		return
	}

	s.log.Info().Str("email", userEmail).Msg("auth.password_reset_email_sent")
}

// sendVerificationEmail renders and sends the email verification link.
func (s *Service) sendVerificationEmail(_ context.Context, fullName, userEmail, verifyToken string) {
	verifyURL := fmt.Sprintf("%s/verify-email?token=%s", s.appURL, verifyToken)

	subject, body, _, err := email.VerificationTemplate.Render(struct {
		UserName  string
		VerifyURL string
	}{
		UserName:  fullName,
		VerifyURL: verifyURL,
	})
	if err != nil {
		s.log.Error().Err(err).Str("email", userEmail).Msg("failed to render verification email")
		return
	}

	if err := s.email.Send(email.Message{
		To:      []string{userEmail},
		Subject: subject,
		Body:    body,
		IsHTML:  true,
	}); err != nil {
		s.log.Error().Err(err).Str("email", userEmail).Msg("failed to send verification email")
		return
	}

	s.log.Info().Str("email", userEmail).Msg("auth.verification_email_sent")
}

// GetAppURL returns the frontend app URL
func (s *Service) GetAppURL() string {
	return s.appURL
}

// LogInfo logs an info message with structured fields
func (s *Service) LogInfo(msg string, fields map[string]interface{}) {
	event := s.log.Info()
	for k, v := range fields {
		event = event.Interface(k, v)
	}
	event.Msg(msg)
}

// LogWarn logs a warning message with structured fields
func (s *Service) LogWarn(msg string, fields map[string]interface{}) {
	event := s.log.Warn()
	for k, v := range fields {
		event = event.Interface(k, v)
	}
	event.Msg(msg)
}

// LogError logs an error message with structured fields
func (s *Service) LogError(msg string, err error, fields map[string]interface{}) {
	event := s.log.Error().Err(err)
	for k, v := range fields {
		event = event.Interface(k, v)
	}
	event.Msg(msg)
}

// ── Helpers ───────────────────────────────────────────────────────────────────
