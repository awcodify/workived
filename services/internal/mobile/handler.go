package mobile

import (
	"context"
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/workived/services/internal/platform/middleware"
	"github.com/workived/services/pkg/apperr"
)

// ServiceInterface is the subset of Service that the handler depends on.
type ServiceInterface interface {
	GetHomeDataForUser(ctx context.Context, orgID, userID uuid.UUID) (*HomeData, error)
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
// GET /api/v1/mobile/home
func (h *Handler) GetHome(c *gin.Context) {
	orgID := middleware.OrgIDFromCtx(c)
	userID := middleware.UserIDFromCtx(c)

	data, err := h.service.GetHomeDataForUser(c.Request.Context(), orgID, userID)
	if err != nil {
		c.JSON(apperr.HTTPStatus(err), apperr.Response(err))
		return
	}

	c.JSON(http.StatusOK, data)
}
