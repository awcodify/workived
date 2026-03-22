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
	"github.com/workived/services/internal/platform/middleware"
	"github.com/workived/services/pkg/apperr"
	"golang.org/x/crypto/bcrypt"
)

// Repo is the interface the auth service requires from its repository.
type Repo interface {
	CreateUser(ctx context.Context, email, passwordHash, fullName string) (*User, error)
	GetUserByEmail(ctx context.Context, email string) (*User, string, error)
	GetUserByID(ctx context.Context, id uuid.UUID) (*User, error)
	MarkEmailVerified(ctx context.Context, userID uuid.UUID) error
	UpdateLastLogin(ctx context.Context, userID uuid.UUID) error
	CreateToken(ctx context.Context, userID uuid.UUID, tokenHash, tokenType string, expiresAt time.Time) error
	GetValidToken(ctx context.Context, tokenHash, tokenType string) (*AuthToken, error)
	ConsumeToken(ctx context.Context, tokenHash string) error
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
}

func NewService(repo Repo, orgRepo OrgRepo, jwtSecret string, accessTTL, refreshTTL time.Duration) *Service {
	return &Service{
		repo:       repo,
		orgRepo:    orgRepo,
		jwtSecret:  jwtSecret,
		accessTTL:  accessTTL,
		refreshTTL: refreshTTL,
	}
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

	// Issue email verification token (stored; sending is out of scope for this sprint)
	rawToken, tokenHash := generateToken()
	expiresAt := time.Now().UTC().Add(24 * time.Hour)
	if err := s.repo.CreateToken(ctx, user.ID, tokenHash, "email_verify", expiresAt); err != nil {
		return nil, fmt.Errorf("create verify token: %w", err)
	}
	_ = rawToken // TODO Sprint 5+: send via SMTP

	return user, nil
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

	// Try to get org context — may be empty if user has not yet created/joined an org
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
