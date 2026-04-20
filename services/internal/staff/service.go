package staff

import (
	"context"
	"fmt"
	"strings"
	"time"

	"github.com/golang-jwt/jwt/v5"
	"github.com/google/uuid"
	"github.com/workived/services/pkg/apperr"
	"golang.org/x/crypto/bcrypt"
)

type Service struct {
	repo      *Repository
	jwtSecret string
	tokenTTL  time.Duration
}

func NewService(repo *Repository, jwtSecret string, tokenTTL time.Duration) *Service {
	return &Service{
		repo:      repo,
		jwtSecret: jwtSecret,
		tokenTTL:  tokenTTL,
	}
}

// Login authenticates an internal admin and returns an access token.
func (s *Service) Login(ctx context.Context, email, password string) (*LoginResponse, error) {
	email = strings.ToLower(email)

	admin, hash, err := s.repo.GetByEmail(ctx, email)
	if err != nil {
		return nil, apperr.New(apperr.CodeUnauthorized, "invalid email or password")
	}

	if err := bcrypt.CompareHashAndPassword([]byte(hash), []byte(password)); err != nil {
		return nil, apperr.New(apperr.CodeUnauthorized, "invalid email or password")
	}

	if !admin.IsActive {
		return nil, apperr.New(apperr.CodeForbidden, "account is deactivated")
	}

	accessToken, err := s.issueToken(admin.ID)
	if err != nil {
		return nil, fmt.Errorf("issue token: %w", err)
	}

	_ = s.repo.UpdateLastLogin(ctx, admin.ID)

	return &LoginResponse{
		AccessToken: accessToken,
		Admin:       admin,
	}, nil
}

// Create creates a new internal admin account (used for initial setup).
func (s *Service) Create(ctx context.Context, email, password, fullName string) (*InternalAdmin, error) {
	email = strings.ToLower(email)

	hash, err := bcrypt.GenerateFromPassword([]byte(password), bcrypt.DefaultCost)
	if err != nil {
		return nil, fmt.Errorf("hash password: %w", err)
	}

	admin, err := s.repo.Create(ctx, email, string(hash), fullName)
	if err != nil {
		return nil, err
	}

	return admin, nil
}

// issueToken creates a signed JWT for an internal admin.
func (s *Service) issueToken(adminID uuid.UUID) (string, error) {
	now := time.Now().UTC()
	claims := Claims{
		RegisteredClaims: jwt.RegisteredClaims{
			Subject:   adminID.String(),
			IssuedAt:  jwt.NewNumericDate(now),
			ExpiresAt: jwt.NewNumericDate(now.Add(s.tokenTTL)),
		},
		InternalAdminID: adminID,
	}
	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	return token.SignedString([]byte(s.jwtSecret))
}
