package mcp

import (
	"crypto/sha256"
	"encoding/base64"
	"fmt"
	"net/http"
	"strings"
	"sync"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/golang-jwt/jwt/v5"
	"github.com/rs/zerolog"
)

const mcpTokenTTL = 30 * 24 * time.Hour // 30-day MCP session token

// OAuthHandler implements minimal OAuth 2.0 + PKCE for MCP Authorization spec.
// This allows Claude Code (and other MCP clients) to authenticate via browser
// and receive a Workived JWT as the MCP access token.
type OAuthHandler struct {
	appURL    string
	jwtSecret string
	log       zerolog.Logger
	clients   sync.Map // clientID → registered
	codes     sync.Map // code → *oauthCode
}

type oauthCode struct {
	redirectURI   string
	codeChallenge string
	accessToken   string // Workived JWT (short-lived; used to extract claims)
	expiresAt     time.Time
}

func NewOAuthHandler(appURL string, jwtSecret string, log zerolog.Logger) *OAuthHandler {
	h := &OAuthHandler{appURL: appURL, jwtSecret: jwtSecret, log: log}
	go h.sweepCodes()
	return h
}

func (h *OAuthHandler) sweepCodes() {
	ticker := time.NewTicker(5 * time.Minute)
	defer ticker.Stop()
	for range ticker.C {
		now := time.Now()
		h.codes.Range(func(k, v any) bool {
			if v.(*oauthCode).expiresAt.Before(now) {
				h.codes.Delete(k)
			}
			return true
		})
	}
}

// issueMCPToken re-signs the short-lived Workived JWT with a 30-day TTL.
// Same claims, same secret — just extended expiry so Claude Code doesn't
// need to re-authenticate on every restart.
func (h *OAuthHandler) issueMCPToken(accessToken string) (string, error) {
	parsed, err := jwt.Parse(accessToken, func(t *jwt.Token) (interface{}, error) {
		if _, ok := t.Method.(*jwt.SigningMethodHMAC); !ok {
			return nil, fmt.Errorf("unexpected signing method: %v", t.Header["alg"])
		}
		return []byte(h.jwtSecret), nil
	})
	if err != nil {
		return "", fmt.Errorf("invalid token: %w", err)
	}
	claims, ok := parsed.Claims.(jwt.MapClaims)
	if !ok {
		return "", fmt.Errorf("invalid claims type")
	}

	now := time.Now()
	claims["iat"] = now.Unix()
	claims["exp"] = now.Add(mcpTokenTTL).Unix()

	t := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	return t.SignedString([]byte(h.jwtSecret))
}

// ── Well-known metadata ───────────────────────────────────────────────────────

// ProtectedResourceMetadata handles GET /.well-known/oauth-protected-resource
// and GET /.well-known/oauth-protected-resource/* (path suffix ignored).
func (h *OAuthHandler) ProtectedResourceMetadata(c *gin.Context) {
	c.JSON(http.StatusOK, gin.H{
		"resource":                 h.appURL,
		"authorization_servers":   []string{h.appURL},
		"bearer_methods_supported": []string{"header"},
	})
}

// AuthorizationServerMetadata handles GET /.well-known/oauth-authorization-server
// and GET /.well-known/openid-configuration.
func (h *OAuthHandler) AuthorizationServerMetadata(c *gin.Context) {
	c.JSON(http.StatusOK, gin.H{
		"issuer":                                h.appURL,
		"authorization_endpoint":                h.appURL + "/oauth/authorize",
		"token_endpoint":                        h.appURL + "/oauth/token",
		"registration_endpoint":                 h.appURL + "/oauth/register",
		"response_types_supported":              []string{"code"},
		"grant_types_supported":                 []string{"authorization_code"},
		"code_challenge_methods_supported":       []string{"S256"},
		"token_endpoint_auth_methods_supported":  []string{"none"},
	})
}

// ── Dynamic client registration (RFC 7591) ───────────────────────────────────

