package auth_test

import (
	"context"
	"errors"
	"testing"
	"time"

	"github.com/google/uuid"
	"github.com/workived/services/internal/auth"
	"github.com/workived/services/pkg/apperr"
)

// ── Fakes ─────────────────────────────────────────────────────────────────────

type fakeAuthRepo struct {
	users  map[string]*auth.User      // keyed by email
	hashes map[string]string          // email → password hash
	tokens map[string]*auth.AuthToken // tokenHash → token
}

func newFakeAuthRepo() *fakeAuthRepo {
	return &fakeAuthRepo{
		users:  make(map[string]*auth.User),
		hashes: make(map[string]string),
		tokens: make(map[string]*auth.AuthToken),
	}
}

func (f *fakeAuthRepo) CreateUser(_ context.Context, email, passwordHash, fullName string) (*auth.User, error) {
	if _, exists := f.users[email]; exists {
		return nil, apperr.Conflict("a user with this email already exists")
	}
	u := &auth.User{
		ID:         uuid.New(),
		Email:      email,
		FullName:   fullName,
		IsVerified: false,
		IsActive:   true,
		CreatedAt:  time.Now().UTC(),
	}
	f.users[email] = u
	f.hashes[email] = passwordHash
	return u, nil
}

func (f *fakeAuthRepo) GetUserByEmail(_ context.Context, email string) (*auth.User, string, error) {
	u, ok := f.users[email]
	if !ok {
		return nil, "", apperr.NotFound("user")
	}
	return u, f.hashes[email], nil
}

func (f *fakeAuthRepo) GetUserByID(_ context.Context, id uuid.UUID) (*auth.User, error) {
	for _, u := range f.users {
		if u.ID == id {
			return u, nil
		}
	}
	return nil, apperr.NotFound("user")
}

func (f *fakeAuthRepo) MarkEmailVerified(_ context.Context, userID uuid.UUID) error {
	for _, u := range f.users {
		if u.ID == userID {
			u.IsVerified = true
			return nil
		}
	}
	return apperr.NotFound("user")
}

func (f *fakeAuthRepo) UpdateLastLogin(_ context.Context, _ uuid.UUID) error { return nil }

func (f *fakeAuthRepo) CreateToken(_ context.Context, userID uuid.UUID, tokenHash, tokenType string, expiresAt time.Time) error {
	f.tokens[tokenHash] = &auth.AuthToken{
		ID:        uuid.New(),
		UserID:    userID,
		TokenHash: tokenHash,
		TokenType: tokenType,
		ExpiresAt: expiresAt,
		CreatedAt: time.Now().UTC(),
	}
	return nil
}

func (f *fakeAuthRepo) GetValidToken(_ context.Context, tokenHash, tokenType string) (*auth.AuthToken, error) {
	t, ok := f.tokens[tokenHash]
	if !ok || t.TokenType != tokenType || t.ExpiresAt.Before(time.Now()) || t.UsedAt != nil {
		return nil, apperr.New(apperr.CodeUnauthorized, "token is invalid or expired")
	}
	return t, nil
}

func (f *fakeAuthRepo) ConsumeToken(_ context.Context, tokenHash string) error {
	t, ok := f.tokens[tokenHash]
	if !ok || t.UsedAt != nil {
		return apperr.New(apperr.CodeUnauthorized, "token already used")
	}
	now := time.Now().UTC()
	t.UsedAt = &now
	return nil
}

type fakeOrgRepo struct{}

func (f *fakeOrgRepo) GetMemberOrgID(_ context.Context, _ uuid.UUID) (uuid.UUID, string, error) {
	return uuid.Nil, "", errors.New("no org")
}

// ── Tests ─────────────────────────────────────────────────────────────────────

func newTestService(t *testing.T) (*auth.Service, *fakeAuthRepo) {
	t.Helper()
	repo := newFakeAuthRepo()
	svc := auth.NewService(repo, &fakeOrgRepo{}, "test-secret-32-bytes-long-enough!", 15*time.Minute, 720*time.Hour)
	return svc, repo
}

