package organisation

import (
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/workived/services/internal/platform/middleware"
	"github.com/workived/services/pkg/apperr"
	"github.com/workived/services/pkg/validate"
)

type Handler struct {
	service *Service
}

func NewHandler(service *Service) *Handler {
	return &Handler{service: service}
}

func (h *Handler) RegisterRoutes(rg *gin.RouterGroup) {
	orgs := rg.Group("/organisations")
	orgs.POST("", h.Create)
	orgs.GET("/me", h.GetMine)
	orgs.POST("/invitations", h.InviteMember)
}

func (h *Handler) Create(c *gin.Context) {
	ownerID := middleware.UserIDFromCtx(c)

	var req CreateOrgRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, apperr.ValidationError(err))
		return
	}
	if err := validate.Struct(req); err != nil {
		c.JSON(http.StatusBadRequest, apperr.ValidationError(err))
		return
	}

	org, err := h.service.Create(c.Request.Context(), ownerID, req)
	if err != nil {
		c.JSON(apperr.HTTPStatus(err), apperr.Response(err))
		return
	}

	c.JSON(http.StatusCreated, gin.H{"data": org})
}

func (h *Handler) GetMine(c *gin.Context) {
	orgID := middleware.OrgIDFromCtx(c)

	org, err := h.service.Get(c.Request.Context(), orgID)
	if err != nil {
		c.JSON(apperr.HTTPStatus(err), apperr.Response(err))
		return
	}

	c.JSON(http.StatusOK, gin.H{"data": org})
}

func (h *Handler) InviteMember(c *gin.Context) {
	orgID := middleware.OrgIDFromCtx(c)
	inviterID := middleware.UserIDFromCtx(c)
	role := middleware.RoleFromCtx(c)

	if err := middleware.RequireRole(role, middleware.RoleOwner, middleware.RoleAdmin); err != nil {
		c.JSON(http.StatusForbidden, apperr.Response(err))
		return
	}

	var req InviteMemberRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, apperr.ValidationError(err))
		return
	}
	if err := validate.Struct(req); err != nil {
		c.JSON(http.StatusBadRequest, apperr.ValidationError(err))
		return
	}

	if err := h.service.InviteMember(c.Request.Context(), orgID, inviterID, req); err != nil {
		c.JSON(apperr.HTTPStatus(err), apperr.Response(err))
		return
	}

	c.JSON(http.StatusCreated, gin.H{"data": gin.H{"message": "invitation sent"}})
}
