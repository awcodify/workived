package auth_test

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/workived/services/internal/auth"
	"github.com/workived/services/pkg/apperr"
	"golang.org/x/oauth2"
)

func init() {
	gin.SetMode(gin.TestMode)
}

// ── Mock service ──────────────────────────────────────────────────────────────

type mockAuthService struct {
	registerFn           func(ctx context.Context, req auth.RegisterRequest) (*auth.User, error)
	loginFn              func(ctx context.Context, req auth.LoginRequest) (*auth.LoginResponse, string, error)
	refreshFn            func(ctx context.Context, raw string) (*auth.RefreshResponse, string, error)
	logoutFn             func(ctx context.Context, raw string) error
	verifyEmailFn        func(ctx context.Context, req auth.VerifyEmailRequest) error
	resendVerificationFn func(ctx context.Context, userID uuid.UUID) error
	getUserByIDFn        func(ctx context.Context, userID uuid.UUID) (*auth.User, error)
	forgotPasswordFn     func(ctx context.Context, req auth.ForgotPasswordRequest) error
	resetPasswordFn      func(ctx context.Context, req auth.ResetPasswordRequest) error
}

func (m *mockAuthService) Register(ctx context.Context, req auth.RegisterRequest) (*auth.User, error) {
	return m.registerFn(ctx, req)
}
func (m *mockAuthService) Login(ctx context.Context, req auth.LoginRequest) (*auth.LoginResponse, string, error) {
	return m.loginFn(ctx, req)
}
func (m *mockAuthService) Refresh(ctx context.Context, raw string) (*auth.RefreshResponse, string, error) {
	return m.refreshFn(ctx, raw)
}
func (m *mockAuthService) Logout(ctx context.Context, raw string) error {
	return m.logoutFn(ctx, raw)
}
func (m *mockAuthService) VerifyEmail(ctx context.Context, req auth.VerifyEmailRequest) error {
	return m.verifyEmailFn(ctx, req)
}
func (m *mockAuthService) ResendVerificationEmail(ctx context.Context, userID uuid.UUID) error {
	if m.resendVerificationFn != nil {
		return m.resendVerificationFn(ctx, userID)
	}
	return nil
}
func (m *mockAuthService) GetUserByID(ctx context.Context, userID uuid.UUID) (*auth.User, error) {
	if m.getUserByIDFn != nil {
		return m.getUserByIDFn(ctx, userID)
	}
	return &auth.User{ID: userID, IsVerified: true}, nil
}
func (m *mockAuthService) ForgotPassword(ctx context.Context, req auth.ForgotPasswordRequest) error {
	return m.forgotPasswordFn(ctx, req)
}
func (m *mockAuthService) ResetPassword(ctx context.Context, req auth.ResetPasswordRequest) error {
	return m.resetPasswordFn(ctx, req)
}

// OAuth methods (stubs for tests)
func (m *mockAuthService) GenerateOAuthState(_ context.Context) (string, error) {
	return "mock-state", nil
}
func (m *mockAuthService) GetGoogleOAuthConfig() *oauth2.Config {
	return &oauth2.Config{}
}
func (m *mockAuthService) LoginWithGoogle(_ context.Context, code, state string) (*auth.LoginResponse, string, bool, error) {
	return nil, "", false, nil
}
func (m *mockAuthService) GetAppURL() string {
	return "http://localhost:3000"
}

// Logging methods (stubs for tests)
func (m *mockAuthService) LogInfo(msg string, fields map[string]interface{})             {}
func (m *mockAuthService) LogWarn(msg string, fields map[string]interface{})             {}
func (m *mockAuthService) LogError(msg string, err error, fields map[string]interface{}) {}

// ── Helpers ───────────────────────────────────────────────────────────────────

func newTestRouter(svc auth.ServiceInterface) *gin.Engine {
	r := gin.New()
	h := auth.NewHandler(svc)
	h.RegisterRoutes(r.Group("/api/v1"))
	return r
}

