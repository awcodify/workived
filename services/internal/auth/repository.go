package auth

import (
	"context"
	"errors"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/workived/services/pkg/apperr"
)

type Repository struct {
	db *pgxpool.Pool
}

func NewRepository(db *pgxpool.Pool) *Repository {
	return &Repository{db: db}
}

func (r *Repository) CreateUser(ctx context.Context, email, passwordHash, fullName string) (*User, error) {
	u := &User{}
	err := r.db.QueryRow(ctx, `
		INSERT INTO users (email, password_hash, full_name)
		VALUES ($1, $2, $3)
		RETURNING id, email, full_name, is_verified, is_active, last_login_at, created_at
	`, email, passwordHash, fullName).Scan(
		&u.ID, &u.Email, &u.FullName,
		&u.IsVerified, &u.IsActive, &u.LastLoginAt, &u.CreatedAt,
	)
	if err != nil {
		if isUniqueViolation(err) {
			return nil, apperr.Conflict("a user with this email already exists")
		}
		return nil, err
	}
	return u, nil
}

func (r *Repository) GetUserByEmail(ctx context.Context, email string) (*User, string, error) {
	u := &User{}
	var hash *string // nullable for OAuth users
	err := r.db.QueryRow(ctx, `
		SELECT id, email, full_name, is_verified, is_active, last_login_at, created_at, password_hash
		FROM users
		WHERE email = $1
	`, email).Scan(
		&u.ID, &u.Email, &u.FullName,
		&u.IsVerified, &u.IsActive, &u.LastLoginAt, &u.CreatedAt, &hash,
	)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, "", apperr.NotFound("user")
		}
		return nil, "", err
	}

	// Return empty string if password_hash is NULL (OAuth users)
	hashValue := ""
	if hash != nil {
		hashValue = *hash
	}
	return u, hashValue, nil
}

func (r *Repository) GetUserByID(ctx context.Context, id uuid.UUID) (*User, error) {
	u := &User{}
	err := r.db.QueryRow(ctx, `
		SELECT id, email, full_name, is_verified, is_active, last_login_at, created_at
		FROM users
		WHERE id = $1
	`, id).Scan(
		&u.ID, &u.Email, &u.FullName,
		&u.IsVerified, &u.IsActive, &u.LastLoginAt, &u.CreatedAt,
	)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, apperr.NotFound("user")
		}
		return nil, err
	}
	return u, nil
}

func (r *Repository) MarkEmailVerified(ctx context.Context, userID uuid.UUID) error {
	_, err := r.db.Exec(ctx, `
		UPDATE users SET is_verified = TRUE WHERE id = $1
	`, userID)
	return err
}

func (r *Repository) UpdatePassword(ctx context.Context, userID uuid.UUID, passwordHash string) error {
	_, err := r.db.Exec(ctx, `
		UPDATE users SET password_hash = $1 WHERE id = $2
	`, passwordHash, userID)
	return err
}

func (r *Repository) UpdateLastLogin(ctx context.Context, userID uuid.UUID) error {
	now := time.Now().UTC()
	_, err := r.db.Exec(ctx, `
		UPDATE users SET last_login_at = $1 WHERE id = $2
	`, now, userID)
	return err
}

// ── Token operations ──────────────────────────────────────────────────────────

func (r *Repository) CreateToken(ctx context.Context, userID uuid.UUID, tokenHash, tokenType string, expiresAt time.Time) error {
	_, err := r.db.Exec(ctx, `
		INSERT INTO auth_tokens (user_id, token_hash, token_type, expires_at)
		VALUES ($1, $2, $3, $4)
	`, userID, tokenHash, tokenType, expiresAt)
	return err
}

func (r *Repository) GetValidToken(ctx context.Context, tokenHash, tokenType string) (*AuthToken, error) {
	t := &AuthToken{}
	err := r.db.QueryRow(ctx, `
		SELECT id, user_id, token_hash, token_type, expires_at, used_at, created_at
		FROM auth_tokens
		WHERE token_hash = $1
		  AND token_type = $2
		  AND expires_at > NOW()
		  AND used_at IS NULL
	`, tokenHash, tokenType).Scan(
		&t.ID, &t.UserID, &t.TokenHash, &t.TokenType,
		&t.ExpiresAt, &t.UsedAt, &t.CreatedAt,
	)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, apperr.New(apperr.CodeUnauthorized, "token is invalid or expired")
		}
		return nil, err
	}
	return t, nil
}

