package auth

import (
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/workived/services/pkg/apperr"
	"golang.org/x/oauth2"
)

// HandleGoogleLogin initiates the Google OAuth flow
func (h *Handler) HandleGoogleLogin(c *gin.Context) {
	// Prevent caching of OAuth endpoints
	c.Header("Cache-Control", "no-store, no-cache, must-revalidate, private")
	c.Header("Pragma", "no-cache")
	c.Header("Expires", "0")

	state, err := h.service.GenerateOAuthState(c.Request.Context())
	if err != nil {
		h.service.LogError("oauth.generate_state_failed", err, nil)
		c.JSON(http.StatusInternalServerError, apperr.Response(apperr.New(apperr.CodeInternal, "failed to generate state")))
		return
	}

	oauthConfig := h.service.GetGoogleOAuthConfig()
	url := oauthConfig.AuthCodeURL(state, oauth2.SetAuthURLParam("prompt", "select_account"))

	h.service.LogInfo("oauth.google_login_initiated", map[string]interface{}{
		"state":        state[:8] + "...", // Log first 8 chars for tracking
		"redirect_url": oauthConfig.RedirectURL,
		"scopes":       oauthConfig.Scopes,
	})

	c.Redirect(http.StatusTemporaryRedirect, url)
}

// HandleGoogleCallback handles the OAuth callback from Google
func (h *Handler) HandleGoogleCallback(c *gin.Context) {
	// Prevent caching of OAuth endpoints
	c.Header("Cache-Control", "no-store, no-cache, must-revalidate, private")
	c.Header("Pragma", "no-cache")
	c.Header("Expires", "0")

	code := c.Query("code")
	state := c.Query("state")
	errorParam := c.Query("error")

	h.service.LogInfo("oauth.callback_received", map[string]interface{}{
		"has_code":  code != "",
		"has_state": state != "",
		"error":     errorParam,
		"query":     c.Request.URL.RawQuery,
	})

	appURL := h.service.GetAppURL()

	// Check if user denied access
	if errorParam != "" {
		h.service.LogWarn("oauth.user_denied", map[string]interface{}{"error": errorParam})
		c.Redirect(http.StatusTemporaryRedirect, appURL+"/login?error=oauth_denied")
		return
	}

	if code == "" || state == "" {
		h.service.LogError("oauth.missing_params", nil, map[string]interface{}{
			"has_code":  code != "",
			"has_state": state != "",
		})
		c.Redirect(http.StatusTemporaryRedirect, appURL+"/login?error=invalid_oauth_response")
		return
	}

	// Exchange code for token and login user
	resp, refreshToken, isExisting, err := h.service.LoginWithGoogle(c.Request.Context(), code, state)
	if err != nil {
		h.service.LogError("oauth.login_failed", err, map[string]interface{}{
			"state": state[:8] + "...",
		})
		c.Redirect(http.StatusTemporaryRedirect, appURL+"/login?error=oauth_failed")
		return
	}

	h.service.LogInfo("oauth.login_success", map[string]interface{}{
		"user_id":     resp.User.ID,
		"email":       resp.User.Email,
		"is_existing": isExisting,
	})

	// Set refresh token in httpOnly cookie
	c.SetCookie("refresh_token", refreshToken, 30*24*3600, "/", "", true, true)

	redirectURL := appURL + "/#access_token=" + resp.AccessToken
	if isExisting {
		redirectURL += "&existing=true"
	}
	h.service.LogInfo("oauth.redirecting_to_frontend", map[string]interface{}{
		"redirect_url": appURL + "/#access_token=***",
		"user_id":      resp.User.ID,
	})

	// Redirect to frontend with access token in URL fragment (will be moved to memory by frontend)
	// Using fragment (#) is safer than query params (?) as fragments are not sent to server
	c.Redirect(http.StatusTemporaryRedirect, redirectURL)
}
