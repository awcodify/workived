package setup

import (
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/rs/zerolog"

	"github.com/workived/services/internal/platform/middleware"
	"github.com/workived/services/pkg/apperr"
)

type Handler struct {
	service *Service
	logger  zerolog.Logger
}

func NewHandler(service *Service, logger zerolog.Logger) *Handler {
	return &Handler{
		service: service,
		logger:  logger.With().Str("handler", "setup").Logger(),
	}
}

// RegisterRoutes registers setup wizard routes
func (h *Handler) RegisterRoutes(rg *gin.RouterGroup) {
	setup := rg.Group("/setup")
	{
		setup.GET("/status", middleware.Require(middleware.PermOrgRead), h.GetSetupStatus)
		setup.GET("/templates", middleware.Require(middleware.PermOrgSettings), h.GetTemplates)
		setup.POST("/complete", middleware.Require(middleware.PermOrgSettings), h.CompleteSetup)
		setup.POST("/skip", middleware.Require(middleware.PermOrgSettings), h.SkipSetup)
	}
}

// GetSetupStatus godoc
// @Summary Get setup wizard status
// @Description Retrieves the current state of the organization setup wizard
// @Tags Setup
// @Accept json
// @Produce json
// @Security BearerAuth
// @Success 200 {object} map[string]interface{} "Setup status"
// @Failure 401 {object} apperr.ErrorResponse
// @Failure 500 {object} apperr.ErrorResponse
// @Router /setup/status [get]
func (h *Handler) GetSetupStatus(c *gin.Context) {
	orgID := middleware.OrgIDFromCtx(c)

	status, err := h.service.GetSetupStatus(c.Request.Context(), orgID)
	if err != nil {
		apperr.Respond(c, err)
		return
	}

	c.JSON(http.StatusOK, gin.H{"data": status})
}

// GetTemplates godoc
// @Summary Get setup wizard templates
// @Description Retrieves all available templates for the organization's country
// @Tags Setup
// @Accept json
// @Produce json
// @Security BearerAuth
// @Success 200 {object} map[string]interface{} "Available templates"
// @Failure 401 {object} apperr.ErrorResponse
// @Failure 403 {object} apperr.ErrorResponse
// @Failure 500 {object} apperr.ErrorResponse
// @Router /setup/templates [get]
func (h *Handler) GetTemplates(c *gin.Context) {
	orgID := middleware.OrgIDFromCtx(c)

	templates, err := h.service.GetTemplates(c.Request.Context(), orgID)
	if err != nil {
		apperr.Respond(c, err)
		return
	}

	c.JSON(http.StatusOK, gin.H{"data": templates})
}

// CompleteSetup godoc
// @Summary Complete setup wizard
// @Description Processes all setup wizard choices in a single transaction
// @Tags Setup
// @Accept json
// @Produce json
// @Security BearerAuth
// @Param request body CompleteSetupRequest true "Setup wizard choices"
// @Success 201 {object} map[string]interface{} "Setup completion result"
// @Failure 400 {object} apperr.ErrorResponse
// @Failure 401 {object} apperr.ErrorResponse
// @Failure 403 {object} apperr.ErrorResponse
// @Failure 500 {object} apperr.ErrorResponse
// @Router /setup/complete [post]
func (h *Handler) CompleteSetup(c *gin.Context) {
	orgID := middleware.OrgIDFromCtx(c)

	var req CompleteSetupRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		h.logger.Warn().Err(err).Msg("invalid request body")
		c.JSON(http.StatusBadRequest, apperr.ValidationError(err))
		return
	}

	// Validate request
	if err := h.service.ValidateCompleteSetupRequest(&req); err != nil {
		h.logger.Warn().Err(err).Msg("validation failed")
		c.JSON(http.StatusBadRequest, apperr.ValidationError(err))
		return
	}

	result, err := h.service.CompleteSetup(c.Request.Context(), orgID, &req)
	if err != nil {
		apperr.Respond(c, err)
		return
	}

	c.JSON(http.StatusCreated, gin.H{"data": result})
}

// SkipSetup godoc
// @Summary Skip setup wizard
// @Description Marks the setup wizard as skipped to prevent redirect loops
// @Tags Setup
// @Accept json
// @Produce json
// @Security BearerAuth
// @Success 200 {object} map[string]interface{} "Setup skipped successfully"
// @Failure 400 {object} apperr.ErrorResponse
// @Failure 401 {object} apperr.ErrorResponse
// @Failure 403 {object} apperr.ErrorResponse
// @Failure 500 {object} apperr.ErrorResponse
// @Router /setup/skip [post]
func (h *Handler) SkipSetup(c *gin.Context) {
	orgID := middleware.OrgIDFromCtx(c)

	if err := h.service.SkipSetup(c.Request.Context(), orgID); err != nil {
		apperr.Respond(c, err)
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"message": "Setup wizard skipped successfully",
		"data": gin.H{
			"skipped": true,
		},
	})
}
