package auth_test

import (
	"context"
	"errors"
	"sync"
	"testing"
	"time"

	"github.com/google/uuid"
	"github.com/workived/services/internal/auth"
	"github.com/workived/services/pkg/apperr"
	"github.com/workived/services/pkg/email"
)

// ── Fakes ─────────────────────────────────────────────────────────────────────

type fakeAuthRepo struct {
	users  map[string]*auth.User      // keyed by email
	hashes map[string]string          // email → password hash
	tokens map[string]*auth.AuthToken // tokenHash → token

	// Error injection hooks — set these to force specific errors
	createTokenErr    error
	getUserByIDErr    error
	consumeTokenErr   error
	markVerifiedErr   error
	updatePasswordErr error
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

func (f *fakeAuthRepo) CreateUserWithOAuth(_ context.Context, email, fullName, provider string) (*auth.User, error) {
	if _, exists := f.users[email]; exists {
		return nil, apperr.Conflict("a user with this email already exists")
	}
	u := &auth.User{
		ID:         uuid.New(),
		Email:      email,
		FullName:   fullName,
		IsVerified: true, // OAuth users are pre-verified
		IsActive:   true,
		CreatedAt:  time.Now().UTC(),
	}
	f.users[email] = u
	f.hashes[email] = "" // OAuth users have no password hash
	return u, nil
}

func (f *fakeAuthRepo) UpsertOAuthProvider(_ context.Context, provider *auth.OAuthProvider) error {
	return nil // Not needed for password reset tests
}

func (f *fakeAuthRepo) GetOAuthProvider(_ context.Context, userID uuid.UUID, provider auth.AuthProvider) (*auth.OAuthProvider, error) {
	return nil, apperr.NotFound("oauth provider")
}

func (f *fakeAuthRepo) GetUserByEmail(_ context.Context, email string) (*auth.User, string, error) {
	u, ok := f.users[email]
	if !ok {
		return nil, "", apperr.NotFound("user")
	}
	return u, f.hashes[email], nil
}

func (f *fakeAuthRepo) GetUserByID(_ context.Context, id uuid.UUID) (*auth.User, error) {
	if f.getUserByIDErr != nil {
		return nil, f.getUserByIDErr
	}
	for _, u := range f.users {
		if u.ID == id {
			return u, nil
		}
	}
	return nil, apperr.NotFound("user")
}

func (f *fakeAuthRepo) MarkEmailVerified(_ context.Context, userID uuid.UUID) error {
	if f.markVerifiedErr != nil {
		return f.markVerifiedErr
	}
	for _, u := range f.users {
		if u.ID == userID {
			u.IsVerified = true
			return nil
		}
	}
	return apperr.NotFound("user")
}

func (f *fakeAuthRepo) UpdateLastLogin(_ context.Context, _ uuid.UUID) error { return nil }

func (f *fakeAuthRepo) ConsumeAllPasswordResetTokens(_ context.Context, userID uuid.UUID) error {
	now := time.Now().UTC()
	for _, tok := range f.tokens {
		if tok.UserID == userID && tok.TokenType == "password_reset" && tok.UsedAt == nil && tok.ExpiresAt.After(time.Now()) {
			tok.UsedAt = &now
		}
	}
	return nil
}

func (f *fakeAuthRepo) ConsumeAllTokensByType(_ context.Context, userID uuid.UUID, tokenType string) error {
	now := time.Now().UTC()
	for _, tok := range f.tokens {
		if tok.UserID == userID && tok.TokenType == tokenType && tok.UsedAt == nil && tok.ExpiresAt.After(time.Now()) {
			tok.UsedAt = &now
		}
	}
	return nil
}

func (f *fakeAuthRepo) UpdatePassword(_ context.Context, userID uuid.UUID, passwordHash string) error {
	if f.updatePasswordErr != nil {
		return f.updatePasswordErr
	}
	for email, u := range f.users {
		if u.ID == userID {
			f.hashes[email] = passwordHash
			return nil
		}
	}
	return apperr.NotFound("user")
}

func (f *fakeAuthRepo) CreateToken(_ context.Context, userID uuid.UUID, tokenHash, tokenType string, expiresAt time.Time) error {
	if f.createTokenErr != nil {
		return f.createTokenErr
	}
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
	if f.consumeTokenErr != nil {
		return f.consumeTokenErr
	}
	t, ok := f.tokens[tokenHash]
	if !ok || t.UsedAt != nil {
		return apperr.New(apperr.CodeUnauthorized, "token already used")
	}
	now := time.Now().UTC()
	t.UsedAt = &now
	return nil
}

type fakeOrgRepo struct{}

func (f *fakeOrgRepo) GetMemberOrgID(_ context.Context, _ uuid.UUID) (uuid.UUID, string, bool, error) {
	return uuid.Nil, "", false, errors.New("no org")
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
	t.Run("invalid token rejected", func(t *testing.T) {
		svc, _ := newTestService(t)
		err := svc.VerifyEmail(context.Background(), auth.VerifyEmailRequest{Token: "not-a-real-token"})
		if err == nil {
			t.Fatal("expected error, got nil")
		}
		var appErr *apperr.AppError
		if !errors.As(err, &appErr) || appErr.Code != apperr.CodeUnauthorized {
			t.Errorf("expected UNAUTHORIZED, got %v", err)
		}
	})

	t.Run("double-consume rejected", func(t *testing.T) {
		svc, repo := newTestService(t)
		_, _ = svc.Register(context.Background(), auth.RegisterRequest{
			Email: "v@example.com", Password: "password123", FullName: "Verify",
		})

		// Find the raw verify token — repo stores hash, so we store raw in a patched version.
		// Instead inject a known token directly into the fake repo.
		const raw = "known-raw-verify-token"
		repo.tokens[auth.HashTokenForTest(raw)] = &auth.AuthToken{
			ID:        uuid.New(),
			UserID:    repo.users["v@example.com"].ID,
			TokenHash: auth.HashTokenForTest(raw),
			TokenType: "email_verify",
			ExpiresAt: time.Now().Add(time.Hour),
		}

		if err := svc.VerifyEmail(context.Background(), auth.VerifyEmailRequest{Token: raw}); err != nil {
			t.Fatalf("first verify: %v", err)
		}
		if err := svc.VerifyEmail(context.Background(), auth.VerifyEmailRequest{Token: raw}); err == nil {
			t.Fatal("expected error on second verify, got nil")
		}
	})
}

func TestAuthService_Refresh(t *testing.T) {
	t.Run("success rotates tokens", func(t *testing.T) {
		svc, _ := newTestService(t)
		_, _ = svc.Register(context.Background(), auth.RegisterRequest{
			Email: "r@example.com", Password: "password123", FullName: "Refresh",
		})
		_, rawRefresh, err := svc.Login(context.Background(), auth.LoginRequest{
			Email: "r@example.com", Password: "password123",
		})
		if err != nil {
			t.Fatalf("login: %v", err)
		}

		resp, newRefresh, err := svc.Refresh(context.Background(), rawRefresh)
		if err != nil {
			t.Fatalf("refresh: %v", err)
		}
		if resp.AccessToken == "" {
			t.Error("access token should not be empty")
		}
		if newRefresh == rawRefresh {
			t.Error("refresh token should be rotated")
		}
	})

	t.Run("consumed token rejected", func(t *testing.T) {
		svc, _ := newTestService(t)
		_, _ = svc.Register(context.Background(), auth.RegisterRequest{
			Email: "r2@example.com", Password: "password123", FullName: "Refresh2",
		})
		_, rawRefresh, _ := svc.Login(context.Background(), auth.LoginRequest{
			Email: "r2@example.com", Password: "password123",
		})

		// Use the token once
		_, _, err := svc.Refresh(context.Background(), rawRefresh)
		if err != nil {
			t.Fatalf("first refresh: %v", err)
		}

		// Attempt to reuse the old token
		_, _, err = svc.Refresh(context.Background(), rawRefresh)
		if err == nil {
			t.Fatal("expected error on reuse, got nil")
		}
	})

	t.Run("invalid token rejected", func(t *testing.T) {
		svc, _ := newTestService(t)
		_, _, err := svc.Refresh(context.Background(), "garbage-token")
		if err == nil {
			t.Fatal("expected error, got nil")
		}
		var appErr *apperr.AppError
		if !errors.As(err, &appErr) || appErr.Code != apperr.CodeUnauthorized {
			t.Errorf("expected UNAUTHORIZED, got %v", err)
		}
	})
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

// ── Email sending tests ──────────────────────────────────────────────────────

type spyEmailSender struct {
	mu       sync.Mutex
	messages []email.Message
}

func (s *spyEmailSender) Send(msg email.Message) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.messages = append(s.messages, msg)
	return nil
}

func (s *spyEmailSender) sent() []email.Message {
	s.mu.Lock()
	defer s.mu.Unlock()
	return append([]email.Message(nil), s.messages...)
}

func TestAuthService_Register_SendsVerificationEmail(t *testing.T) {
	repo := newFakeAuthRepo()
	spy := &spyEmailSender{}
	svc := auth.NewService(repo, &fakeOrgRepo{}, "test-secret-32-bytes-long-enough!", 15*time.Minute, 720*time.Hour,
		auth.WithEmailSender(spy),
		auth.WithAppURL("https://app.workived.com"),
	)

	_, err := svc.Register(context.Background(), auth.RegisterRequest{
		Email: "welcome@example.com", Password: "password123", FullName: "Welcome User",
	})
	if err != nil {
		t.Fatalf("register: %v", err)
	}

	// Wait briefly for async goroutine
	time.Sleep(100 * time.Millisecond)

	msgs := spy.sent()
	if len(msgs) != 1 {
		t.Fatalf("expected 1 email, got %d", len(msgs))
	}
	if msgs[0].To[0] != "welcome@example.com" {
		t.Errorf("expected to=welcome@example.com, got %s", msgs[0].To[0])
	}
	if msgs[0].Subject != "Verify your email to continue" {
		t.Errorf("expected verification subject, got %q", msgs[0].Subject)
	}
	if !msgs[0].IsHTML {
		t.Error("expected HTML email")
	}
}

func TestAuthService_Register_NoEmailSender_NoError(t *testing.T) {
	repo := newFakeAuthRepo()
	svc := auth.NewService(repo, &fakeOrgRepo{}, "test-secret-32-bytes-long-enough!", 15*time.Minute, 720*time.Hour)

	user, err := svc.Register(context.Background(), auth.RegisterRequest{
		Email: "no-email@example.com", Password: "password123", FullName: "No Email",
	})
	if err != nil {
		t.Fatalf("register: %v", err)
	}
	if user.Email != "no-email@example.com" {
		t.Errorf("email = %q, want no-email@example.com", user.Email)
	}
}

// ── Error path coverage ───────────────────────────────────────────────────────

func TestAuthService_Register_CreateTokenError(t *testing.T) {
	repo := newFakeAuthRepo()
	svc := auth.NewService(repo, &fakeOrgRepo{}, "test-secret-32-bytes-long-enough!", 15*time.Minute, 720*time.Hour)

	// CreateUser succeeds; CreateToken then fails
	repo.createTokenErr = errors.New("db down")

	_, err := svc.Register(context.Background(), auth.RegisterRequest{
		Email: "e@example.com", Password: "password123", FullName: "E",
	})
	if err == nil {
		t.Fatal("expected error from CreateToken failure, got nil")
	}
}

func TestAuthService_Login_InactiveUser(t *testing.T) {
	repo := newFakeAuthRepo()
	svc := auth.NewService(repo, &fakeOrgRepo{}, "test-secret-32-bytes-long-enough!", 15*time.Minute, 720*time.Hour)

	// Register, then mark inactive
	_, _ = svc.Register(context.Background(), auth.RegisterRequest{
		Email: "inactive@example.com", Password: "password123", FullName: "Inactive",
	})
	repo.users["inactive@example.com"].IsActive = false
	// Reset CreateToken error so Login can proceed past user creation
	repo.createTokenErr = nil

	_, _, err := svc.Login(context.Background(), auth.LoginRequest{
		Email: "inactive@example.com", Password: "password123",
	})
	if err == nil {
		t.Fatal("expected error for inactive user, got nil")
	}
	var appErr *apperr.AppError
	if !errors.As(err, &appErr) || appErr.Code != apperr.CodeForbidden {
		t.Errorf("expected FORBIDDEN, got %v", err)
	}
}

func TestAuthService_Login_CreateTokenError(t *testing.T) {
	repo := newFakeAuthRepo()
	svc := auth.NewService(repo, &fakeOrgRepo{}, "test-secret-32-bytes-long-enough!", 15*time.Minute, 720*time.Hour)

	_, _ = svc.Register(context.Background(), auth.RegisterRequest{
		Email: "tok@example.com", Password: "password123", FullName: "Tok",
	})
	// Now make CreateToken fail for the refresh token issued on login
	repo.createTokenErr = errors.New("db down")

	_, _, err := svc.Login(context.Background(), auth.LoginRequest{
		Email: "tok@example.com", Password: "password123",
	})
	if err == nil {
		t.Fatal("expected error when refresh token creation fails, got nil")
	}
}

func TestAuthService_Refresh_GetUserByIDError(t *testing.T) {
	repo := newFakeAuthRepo()
	svc := auth.NewService(repo, &fakeOrgRepo{}, "test-secret-32-bytes-long-enough!", 15*time.Minute, 720*time.Hour)

	_, _ = svc.Register(context.Background(), auth.RegisterRequest{
		Email: "ref@example.com", Password: "password123", FullName: "Ref",
	})
	_, rawRefresh, _ := svc.Login(context.Background(), auth.LoginRequest{
		Email: "ref@example.com", Password: "password123",
	})

	repo.getUserByIDErr = errors.New("db error")

	_, _, err := svc.Refresh(context.Background(), rawRefresh)
	if err == nil {
		t.Fatal("expected error when GetUserByID fails, got nil")
	}
}

func TestAuthService_Refresh_ConsumeTokenError(t *testing.T) {
	repo := newFakeAuthRepo()
	svc := auth.NewService(repo, &fakeOrgRepo{}, "test-secret-32-bytes-long-enough!", 15*time.Minute, 720*time.Hour)

	_, _ = svc.Register(context.Background(), auth.RegisterRequest{
		Email: "con@example.com", Password: "password123", FullName: "Con",
	})
	_, rawRefresh, _ := svc.Login(context.Background(), auth.LoginRequest{
		Email: "con@example.com", Password: "password123",
	})

	repo.consumeTokenErr = errors.New("db error")

	_, _, err := svc.Refresh(context.Background(), rawRefresh)
	if err == nil {
		t.Fatal("expected error when ConsumeToken fails, got nil")
	}
}

func TestAuthService_Refresh_RotateCreateTokenError(t *testing.T) {
	repo := newFakeAuthRepo()
	svc := auth.NewService(repo, &fakeOrgRepo{}, "test-secret-32-bytes-long-enough!", 15*time.Minute, 720*time.Hour)

	_, _ = svc.Register(context.Background(), auth.RegisterRequest{
		Email: "rot@example.com", Password: "password123", FullName: "Rot",
	})
	_, rawRefresh, _ := svc.Login(context.Background(), auth.LoginRequest{
		Email: "rot@example.com", Password: "password123",
	})

	// Fail CreateToken after ConsumeToken succeeds (second CreateToken call during rotation)
	callCount := 0
	origErr := repo.createTokenErr
	_ = origErr
	// Use consumeTokenErr=nil, createTokenErr set after first successful consume
	// Trick: we intercept after ConsumeToken by setting createTokenErr just-in-time
	// Instead, make createTokenErr fail only for "refresh" type — simplest: just set it now
	// ConsumeToken will succeed (it checks its own err field), but CreateToken for new refresh will fail
	repo.createTokenErr = errors.New("db down")
	_ = callCount

	_, _, err := svc.Refresh(context.Background(), rawRefresh)
	if err == nil {
		t.Fatal("expected error when new refresh token creation fails")
	}
}

func TestAuthService_VerifyEmail_ConsumeTokenError(t *testing.T) {
	repo := newFakeAuthRepo()
	svc := auth.NewService(repo, &fakeOrgRepo{}, "test-secret-32-bytes-long-enough!", 15*time.Minute, 720*time.Hour)

	_, _ = svc.Register(context.Background(), auth.RegisterRequest{
		Email: "ct@example.com", Password: "password123", FullName: "CT",
	})

	const raw = "known-consume-error-token"
	repo.tokens[auth.HashTokenForTest(raw)] = &auth.AuthToken{
		ID:        uuid.New(),
		UserID:    repo.users["ct@example.com"].ID,
		TokenHash: auth.HashTokenForTest(raw),
		TokenType: "email_verify",
		ExpiresAt: time.Now().Add(time.Hour),
	}
	repo.consumeTokenErr = errors.New("db error on consume")

	err := svc.VerifyEmail(context.Background(), auth.VerifyEmailRequest{Token: raw})
	if err == nil {
		t.Fatal("expected error when ConsumeToken fails, got nil")
	}
}

func TestAuthService_VerifyEmail_MarkVerifiedError(t *testing.T) {
	repo := newFakeAuthRepo()
	svc := auth.NewService(repo, &fakeOrgRepo{}, "test-secret-32-bytes-long-enough!", 15*time.Minute, 720*time.Hour)

	_, _ = svc.Register(context.Background(), auth.RegisterRequest{
		Email: "mv@example.com", Password: "password123", FullName: "MV",
	})

	const raw = "known-mark-verify-token"
	repo.tokens[auth.HashTokenForTest(raw)] = &auth.AuthToken{
		ID:        uuid.New(),
		UserID:    repo.users["mv@example.com"].ID,
		TokenHash: auth.HashTokenForTest(raw),
		TokenType: "email_verify",
		ExpiresAt: time.Now().Add(time.Hour),
	}
	repo.markVerifiedErr = errors.New("db error")

	err := svc.VerifyEmail(context.Background(), auth.VerifyEmailRequest{Token: raw})
	if err == nil {
		t.Fatal("expected error when MarkEmailVerified fails, got nil")
	}
}

// ── ForgotPassword / ResetPassword ───────────────────────────────────────────

func TestAuthService_ForgotPassword(t *testing.T) {
	t.Run("unknown email returns nil (no info leakage)", func(t *testing.T) {
		svc, _ := newTestService(t)
		err := svc.ForgotPassword(context.Background(), auth.ForgotPasswordRequest{
			Email: "nobody@example.com",
		})
		if err != nil {
			t.Fatalf("expected nil for unknown email, got %v", err)
		}
	})

	t.Run("known email issues token", func(t *testing.T) {
		svc, repo := newTestService(t)
		_, _ = svc.Register(context.Background(), auth.RegisterRequest{
			Email: "fp@example.com", Password: "password123", FullName: "FP User",
		})
		if err := svc.ForgotPassword(context.Background(), auth.ForgotPasswordRequest{
			Email: "fp@example.com",
		}); err != nil {
			t.Fatalf("forgot password: %v", err)
		}
		// Exactly one password_reset token should exist
		count := 0
		for _, tok := range repo.tokens {
			if tok.TokenType == "password_reset" {
				count++
			}
		}
		if count != 1 {
			t.Errorf("expected 1 password_reset token, got %d", count)
		}
	})

	t.Run("create token error is propagated", func(t *testing.T) {
		svc, repo := newTestService(t)
		_, _ = svc.Register(context.Background(), auth.RegisterRequest{
			Email: "fp2@example.com", Password: "password123", FullName: "FP2",
		})
		repo.createTokenErr = errors.New("db error")
		err := svc.ForgotPassword(context.Background(), auth.ForgotPasswordRequest{
			Email: "fp2@example.com",
		})
		if err == nil {
			t.Fatal("expected error when CreateToken fails, got nil")
		}
	})

	t.Run("previous password_reset tokens are invalidated on new request", func(t *testing.T) {
		svc, repo := newTestService(t)
		_, _ = svc.Register(context.Background(), auth.RegisterRequest{
			Email: "fp3@example.com", Password: "password123", FullName: "FP3",
		})

		// First request — creates token A
		if err := svc.ForgotPassword(context.Background(), auth.ForgotPasswordRequest{
			Email: "fp3@example.com",
		}); err != nil {
			t.Fatalf("first forgot password: %v", err)
		}

		// Capture the first token hash
		var firstHash string
		for h, tok := range repo.tokens {
			if tok.TokenType == "password_reset" {
				firstHash = h
			}
		}

		// Second request — should invalidate token A and create token B
		if err := svc.ForgotPassword(context.Background(), auth.ForgotPasswordRequest{
			Email: "fp3@example.com",
		}); err != nil {
			t.Fatalf("second forgot password: %v", err)
		}

		// Token A must now be consumed
		firstTok := repo.tokens[firstHash]
		if firstTok == nil || firstTok.UsedAt == nil {
			t.Error("old password_reset token should be invalidated after new request")
		}

		// Exactly one active password_reset token should remain
		active := 0
		for _, tok := range repo.tokens {
			if tok.TokenType == "password_reset" && tok.UsedAt == nil {
				active++
			}
		}
		if active != 1 {
			t.Errorf("expected 1 active password_reset token, got %d", active)
		}
	})

	t.Run("OAuth users do not receive password reset emails", func(t *testing.T) {
		svc, repo := newTestService(t)
		// Create an OAuth user (signed in with Google)
		_, _ = repo.CreateUserWithOAuth(context.Background(), "oauth@example.com", "OAuth User", "google")

		// Request password reset — should succeed but not send email or create token
		if err := svc.ForgotPassword(context.Background(), auth.ForgotPasswordRequest{
			Email: "oauth@example.com",
		}); err != nil {
			t.Fatalf("forgot password for OAuth user: %v", err)
		}

		// No password_reset token should be created for OAuth users
		count := 0
		for _, tok := range repo.tokens {
			if tok.TokenType == "password_reset" {
				count++
			}
		}
		if count != 0 {
			t.Errorf("expected 0 password_reset tokens for OAuth user, got %d", count)
		}
	})
}

func TestAuthService_ResetPassword(t *testing.T) {
	t.Run("valid token updates password", func(t *testing.T) {
		svc, repo := newTestService(t)
		_, _ = svc.Register(context.Background(), auth.RegisterRequest{
			Email: "rp@example.com", Password: "oldpassword1", FullName: "RP User",
		})

		const raw = "reset-raw-token-abc"
		repo.tokens[auth.HashTokenForTest(raw)] = &auth.AuthToken{
			ID:        uuid.New(),
			UserID:    repo.users["rp@example.com"].ID,
			TokenHash: auth.HashTokenForTest(raw),
			TokenType: "password_reset",
			ExpiresAt: time.Now().Add(time.Hour),
		}

		err := svc.ResetPassword(context.Background(), auth.ResetPasswordRequest{
			Token:       raw,
			NewPassword: "newpassword1",
		})
		if err != nil {
			t.Fatalf("reset password: %v", err)
		}

		// Old password should no longer work
		_, _, err = svc.Login(context.Background(), auth.LoginRequest{
			Email: "rp@example.com", Password: "oldpassword1",
		})
		if err == nil {
			t.Fatal("old password should be rejected after reset")
		}

		// New password should work
		_, _, err = svc.Login(context.Background(), auth.LoginRequest{
			Email: "rp@example.com", Password: "newpassword1",
		})
		if err != nil {
			t.Fatalf("new password should work: %v", err)
		}
	})

	t.Run("invalid token rejected", func(t *testing.T) {
		svc, _ := newTestService(t)
		err := svc.ResetPassword(context.Background(), auth.ResetPasswordRequest{
			Token:       "bogus-token",
			NewPassword: "newpassword1",
		})
		if err == nil {
			t.Fatal("expected error for invalid token, got nil")
		}
		if !apperr.IsCode(err, apperr.CodeUnauthorized) {
			t.Errorf("expected UNAUTHORIZED, got %v", err)
		}
	})

	t.Run("token reuse rejected", func(t *testing.T) {
		svc, repo := newTestService(t)
		_, _ = svc.Register(context.Background(), auth.RegisterRequest{
			Email: "rp2@example.com", Password: "oldpassword1", FullName: "RP2",
		})

		const raw = "reset-reuse-token"
		repo.tokens[auth.HashTokenForTest(raw)] = &auth.AuthToken{
			ID:        uuid.New(),
			UserID:    repo.users["rp2@example.com"].ID,
			TokenHash: auth.HashTokenForTest(raw),
			TokenType: "password_reset",
			ExpiresAt: time.Now().Add(time.Hour),
		}

		req := auth.ResetPasswordRequest{Token: raw, NewPassword: "newpassword1"}
		if err := svc.ResetPassword(context.Background(), req); err != nil {
			t.Fatalf("first reset: %v", err)
		}
		if err := svc.ResetPassword(context.Background(), req); err == nil {
			t.Fatal("expected error on token reuse, got nil")
		}
	})

	t.Run("expired token rejected", func(t *testing.T) {
		svc, repo := newTestService(t)
		_, _ = svc.Register(context.Background(), auth.RegisterRequest{
			Email: "rp3@example.com", Password: "oldpassword1", FullName: "RP3",
		})

		const raw = "expired-reset-token"
		repo.tokens[auth.HashTokenForTest(raw)] = &auth.AuthToken{
			ID:        uuid.New(),
			UserID:    repo.users["rp3@example.com"].ID,
			TokenHash: auth.HashTokenForTest(raw),
			TokenType: "password_reset",
			ExpiresAt: time.Now().Add(-time.Hour), // already expired
		}

		err := svc.ResetPassword(context.Background(), auth.ResetPasswordRequest{
			Token:       raw,
			NewPassword: "newpassword1",
		})
		if err == nil {
			t.Fatal("expected error for expired token, got nil")
		}
	})
}