// Register handles POST /oauth/register.
// Claude Code registers itself to get a client_id before the auth flow.
func (h *OAuthHandler) Register(c *gin.Context) {
	var req struct {
		RedirectURIs []string `json:"redirect_uris"`
	}
	_ = c.ShouldBindJSON(&req) // best-effort; all fields optional per RFC 7591

	clientID := randomHex(16)
	h.clients.Store(clientID, true)
	h.log.Info().Str("client_id", clientID).Msg("oauth: client registered")

	redirectURIs := req.RedirectURIs
	if redirectURIs == nil {
		redirectURIs = []string{}
	}
	c.JSON(http.StatusCreated, gin.H{
		"client_id":                  clientID,
		"client_id_issued_at":        time.Now().Unix(),
		"token_endpoint_auth_method": "none",
		"grant_types":                []string{"authorization_code"},
		"response_types":             []string{"code"},
		"redirect_uris":              redirectURIs,
	})
}

// ── Authorization endpoint ───────────────────────────────────────────────────

// Authorize handles GET /oauth/authorize.
// Shows a login form. On success, redirects to redirect_uri with an auth code.
func (h *OAuthHandler) Authorize(c *gin.Context) {
	redirectURI := c.Query("redirect_uri")
	state := c.Query("state")
	codeChallenge := c.Query("code_challenge")

	if redirectURI == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "missing redirect_uri"})
		return
	}

	c.Header("Content-Type", "text/html")
	c.String(http.StatusOK, oauthLoginHTML,
		redirectURI, state, codeChallenge,
		h.appURL, redirectURI, state, codeChallenge,
	)
}

// AuthorizeSubmit handles POST /oauth/authorize.
// Validates credentials, issues an auth code, redirects to redirect_uri.
// Called from the login form embedded in Authorize.
func (h *OAuthHandler) AuthorizeSubmit(c *gin.Context) {
	redirectURI := c.PostForm("redirect_uri")
	state := c.PostForm("state")
	codeChallenge := c.PostForm("code_challenge")
	accessToken := c.PostForm("access_token") // set after successful login via /api/v1/auth/login

	if accessToken == "" || redirectURI == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "missing access_token or redirect_uri"})
		return
	}

	code := randomHex(24)
	h.codes.Store(code, &oauthCode{
		redirectURI:   redirectURI,
		codeChallenge: codeChallenge,
		accessToken:   accessToken,
		expiresAt:     time.Now().Add(5 * time.Minute),
	})

	h.log.Info().Str("redirect_uri", redirectURI).Msg("oauth: code issued")

	sep := "?"
	if strings.Contains(redirectURI, "?") {
		sep = "&"
	}
	location := fmt.Sprintf("%s%scode=%s&state=%s", redirectURI, sep, code, state)
	c.Redirect(http.StatusFound, location)
}

// ── Token endpoint ────────────────────────────────────────────────────────────

// Token handles POST /oauth/token.
// Exchanges auth code + PKCE verifier for a long-lived MCP JWT (30 days).
func (h *OAuthHandler) Token(c *gin.Context) {
	grantType := c.PostForm("grant_type")
	if grantType != "authorization_code" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "unsupported_grant_type"})
		return
	}

	code := c.PostForm("code")
	codeVerifier := c.PostForm("code_verifier")

	val, ok := h.codes.Load(code)
	if !ok {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid_grant", "error_description": "code not found or expired"})
		return
	}
	entry := val.(*oauthCode)

	if time.Now().After(entry.expiresAt) {
		h.codes.Delete(code)
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid_grant", "error_description": "code expired"})
		return
	}

	// Verify PKCE S256
	if entry.codeChallenge != "" {
		sum := sha256.Sum256([]byte(codeVerifier))
		challenge := base64.RawURLEncoding.EncodeToString(sum[:])
		if challenge != entry.codeChallenge {
			c.JSON(http.StatusBadRequest, gin.H{"error": "invalid_grant", "error_description": "PKCE verification failed"})
			return
		}
	}

	h.codes.Delete(code)

	// Re-sign the short-lived access JWT with a 30-day TTL so Claude Code
	// doesn't need to re-authenticate on every restart.
	mcpToken, err := h.issueMCPToken(entry.accessToken)
	if err != nil {
		h.log.Error().Err(err).Msg("oauth: failed to issue MCP token")
		c.JSON(http.StatusInternalServerError, gin.H{"error": "server_error", "error_description": "failed to issue token"})
		return
	}

	h.log.Info().Msg("oauth: MCP token issued (30d)")

	c.JSON(http.StatusOK, gin.H{
		"access_token": mcpToken,
		"token_type":   "Bearer",
		"expires_in":   int(mcpTokenTTL.Seconds()), // 2592000
	})
}