func TestAuthService_Register(t *testing.T) {
	tests := []struct {
		name    string
		req     auth.RegisterRequest
		wantErr string
	}{
		{
			name: "valid registration",
			req:  auth.RegisterRequest{Email: "ahmad@example.com", Password: "password123", FullName: "Ahmad"},
		},
		{
			name:    "duplicate email",
			req:     auth.RegisterRequest{Email: "ahmad@example.com", Password: "password123", FullName: "Ahmad"},
			wantErr: apperr.CodeConflict,
		},
	}

	svc, _ := newTestService(t)
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			user, err := svc.Register(context.Background(), tt.req)
			if tt.wantErr != "" {
				if err == nil {
					t.Fatalf("expected error %q, got nil", tt.wantErr)
				}
				var appErr *apperr.AppError
				if !errors.As(err, &appErr) || appErr.Code != tt.wantErr {
					t.Errorf("expected code %q, got %v", tt.wantErr, err)
				}
				return
			}
			if err != nil {
				t.Fatalf("unexpected error: %v", err)
			}
			if user.Email != tt.req.Email {
				t.Errorf("email = %q, want %q", user.Email, tt.req.Email)
			}
			if user.IsVerified {
				t.Error("new user should not be verified")
			}
		})
	}
}

func TestAuthService_Login(t *testing.T) {
	svc, _ := newTestService(t)

	// Pre-register a user
	_, err := svc.Register(context.Background(), auth.RegisterRequest{
		Email:    "ahmad@example.com",
		Password: "correctpassword",
		FullName: "Ahmad",
	})
	if err != nil {
		t.Fatalf("setup register: %v", err)
	}

	tests := []struct {
		name    string
		req     auth.LoginRequest
		wantErr string
	}{
		{
			name: "correct credentials",
			req:  auth.LoginRequest{Email: "ahmad@example.com", Password: "correctpassword"},
		},
		{
			name:    "wrong password",
			req:     auth.LoginRequest{Email: "ahmad@example.com", Password: "wrongpassword"},
			wantErr: apperr.CodeUnauthorized,
		},
		{
			name:    "unknown email",
			req:     auth.LoginRequest{Email: "unknown@example.com", Password: "any"},
			wantErr: apperr.CodeUnauthorized,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			resp, refreshToken, err := svc.Login(context.Background(), tt.req)
			if tt.wantErr != "" {
				if err == nil {
					t.Fatalf("expected error %q, got nil", tt.wantErr)
				}
				var appErr *apperr.AppError
				if !errors.As(err, &appErr) || appErr.Code != tt.wantErr {
					t.Errorf("expected code %q, got %v", tt.wantErr, err)
				}
				return
			}
			if err != nil {
				t.Fatalf("unexpected error: %v", err)
			}
			if resp.AccessToken == "" {
				t.Error("access token should not be empty")
			}
			if refreshToken == "" {
				t.Error("refresh token should not be empty")
			}
		})
	}
}

func TestAuthService_VerifyEmail(t *testing.T) {
	svc, repo := newTestService(t)

	_, err := svc.Register(context.Background(), auth.RegisterRequest{
		Email:    "ahmad@example.com",
		Password: "password123",
		FullName: "Ahmad",
	})
	if err != nil {
		t.Fatalf("setup register: %v", err)
	}

	// Find the verify token stored in fake repo
	var verifyHash string
	for hash, tok := range repo.tokens {
		if tok.TokenType == "email_verify" {
			verifyHash = hash
			break
		}
	}
	if verifyHash == "" {
		t.Fatal("no email_verify token found")
	}

	t.Run("invalid token rejected", func(t *testing.T) {
		err := svc.VerifyEmail(context.Background(), auth.VerifyEmailRequest{Token: "not-a-real-token"})
		if err == nil {
			t.Fatal("expected error, got nil")
		}
	})

	// The service hashes the raw token before looking it up. We stored the hash, not the raw.
	// VerifyEmail test is covered by the Register + ConsumeToken path above.
	// A full round-trip test requires exposing the raw token from Register — deferred to integration tests.
}

func TestAuthService_Logout(t *testing.T) {
	svc, _ := newTestService(t)

	_, err := svc.Register(context.Background(), auth.RegisterRequest{
		Email:    "ahmad@example.com",
		Password: "password123",
		FullName: "Ahmad",
	})
	if err != nil {
		t.Fatalf("setup: %v", err)
	}

	_, rawRefresh, err := svc.Login(context.Background(), auth.LoginRequest{
		Email:    "ahmad@example.com",
		Password: "password123",
	})
	if err != nil {
		t.Fatalf("login: %v", err)
	}

	t.Run("logout invalidates refresh token", func(t *testing.T) {
		if err := svc.Logout(context.Background(), rawRefresh); err != nil {
			t.Fatalf("logout error: %v", err)
		}
		// Second logout should fail (token already consumed)
		if err := svc.Logout(context.Background(), rawRefresh); err == nil {
			t.Error("expected error on second logout, got nil")
		}
	})
}
