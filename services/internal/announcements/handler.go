package announcements

import (
	"context"
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/rs/zerolog"
	"github.com/workived/services/internal/platform/middleware"
	"github.com/workived/services/pkg/apperr"
)

// ServiceInterface is the subset of Service that the handler depends on.
type ServiceInterface interface {
	List(ctx context.Context, orgID, employeeID uuid.UUID) ([]Announcement, error)
	ListAdmin(ctx context.Context, orgID uuid.UUID) ([]Announcement, error)
	GetByID(ctx context.Context, orgID, id uuid.UUID) (*Announcement, error)
	Create(ctx context.Context, orgID, authorID uuid.UUID, req CreateAnnouncementRequest) (*Announcement, error)
	Update(ctx context.Context, orgID, id uuid.UUID, req UpdateAnnouncementRequest) (*Announcement, error)
	Publish(ctx context.Context, orgID, id uuid.UUID) (*Announcement, error)
	SetPinned(ctx context.Context, orgID, id uuid.UUID, pinned bool) (*Announcement, error)
	Delete(ctx context.Context, orgID, id uuid.UUID) error
	MarkRead(ctx context.Context, orgID, announcementID, employeeID uuid.UUID) error
	CountUnread(ctx context.Context, orgID, employeeID uuid.UUID) (int, error)
}

// EmployeeLookupFunc resolves the authenticated user's employee ID.
type EmployeeLookupFunc func(ctx context.Context, orgID, userID uuid.UUID) (uuid.UUID, error)

type Handler struct {
	service   ServiceInterface
	empLookup EmployeeLookupFunc
	log       zerolog.Logger
}

func NewHandler(service ServiceInterface, empLookup EmployeeLookupFunc, log zerolog.Logger) *Handler {
	return &Handler{service: service, empLookup: empLookup, log: log}
}

func (h *Handler) logErr(c *gin.Context, err error, msg string, fields map[string]string) {
	ev := h.log.Error().Err(err)
	for k, v := range fields {
		ev = ev.Str(k, v)
	}
	ev.Msg(msg)
	apperr.Respond(c, err)
}

func (h *Handler) RegisterRoutes(rg *gin.RouterGroup) {
	g := rg.Group("/announcements")

	// Employees: list + mark read + unread count
	g.GET("", middleware.Require(middleware.PermSelfRead), h.List)
	g.GET("/unread-count", middleware.Require(middleware.PermSelfRead), h.UnreadCount)
	g.POST("/:id/read", middleware.Require(middleware.PermSelfRead), h.MarkRead)

	// Admin-only: full CRUD + publish + pin
	g.GET("/admin", middleware.Require(middleware.PermOrgSettings), h.ListAdmin)
	g.POST("", middleware.Require(middleware.PermOrgSettings), h.Create)
	g.PUT("/:id", middleware.Require(middleware.PermOrgSettings), h.Update)
	g.DELETE("/:id", middleware.Require(middleware.PermOrgSettings), h.Delete)
	g.PATCH("/:id/publish", middleware.Require(middleware.PermOrgSettings), h.Publish)
	g.PATCH("/:id/pin", middleware.Require(middleware.PermOrgSettings), h.Pin)
	g.PATCH("/:id/unpin", middleware.Require(middleware.PermOrgSettings), h.Unpin)
}

