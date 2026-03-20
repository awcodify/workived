package admin

import (
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/rs/zerolog"
	"github.com/workived/services/internal/platform/middleware"
	"github.com/workived/services/pkg/apperr"
)

type Handler struct {
	svc *Service
	log zerolog.Logger
}

func NewHandler(svc *Service, log zerolog.Logger) *Handler {
	return &Handler{svc: svc, log: log}
}

func (h *Handler) logAndRespondError(c *gin.Context, err error, msg string, fields map[string]string) {
	event := h.log.Error().Err(err)
	for k, v := range fields {
		event = event.Str(k, v)
	}
	event.Msg(msg)
	c.JSON(apperr.HTTPStatus(err), apperr.Response(err))
}

// RegisterRoutes registers all admin routes under /api/v1/admin
func (h *Handler) RegisterRoutes(r *gin.RouterGroup) {
	admin := r.Group("/admin")
	admin.Use(middleware.RequireSuperAdmin()) // Only super_admin role can access

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
}

// RegisterPublicRoutes registers auth-only (non-admin) feature-check routes.
func (h *Handler) RegisterPublicRoutes(r *gin.RouterGroup) {
	r.GET("/features", h.GetEnabledFeatures)
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
// This endpoint is auth-only (not super_admin-only) so regular users can call it.
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
