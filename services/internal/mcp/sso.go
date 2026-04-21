package mcp

import (
	"context"
	"crypto/rand"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"net"
	"net/http"
	"os"
	"os/exec"
	"path/filepath"
	"runtime"
	"time"

	"github.com/google/uuid"
	"github.com/rs/zerolog"
)

const (
	tokenFileName = ".workived_mcp_token"
	callbackPath  = "/auth/callback"
)

// TokenStore manages secure token storage
type TokenStore struct {
	RefreshToken string    `json:"refresh_token"`
	UserID       uuid.UUID `json:"user_id"`
	Role         string    `json:"role"`
	Email        string    `json:"email"`
	ExpiresAt    time.Time `json:"expires_at"`
}

// getTokenPath returns the path to the token file
func getTokenPath() string {
	home, err := os.UserHomeDir()
	if err != nil {
		home = "."
	}
	return filepath.Join(home, tokenFileName)
}

// LoadToken loads the refresh token from disk
func LoadToken() (*TokenStore, error) {
	path := getTokenPath()
	data, err := os.ReadFile(path)
	if err != nil {
		if os.IsNotExist(err) {
			return nil, fmt.Errorf("no saved session found - please login")
		}
		return nil, fmt.Errorf("failed to read token: %w", err)
	}

	var token TokenStore
	if err := json.Unmarshal(data, &token); err != nil {
		return nil, fmt.Errorf("failed to parse token: %w", err)
	}

	// Check if token is expired
	if time.Now().After(token.ExpiresAt) {
		return nil, fmt.Errorf("session expired - please login again")
	}

	return &token, nil
}

// SaveToken saves the refresh token to disk
func SaveToken(token *TokenStore) error {
	path := getTokenPath()

	data, err := json.MarshalIndent(token, "", "  ")
	if err != nil {
		return fmt.Errorf("failed to marshal token: %w", err)
	}

	// Write with restricted permissions (owner read/write only)
	if err := os.WriteFile(path, data, 0600); err != nil {
		return fmt.Errorf("failed to write token: %w", err)
	}

	return nil
}

// DeleteToken removes the saved token
func DeleteToken() error {
	path := getTokenPath()
	if err := os.Remove(path); err != nil && !os.IsNotExist(err) {
		return fmt.Errorf("failed to delete token: %w", err)
	}
	return nil
}

// SSOLogin initiates browser-based SSO login (no auth service needed - pure API flow)
func SSOLogin(ctx context.Context, appURL string, log zerolog.Logger) (*TokenStore, error) {
	// Start local HTTP server for callback
	listener, err := net.Listen("tcp", "127.0.0.1:0")
	if err != nil {
		return nil, fmt.Errorf("failed to start callback server: %w", err)
	}
	defer listener.Close()

	port := listener.Addr().(*net.TCPAddr).Port
	callbackURL := fmt.Sprintf("http://127.0.0.1:%d%s", port, callbackPath)

	// Generate state for CSRF protection
	stateBytes := make([]byte, 32)
	if _, err := rand.Read(stateBytes); err != nil {
		return nil, fmt.Errorf("failed to generate state: %w", err)
	}
	state := base64.URLEncoding.EncodeToString(stateBytes)

	// Channel to receive auth result
	resultChan := make(chan *TokenStore, 1)
	errorChan := make(chan error, 1)

	// HTTP handler for callback
	mux := http.NewServeMux()
	mux.HandleFunc(callbackPath, func(w http.ResponseWriter, r *http.Request) {
		// Verify state
		if r.URL.Query().Get("state") != state {
			errorChan <- fmt.Errorf("invalid state parameter")
			http.Error(w, "Invalid state", http.StatusBadRequest)
			return
		}

		// Get session token from query
		refreshToken := r.URL.Query().Get("token")
		userID := r.URL.Query().Get("user_id")
		email := r.URL.Query().Get("email")

		if refreshToken == "" || userID == "" {
			errorChan <- fmt.Errorf("missing token or user_id")
			http.Error(w, "Missing parameters", http.StatusBadRequest)
			return
		}

		uid, err := uuid.Parse(userID)
		if err != nil {
			errorChan <- fmt.Errorf("invalid user_id: %w", err)
			http.Error(w, "Invalid user_id", http.StatusBadRequest)
			return
		}

		// Success response
		w.Header().Set("Content-Type", "text/html")
		fmt.Fprintf(w, `
<!DOCTYPE html>
<html>
<head>
    <title>Workived MCP - Login Successful</title>
    <style>
        body {
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
            display: flex;
            justify-content: center;
            align-items: center;
            height: 100vh;
            margin: 0;
            background: linear-gradient(135deg, #667eea 0%%, #764ba2 100%%);
        }
        .container {
            background: white;
            padding: 3rem;
            border-radius: 12px;
            box-shadow: 0 10px 40px rgba(0,0,0,0.1);
            text-align: center;
            max-width: 400px;
        }
        .checkmark {
            font-size: 64px;
            color: #10b981;
            margin-bottom: 1rem;
        }
        h1 {
            color: #1f2937;
            margin-bottom: 0.5rem;
        }
        p {
            color: #6b7280;
            margin-bottom: 1.5rem;
        }
        .info {
            background: #f3f4f6;
            padding: 1rem;
            border-radius: 8px;
            font-size: 14px;
            color: #4b5563;
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="checkmark">✓</div>
        <h1>Login Successful!</h1>
        <p>You can now close this window and return to your terminal.</p>
        <div class="info">
            <strong>Logged in as:</strong><br>%s
        </div>
    </div>
</body>
</html>
`, email)

		// Send result
		resultChan <- &TokenStore{
			RefreshToken: refreshToken,
			UserID:       uid,
			Role:         "member", // Default role, will be fetched from API
			Email:        email,
			ExpiresAt:    time.Now().Add(30 * 24 * time.Hour), // 30 days
		}
	})

	// Start server
	server := &http.Server{Handler: mux}
	go func() {
		if err := server.Serve(listener); err != nil && err != http.ErrServerClosed {
			errorChan <- fmt.Errorf("server error: %w", err)
		}
	}()
	defer server.Shutdown(ctx)

	// Build login URL
	loginURL := fmt.Sprintf("%s/api/v1/mcp/login?callback=%s&state=%s",
		appURL,
		base64.URLEncoding.EncodeToString([]byte(callbackURL)),
		state,
	)

	log.Info().Str("url", loginURL).Msg("Opening browser for authentication")
	fmt.Println("\n🔐 Opening browser for authentication...")
	fmt.Printf("If the browser doesn't open, visit: %s\n\n", loginURL)

	// Open browser
	if err := openBrowser(loginURL); err != nil {
		log.Warn().Err(err).Msg("failed to open browser automatically")
	}

	// Wait for result or timeout
	select {
	case token := <-resultChan:
		log.Info().Str("email", token.Email).Msg("SSO login successful")
		return token, nil
	case err := <-errorChan:
		return nil, err
	case <-time.After(5 * time.Minute):
		return nil, fmt.Errorf("login timeout - please try again")
	case <-ctx.Done():
		return nil, fmt.Errorf("login cancelled")
	}
}

