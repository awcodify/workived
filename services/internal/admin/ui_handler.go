package admin

import (
	"fmt"
	"html/template"
	"net/http"
	"path/filepath"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/golang-jwt/jwt/v5"
	"github.com/google/uuid"
	"github.com/rs/zerolog"
	"github.com/workived/services/internal/platform/middleware"
	"github.com/workived/services/internal/staff"
	"github.com/workived/services/pkg/apperr"
)

const (
	adminSessionCookie = "admin_session"
	sessionDuration    = 8 * time.Hour
)

// UIHandler serves HTML pages for the admin interface.
type UIHandler struct {
	svc       *Service
	staffSvc  *staff.Service
	staffRepo *staff.Repository
	templates map[string]*template.Template
	log       zerolog.Logger
}

// NewUIHandler creates a new UI handler and loads templates.
func NewUIHandler(svc *Service, staffSvc *staff.Service, staffRepo *staff.Repository) (*UIHandler, error) {
	// Load templates - each page gets base.html + its specific template
	basePath := filepath.Join("internal", "admin", "templates", "base.html")
	templatesDir := filepath.Join("internal", "admin", "templates")

	templates := make(map[string]*template.Template)

	// Parse each page template with base
	pages := []string{"dashboard.html", "feature-flags.html", "licenses.html", "organizations.html", "error.html"}
	for _, page := range pages {
		pagePath := filepath.Join(templatesDir, page)
		tmpl, err := template.ParseFiles(basePath, pagePath)
		if err != nil {
			return nil, err
		}
		templates[page] = tmpl
	}

	// Parse login and setup separately (don't use base)
	loginPath := filepath.Join(templatesDir, "login.html")
	loginTmpl, err := template.ParseFiles(loginPath)
	if err != nil {
		return nil, err
	}
	templates["login.html"] = loginTmpl

	setupPath := filepath.Join(templatesDir, "setup.html")
	setupTmpl, err := template.ParseFiles(setupPath)
	if err != nil {
		return nil, err
	}
	templates["setup.html"] = setupTmpl

	return &UIHandler{
		svc:       svc,
		staffSvc:  staffSvc,
		staffRepo: staffRepo,
		templates: templates,
		log:       svc.log,
	}, nil
}

// RegisterUIRoutes registers all admin UI routes under /_system
func (h *UIHandler) RegisterUIRoutes(r *gin.Engine, jwtSecret string) {
	admin := r.Group("/_system")

	// One-time setup routes (only accessible if no internal admins exist)
	admin.GET("/setup", h.SetupPage)
	admin.POST("/setup", h.HandleSetup)

	// Public routes (no auth required)
	admin.GET("/login", h.redirectToSetupIfNeeded, h.LoginPage)
	admin.POST("/login", h.HandleLogin)

	// Protected routes (authentication required - staff admins only)
	// DATA PRIVACY: These routes manage Workived platform settings only.
	// Staff admins have NO ACCESS to customer organization data.
	protected := admin.Group("")
	protected.Use(h.RequireAdminSession(jwtSecret))
	{
		protected.GET("", h.Dashboard)
		protected.GET("/", h.Dashboard)
		protected.GET("/health", h.HealthJSON)
		protected.GET("/feature-flags", h.FeatureFlags)
		protected.POST("/feature-flags/:key/toggle", h.ToggleFeatureFlag)
		protected.GET("/licenses", h.Licenses)
		protected.POST("/licenses/create", h.CreateLicense)
		protected.POST("/licenses/:id/update", h.UpdateLicense)
		protected.POST("/licenses/:id/extend", h.ExtendLicense)
		protected.GET("/organizations", h.Organizations)
		protected.POST("/organizations/:id/suspend", h.SuspendOrganization)
		protected.POST("/organizations/:id/reactivate", h.ReactivateOrganization)
		protected.GET("/configs", h.Configs)
		protected.POST("/logout", h.Logout)
	}
}

