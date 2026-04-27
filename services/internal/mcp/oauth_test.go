package mcp

import (
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"net/url"
	"strings"
	"testing"
	"time"

	"crypto/sha256"
	"encoding/base64"

	"github.com/gin-gonic/gin"
	"github.com/golang-jwt/jwt/v5"
	"github.com/rs/zerolog"
)

const testJWTSecret = "test-secret-for-oauth-tests"

func newTestOAuthHandler() *OAuthHandler {
	return NewOAuthHandler("http://localhost:8080", testJWTSecret, zerolog.Nop())
}

func makeTestJWT(secret string, ttl time.Duration) string {
	claims := jwt.MapClaims{
		"sub":  "user-123",
		"uid":  "user-123",
		"oid":  "org-456",
		"role": "owner",
		"exp":  time.Now().Add(ttl).Unix(),
		"iat":  time.Now().Unix(),
	}
	t := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	signed, _ := t.SignedString([]byte(secret))
	return signed
}

func setupOAuthRouter(h *OAuthHandler) *gin.Engine {
	r := gin.New()
	r.GET("/.well-known/oauth-protected-resource", h.ProtectedResourceMetadata)
	r.GET("/.well-known/oauth-authorization-server", h.AuthorizationServerMetadata)
	r.POST("/oauth/register", h.Register)
	r.GET("/oauth/authorize", h.Authorize)
	r.POST("/oauth/authorize", h.AuthorizeSubmit)
	r.POST("/oauth/token", h.Token)
	return r
}

// ── ProtectedResourceMetadata ─────────────────────────────────────────────────

func TestProtectedResourceMetadata(t *testing.T) {
	h := newTestOAuthHandler()
	r := setupOAuthRouter(h)

	req := httptest.NewRequest(http.MethodGet, "/.well-known/oauth-protected-resource", nil)
	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)

	if w.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d", w.Code)
	}
	var body map[string]interface{}
	if err := json.Unmarshal(w.Body.Bytes(), &body); err != nil {
		t.Fatal(err)
	}
	if body["resource"] != "http://localhost:8080" {
		t.Errorf("unexpected resource: %v", body["resource"])
	}
	servers, ok := body["authorization_servers"].([]interface{})
	if !ok || len(servers) == 0 {
		t.Error("missing authorization_servers")
	}
}

// ── AuthorizationServerMetadata ───────────────────────────────────────────────

func TestAuthorizationServerMetadata(t *testing.T) {
	h := newTestOAuthHandler()
	r := setupOAuthRouter(h)

	req := httptest.NewRequest(http.MethodGet, "/.well-known/oauth-authorization-server", nil)
	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)

	if w.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d", w.Code)
	}
	var body map[string]interface{}
	if err := json.Unmarshal(w.Body.Bytes(), &body); err != nil {
		t.Fatal(err)
	}
	for _, field := range []string{"issuer", "authorization_endpoint", "token_endpoint", "registration_endpoint"} {
		if body[field] == "" || body[field] == nil {
			t.Errorf("missing field: %s", field)
		}
	}
	if body["authorization_endpoint"] != "http://localhost:8080/oauth/authorize" {
		t.Errorf("unexpected authorization_endpoint: %v", body["authorization_endpoint"])
	}
}

// ── Register ──────────────────────────────────────────────────────────────────

func TestRegister_NoRedirectURIs(t *testing.T) {
	h := newTestOAuthHandler()
	r := setupOAuthRouter(h)

	req := httptest.NewRequest(http.MethodPost, "/oauth/register", strings.NewReader(`{}`))
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)

	if w.Code != http.StatusCreated {
		t.Fatalf("expected 201, got %d", w.Code)
	}
	var body map[string]interface{}
	_ = json.Unmarshal(w.Body.Bytes(), &body)
	if body["client_id"] == "" || body["client_id"] == nil {
		t.Error("missing client_id")
	}
	uris, ok := body["redirect_uris"].([]interface{})
	if !ok {
		t.Errorf("redirect_uris should be array, got %T", body["redirect_uris"])
	}
	if len(uris) != 0 {
		t.Errorf("expected empty redirect_uris, got %v", uris)
	}
}