func jsonBody(t *testing.T, v any) *bytes.Buffer {
	t.Helper()
	b, err := json.Marshal(v)
	if err != nil {
		t.Fatalf("marshal body: %v", err)
	}
	return bytes.NewBuffer(b)
}

func assertStatus(t *testing.T, w *httptest.ResponseRecorder, want int) {
	t.Helper()
	if w.Code != want {
		t.Errorf("status = %d, want %d; body: %s", w.Code, want, w.Body.String())
	}
}

// ── Register tests ────────────────────────────────────────────────────────────

func TestAuthHandler_Register(t *testing.T) {
	tests := []struct {
		name       string
		body       any
		serviceErr error
		wantStatus int
	}{
		{
			name:       "success",
			body:       map[string]string{"email": "a@b.com", "password": "pass1234", "full_name": "Ahmad"},
			wantStatus: http.StatusCreated,
		},
		{
			name:       "invalid json",
			body:       "not-json",
			wantStatus: http.StatusBadRequest,
		},
		{
			name:       "missing required fields",
			body:       map[string]string{"email": "bad"},
			wantStatus: http.StatusBadRequest,
		},
		{
			name:       "service conflict",
			body:       map[string]string{"email": "a@b.com", "password": "pass1234", "full_name": "Ahmad"},
			serviceErr: apperr.Conflict("email taken"),
			wantStatus: http.StatusConflict,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			svc := &mockAuthService{
				registerFn: func(_ context.Context, _ auth.RegisterRequest) (*auth.User, error) {
					if tt.serviceErr != nil {
						return nil, tt.serviceErr
					}
					return &auth.User{Email: "a@b.com", FullName: "Ahmad"}, nil
				},
			}
			w := httptest.NewRecorder()
			var body *bytes.Buffer
			if s, ok := tt.body.(string); ok {
				body = bytes.NewBufferString(s)
			} else {
				body = jsonBody(t, tt.body)
			}
			req, _ := http.NewRequest(http.MethodPost, "/api/v1/auth/register", body)
			req.Header.Set("Content-Type", "application/json")
			newTestRouter(svc).ServeHTTP(w, req)
			assertStatus(t, w, tt.wantStatus)
		})
	}
}

// ── Login tests ───────────────────────────────────────────────────────────────

func TestAuthHandler_Login(t *testing.T) {
	tests := []struct {
		name       string
		body       any
		serviceErr error
		wantStatus int
	}{
		{
			name:       "success",
			body:       map[string]string{"email": "a@b.com", "password": "pass1234"},
			wantStatus: http.StatusOK,
		},
		{
			name:       "invalid credentials",
			body:       map[string]string{"email": "a@b.com", "password": "wrong"},
			serviceErr: apperr.New(apperr.CodeUnauthorized, "invalid email or password"),
			wantStatus: http.StatusUnauthorized,
		},
		{
			name:       "bad request body",
			body:       "not-json",
			wantStatus: http.StatusBadRequest,
		},
		{
			name:       "missing fields",
			body:       map[string]string{},
			wantStatus: http.StatusBadRequest,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			svc := &mockAuthService{
				loginFn: func(_ context.Context, _ auth.LoginRequest) (*auth.LoginResponse, string, error) {
					if tt.serviceErr != nil {
						return nil, "", tt.serviceErr
					}
					return &auth.LoginResponse{AccessToken: "tok"}, "refresh", nil
				},
			}
			w := httptest.NewRecorder()
			var body *bytes.Buffer
			if s, ok := tt.body.(string); ok {
				body = bytes.NewBufferString(s)
			} else {
				body = jsonBody(t, tt.body)
			}
			req, _ := http.NewRequest(http.MethodPost, "/api/v1/auth/login", body)
			req.Header.Set("Content-Type", "application/json")
			newTestRouter(svc).ServeHTTP(w, req)
			assertStatus(t, w, tt.wantStatus)
		})
	}
}

// ── Refresh tests ─────────────────────────────────────────────────────────────

