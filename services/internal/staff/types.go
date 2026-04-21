package staff

import (
	"time"

	"github.com/golang-jwt/jwt/v5"
	"github.com/google/uuid"
)

// InternalAdmin represents a Workived internal staff member.
type InternalAdmin struct {
	ID          uuid.UUID  `json:"id"`
	Email       string     `json:"email"`
	FullName    string     `json:"full_name"`
	IsActive    bool       `json:"is_active"`
	LastLoginAt *time.Time `json:"last_login_at,omitempty"`
	CreatedAt   time.Time  `json:"created_at"`
}

// LoginResponse contains the access token for an internal admin.
type LoginResponse struct {
	AccessToken string         `json:"access_token"`
	Admin       *InternalAdmin `json:"admin"`
}

// Claims for internal admin JWT tokens.
type Claims struct {
	jwt.RegisteredClaims
	InternalAdminID uuid.UUID `json:"admin_id"`
}