// ── Login HTML ────────────────────────────────────────────────────────────────

// oauthLoginHTML renders a login form that calls /api/v1/auth/login,
// stores the access token, then submits to /oauth/authorize (POST).
// Template args: redirectURI, state, codeChallenge, appURL, redirectURI, state, codeChallenge.
const oauthLoginHTML = `<!DOCTYPE html>
<html>
<head>
  <title>Workived — Sign in to MCP</title>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    *{margin:0;padding:0;box-sizing:border-box}
    body{font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;
      background:linear-gradient(135deg,#667eea,#764ba2);
      min-height:100vh;display:flex;justify-content:center;align-items:center;padding:20px}
    .card{background:#fff;border-radius:16px;box-shadow:0 20px 60px rgba(0,0,0,.3);
      max-width:420px;width:100%%;padding:3rem}
    h1{font-size:24px;color:#1f2937;margin-bottom:.5rem;text-align:center}
    p{color:#6b7280;font-size:14px;text-align:center;margin-bottom:2rem}
    .field{margin-bottom:1.25rem}
    label{display:block;color:#374151;font-weight:500;margin-bottom:.4rem;font-size:14px}
    input[type=email],input[type=password]{width:100%%;padding:.75rem 1rem;
      border:2px solid #e5e7eb;border-radius:8px;font-size:15px;
      transition:border-color .2s}
    input:focus{outline:none;border-color:#667eea}
    button{width:100%%;padding:.875rem;
      background:linear-gradient(135deg,#667eea,#764ba2);
      color:#fff;border:none;border-radius:8px;font-size:16px;font-weight:600;
      cursor:pointer;transition:transform .15s,box-shadow .15s}
    button:hover{transform:translateY(-2px);box-shadow:0 10px 20px rgba(102,126,234,.3)}
    button:disabled{opacity:.6;cursor:not-allowed;transform:none}
    .error{background:#fef2f2;border:1px solid #fecaca;color:#dc2626;
      padding:.75rem;border-radius:8px;margin-bottom:1rem;font-size:14px;display:none}
    .info{background:#f0f9ff;border:1px solid #bae6fd;color:#0369a1;
      padding:.75rem;border-radius:8px;margin-bottom:1.5rem;font-size:13px;text-align:center}
  </style>
</head>
<body>
<div class="card">
  <h1>🔐 Workived MCP</h1>
  <p>Sign in to connect Claude Code to Workived</p>
  <div class="info">This authorises Claude Code to access your Workived data.</div>
  <div class="error" id="err"></div>
  <form id="loginForm">
    <div class="field">
      <label>Email</label>
      <input type="email" id="email" required placeholder="you@company.com" autocomplete="email">
    </div>
    <div class="field">
      <label>Password</label>
      <input type="password" id="password" required placeholder="••••••••" autocomplete="current-password">
    </div>
    <button type="submit" id="btn">Sign In</button>
  </form>
  <form id="oauthForm" action="/oauth/authorize" method="POST" style="display:none">
    <input type="hidden" name="redirect_uri" value="%s">
    <input type="hidden" name="state" value="%s">
    <input type="hidden" name="code_challenge" value="%s">
    <input type="hidden" name="access_token" id="accessToken">
  </form>
</div>
<script>
  const APP_URL = '%s';
  document.getElementById('loginForm').addEventListener('submit', async e => {
    e.preventDefault();
    const btn = document.getElementById('btn');
    const errDiv = document.getElementById('err');
    btn.disabled = true; btn.textContent = 'Signing in…'; errDiv.style.display = 'none';
    try {
      const resp = await fetch(APP_URL + '/api/v1/auth/login', {
        method: 'POST',
        headers: {'Content-Type':'application/json'},
        body: JSON.stringify({
          email: document.getElementById('email').value,
          password: document.getElementById('password').value,
        }),
      });
      const data = await resp.json();
      if (!resp.ok) throw new Error(data?.error?.message || 'Login failed');
      document.getElementById('accessToken').value = data.data.access_token;
      document.getElementById('oauthForm').submit();
    } catch(err) {
      errDiv.textContent = err.message; errDiv.style.display = 'block';
      btn.disabled = false; btn.textContent = 'Sign In';
    }
  });
</script>
</body>
</html>`