func TestAuthHandler_Refresh(t *testing.T) {
	tests := []struct {
		name       string
		cookie     string
		body       any
		serviceErr error
		wantStatus int
	}{
		{
			name:       "success via cookie",
			cookie:     "valid-token",
			wantStatus: http.StatusOK,
		},
		{
			name:       "success via body",
			body:       map[string]string{"refresh_token": "valid-token"},
			wantStatus: http.StatusOK,
		},
		{
			name:       "invalid token",
			cookie:     "bad-token",
			serviceErr: apperr.New(apperr.CodeUnauthorized, "invalid"),
			wantStatus: http.StatusUnauthorized,
		},
		{
			name:       "bad body no cookie",
			body:       "not-json",
			wantStatus: http.StatusBadRequest,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			svc := &mockAuthService{
				refreshFn: func(_ context.Context, _ string) (*auth.RefreshResponse, string, error) {
					if tt.serviceErr != nil {
						return nil, "", tt.serviceErr
					}
					return &auth.RefreshResponse{AccessToken: "new-tok"}, "new-refresh", nil
				},
			}
			w := httptest.NewRecorder()

			var body *bytes.Buffer
			if s, ok := tt.body.(string); ok {
				body = bytes.NewBufferString(s)
			} else if tt.body != nil {
				body = jsonBody(t, tt.body)
			} else {
				body = &bytes.Buffer{}
			}
			req, _ := http.NewRequest(http.MethodPost, "/api/v1/auth/refresh", body)
			req.Header.Set("Content-Type", "application/json")
			if tt.cookie != "" {
				req.AddCookie(&http.Cookie{Name: "refresh_token", Value: tt.cookie})
			}
			newTestRouter(svc).ServeHTTP(w, req)
			assertStatus(t, w, tt.wantStatus)
		})
	}
}

// ── Logout tests ──────────────────────────────────────────────────────────────

func TestAuthHandler_Logout(t *testing.T) {
	tests := []struct {
		name       string
		cookie     string
		serviceErr error
		wantStatus int
	}{
		{
			name:       "success with cookie",
			cookie:     "valid-token",
			wantStatus: http.StatusOK,
		},
		{
			name:       "no cookie — still 200",
			wantStatus: http.StatusOK,
		},
		{
			name:       "service error is swallowed",
			cookie:     "bad-token",
			serviceErr: errors.New("already consumed"),
			wantStatus: http.StatusOK,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			svc := &mockAuthService{
				logoutFn: func(_ context.Context, _ string) error {
					return tt.serviceErr
				},
			}
			w := httptest.NewRecorder()
			req, _ := http.NewRequest(http.MethodPost, "/api/v1/auth/logout", nil)
			if tt.cookie != "" {
				req.AddCookie(&http.Cookie{Name: "refresh_token", Value: tt.cookie})
			}
			newTestRouter(svc).ServeHTTP(w, req)
			assertStatus(t, w, tt.wantStatus)
		})
	}
}

// ── VerifyEmail tests ─────────────────────────────────────────────────────────

func TestAuthHandler_VerifyEmail(t *testing.T) {
	tests := []struct {
		name       string
		body       any
		serviceErr error
		wantStatus int
	}{
		{
			name:       "success",
			body:       map[string]string{"token": "abc123"},
			wantStatus: http.StatusOK,
		},
		{
			name:       "invalid token",
			body:       map[string]string{"token": "bad"},
			serviceErr: apperr.New(apperr.CodeUnauthorized, "token invalid"),
			wantStatus: http.StatusUnauthorized,
		},
		{
			name:       "bad body",
			body:       "not-json",
			wantStatus: http.StatusBadRequest,
		},
		{
			name:       "missing token field",
			body:       map[string]string{},
			wantStatus: http.StatusBadRequest,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			svc := &mockAuthService{
				verifyEmailFn: func(_ context.Context, _ auth.VerifyEmailRequest) error {
					return tt.serviceErr
				},
			}
			w := httptest.NewRecorder()
			var body *bytes.Buffer
			if s, ok := tt.body.(string); ok {
				body = bytes.NewBufferString(s)
			} else {
				body = jsonBody(t, tt.body)
			}
			req, _ := http.NewRequest(http.MethodPost, "/api/v1/auth/verify-email", body)
			req.Header.Set("Content-Type", "application/json")
			newTestRouter(svc).ServeHTTP(w, req)
			assertStatus(t, w, tt.wantStatus)
		})
	}
}

