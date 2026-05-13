package mcp

import (
	"bytes"
	"crypto/sha256"
	_ "embed"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"html"
	"io"
	"net/http"
	"strings"
	"sync"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/golang-jwt/jwt/v5"
	"github.com/rs/zerolog"
)

//go:embed templates/oauth_login.html
var oauthLoginHTML string

const mcpTokenTTL = 30 * 24 * time.Hour // 30-day MCP session token

// OAuthHandler implements minimal OAuth 2.0 + PKCE for MCP Authorization spec.
// This allows Claude Code (and other MCP clients) to authenticate via browser
// and receive a Workived JWT as the MCP access token.
type OAuthHandler struct {
	appURL    string
	apiURL    string // API server URL for login endpoint
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

func NewOAuthHandler(appURL string, apiURL string, jwtSecret string, log zerolog.Logger) *OAuthHandler {
	if apiURL == "" {
		apiURL = appURL // fallback: same origin
	}
	h := &OAuthHandler{appURL: appURL, apiURL: apiURL, jwtSecret: jwtSecret, log: log}
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
// Per RFC 9728, the 'resource' field must match the actual resource URL.
func (h *OAuthHandler) ProtectedResourceMetadata(c *gin.Context) {
	// Extract the resource path from the URL (e.g., "/mcp/sse" from "/.well-known/oauth-protected-resource/mcp/sse")
	resourcePath := strings.TrimPrefix(c.Request.URL.Path, "/.well-known/oauth-protected-resource")
	if resourcePath == "" {
		resourcePath = "/mcp/sse" // Default to MCP SSE endpoint
	}

	resourceURL := h.appURL + resourcePath

	c.JSON(http.StatusOK, gin.H{
		"resource":                 resourceURL,
		"authorization_servers":    []string{h.appURL},
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
		"code_challenge_methods_supported":      []string{"S256"},
		"token_endpoint_auth_methods_supported": []string{"none"},
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
	if redirectURI == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "missing redirect_uri"})
		return
	}

	// Inject MCP server origin so the login form POSTs to /oauth/login (same-origin HTTPS proxy).
	// Never expose apiURL (internal Railway HTTP) to the browser.
	page := strings.ReplaceAll(oauthLoginHTML, "__MCP_URL__", html.EscapeString(h.appURL))

	c.Header("Content-Type", "text/html")
	c.String(http.StatusOK, page)
}

// LoginProxy handles POST /oauth/login.
// Proxies email/password to the internal API so the browser only contacts
// the MCP server (HTTPS, same origin). Never exposes the internal apiURL.
func (h *OAuthHandler) LoginProxy(c *gin.Context) {
	var creds struct {
		Email    string `json:"email"`
		Password string `json:"password"`
	}
	if err := c.ShouldBindJSON(&creds); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid request body"})
		return
	}

	b, err := json.Marshal(creds)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "internal error"})
		return
	}

	resp, err := http.Post(h.apiURL+"/api/v1/auth/login", "application/json", bytes.NewReader(b)) //nolint:gosec
	if err != nil {
		h.log.Error().Err(err).Msg("oauth: login proxy upstream error")
		c.JSON(http.StatusBadGateway, gin.H{"error": "upstream unavailable"})
		return
	}
	defer resp.Body.Close()

	body, _ := io.ReadAll(resp.Body)
	c.Data(resp.StatusCode, "application/json", body)
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
