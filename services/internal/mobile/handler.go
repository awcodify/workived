package mobile

import (
	"context"
	"net/http"
	"strconv"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/workived/services/internal/platform/middleware"
	"github.com/workived/services/pkg/apperr"
)

// ServiceInterface is the subset of Service that the handler depends on.
type ServiceInterface interface {
	GetHomeDataForUser(ctx context.Context, orgID, userID uuid.UUID, weekOffset int) (*HomeData, error)
}

// Handler provides mobile-specific API endpoints.
type Handler struct {
	service ServiceInterface
}

// NewHandler creates a new mobile handler.
func NewHandler(service ServiceInterface) *Handler {
	return &Handler{service: service}
}

// RegisterRoutes registers mobile API routes.
func (h *Handler) RegisterRoutes(rg *gin.RouterGroup) {
	mobile := rg.Group("/mobile")
	mobile.GET("/home", middleware.RequireAny(middleware.PermEmployeeRead, middleware.PermSelfRead), h.GetHome)
}

// GetHome returns aggregated data for the mobile home screen.
// GET /api/v1/mobile/home?week_offset=0 (0=this week, -1=last week, etc.)
func (h *Handler) GetHome(c *gin.Context) {
	orgID := middleware.OrgIDFromCtx(c)
	userID := middleware.UserIDFromCtx(c)

	// Get week offset from query parameter (default: 0 = this week)
	weekOffset := 0
	if offsetStr := c.Query("week_offset"); offsetStr != "" {
		if offset, err := strconv.Atoi(offsetStr); err == nil {
			// Limit to -52 weeks (1 year back) to 0 (current week)
			if offset >= -52 && offset <= 0 {
				weekOffset = offset
			}
		}
	}

	data, err := h.service.GetHomeDataForUser(c.Request.Context(), orgID, userID, weekOffset)
	if err != nil {
		apperr.Respond(c, err)
		return
	}

	c.JSON(http.StatusOK, data)
}