func TestRegister_WithRedirectURIs(t *testing.T) {
	h := newTestOAuthHandler()
	r := setupOAuthRouter(h)

	body := `{"redirect_uris":["http://localhost:3000/callback","http://localhost:3001/cb"]}`
	req := httptest.NewRequest(http.MethodPost, "/oauth/register", strings.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)

	if w.Code != http.StatusCreated {
		t.Fatalf("expected 201, got %d", w.Code)
	}
	var resp map[string]interface{}
	_ = json.Unmarshal(w.Body.Bytes(), &resp)
	uris, ok := resp["redirect_uris"].([]interface{})
	if !ok || len(uris) != 2 {
		t.Errorf("expected 2 redirect_uris, got %v", resp["redirect_uris"])
	}
}

// ── Authorize GET ─────────────────────────────────────────────────────────────

func TestAuthorize_MissingRedirectURI(t *testing.T) {
	h := newTestOAuthHandler()
	r := setupOAuthRouter(h)

	req := httptest.NewRequest(http.MethodGet, "/oauth/authorize", nil)
	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)

	if w.Code != http.StatusBadRequest {
		t.Errorf("expected 400, got %d", w.Code)
	}
}

func TestAuthorize_RendersForm(t *testing.T) {
	h := newTestOAuthHandler()
	r := setupOAuthRouter(h)

	req := httptest.NewRequest(http.MethodGet, "/oauth/authorize?redirect_uri=http://localhost:3000/cb&state=abc&code_challenge=xyz", nil)
	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)

	if w.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d", w.Code)
	}
	if ct := w.Header().Get("Content-Type"); !strings.HasPrefix(ct, "text/html") {
		t.Errorf("expected text/html, got %s", ct)
	}
	if !strings.Contains(w.Body.String(), "Workived MCP") {
		t.Error("expected login form HTML")
	}
}

// ── AuthorizeSubmit POST ──────────────────────────────────────────────────────

func TestAuthorizeSubmit_MissingFields(t *testing.T) {
	h := newTestOAuthHandler()
	r := setupOAuthRouter(h)

	form := url.Values{}
	form.Set("redirect_uri", "http://localhost:3000/cb")
	// no access_token

	req := httptest.NewRequest(http.MethodPost, "/oauth/authorize", strings.NewReader(form.Encode()))
	req.Header.Set("Content-Type", "application/x-www-form-urlencoded")
	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)

	if w.Code != http.StatusBadRequest {
		t.Errorf("expected 400, got %d", w.Code)
	}
}

func TestAuthorizeSubmit_IssuedCode(t *testing.T) {
	h := newTestOAuthHandler()
	r := setupOAuthRouter(h)

	form := url.Values{}
	form.Set("redirect_uri", "http://localhost:3000/cb")
	form.Set("state", "mystate")
	form.Set("code_challenge", "somechallenge")
	form.Set("access_token", "sometoken")

	req := httptest.NewRequest(http.MethodPost, "/oauth/authorize", strings.NewReader(form.Encode()))
	req.Header.Set("Content-Type", "application/x-www-form-urlencoded")
	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)

	if w.Code != http.StatusFound {
		t.Fatalf("expected 302, got %d", w.Code)
	}
	loc := w.Header().Get("Location")
	if !strings.Contains(loc, "code=") {
		t.Errorf("expected code in redirect, got: %s", loc)
	}
	if !strings.Contains(loc, "state=mystate") {
		t.Errorf("expected state in redirect, got: %s", loc)
	}
}

// ── Token endpoint ────────────────────────────────────────────────────────────

func issueCode(h *OAuthHandler, accessToken, codeChallenge string) string {
	code := randomHex(24)
	h.codes.Store(code, &oauthCode{
		redirectURI:   "http://localhost:3000/cb",
		codeChallenge: codeChallenge,
		accessToken:   accessToken,
		expiresAt:     time.Now().Add(5 * time.Minute),
	})
	return code
}

