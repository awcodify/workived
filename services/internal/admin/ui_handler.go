package admin

import (
	"html/template"
	"net/http"
	"path/filepath"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/golang-jwt/jwt/v5"
	"github.com/workived/services/internal/auth"
	"github.com/workived/services/internal/platform/middleware"
	"github.com/workived/services/pkg/apperr"
)

const (
	adminSessionCookie = "admin_session"
	sessionDuration    = 8 * time.Hour
)

// UIHandler serves HTML pages for the admin interface.
type UIHandler struct {
	svc       *Service
	authSvc   *auth.Service
	templates map[string]*template.Template
}

// NewUIHandler creates a new UI handler and loads templates.
func NewUIHandler(svc *Service, authSvc *auth.Service) (*UIHandler, error) {
	// Load templates - each page gets base.html + its specific template
	basePath := filepath.Join("internal", "admin", "templates", "base.html")
	templatesDir := filepath.Join("internal", "admin", "templates")

	templates := make(map[string]*template.Template)

	// Parse each page template with base
	pages := []string{"dashboard.html", "feature-flags.html", "licenses.html", "error.html"}
	for _, page := range pages {
		pagePath := filepath.Join(templatesDir, page)
		tmpl, err := template.ParseFiles(basePath, pagePath)
		if err != nil {
			return nil, err
		}
		templates[page] = tmpl
	}

	// Parse login separately (doesn't use base)
	loginPath := filepath.Join(templatesDir, "login.html")
	loginTmpl, err := template.ParseFiles(loginPath)
	if err != nil {
		return nil, err
	}
	templates["login.html"] = loginTmpl

	return &UIHandler{
		svc:       svc,
		authSvc:   authSvc,
		templates: templates,
	}, nil
}

// RegisterUIRoutes registers all admin UI routes under /admin
func (h *UIHandler) RegisterUIRoutes(r *gin.Engine, jwtSecret string) {
	admin := r.Group("/admin")

	// Public routes (no auth required)
	admin.GET("/login", h.LoginPage)
	admin.POST("/login", h.HandleLogin)

	// Protected routes (authentication + super_admin role required)
	protected := admin.Group("")
	protected.Use(h.RequireAdminSession(jwtSecret))
	{
		protected.GET("", h.Dashboard)
		protected.GET("/", h.Dashboard)
		protected.GET("/feature-flags", h.FeatureFlags)
		protected.POST("/feature-flags/:key/toggle", h.ToggleFeatureFlag)
		protected.GET("/licenses", h.Licenses)
		protected.GET("/configs", h.Configs)
		protected.GET("/organizations", h.Organizations)
		protected.POST("/logout", h.Logout)
	}
}

// RequireAdminSession is middleware that checks for valid admin session cookie
func (h *UIHandler) RequireAdminSession(jwtSecret string) gin.HandlerFunc {
	return func(c *gin.Context) {
		sessionToken, err := c.Cookie(adminSessionCookie)
		if err != nil || sessionToken == "" {
			c.Redirect(http.StatusSeeOther, "/admin/login")
			c.Abort()
			return
		}

		// Validate JWT token manually (don't use API middleware which returns JSON)
		claims := &middleware.Claims{}
		token, err := jwt.ParseWithClaims(sessionToken, claims, func(t *jwt.Token) (any, error) {
			if _, ok := t.Method.(*jwt.SigningMethodHMAC); !ok {
				return nil, apperr.Unauthorized()
			}
			return []byte(jwtSecret), nil
		})

		if err != nil || !token.Valid {
			c.Redirect(http.StatusSeeOther, "/admin/login?error=session_expired")
			c.Abort()
			return
		}

		// Store claims in context for downstream handlers
		c.Set("user_id", claims.UserID)
		c.Set("org_id", claims.OrgID)
		c.Set("role", claims.Role)

		// Check for super_admin role (UI-specific - redirect instead of JSON error)
		if claims.Role != middleware.RoleSuperAdmin {
			c.Redirect(http.StatusSeeOther, "/admin/login?error=insufficient_permissions")
			c.Abort()
			return
		}

		c.Next()
	}
}

// getUserFromContext extracts user info from Gin context
func (h *UIHandler) getUserFromContext(c *gin.Context) gin.H {
	userID := middleware.UserIDFromCtx(c)
	return gin.H{
		"ID":    userID.String(),
		"Email": userID.String(), // Use user ID as email display for now
	}
}

// LoginPage renders the admin login page
func (h *UIHandler) LoginPage(c *gin.Context) {
	error := c.Query("error")
	data := gin.H{
		"Error": error,
	}

	c.Writer.Header().Set("Content-Type", "text/html; charset=utf-8")
	if err := h.templates["login.html"].Execute(c.Writer, data); err != nil {
		c.String(http.StatusInternalServerError, "Template error: %v", err)
	}
}