// ── ForgotPassword handler ────────────────────────────────────────────────────

func TestAuthHandler_ForgotPassword(t *testing.T) {
	tests := []struct {
		name       string
		body       any
		serviceErr error
		wantStatus int
	}{
		{
			name:       "valid email returns 200",
			body:       map[string]string{"email": "user@example.com"},
			wantStatus: http.StatusOK,
		},
		{
			name:       "unknown email still returns 200 (no info leakage)",
			body:       map[string]string{"email": "nobody@example.com"},
			serviceErr: nil,
			wantStatus: http.StatusOK,
		},
		{
			name:       "invalid email rejected",
			body:       map[string]string{"email": "not-an-email"},
			wantStatus: http.StatusBadRequest,
		},
		{
			name:       "rate limit exceeded returns 429",
			body:       map[string]string{"email": "user@example.com"},
			serviceErr: apperr.New(apperr.CodeRateLimit, "too many password reset requests, try again later"),
			wantStatus: http.StatusTooManyRequests,
		},
		{
			name:       "missing body rejected",
			body:       "not json",
			wantStatus: http.StatusBadRequest,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			svc := &mockAuthService{
				forgotPasswordFn: func(_ context.Context, _ auth.ForgotPasswordRequest) error {
					return tt.serviceErr
				},
			}
			w := httptest.NewRecorder()
			var body *bytes.Buffer
			if s, ok := tt.body.(string); ok {
				body = bytes.NewBufferString(s)
			} else {
				body = jsonBody(t, tt.body)
			}
			req, _ := http.NewRequest(http.MethodPost, "/api/v1/auth/forgot-password", body)
			req.Header.Set("Content-Type", "application/json")
			newTestRouter(svc).ServeHTTP(w, req)
			assertStatus(t, w, tt.wantStatus)
		})
	}
}

// ── ResetPassword handler ─────────────────────────────────────────────────────

func TestAuthHandler_ResetPassword(t *testing.T) {
	tests := []struct {
		name       string
		body       any
		serviceErr error
		wantStatus int
	}{
		{
			name:       "valid request returns 200",
			body:       map[string]string{"token": "abc123", "new_password": "newpassword1"},
			wantStatus: http.StatusOK,
		},
		{
			name:       "invalid token returns 401",
			body:       map[string]string{"token": "bad", "new_password": "newpassword1"},
			serviceErr: apperr.New(apperr.CodeUnauthorized, "token is invalid or expired"),
			wantStatus: http.StatusUnauthorized,
		},
		{
			name:       "missing token rejected",
			body:       map[string]string{"new_password": "newpassword1"},
			wantStatus: http.StatusBadRequest,
		},
		{
			name:       "missing password rejected",
			body:       map[string]string{"token": "abc123"},
			wantStatus: http.StatusBadRequest,
		},
		{
			name:       "password too short rejected",
			body:       map[string]string{"token": "abc123", "new_password": "short"},
			wantStatus: http.StatusBadRequest,
		},
		{
			name:       "invalid body rejected",
			body:       "not json",
			wantStatus: http.StatusBadRequest,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			svc := &mockAuthService{
				resetPasswordFn: func(_ context.Context, _ auth.ResetPasswordRequest) error {
					return tt.serviceErr
				},
			}
			w := httptest.NewRecorder()
			var body *bytes.Buffer
			if s, ok := tt.body.(string); ok {
				body = bytes.NewBufferString(s)
			} else {
				body = jsonBody(t, tt.body)
			}
			req, _ := http.NewRequest(http.MethodPost, "/api/v1/auth/reset-password", body)
			req.Header.Set("Content-Type", "application/json")
			newTestRouter(svc).ServeHTTP(w, req)
			assertStatus(t, w, tt.wantStatus)
		})
	}
}
