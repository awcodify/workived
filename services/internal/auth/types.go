package auth

import (
	"time"

	"github.com/google/uuid"
)

// ── Domain types ──────────────────────────────────────────────────────────────

type User struct {
	ID           uuid.UUID  `json:"id"`
	Email        string     `json:"email"`
	FullName     string     `json:"full_name"`
	IsVerified   bool       `json:"is_verified"`
	IsActive     bool       `json:"is_active"`
	LastLoginAt  *time.Time `json:"last_login_at,omitempty"`
	CreatedAt    time.Time  `json:"created_at"`
}

type AuthToken struct {
	ID        uuid.UUID
	UserID    uuid.UUID
	TokenHash string
	TokenType string
	ExpiresAt time.Time
	UsedAt    *time.Time
	CreatedAt time.Time
}

// ── Request / Response types ──────────────────────────────────────────────────

type RegisterRequest struct {
	Email    string `json:"email" validate:"required,email,max=255"`
	Password string `json:"password" validate:"required,min=8,max=72"`
	FullName string `json:"full_name" validate:"required,min=1,max=255"`
}

type LoginRequest struct {
	Email    string `json:"email" validate:"required,email"`
	Password string `json:"password" validate:"required"`
}

type LoginResponse struct {
	AccessToken string `json:"access_token"`
	User        *User  `json:"user"`
}

type RefreshRequest struct {
	RefreshToken string `json:"refresh_token" validate:"required"`
}

type RefreshResponse struct {
	AccessToken string `json:"access_token"`
}

type VerifyEmailRequest struct {
	Token string `json:"token" validate:"required"`
}