// RequireAdminSession is middleware that checks for valid admin session cookie
func (h *UIHandler) RequireAdminSession(jwtSecret string) gin.HandlerFunc {
	return func(c *gin.Context) {
		sessionToken, err := c.Cookie(adminSessionCookie)
		if err != nil || sessionToken == "" {
			c.Redirect(http.StatusSeeOther, "/_system/login")
			c.Abort()
			return
		}

		// Validate JWT token manually (don't use API middleware which returns JSON)
		claims := &staff.Claims{}
		token, err := jwt.ParseWithClaims(sessionToken, claims, func(t *jwt.Token) (any, error) {
			if _, ok := t.Method.(*jwt.SigningMethodHMAC); !ok {
				return nil, apperr.Unauthorized()
			}
			return []byte(jwtSecret), nil
		})

		if err != nil || !token.Valid {
			c.Redirect(http.StatusSeeOther, "/_system/login?error=session_expired")
			c.Abort()
			return
		}

		// Verify this is an internal admin token
		if claims.InternalAdminID == uuid.Nil {
			c.Redirect(http.StatusSeeOther, "/_system/login?error=invalid_token")
			c.Abort()
			return
		}

		// Verify admin is still active in database
		if !h.staffRepo.IsActive(c.Request.Context(), claims.InternalAdminID) {
			c.Redirect(http.StatusSeeOther, "/_system/login?error=insufficient_permissions")
			c.Abort()
			return
		}

		// Store admin ID in context
		c.Set("internal_admin_id", claims.InternalAdminID)
		c.Set("is_internal_admin", true)

		c.Next()
	}
}

// redirectToSetupIfNeeded redirects to setup page if no internal admins exist yet
func (h *UIHandler) redirectToSetupIfNeeded(c *gin.Context) {
	if !h.staffRepo.HasAny(c.Request.Context()) {
		c.Redirect(http.StatusSeeOther, "/_system/setup")
		c.Abort()
		return
	}
	c.Next()
}

// SetupPage renders the one-time setup page
func (h *UIHandler) SetupPage(c *gin.Context) {
	// Check if setup is still needed
	if h.staffRepo.HasAny(c.Request.Context()) {
		c.Redirect(http.StatusSeeOther, "/_system/login")
		return
	}

	error := c.Query("error")
	data := gin.H{
		"Error": error,
	}

	c.Writer.Header().Set("Content-Type", "text/html; charset=utf-8")
	if err := h.templates["setup.html"].Execute(c.Writer, data); err != nil {
		c.String(http.StatusInternalServerError, "Template error: %v", err)
	}
}