func (h *Handler) List(c *gin.Context) {
	orgID := middleware.OrgIDFromCtx(c)
	userID := middleware.UserIDFromCtx(c)

	employeeID, err := h.empLookup(c.Request.Context(), orgID, userID)
	if err != nil {
		h.logErr(c, err, "employee lookup for announcements list", map[string]string{"org_id": orgID.String()})
		return
	}

	list, err := h.service.List(c.Request.Context(), orgID, employeeID)
	if err != nil {
		h.logErr(c, err, "list announcements", map[string]string{"org_id": orgID.String()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"data": list})
}

func (h *Handler) ListAdmin(c *gin.Context) {
	orgID := middleware.OrgIDFromCtx(c)

	list, err := h.service.ListAdmin(c.Request.Context(), orgID)
	if err != nil {
		h.logErr(c, err, "list admin announcements", map[string]string{"org_id": orgID.String()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"data": list})
}

func (h *Handler) UnreadCount(c *gin.Context) {
	orgID := middleware.OrgIDFromCtx(c)
	userID := middleware.UserIDFromCtx(c)

	employeeID, err := h.empLookup(c.Request.Context(), orgID, userID)
	if err != nil {
		h.logErr(c, err, "employee lookup for unread count", map[string]string{"org_id": orgID.String()})
		return
	}

	count, err := h.service.CountUnread(c.Request.Context(), orgID, employeeID)
	if err != nil {
		h.logErr(c, err, "count unread announcements", map[string]string{"org_id": orgID.String()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"data": gin.H{"count": count}})
}

func (h *Handler) Create(c *gin.Context) {
	orgID := middleware.OrgIDFromCtx(c)
	userID := middleware.UserIDFromCtx(c)

	authorID, err := h.empLookup(c.Request.Context(), orgID, userID)
	if err != nil {
		h.logErr(c, err, "employee lookup for create announcement", map[string]string{"org_id": orgID.String()})
		return
	}

	var req CreateAnnouncementRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, apperr.ValidationError(apperr.New(apperr.CodeValidation, "invalid request body")))
		return
	}

	ann, err := h.service.Create(c.Request.Context(), orgID, authorID, req)
	if err != nil {
		h.logErr(c, err, "create announcement", map[string]string{"org_id": orgID.String()})
		return
	}

	c.JSON(http.StatusCreated, gin.H{"data": ann})
}

func (h *Handler) Update(c *gin.Context) {
	orgID := middleware.OrgIDFromCtx(c)
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, apperr.ValidationError(apperr.NewField(apperr.CodeValidation, "invalid id", "id")))
		return
	}

	var req UpdateAnnouncementRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, apperr.ValidationError(apperr.New(apperr.CodeValidation, "invalid request body")))
		return
	}

	ann, err := h.service.Update(c.Request.Context(), orgID, id, req)
	if err != nil {
		h.logErr(c, err, "update announcement", map[string]string{"org_id": orgID.String(), "id": id.String()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"data": ann})
}

func (h *Handler) Delete(c *gin.Context) {
	orgID := middleware.OrgIDFromCtx(c)
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, apperr.ValidationError(apperr.NewField(apperr.CodeValidation, "invalid id", "id")))
		return
	}

	if err := h.service.Delete(c.Request.Context(), orgID, id); err != nil {
		h.logErr(c, err, "delete announcement", map[string]string{"org_id": orgID.String(), "id": id.String()})
		return
	}

	c.JSON(http.StatusNoContent, nil)
}

func (h *Handler) Publish(c *gin.Context) {
	orgID := middleware.OrgIDFromCtx(c)
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, apperr.ValidationError(apperr.NewField(apperr.CodeValidation, "invalid id", "id")))
		return
	}

	ann, err := h.service.Publish(c.Request.Context(), orgID, id)
	if err != nil {
		h.logErr(c, err, "publish announcement", map[string]string{"org_id": orgID.String(), "id": id.String()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"data": ann})
}

func (h *Handler) Pin(c *gin.Context) {
	orgID := middleware.OrgIDFromCtx(c)
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, apperr.ValidationError(apperr.NewField(apperr.CodeValidation, "invalid id", "id")))
		return
	}

	ann, err := h.service.SetPinned(c.Request.Context(), orgID, id, true)
	if err != nil {
		h.logErr(c, err, "pin announcement", map[string]string{"org_id": orgID.String(), "id": id.String()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"data": ann})
}

func (h *Handler) Unpin(c *gin.Context) {
	orgID := middleware.OrgIDFromCtx(c)
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, apperr.ValidationError(apperr.NewField(apperr.CodeValidation, "invalid id", "id")))
		return
	}

	ann, err := h.service.SetPinned(c.Request.Context(), orgID, id, false)
	if err != nil {
		h.logErr(c, err, "unpin announcement", map[string]string{"org_id": orgID.String(), "id": id.String()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"data": ann})
}

func (h *Handler) MarkRead(c *gin.Context) {
	orgID := middleware.OrgIDFromCtx(c)
	userID := middleware.UserIDFromCtx(c)
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, apperr.ValidationError(apperr.NewField(apperr.CodeValidation, "invalid id", "id")))
		return
	}

	employeeID, err := h.empLookup(c.Request.Context(), orgID, userID)
	if err != nil {
		h.logErr(c, err, "employee lookup for mark read", map[string]string{"org_id": orgID.String()})
		return
	}

	if err := h.service.MarkRead(c.Request.Context(), orgID, id, employeeID); err != nil {
		h.logErr(c, err, "mark announcement read", map[string]string{"org_id": orgID.String(), "id": id.String()})
		return
	}

	c.JSON(http.StatusNoContent, nil)
}
