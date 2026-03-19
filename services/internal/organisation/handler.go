package organisation

import (
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
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
	orgs.GET("/me", middleware.Require(middleware.PermOrgRead), h.GetMine)
	orgs.PUT("/me", middleware.Require(middleware.PermOrgSettings), h.Update)
	orgs.POST("/me/transfer-ownership", h.TransferOwnership) // owner check in service

	// Invitation management (admin only).
	orgs.POST("/invitations", middleware.Require(middleware.PermInvitationWrite), h.InviteMember)
	orgs.GET("/invitations", middleware.Require(middleware.PermInvitationWrite), h.ListPendingInvitations)
	orgs.DELETE("/invitations/:id", middleware.Require(middleware.PermInvitationWrite), h.RevokeInvitation)
}

// RegisterPublicRoutes registers routes that require authentication but NOT tenant context.
// These are called by users who may not yet belong to any org.
func (h *Handler) RegisterPublicRoutes(rg *gin.RouterGroup) {
	rg.POST("/organisations", h.Create)
	rg.POST("/invitations/accept", h.AcceptInvitation)
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

	resp, err := h.service.Create(c.Request.Context(), ownerID, req)
	if err != nil {
		c.JSON(apperr.HTTPStatus(err), apperr.Response(err))
		return
	}

	c.JSON(http.StatusCreated, gin.H{"data": resp})
}

func (h *Handler) GetMine(c *gin.Context) {
	orgID := middleware.OrgIDFromCtx(c)

	detail, err := h.service.GetDetail(c.Request.Context(), orgID)
	if err != nil {
		c.JSON(apperr.HTTPStatus(err), apperr.Response(err))
		return
	}

	c.JSON(http.StatusOK, gin.H{"data": detail})
}

func (h *Handler) Update(c *gin.Context) {
	orgID := middleware.OrgIDFromCtx(c)

	var req UpdateOrgRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, apperr.ValidationError(err))
		return
	}
	if err := validate.Struct(req); err != nil {
		c.JSON(http.StatusBadRequest, apperr.ValidationError(err))
		return
	}

	// Get current employee count to enforce country lock.
	detail, err := h.service.GetDetail(c.Request.Context(), orgID)
	if err != nil {
		c.JSON(apperr.HTTPStatus(err), apperr.Response(err))
		return
	}

	org, err := h.service.Update(c.Request.Context(), orgID, req, detail.EmployeeCount)
	if err != nil {
		c.JSON(apperr.HTTPStatus(err), apperr.Response(err))
		return
	}

	c.JSON(http.StatusOK, gin.H{"data": org})
}

func (h *Handler) TransferOwnership(c *gin.Context) {
	orgID := middleware.OrgIDFromCtx(c)
	userID := middleware.UserIDFromCtx(c)

	var req TransferOwnershipRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, apperr.ValidationError(err))
		return
	}
	if err := validate.Struct(req); err != nil {
		c.JSON(http.StatusBadRequest, apperr.ValidationError(err))
		return
	}

	if err := h.service.TransferOwnership(c.Request.Context(), orgID, userID, req); err != nil {
		c.JSON(apperr.HTTPStatus(err), apperr.Response(err))
		return
	}

	c.JSON(http.StatusOK, gin.H{"data": gin.H{"message": "ownership transferred"}})
}

func (h *Handler) InviteMember(c *gin.Context) {
	orgID := middleware.OrgIDFromCtx(c)
	inviterID := middleware.UserIDFromCtx(c)

	var req InviteMemberRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, apperr.ValidationError(err))
		return
	}
	if err := validate.Struct(req); err != nil {
		c.JSON(http.StatusBadRequest, apperr.ValidationError(err))
		return
	}

	resp, err := h.service.InviteMember(c.Request.Context(), orgID, inviterID, req)
	if err != nil {
		c.JSON(apperr.HTTPStatus(err), apperr.Response(err))
		return
	}

	c.JSON(http.StatusCreated, gin.H{"data": resp})
}

func (h *Handler) AcceptInvitation(c *gin.Context) {
	userID := middleware.UserIDFromCtx(c)

	var req AcceptInvitationRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, apperr.ValidationError(err))
		return
	}
	if err := validate.Struct(req); err != nil {
		c.JSON(http.StatusBadRequest, apperr.ValidationError(err))
		return
	}

	resp, err := h.service.AcceptInvitation(c.Request.Context(), userID, req)
	if err != nil {
		c.JSON(apperr.HTTPStatus(err), apperr.Response(err))
		return
	}

	c.JSON(http.StatusOK, gin.H{"data": resp})
}

func (h *Handler) ListPendingInvitations(c *gin.Context) {
	orgID := middleware.OrgIDFromCtx(c)

	invitations, err := h.service.ListPendingInvitations(c.Request.Context(), orgID)
	if err != nil {
		c.JSON(apperr.HTTPStatus(err), apperr.Response(err))
		return
	}

	c.JSON(http.StatusOK, gin.H{"data": invitations})
}

func (h *Handler) RevokeInvitation(c *gin.Context) {
	orgID := middleware.OrgIDFromCtx(c)
	invID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, apperr.ValidationError(err))
		return
	}

	if err := h.service.RevokeInvitation(c.Request.Context(), orgID, invID); err != nil {
		c.JSON(apperr.HTTPStatus(err), apperr.Response(err))
		return
	}

	c.JSON(http.StatusOK, gin.H{"data": gin.H{"message": "invitation revoked"}})
}