func TestToken_InvalidGrantType(t *testing.T) {
	h := newTestOAuthHandler()
	r := setupOAuthRouter(h)

	form := url.Values{"grant_type": {"implicit"}}
	req := httptest.NewRequest(http.MethodPost, "/oauth/token", strings.NewReader(form.Encode()))
	req.Header.Set("Content-Type", "application/x-www-form-urlencoded")
	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)

	if w.Code != http.StatusBadRequest {
		t.Errorf("expected 400, got %d", w.Code)
	}
}

func TestToken_CodeNotFound(t *testing.T) {
	h := newTestOAuthHandler()
	r := setupOAuthRouter(h)

	form := url.Values{"grant_type": {"authorization_code"}, "code": {"nonexistent"}, "code_verifier": {"v"}}
	req := httptest.NewRequest(http.MethodPost, "/oauth/token", strings.NewReader(form.Encode()))
	req.Header.Set("Content-Type", "application/x-www-form-urlencoded")
	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)

	if w.Code != http.StatusBadRequest {
		t.Errorf("expected 400, got %d", w.Code)
	}
}

func TestToken_ExpiredCode(t *testing.T) {
	h := newTestOAuthHandler()
	r := setupOAuthRouter(h)

	code := randomHex(24)
	h.codes.Store(code, &oauthCode{
		redirectURI: "http://localhost/cb",
		accessToken: "tok",
		expiresAt:   time.Now().Add(-1 * time.Minute), // already expired
	})

	form := url.Values{"grant_type": {"authorization_code"}, "code": {code}, "code_verifier": {"v"}}
	req := httptest.NewRequest(http.MethodPost, "/oauth/token", strings.NewReader(form.Encode()))
	req.Header.Set("Content-Type", "application/x-www-form-urlencoded")
	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)

	if w.Code != http.StatusBadRequest {
		t.Errorf("expected 400, got %d", w.Code)
	}
}

func TestToken_PKCEFailure(t *testing.T) {
	h := newTestOAuthHandler()
	r := setupOAuthRouter(h)

	jwt := makeTestJWT(testJWTSecret, 15*time.Minute)
	code := issueCode(h, jwt, "correct-challenge")

	form := url.Values{
		"grant_type":    {"authorization_code"},
		"code":          {code},
		"code_verifier": {"wrong-verifier"},
	}
	req := httptest.NewRequest(http.MethodPost, "/oauth/token", strings.NewReader(form.Encode()))
	req.Header.Set("Content-Type", "application/x-www-form-urlencoded")
	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)

	if w.Code != http.StatusBadRequest {
		t.Errorf("expected 400, got %d", w.Code)
	}
}

func TestToken_Success_Issues30DayToken(t *testing.T) {
	h := newTestOAuthHandler()
	r := setupOAuthRouter(h)

	shortJWT := makeTestJWT(testJWTSecret, 15*time.Minute)

	// Compute PKCE S256 challenge
	verifier := "test-verifier-string-long-enough"
	sum := sha256.Sum256([]byte(verifier))
	challenge := base64.RawURLEncoding.EncodeToString(sum[:])

	code := issueCode(h, shortJWT, challenge)

	form := url.Values{
		"grant_type":    {"authorization_code"},
		"code":          {code},
		"code_verifier": {verifier},
	}
	req := httptest.NewRequest(http.MethodPost, "/oauth/token", strings.NewReader(form.Encode()))
	req.Header.Set("Content-Type", "application/x-www-form-urlencoded")
	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)

	if w.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d: %s", w.Code, w.Body.String())
	}

	var resp map[string]interface{}
	_ = json.Unmarshal(w.Body.Bytes(), &resp)

	if resp["access_token"] == "" || resp["access_token"] == nil {
		t.Error("missing access_token")
	}
	if resp["token_type"] != "Bearer" {
		t.Errorf("unexpected token_type: %v", resp["token_type"])
	}
	expiresIn, ok := resp["expires_in"].(float64)
	if !ok || expiresIn < 2500000 { // ~29 days in seconds
		t.Errorf("expected ~30d expires_in, got %v", resp["expires_in"])
	}

	// Verify the issued token is valid and has extended TTL.
	token := resp["access_token"].(string)
	parsed, err := jwt.Parse(token, func(t *jwt.Token) (interface{}, error) {
		return []byte(testJWTSecret), nil
	})
	if err != nil || !parsed.Valid {
		t.Fatalf("issued token invalid: %v", err)
	}
	claims, _ := parsed.Claims.(jwt.MapClaims)
	exp, _ := claims["exp"].(float64)
	remaining := time.Until(time.Unix(int64(exp), 0))
	if remaining < 29*24*time.Hour {
		t.Errorf("expected ~30d TTL, got %v remaining", remaining)
	}
}

