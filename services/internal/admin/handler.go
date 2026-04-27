// Package admin provides platform-level administration for Workived staff.
//
// DATA PRIVACY BOUNDARIES:
// - Staff admins manage Workived platform settings (feature flags, licenses, configs)
// - Staff admins CAN SEE: organization names/IDs (for license management)
// - Staff admins CANNOT ACCESS: employee data, attendance, payroll, HR records, tasks, etc.
// - All customer HR data access goes through the separate API service with proper tenancy
package admin

import (
	"context"
	"fmt"
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/rs/zerolog"
	"github.com/workived/services/internal/platform/middleware"
	"github.com/workived/services/pkg/apperr"
	"github.com/workived/services/pkg/notify"
)

type Handler struct {
	svc           *Service
	importHandler *ImportHandler
	notifier      notify.Notifier
	log           zerolog.Logger
}

func NewHandler(svc *Service, log zerolog.Logger) *Handler {
	return &Handler{
		svc:      svc,
		notifier: &notify.NoOpNotifier{},
		log:      log,
	}
}

// WithImportHandler sets the import handler for staff import operations.
func (h *Handler) WithImportHandler(importHandler *ImportHandler) *Handler {
	h.importHandler = importHandler
	return h
}

// WithNotifier sets the notifier used by the test-notification endpoint.
func (h *Handler) WithNotifier(n notify.Notifier) *Handler {
	h.notifier = n
	return h
}

func (h *Handler) logAndRespondError(c *gin.Context, err error, msg string, fields map[string]string) {
	event := h.log.Error().Err(err)
	for k, v := range fields {
		event = event.Str(k, v)
	}
	event.Msg(msg)
	c.JSON(apperr.HTTPStatus(err), apperr.Response(err))
}

// RegisterStaffRoutes registers all admin routes for staff binary.
// Protected by staff authentication middleware (applied at router level).
//
// DATA PRIVACY: Staff admins manage Workived platform settings (feature flags,
// licenses, configs) but have NO ACCESS to customer organization data.
func (h *Handler) RegisterStaffRoutes(r *gin.RouterGroup) {
	admin := r.Group("/admin")

	// System stats
	admin.GET("/stats", h.GetSystemStats)

	// Feature flags
	admin.GET("/feature-flags", h.ListFeatureFlags)
	admin.GET("/feature-flags/:key", h.GetFeatureFlagByKey)
	admin.PATCH("/feature-flags/:key", h.UpdateFeatureFlag)

	// Pro licenses
	admin.GET("/pro-licenses", h.ListProLicenses)
	admin.GET("/pro-licenses/org/:orgId", h.GetProLicenseByOrg)
	admin.POST("/pro-licenses", h.CreateProLicense)
	admin.PATCH("/pro-licenses/:id", h.UpdateProLicense)

	// Admin configs
	admin.GET("/configs", h.ListAdminConfigs)
	admin.PATCH("/configs/:key", h.UpdateAdminConfig)

	// Import tools
	admin.POST("/import/linear-tasks", h.ImportLinearTasks)
	admin.POST("/import/linear-projects", h.FetchLinearProjects)
	admin.POST("/import/linear-users", h.FetchLinearUsers)
}

// RegisterPublicRoutes registers auth-only (non-admin) feature-check routes.
func (h *Handler) RegisterPublicRoutes(r *gin.RouterGroup) {
	r.GET("/features", h.GetEnabledFeatures)
	r.POST("/notifications/test", h.SendTestNotification)
}

// ── System Stats ────────────────────────────────────────────────────────────

func (h *Handler) GetSystemStats(c *gin.Context) {
	stats, err := h.svc.GetSystemStats(c.Request.Context())
	if err != nil {
		h.logAndRespondError(c, err, "failed to get system stats", nil)
		return
	}
	c.JSON(http.StatusOK, gin.H{"data": stats})
}

// ── Feature Flags ───────────────────────────────────────────────────────────

func (h *Handler) ListFeatureFlags(c *gin.Context) {
	flags, err := h.svc.ListFeatureFlags(c.Request.Context())
	if err != nil {
		h.logAndRespondError(c, err, "failed to list feature flags", nil)
		return
	}
	c.JSON(http.StatusOK, gin.H{"data": flags})
}