// openBrowser opens the default browser to the given URL
func openBrowser(url string) error {
	var cmd *exec.Cmd
	switch runtime.GOOS {
	case "darwin":
		cmd = exec.Command("open", url)
	case "linux":
		cmd = exec.Command("xdg-open", url)
	case "windows":
		cmd = exec.Command("rundll32", "url.dll,FileProtocolHandler", url)
	default:
		return fmt.Errorf("unsupported platform: %s", runtime.GOOS)
	}
	return cmd.Start()
}

// AuthenticateWithSSO authenticates using SSO and returns the auth context
func (s *Server) AuthenticateWithSSO(ctx context.Context, appURL string, forceLogin bool) error {
	// Try to load existing token
	var token *TokenStore
	var err error

	if !forceLogin {
		token, err = LoadToken()
		if err != nil {
			s.log.Info().Msg("No valid session found, initiating browser login")
		} else {
			s.log.Info().Str("email", token.Email).Msg("Using saved session")
		}
	} else {
		s.log.Info().Msg("Force login requested, deleting saved session")
		_ = DeleteToken()
	}

	// Perform SSO login if no valid token
	if token == nil {
		token, err = SSOLogin(ctx, appURL, s.log)
		if err != nil {
			return fmt.Errorf("SSO login failed: %w", err)
		}

		// Save token for future use
		if err := SaveToken(token); err != nil {
			s.log.Warn().Err(err).Msg("failed to save session token")
		} else {
			s.log.Info().Str("path", getTokenPath()).Msg("Session saved")
		}
	}

	// Create API client (will auto-refresh access token as needed)
	apiClient := NewAPIClient(appURL, "", token.RefreshToken, s.log)

	// Get initial access token via API
	if err := apiClient.refreshAccessToken(); err != nil {
		// Token might be invalid, try SSO login again
		s.log.Warn().Err(err).Msg("Refresh token invalid, initiating new login")
		_ = DeleteToken()

		token, err = SSOLogin(ctx, appURL, s.log)
		if err != nil {
			return fmt.Errorf("SSO login failed: %w", err)
		}

		if err := SaveToken(token); err != nil {
			s.log.Warn().Err(err).Msg("failed to save session token")
		}

		// Update client with new token and refresh
		apiClient.refreshToken = token.RefreshToken
		if err := apiClient.refreshAccessToken(); err != nil {
			return fmt.Errorf("failed to refresh token: %w", err)
		}
	}

	// Fetch user context from /api/v1/employees/me (API extracts from JWT)
	userData, err := apiClient.Get(ctx, "/api/v1/employees/me", nil)
	if err != nil {
		return fmt.Errorf("failed to fetch user context: %w", err)
	}

	var employeeResp struct {
		Data struct {
			ID             uuid.UUID  `json:"id"`
			OrganisationID uuid.UUID  `json:"organisation_id"`
			UserID         *uuid.UUID `json:"user_id"`
			Email          string     `json:"email"`
		} `json:"data"`
	}
	if err := json.Unmarshal(userData, &employeeResp); err != nil {
		return fmt.Errorf("failed to parse employee data: %w", err)
	}

	// Store auth context (minimal - API handles everything via JWT)
	s.authCtx = &AuthContext{
		UserID:         token.UserID,
		OrganisationID: employeeResp.Data.OrganisationID,
		EmployeeID:     &employeeResp.Data.ID,
		Role:           token.Role,
		Email:          employeeResp.Data.Email,
		AccessToken:    apiClient.accessToken,
		RefreshToken:   token.RefreshToken,
	}

	// Update auth context when token refreshes
	apiClient.SetOnTokenRefresh(func(newAccessToken string) {
		s.authCtx.AccessToken = newAccessToken
	})

	// Create API tool handler
	s.handler = NewAPIToolHandler(apiClient, s.log)

	s.log.Info().
		Str("user_id", token.UserID.String()).
		Str("org_id", employeeResp.Data.OrganisationID.String()).
		Str("email", employeeResp.Data.Email).
		Msg("MCP server authenticated and ready")

	return nil
}