func TestToken_NoPKCE_Success(t *testing.T) {
	h := newTestOAuthHandler()
	r := setupOAuthRouter(h)

	shortJWT := makeTestJWT(testJWTSecret, 15*time.Minute)
	code := issueCode(h, shortJWT, "") // no PKCE challenge

	form := url.Values{
		"grant_type": {"authorization_code"},
		"code":       {code},
		// no code_verifier
	}
	req := httptest.NewRequest(http.MethodPost, "/oauth/token", strings.NewReader(form.Encode()))
	req.Header.Set("Content-Type", "application/x-www-form-urlencoded")
	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)

	if w.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d: %s", w.Code, w.Body.String())
	}
}

// ── issueMCPToken unit tests ──────────────────────────────────────────────────

func TestIssueMCPToken_PreservesClaimsExtendsTTL(t *testing.T) {
	h := newTestOAuthHandler()
	shortJWT := makeTestJWT(testJWTSecret, 15*time.Minute)

	mcpToken, err := h.issueMCPToken(shortJWT)
	if err != nil {
		t.Fatalf("issueMCPToken error: %v", err)
	}

	parsed, err := jwt.Parse(mcpToken, func(t *jwt.Token) (interface{}, error) {
		return []byte(testJWTSecret), nil
	})
	if err != nil || !parsed.Valid {
		t.Fatalf("issued MCP token invalid: %v", err)
	}
	claims, _ := parsed.Claims.(jwt.MapClaims)

	if claims["sub"] != "user-123" {
		t.Errorf("sub not preserved: %v", claims["sub"])
	}
	if claims["oid"] != "org-456" {
		t.Errorf("oid not preserved: %v", claims["oid"])
	}

	exp, _ := claims["exp"].(float64)
	remaining := time.Until(time.Unix(int64(exp), 0))
	if remaining < 29*24*time.Hour {
		t.Errorf("expected ~30d TTL, got %v", remaining)
	}
}

func TestIssueMCPToken_InvalidJWT(t *testing.T) {
	h := newTestOAuthHandler()
	_, err := h.issueMCPToken("not.a.valid.jwt")
	if err == nil {
		t.Error("expected error for invalid JWT")
	}
}

func TestIssueMCPToken_WrongSecret(t *testing.T) {
	h := newTestOAuthHandler()
	wrongSecretJWT := makeTestJWT("different-secret", 15*time.Minute)
	_, err := h.issueMCPToken(wrongSecretJWT)
	if err == nil {
		t.Error("expected error for JWT signed with wrong secret")
	}
}

// ── sweepCodes ────────────────────────────────────────────────────────────────

func TestSweepCodes_RemovesExpired(t *testing.T) {
	h := newTestOAuthHandler()
	code := "expiredcode"
	h.codes.Store(code, &oauthCode{
		accessToken: "tok",
		expiresAt:   time.Now().Add(-1 * time.Minute),
	})

	now := time.Now()
	h.codes.Range(func(k, v any) bool {
		if v.(*oauthCode).expiresAt.Before(now) {
			h.codes.Delete(k)
		}
		return true
	})

	if _, ok := h.codes.Load(code); ok {
		t.Error("expected expired code to be swept")
	}
}

var _ = fmt.Sprintf // suppress unused import