func (h *Handler) GetFeatureFlagByKey(c *gin.Context) {
	key := c.Param("key")
	flag, err := h.svc.GetFeatureFlagByKey(c.Request.Context(), key)
	if err != nil {
		h.logAndRespondError(c, err, "failed to get feature flag", map[string]string{
			"feature_key": key,
		})
		return
	}
	c.JSON(http.StatusOK, gin.H{"data": flag})
}

func (h *Handler) UpdateFeatureFlag(c *gin.Context) {
	key := c.Param("key")
	uid := middleware.UserIDFromCtx(c)

	var req UpdateFeatureFlagRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(apperr.HTTPStatus(apperr.New(apperr.CodeValidation, err.Error())), apperr.Response(apperr.New(apperr.CodeValidation, err.Error())))
		return
	}

	flag, err := h.svc.UpdateFeatureFlag(c.Request.Context(), key, req, uid)
	if err != nil {
		h.logAndRespondError(c, err, "failed to update feature flag", map[string]string{
			"feature_key": key,
			"user_id":     uid.String(),
		})
		return
	}
	c.JSON(http.StatusOK, gin.H{"data": flag})
}

// ── Pro Licenses ────────────────────────────────────────────────────────────

func (h *Handler) ListProLicenses(c *gin.Context) {
	status := c.Query("status") // Optional: filter by status
	var statusPtr *string
	if status != "" {
		statusPtr = &status
	}

	licenses, err := h.svc.ListProLicenses(c.Request.Context(), statusPtr)
	if err != nil {
		h.logAndRespondError(c, err, "failed to list pro licenses", nil)
		return
	}
	c.JSON(http.StatusOK, gin.H{"data": licenses})
}

func (h *Handler) GetProLicenseByOrg(c *gin.Context) {
	orgIDStr := c.Param("orgId")
	orgID, err := uuid.Parse(orgIDStr)
	if err != nil {
		c.JSON(apperr.HTTPStatus(apperr.New(apperr.CodeValidation, "invalid organisation ID")), apperr.Response(apperr.New(apperr.CodeValidation, "invalid organisation ID")))
		return
	}

	license, err := h.svc.GetProLicenseByOrg(c.Request.Context(), orgID)
	if err != nil {
		h.logAndRespondError(c, err, "failed to get pro license", map[string]string{
			"org_id": orgID.String(),
		})
		return
	}
	c.JSON(http.StatusOK, gin.H{"data": license})
}

func (h *Handler) CreateProLicense(c *gin.Context) {
	uid := middleware.UserIDFromCtx(c)

	var req CreateProLicenseRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(apperr.HTTPStatus(apperr.New(apperr.CodeValidation, err.Error())), apperr.Response(apperr.New(apperr.CodeValidation, err.Error())))
		return
	}

	license, err := h.svc.CreateProLicense(c.Request.Context(), req, uid)
	if err != nil {
		h.logAndRespondError(c, err, "failed to create pro license", map[string]string{
			"org_id":  req.OrganisationID.String(),
			"user_id": uid.String(),
		})
		return
	}
	c.JSON(http.StatusCreated, gin.H{"data": license})
}

func (h *Handler) UpdateProLicense(c *gin.Context) {
	licenseIDStr := c.Param("id")
	licenseID, err := uuid.Parse(licenseIDStr)
	if err != nil {
		c.JSON(apperr.HTTPStatus(apperr.New(apperr.CodeValidation, "invalid license ID")), apperr.Response(apperr.New(apperr.CodeValidation, "invalid license ID")))
		return
	}

	var req UpdateProLicenseRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(apperr.HTTPStatus(apperr.New(apperr.CodeValidation, err.Error())), apperr.Response(apperr.New(apperr.CodeValidation, err.Error())))
		return
	}

	license, err := h.svc.UpdateProLicense(c.Request.Context(), licenseID, req)
	if err != nil {
		h.logAndRespondError(c, err, "failed to update pro license", map[string]string{
			"license_id": licenseID.String(),
		})
		return
	}
	c.JSON(http.StatusOK, gin.H{"data": license})
}

// ── Admin Configs ───────────────────────────────────────────────────────────

func (h *Handler) ListAdminConfigs(c *gin.Context) {
	configs, err := h.svc.ListAdminConfigs(c.Request.Context())
	if err != nil {
		h.logAndRespondError(c, err, "failed to list admin configs", nil)
		return
	}
	c.JSON(http.StatusOK, gin.H{"data": configs})
}