// HandleSetup processes the one-time setup form
func (h *UIHandler) HandleSetup(c *gin.Context) {
	// Check if setup is still needed
	if h.staffRepo.HasAny(c.Request.Context()) {
		c.Redirect(http.StatusSeeOther, "/_system/login")
		return
	}

	email := c.PostForm("email")
	password := c.PostForm("password")
	fullName := c.PostForm("full_name")

	// Validate input
	if email == "" || password == "" || fullName == "" {
		c.Redirect(http.StatusSeeOther, "/_system/setup?error=missing_fields")
		return
	}

	// Create the first internal admin
	admin, err := h.staffSvc.Create(c.Request.Context(), email, password, fullName)
	if err != nil {
		c.Redirect(http.StatusSeeOther, "/_system/setup?error=setup_failed")
		return
	}

	// Login the newly created admin
	loginResp, err := h.staffSvc.Login(c.Request.Context(), email, password)
	if err != nil {
		c.Redirect(http.StatusSeeOther, "/_system/login")
		return
	}

	// Set session cookie
	c.SetCookie(
		adminSessionCookie,
		loginResp.AccessToken,
		int(sessionDuration.Seconds()),
		"/_system",
		"",
		c.Request.TLS != nil,
		true,
	)

	c.SetCookie(
		"admin_user_email",
		admin.Email,
		int(sessionDuration.Seconds()),
		"/_system",
		"",
		c.Request.TLS != nil,
		false,
	)

	c.Redirect(http.StatusSeeOther, "/_system")
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

	// Authenticate as internal admin
	loginResp, err := h.staffSvc.Login(c.Request.Context(), email, password)
	if err != nil {
		c.Redirect(http.StatusSeeOther, "/_system/login?error=invalid_credentials")
		return
	}

	// Set session cookie (httpOnly, secure in production)
	c.SetCookie(
		adminSessionCookie,
		loginResp.AccessToken,
		int(sessionDuration.Seconds()),
		"/_system",
		"",                   // domain
		c.Request.TLS != nil, // secure: true if HTTPS
		true,                 // httpOnly
	)

	// Store admin email in a separate cookie for display
	c.SetCookie(
		"admin_user_email",
		loginResp.Admin.Email,
		int(sessionDuration.Seconds()),
		"/_system",
		"",
		c.Request.TLS != nil,
		false, // not httpOnly so JS can read it
	)

	c.Redirect(http.StatusSeeOther, "/_system")
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

// HealthJSON returns system health metrics as JSON for dashboard auto-refresh.
func (h *UIHandler) HealthJSON(c *gin.Context) {
	health, err := h.svc.GetSystemHealth(c.Request.Context())
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch health data"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"data": health})
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
	c.Redirect(http.StatusSeeOther, "/_system/feature-flags")
}

// Licenses renders the Pro licenses management page.
func (h *UIHandler) Licenses(c *gin.Context) {
	// Get filter parameters
	search := c.Query("search")
	statusFilter := c.Query("status")

	// Fetch all licenses
	var status *string
	if statusFilter != "" && statusFilter != "expiring" {
		status = &statusFilter
	}
	allLicenses, err := h.svc.ListProLicenses(c.Request.Context(), status)
	if err != nil {
		h.renderError(c, err)
		return
	}

	// Apply filters
	var licenses []ProLicense
	for _, l := range allLicenses {
		// Apply search filter
		if search != "" {
			if !containsIgnoreCase(l.OrganisationName, search) &&
				!containsIgnoreCase(l.OrganisationID.String(), search) {
				continue
			}
		}

		// Apply "expiring" filter
		if statusFilter == "expiring" {
			if l.Status != "active" || l.DaysUntilExpiry() > 7 || l.DaysUntilExpiry() < 0 {
				continue
			}
		}

		licenses = append(licenses, l)
	}

	// Calculate stats
	stats := struct {
		Total        int
		Active       int
		ExpiringSoon int
		Expired      int
	}{}

	for _, l := range allLicenses {
		stats.Total++
		if l.Status == "active" {
			stats.Active++
			if l.DaysUntilExpiry() <= 7 && l.DaysUntilExpiry() >= 0 {
				stats.ExpiringSoon++
			}
		} else if l.Status == "expired" {
			stats.Expired++
		}
	}

	userEmail, _ := c.Cookie("admin_user_email")
	data := gin.H{
		"User":     gin.H{"Email": userEmail},
		"Licenses": licenses,
		"Stats":    stats,
		"Filters": gin.H{
			"Search": search,
			"Status": statusFilter,
		},
	}

	c.Writer.Header().Set("Content-Type", "text/html; charset=utf-8")
	if err := h.templates["licenses.html"].ExecuteTemplate(c.Writer, "base.html", data); err != nil {
		c.String(http.StatusInternalServerError, "Template error: %v", err)
	}
}

// CreateLicense handles the create license form submission.
func (h *UIHandler) CreateLicense(c *gin.Context) {
	adminID, _ := c.Get("internal_admin_id")
	staffAdminID := adminID.(uuid.UUID)

	// Parse form
	orgIDStr := c.PostForm("organisation_id")
	orgID, err := uuid.Parse(orgIDStr)
	if err != nil {
		h.log.Error().Err(err).Str("org_id_str", orgIDStr).Msg("invalid organisation ID for license creation")
		c.Redirect(http.StatusSeeOther, "/_system/licenses?error=invalid_org_id")
		return
	}

	licenseType := c.PostForm("license_type")
	durationDaysStr := c.PostForm("duration_days")
	durationDays := 14 // default
	if durationDaysStr != "" {
		fmt.Sscanf(durationDaysStr, "%d", &durationDays)
	}

	var maxEmployees *int
	maxEmployeesStr := c.PostForm("max_employees")
	if maxEmployeesStr != "" {
		var val int
		fmt.Sscanf(maxEmployeesStr, "%d", &val)
		maxEmployees = &val
	}

	req := CreateProLicenseRequest{
		OrganisationID: orgID,
		LicenseType:    licenseType,
		MaxEmployees:   maxEmployees,
		DurationDays:   durationDays,
	}

	h.log.Info().
		Str("org_id", orgID.String()).
		Str("license_type", licenseType).
		Int("duration_days", durationDays).
		Str("staff_admin_id", staffAdminID.String()).
		Msg("attempting to create pro license")

	_, err = h.svc.CreateProLicenseByStaffAdmin(c.Request.Context(), req, staffAdminID)
	if err != nil {
		h.log.Error().
			Err(err).
			Str("org_id", orgID.String()).
			Str("license_type", licenseType).
			Msg("failed to create pro license")
		c.Redirect(http.StatusSeeOther, "/_system/licenses?error=create_failed")
		return
	}

	h.log.Info().Str("org_id", orgID.String()).Msg("pro license created successfully")
	c.Redirect(http.StatusSeeOther, "/_system/licenses")
}

// UpdateLicense handles the update license form submission.
func (h *UIHandler) UpdateLicense(c *gin.Context) {
	licenseIDStr := c.Param("id")
	licenseID, err := uuid.Parse(licenseIDStr)
	if err != nil {
		c.Redirect(http.StatusSeeOther, "/_system/licenses?error=invalid_id")
		return
	}

	// Parse form
	status := c.PostForm("status")
	expiresAtStr := c.PostForm("expires_at")
	maxEmployeesStr := c.PostForm("max_employees")

	var expiresAt *time.Time
	if expiresAtStr != "" {
		parsed, err := time.Parse("2006-01-02", expiresAtStr)
		if err == nil {
			expiresAt = &parsed
		}
	}

	var maxEmployees *int
	if maxEmployeesStr != "" {
		var val int
		fmt.Sscanf(maxEmployeesStr, "%d", &val)
		maxEmployees = &val
	}

	req := UpdateProLicenseRequest{
		Status:       &status,
		ExpiresAt:    expiresAt,
		MaxEmployees: maxEmployees,
	}

	_, err = h.svc.UpdateProLicense(c.Request.Context(), licenseID, req)
	if err != nil {
		c.Redirect(http.StatusSeeOther, "/_system/licenses?error=update_failed")
		return
	}

	c.Redirect(http.StatusSeeOther, "/_system/licenses")
}

// ExtendLicense extends a license by 30 days.
func (h *UIHandler) ExtendLicense(c *gin.Context) {
	licenseIDStr := c.Param("id")
	licenseID, err := uuid.Parse(licenseIDStr)
	if err != nil {
		c.Redirect(http.StatusSeeOther, "/_system/licenses?error=invalid_id")
		return
	}

	// Get current license
	license, err := h.svc.repo.GetProLicenseByID(c.Request.Context(), licenseID)
	if err != nil {
		c.Redirect(http.StatusSeeOther, "/_system/licenses?error=license_not_found")
		return
	}

	// Extend by 30 days
	newExpiresAt := license.ExpiresAt.AddDate(0, 0, 30)
	req := UpdateProLicenseRequest{
		ExpiresAt: &newExpiresAt,
	}

	_, err = h.svc.UpdateProLicense(c.Request.Context(), licenseID, req)
	if err != nil {
		c.Redirect(http.StatusSeeOther, "/_system/licenses?error=extend_failed")
		return
	}

	c.Redirect(http.StatusSeeOther, "/_system/licenses")
}

// containsIgnoreCase checks if s contains substr (case-insensitive).
func containsIgnoreCase(s, substr string) bool {
	s = strings.ToLower(s)
	substr = strings.ToLower(substr)
	return strings.Contains(s, substr)
}

// Configs renders the admin configs page.
func (h *UIHandler) Configs(c *gin.Context) {
	userEmail, _ := c.Cookie("admin_user_email")
	_ = userEmail // TODO: use in template when implemented

	c.Writer.Header().Set("Content-Type", "text/html; charset=utf-8")
	c.String(http.StatusOK, "Admin configs page (to be implemented)")
}

// Organizations renders the organizations management page.
func (h *UIHandler) Organizations(c *gin.Context) {
	orgs, err := h.svc.ListOrganisations(c.Request.Context())
	if err != nil {
		h.renderError(c, err)
		return
	}

	userEmail, _ := c.Cookie("admin_user_email")
	data := gin.H{
		"User":          gin.H{"Email": userEmail},
		"Organizations": orgs,
		"Title":         "Organizations",
	}

	c.Writer.Header().Set("Content-Type", "text/html; charset=utf-8")
	if renderErr := h.templates["organizations.html"].ExecuteTemplate(c.Writer, "base.html", data); renderErr != nil {
		c.String(http.StatusInternalServerError, "Template error: %v", renderErr)
	}
}

// SuspendOrganization sets an organization as inactive.
func (h *UIHandler) SuspendOrganization(c *gin.Context) {
	orgID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid organisation ID"})
		return
	}

	// Get admin user ID from context
	adminUserID, exists := c.Get("internal_admin_id")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "unauthorized"})
		return
	}

	if err := h.svc.SuspendOrganisation(c.Request.Context(), orgID, adminUserID.(uuid.UUID)); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.Redirect(http.StatusSeeOther, "/_system/organizations")
}

// ReactivateOrganization sets an organization as active.
func (h *UIHandler) ReactivateOrganization(c *gin.Context) {
	orgID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid organisation ID"})
		return
	}

	// Get admin user ID from context
	adminUserID, exists := c.Get("internal_admin_id")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "unauthorized"})
		return
	}

	if err := h.svc.ReactivateOrganisation(c.Request.Context(), orgID, adminUserID.(uuid.UUID)); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.Redirect(http.StatusSeeOther, "/_system/organizations")
}

// Logout handles logout and clears session cookie.
func (h *UIHandler) Logout(c *gin.Context) {
	// Clear session cookie
	c.SetCookie(adminSessionCookie, "", -1, "/_system", "", false, true)
	c.SetCookie("admin_user_email", "", -1, "/_system", "", false, false)
	c.Redirect(http.StatusSeeOther, "/_system/login")
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
