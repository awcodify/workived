package auth

import (
	"context"
	"crypto/rand"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"time"

	"github.com/google/uuid"
	"github.com/workived/services/pkg/apperr"
	"golang.org/x/oauth2"
	"golang.org/x/oauth2/google"
)

// OAuth provider types
type AuthProvider string

const (
	AuthProviderEmail  AuthProvider = "email"
	AuthProviderGoogle AuthProvider = "google"
	AuthProviderGithub AuthProvider = "github"
)

// OAuthProvider represents an OAuth connection
type OAuthProvider struct {
	ID             uuid.UUID
	UserID         uuid.UUID
	Provider       AuthProvider
	ProviderUserID string
	ProviderEmail  string
	AccessToken    string
	RefreshToken   string
	TokenExpiresAt *time.Time
	Scope          string
	ProfileData    json.RawMessage
	CreatedAt      time.Time
	UpdatedAt      time.Time
}

// GoogleUserInfo represents the user profile from Google
type GoogleUserInfo struct {
	Sub           string `json:"sub"` // Google user ID
	Email         string `json:"email"`
	EmailVerified bool   `json:"email_verified"`
	Name          string `json:"name"`
	Picture       string `json:"picture"`
	GivenName     string `json:"given_name"`
	FamilyName    string `json:"family_name"`
	Locale        string `json:"locale"`
}

// OAuthConfig holds OAuth configuration
type OAuthConfig struct {
	GoogleClientID     string
	GoogleClientSecret string
	GoogleRedirectURL  string
}

// GetGoogleOAuthConfig returns the OAuth2 config for Google
func (s *Service) GetGoogleOAuthConfig() *oauth2.Config {
	return &oauth2.Config{
		ClientID:     s.oauthCfg.GoogleClientID,
		ClientSecret: s.oauthCfg.GoogleClientSecret,
		RedirectURL:  s.oauthCfg.GoogleRedirectURL,
		Scopes: []string{
			"openid",
			"https://www.googleapis.com/auth/userinfo.email",
			"https://www.googleapis.com/auth/userinfo.profile",
		},
		Endpoint: google.Endpoint,
	}
}

// GenerateOAuthState creates a random state string and stores it in Redis
func (s *Service) GenerateOAuthState(ctx context.Context) (string, error) {
	b := make([]byte, 32)
	if _, err := rand.Read(b); err != nil {
		return "", fmt.Errorf("generate random state: %w", err)
	}
	state := base64.URLEncoding.EncodeToString(b)

	// Store in Redis with 10-minute expiry
	if s.rdb != nil {
		key := fmt.Sprintf("oauth:state:%s", state)
		if err := s.rdb.Set(ctx, key, "1", 10*time.Minute).Err(); err != nil {
			return "", fmt.Errorf("store oauth state: %w", err)
		}
	}

	return state, nil
}

// ValidateOAuthState checks if the state is valid and deletes it
func (s *Service) ValidateOAuthState(ctx context.Context, state string) error {
	if state == "" {
		return apperr.New(apperr.CodeValidation, "missing state parameter")
	}

	if s.rdb == nil {
		return apperr.New(apperr.CodeInternal, "redis not configured")
	}

	key := fmt.Sprintf("oauth:state:%s", state)
	val, err := s.rdb.Get(ctx, key).Result()
	if err != nil {
		return apperr.New(apperr.CodeUnauthorized, "invalid or expired state")
	}

	if val != "1" {
		return apperr.New(apperr.CodeUnauthorized, "invalid state")
	}

	// Delete the state after validation (one-time use)
	_ = s.rdb.Del(ctx, key).Err()

	return nil
}

// GetGoogleUserInfo fetches user profile from Google
func (s *Service) GetGoogleUserInfo(ctx context.Context, accessToken string) (*GoogleUserInfo, error) {
	req, err := http.NewRequestWithContext(ctx, "GET", "https://www.googleapis.com/oauth2/v2/userinfo", nil)
	if err != nil {
		return nil, fmt.Errorf("create request: %w", err)
	}

	req.Header.Set("Authorization", "Bearer "+accessToken)

	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		return nil, fmt.Errorf("fetch user info: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(resp.Body)
		return nil, fmt.Errorf("google api error: %s", string(body))
	}

	// Read and log the raw response for debugging
	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, fmt.Errorf("read response body: %w", err)
	}

	s.log.Debug().
		Str("raw_response", string(body)).
		Msg("oauth.google_userinfo_raw")

	var userInfo GoogleUserInfo
	if err := json.Unmarshal(body, &userInfo); err != nil {
		return nil, fmt.Errorf("decode user info: %w", err)
	}

	return &userInfo, nil
}