func (r *Repository) ConsumeAllPasswordResetTokens(ctx context.Context, userID uuid.UUID) error {
	now := time.Now().UTC()
	_, err := r.db.Exec(ctx, `
		UPDATE auth_tokens SET used_at = $1
		WHERE user_id = $2
		  AND token_type = 'password_reset'
		  AND used_at IS NULL
		  AND expires_at > NOW()
	`, now, userID)
	return err
}

func (r *Repository) ConsumeAllTokensByType(ctx context.Context, userID uuid.UUID, tokenType string) error {
	now := time.Now().UTC()
	_, err := r.db.Exec(ctx, `
		UPDATE auth_tokens SET used_at = $1
		WHERE user_id = $2
		  AND token_type = $3
		  AND used_at IS NULL
		  AND expires_at > NOW()
	`, now, userID, tokenType)
	return err
}

func (r *Repository) ConsumeToken(ctx context.Context, tokenHash string) error {
	now := time.Now().UTC()
	tag, err := r.db.Exec(ctx, `
		UPDATE auth_tokens SET used_at = $1
		WHERE token_hash = $2 AND used_at IS NULL
	`, now, tokenHash)
	if err != nil {
		return err
	}
	if tag.RowsAffected() == 0 {
		return apperr.New(apperr.CodeUnauthorized, "token already used")
	}
	return nil
}

// isUniqueViolation detects PostgreSQL unique constraint errors (code 23505).
func isUniqueViolation(err error) bool {
	return err != nil && len(err.Error()) > 0 &&
		containsCode(err.Error(), "23505")
}

func containsCode(msg, code string) bool {
	for i := 0; i+len(code) <= len(msg); i++ {
		if msg[i:i+len(code)] == code {
			return true
		}
	}
	return false
}

// ── OAuth Provider Methods ────────────────────────────────────────────────────

// CreateUserWithOAuth creates a user account for OAuth authentication
func (r *Repository) CreateUserWithOAuth(ctx context.Context, email, fullName, provider string) (*User, error) {
	u := &User{}
	err := r.db.QueryRow(ctx, `
		INSERT INTO users (email, password_hash, full_name, auth_provider, is_verified)
		VALUES ($1, NULL, $2, $3, true)
		RETURNING id, email, full_name, is_verified, is_active, last_login_at, created_at
	`, email, fullName, provider).Scan(
		&u.ID, &u.Email, &u.FullName,
		&u.IsVerified, &u.IsActive, &u.LastLoginAt, &u.CreatedAt,
	)
	if err != nil {
		if isUniqueViolation(err) {
			return nil, apperr.Conflict("a user with this email already exists")
		}
		return nil, err
	}
	return u, nil
}

// UpsertOAuthProvider creates or updates OAuth provider connection
func (r *Repository) UpsertOAuthProvider(ctx context.Context, provider *OAuthProvider) error {
	_, err := r.db.Exec(ctx, `
		INSERT INTO user_oauth_providers (
			user_id, provider, provider_user_id, provider_email,
			access_token, refresh_token, token_expires_at, scope, profile_data
		) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
		ON CONFLICT (user_id, provider)
		DO UPDATE SET
			provider_user_id = EXCLUDED.provider_user_id,
			provider_email = EXCLUDED.provider_email,
			access_token = EXCLUDED.access_token,
			refresh_token = EXCLUDED.refresh_token,
			token_expires_at = EXCLUDED.token_expires_at,
			scope = EXCLUDED.scope,
			profile_data = EXCLUDED.profile_data,
			updated_at = NOW()
	`,
		provider.UserID,
		provider.Provider,
		provider.ProviderUserID,
		provider.ProviderEmail,
		provider.AccessToken,
		provider.RefreshToken,
		provider.TokenExpiresAt,
		provider.Scope,
		provider.ProfileData,
	)
	return err
}

// GetOAuthProvider retrieves OAuth provider connection
func (r *Repository) GetOAuthProvider(ctx context.Context, userID uuid.UUID, provider AuthProvider) (*OAuthProvider, error) {
	p := &OAuthProvider{}
	err := r.db.QueryRow(ctx, `
		SELECT id, user_id, provider, provider_user_id, provider_email,
		       access_token, refresh_token, token_expires_at, scope, profile_data,
		       created_at, updated_at
		FROM user_oauth_providers
		WHERE user_id = $1 AND provider = $2
	`, userID, provider).Scan(
		&p.ID, &p.UserID, &p.Provider, &p.ProviderUserID, &p.ProviderEmail,
		&p.AccessToken, &p.RefreshToken, &p.TokenExpiresAt, &p.Scope, &p.ProfileData,
		&p.CreatedAt, &p.UpdatedAt,
	)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, apperr.NotFound("oauth provider not found")
		}
		return nil, err
	}
	return p, nil
}