func (h *Handler) UpdateAdminConfig(c *gin.Context) {
	key := c.Param("key")
	uid := middleware.UserIDFromCtx(c)

	var req UpdateAdminConfigRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(apperr.HTTPStatus(apperr.New(apperr.CodeValidation, err.Error())), apperr.Response(apperr.New(apperr.CodeValidation, err.Error())))
		return
	}

	config, err := h.svc.UpdateAdminConfig(c.Request.Context(), key, req, uid)
	if err != nil {
		h.logAndRespondError(c, err, "failed to update admin config", map[string]string{
			"config_key": key,
			"user_id":    uid.String(),
		})
		return
	}
	c.JSON(http.StatusOK, gin.H{"data": config})
}

// ── Public feature-flag check ────────────────────────────────────────────────

// GetEnabledFeatures returns a map of feature_key → bool for the current user's org.
// This endpoint is auth-only (available to any authenticated user).
func (h *Handler) GetEnabledFeatures(c *gin.Context) {
	orgID := middleware.OrgIDFromCtx(c)
	userID := middleware.UserIDFromCtx(c)

	features, err := h.svc.GetEnabledFeaturesForOrg(c.Request.Context(), orgID, userID)
	if err != nil {
		h.logAndRespondError(c, err, "failed to get enabled features", map[string]string{
			"org_id":  orgID.String(),
			"user_id": userID.String(),
		})
		return
	}
	c.JSON(http.StatusOK, gin.H{"data": features})
}

// ── Import Tools ─────────────────────────────────────────────────────────────

// ImportLinearTasks delegates to the import handler
func (h *Handler) ImportLinearTasks(c *gin.Context) {
	if h.importHandler == nil {
		c.JSON(http.StatusNotImplemented, apperr.Response(apperr.New(apperr.CodeNotFound, "import functionality not enabled")))
		return
	}
	h.importHandler.ImportLinearTasks(c)
}

// FetchLinearProjects delegates to the import handler
func (h *Handler) FetchLinearProjects(c *gin.Context) {
	if h.importHandler == nil {
		c.JSON(http.StatusNotImplemented, apperr.Response(apperr.New(apperr.CodeNotFound, "import functionality not enabled")))
		return
	}
	h.importHandler.FetchLinearProjects(c)
}

// FetchLinearUsers delegates to the import handler
func (h *Handler) FetchLinearUsers(c *gin.Context) {
	if h.importHandler == nil {
		c.JSON(http.StatusNotImplemented, apperr.Response(apperr.New(apperr.CodeNotFound, "import functionality not enabled")))
		return
	}
	h.importHandler.FetchLinearUsers(c)
}

// SendTestNotification sends a rich test message via the configured notifier.
// Owner-only: any authenticated org member with "owner" role can trigger this.
func (h *Handler) SendTestNotification(c *gin.Context) {
	role := middleware.RoleFromCtx(c)
	if role != "owner" {
		c.JSON(http.StatusForbidden, apperr.Response(apperr.New(apperr.CodeForbidden, "only org owners can send test notifications")))
		return
	}

	orgID := middleware.OrgIDFromCtx(c)
	userID := middleware.UserIDFromCtx(c)
	requestID := middleware.RequestIDFromCtx(c)

	msg := fmt.Sprintf(
		"✅ Workived Test Notification\n\n"+
			"This is a test message from your Workived instance.\n\n"+
			"Details\n"+
			"Org ID: %s\n"+
			"Triggered by: %s\n"+
			"Request ID: %s\n"+
			"Time: %s\n\n"+
			"Alert types active:\n"+
			"- 500 errors: instant alert\n"+
			"- New organisation registered: welcome alert\n\n"+
			"If you see this, Telegram notifications are working.",
		orgID,
		userID,
		requestID,
		time.Now().UTC().Format(time.RFC3339),
	)

	ctx, cancel := context.WithTimeout(c.Request.Context(), 10*time.Second)
	defer cancel()

	if err := h.notifier.Send(ctx, msg); err != nil {
		h.log.Error().Err(err).Str("org_id", orgID.String()).Msg("test notification failed")
		c.JSON(http.StatusInternalServerError, apperr.Response(fmt.Errorf("send notification: %w", err)))
		return
	}

	h.log.Info().Str("org_id", orgID.String()).Str("user_id", userID.String()).Msg("test notification sent")
	c.JSON(http.StatusOK, gin.H{"message": "test notification sent"})
}
