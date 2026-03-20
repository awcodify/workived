package department

import (
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/rs/zerolog"

	"github.com/workived/services/internal/platform/middleware"
	"github.com/workived/services/pkg/apperr"
	"github.com/workived/services/pkg/validate"
)

type Handler struct {
	service *Service
	log     zerolog.Logger
}

func NewHandler(service *Service, log zerolog.Logger) *Handler {
	return &Handler{service: service, log: log}
}

func (h *Handler) logAndRespondError(c *gin.Context, err error, msg string, fields map[string]string) {
	event := h.log.Error().Err(err)
	for k, v := range fields {
		event = event.Str(k, v)
	}
	event.Msg(msg)
	c.JSON(apperr.HTTPStatus(err), apperr.Response(err))
}

func (h *Handler) RegisterRoutes(rg *gin.RouterGroup) {
	depts := rg.Group("/departments")
	depts.GET("", middleware.Require(middleware.PermDepartmentRead), h.List)
	depts.POST("", middleware.Require(middleware.PermDepartmentWrite), h.Create)
	depts.PUT("/:id", middleware.Require(middleware.PermDepartmentWrite), h.Update)
	depts.DELETE("/:id", middleware.Require(middleware.PermDepartmentWrite), h.Deactivate)
}

func (h *Handler) List(c *gin.Context) {
	orgID := middleware.OrgIDFromCtx(c)
	depts, err := h.service.List(c.Request.Context(), orgID)
	if err != nil {
		h.logAndRespondError(c, err, "failed to list departments", map[string]string{
			"org_id": orgID.String(),
		})
		return
	}
	c.JSON(http.StatusOK, gin.H{"data": depts})
}

func (h *Handler) Create(c *gin.Context) {
	orgID := middleware.OrgIDFromCtx(c)

	var req CreateDepartmentRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, apperr.ValidationError(err))
		return
	}
	if err := validate.Struct(req); err != nil {
		c.JSON(http.StatusBadRequest, apperr.ValidationError(err))
		return
	}

	dept, err := h.service.Create(c.Request.Context(), orgID, req)
	if err != nil {
		h.logAndRespondError(c, err, "failed to create department", map[string]string{
			"org_id": orgID.String(),
			"name":   req.Name,
		})
		return
	}
	c.JSON(http.StatusCreated, gin.H{"data": dept})
}

func (h *Handler) Update(c *gin.Context) {
	orgID := middleware.OrgIDFromCtx(c)
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, apperr.ValidationError(err))
		return
	}

	var req UpdateDepartmentRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, apperr.ValidationError(err))
		return
	}
	if err := validate.Struct(req); err != nil {
		c.JSON(http.StatusBadRequest, apperr.ValidationError(err))
		return
	}

	dept, err := h.service.Update(c.Request.Context(), orgID, id, req)
	if err != nil {
		h.logAndRespondError(c, err, "failed to update department", map[string]string{
			"org_id":        orgID.String(),
			"department_id": id.String(),
		})
		return
	}
	c.JSON(http.StatusOK, gin.H{"data": dept})
}

func (h *Handler) Deactivate(c *gin.Context) {
	orgID := middleware.OrgIDFromCtx(c)
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, apperr.ValidationError(err))
		return
	}

	if err := h.service.Deactivate(c.Request.Context(), orgID, id); err != nil {
		h.logAndRespondError(c, err, "failed to deactivate department", map[string]string{
			"org_id":        orgID.String(),
			"department_id": id.String(),
		})
		return
	}
	c.JSON(http.StatusOK, gin.H{"data": gin.H{"message": "department deactivated"}})
}