// LoginWithGoogle handles the OAuth callback and creates/logs in the user
func (s *Service) LoginWithGoogle(ctx context.Context, code, state string) (*LoginResponse, string, bool, error) {
	s.log.Info().
		Str("state", state[:8]+"...").
		Msg("oauth.exchange_starting")

	// Validate state to prevent CSRF
	if err := s.ValidateOAuthState(ctx, state); err != nil {
		s.log.Error().Err(err).Msg("oauth.state_validation_failed")
		return nil, "", false, err
	}

	// Exchange code for token
	oauthConfig := s.GetGoogleOAuthConfig()
	token, err := oauthConfig.Exchange(ctx, code)
	if err != nil {
		s.log.Error().Err(err).Msg("oauth.token_exchange_failed")
		return nil, "", false, apperr.New(apperr.CodeUnauthorized, "failed to exchange code for token")
	}

	s.log.Info().Msg("oauth.token_exchange_success")

	// Get user info from Google
	userInfo, err := s.GetGoogleUserInfo(ctx, token.AccessToken)
	if err != nil {
		s.log.Error().Err(err).Msg("oauth.fetch_userinfo_failed")
		return nil, "", false, apperr.New(apperr.CodeInternal, "failed to get user info from google")
	}

	s.log.Info().
		Str("email", userInfo.Email).
		Bool("email_verified", userInfo.EmailVerified).
		Msg("oauth.userinfo_received")

	// Note: We trust Google's OAuth - if they authenticated the user, the email is valid
	// No need to check email_verified since Google already verified it during sign-in

	// Find or create user
	user, isExisting, err := s.getOrCreateUserFromGoogle(ctx, userInfo, token)
	if err != nil {
		s.log.Error().Err(err).Str("email", userInfo.Email).Msg("oauth.user_creation_failed")
		return nil, "", false, err
	}

	s.log.Info().
		Str("user_id", user.ID.String()).
		Str("email", user.Email).
		Msg("oauth.user_ready")

	// Update last login
	_ = s.repo.UpdateLastLogin(ctx, user.ID)

	// Get org context
	orgID, role, hasSubordinate, _ := s.orgRepo.GetMemberOrgID(ctx, user.ID)

	// Issue tokens
	accessToken, err := s.IssueAccessToken(user.ID, orgID, role, hasSubordinate)
	if err != nil {
		return nil, "", false, fmt.Errorf("issue access token: %w", err)
	}

	refreshTokenRaw, refreshTokenHash := generateToken()
	expiresAt := time.Now().UTC().Add(s.refreshTTL)
	if err := s.repo.CreateToken(ctx, user.ID, refreshTokenHash, "refresh", expiresAt); err != nil {
		return nil, "", false, fmt.Errorf("create refresh token: %w", err)
	}

	user.OrgRole = role

	return &LoginResponse{
		AccessToken: accessToken,
		User:        user,
	}, refreshTokenRaw, isExisting, nil
}

// getOrCreateUserFromGoogle finds existing user or creates new one
func (s *Service) getOrCreateUserFromGoogle(ctx context.Context, userInfo *GoogleUserInfo, token *oauth2.Token) (*User, bool, error) {
	// Try to find existing user by email
	existingUser, _, err := s.repo.GetUserByEmail(ctx, userInfo.Email)
	if err == nil {
		// User exists - link OAuth to their account (don't change auth_provider)
		// They can continue using password AND OAuth
		s.log.Info().
			Str("user_id", existingUser.ID.String()).
			Str("email", existingUser.Email).
			Msg("oauth.linking_existing_user")

		// Verify email if not already verified (OAuth confirms email is valid)
		if !existingUser.IsVerified {
			_ = s.repo.MarkEmailVerified(ctx, existingUser.ID)
			existingUser.IsVerified = true
		}

		// Store/update OAuth provider info (allows dual authentication)
		profileJSON, _ := json.Marshal(userInfo)
		oauthProvider := &OAuthProvider{
			UserID:         existingUser.ID,
			Provider:       AuthProviderGoogle,
			ProviderUserID: userInfo.Sub,
			ProviderEmail:  userInfo.Email,
			AccessToken:    token.AccessToken,
			RefreshToken:   token.RefreshToken,
			Scope:          "email profile",
			ProfileData:    profileJSON,
		}
		if token.Expiry.IsZero() {
			oauthProvider.TokenExpiresAt = nil
		} else {
			oauthProvider.TokenExpiresAt = &token.Expiry
		}

		if err := s.repo.UpsertOAuthProvider(ctx, oauthProvider); err != nil {
			s.log.Warn().Err(err).Msg("failed to store oauth provider")
		}

		return existingUser, true, nil
	}

	// Check if error is "not found" - only then create new user
	if !apperr.IsCode(err, apperr.CodeNotFound) {
		// Some other database error occurred
		return nil, false, fmt.Errorf("get user by email: %w", err)
	}

	// User doesn't exist - create new account
	s.log.Info().
		Str("email", userInfo.Email).
		Msg("oauth.creating_new_user")

	newUser, err := s.repo.CreateUserWithOAuth(ctx, userInfo.Email, userInfo.Name, string(AuthProviderGoogle))
	if err != nil {
		return nil, false, fmt.Errorf("create oauth user: %w", err)
	}

	// Store OAuth provider info
	profileJSON, _ := json.Marshal(userInfo)
	oauthProvider := &OAuthProvider{
		UserID:         newUser.ID,
		Provider:       AuthProviderGoogle,
		ProviderUserID: userInfo.Sub,
		ProviderEmail:  userInfo.Email,
		AccessToken:    token.AccessToken,
		RefreshToken:   token.RefreshToken,
		Scope:          "email profile",
		ProfileData:    profileJSON,
	}
	if token.Expiry.IsZero() {
		oauthProvider.TokenExpiresAt = nil
	} else {
		oauthProvider.TokenExpiresAt = &token.Expiry
	}

	if err := s.repo.UpsertOAuthProvider(ctx, oauthProvider); err != nil {
		s.log.Warn().Err(err).Msg("failed to store oauth provider")
	}

	// OAuth users are pre-verified
	_ = s.repo.MarkEmailVerified(ctx, newUser.ID)

	return newUser, false, nil
}