// HandleLogin processes the login form submission
func (h *UIHandler) HandleLogin(c *gin.Context) {
	email := c.PostForm("email")
	password := c.PostForm("password")

	// Authenticate using auth service
	loginResp, refreshToken, err := h.authSvc.Login(c.Request.Context(), auth.LoginRequest{
		Email:    email,
		Password: password,
	})
	if err != nil {
		c.Redirect(http.StatusSeeOther, "/admin/login?error=invalid_credentials")
		return
	}

	// Note: refreshToken is returned but we don't use it for admin UI
	_ = refreshToken

	// Check if user is super_admin (get their role from org membership)
	// Note: The token already contains the role, but we should verify it
	// For now, we trust the token. In production, add explicit role check here.

	// Set session cookie (httpOnly, secure in production)
	c.SetCookie(
		adminSessionCookie,
		loginResp.AccessToken,
		int(sessionDuration.Seconds()),
		"/admin",
		"",                   // domain
		c.Request.TLS != nil, // secure: true if HTTPS
		true,                 // httpOnly
	)

	// Store user email in a separate cookie for display
	c.SetCookie(
		"admin_user_email",
		loginResp.User.Email,
		int(sessionDuration.Seconds()),
		"/admin",
		"",
		c.Request.TLS != nil,
		false, // not httpOnly so JS can read it
	)

	c.Redirect(http.StatusSeeOther, "/admin")
}

// Dashboard renders the admin dashboard with system stats.
func (h *UIHandler) Dashboard(c *gin.Context) {
	stats, err := h.svc.GetSystemStats(c.Request.Context())
	if err != nil {
		h.renderError(c, err)
		return
	}

	// Get user email from cookie
	userEmail, _ := c.Cookie("admin_user_email")

	data := gin.H{
		"User":  gin.H{"Email": userEmail},
		"Stats": stats,
	}

	c.Writer.Header().Set("Content-Type", "text/html; charset=utf-8")
	if err := h.templates["dashboard.html"].ExecuteTemplate(c.Writer, "base.html", data); err != nil {
		c.String(http.StatusInternalServerError, "Template error: %v", err)
	}
}

// FeatureFlags renders the feature flags management page.
func (h *UIHandler) FeatureFlags(c *gin.Context) {
	flags, err := h.svc.ListFeatureFlags(c.Request.Context())
	if err != nil {
		h.renderError(c, err)
		return
	}

	userEmail, _ := c.Cookie("admin_user_email")
	data := gin.H{
		"User":  gin.H{"Email": userEmail},
		"Flags": flags,
	}

	c.Writer.Header().Set("Content-Type", "text/html; charset=utf-8")
	if err := h.templates["feature-flags.html"].ExecuteTemplate(c.Writer, "base.html", data); err != nil {
		c.String(http.StatusInternalServerError, "Template error: %v", err)
	}
}

// ToggleFeatureFlag handles the form POST to toggle a feature flag.
func (h *UIHandler) ToggleFeatureFlag(c *gin.Context) {
	key := c.Param("key")
	uid := middleware.UserIDFromCtx(c)

	// Get current flag state
	flag, err := h.svc.GetFeatureFlagByKey(c.Request.Context(), key)
	if err != nil {
		h.renderError(c, err)
		return
	}

	// Toggle the state
	req := UpdateFeatureFlagRequest{
		IsEnabled: !flag.IsEnabled,
	}

	_, err = h.svc.UpdateFeatureFlag(c.Request.Context(), key, req, uid)
	if err != nil {
		h.renderError(c, err)
		return
	}

	// Redirect back to feature flags page
	c.Redirect(http.StatusSeeOther, "/admin/feature-flags")
}

// Licenses renders the Pro licenses management page.
func (h *UIHandler) Licenses(c *gin.Context) {
	licenses, err := h.svc.ListProLicenses(c.Request.Context(), nil)
	if err != nil {
		h.renderError(c, err)
		return
	}

	userEmail, _ := c.Cookie("admin_user_email")
	data := gin.H{
		"User":     gin.H{"Email": userEmail},
		"Licenses": licenses,
	}

	c.Writer.Header().Set("Content-Type", "text/html; charset=utf-8")
	if err := h.templates["licenses.html"].ExecuteTemplate(c.Writer, "base.html", data); err != nil {
		c.String(http.StatusInternalServerError, "Template error: %v", err)
	}
}

// Configs renders the admin configs page.
func (h *UIHandler) Configs(c *gin.Context) {
	userEmail, _ := c.Cookie("admin_user_email")
	_ = userEmail // TODO: use in template when implemented

	c.Writer.Header().Set("Content-Type", "text/html; charset=utf-8")
	c.String(http.StatusOK, "Admin configs page (to be implemented)")
}

// Organizations renders the organizations list page.
func (h *UIHandler) Organizations(c *gin.Context) {
	userEmail, _ := c.Cookie("admin_user_email")
	_ = userEmail // TODO: use in template when implemented

	c.Writer.Header().Set("Content-Type", "text/html; charset=utf-8")
	c.String(http.StatusOK, "Organizations page (to be implemented)")
}

// Logout handles logout and clears session cookie.
func (h *UIHandler) Logout(c *gin.Context) {
	// Clear session cookie
	c.SetCookie(adminSessionCookie, "", -1, "/admin", "", false, true)
	c.SetCookie("admin_user_email", "", -1, "/admin", "", false, false)
	c.Redirect(http.StatusSeeOther, "/admin/login")
}

// renderError renders an error page.
func (h *UIHandler) renderError(c *gin.Context, err error) {
	status := apperr.HTTPStatus(err)
	message := err.Error()

	userEmail, _ := c.Cookie("admin_user_email")
	data := gin.H{
		"User":    gin.H{"Email": userEmail},
		"Status":  status,
		"Message": message,
	}

	c.Writer.Header().Set("Content-Type", "text/html; charset=utf-8")
	if renderErr := h.templates["error.html"].ExecuteTemplate(c.Writer, "base.html", data); renderErr != nil {
		c.String(http.StatusInternalServerError, "Template error: %v", renderErr)
	}
}
