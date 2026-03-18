package employee

import (
	"context"
	"net/http"
	"strconv"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/workived/services/internal/platform/middleware"
	"github.com/workived/services/pkg/apperr"
	"github.com/workived/services/pkg/paginate"
	"github.com/workived/services/pkg/validate"
)

// ServiceInterface is the subset of Service that the handler depends on.
type ServiceInterface interface {
	List(ctx context.Context, orgID uuid.UUID, f ListFilters) (*ListResult, error)
	Create(ctx context.Context, orgID uuid.UUID, req CreateEmployeeRequest) (*Employee, error)
	Get(ctx context.Context, orgID, id uuid.UUID) (*Employee, error)
	GetByUserID(ctx context.Context, orgID, userID uuid.UUID) (*Employee, error)
	Update(ctx context.Context, orgID, id uuid.UUID, req UpdateEmployeeRequest) (*Employee, error)
	Deactivate(ctx context.Context, orgID, id uuid.UUID) error
}

type Handler struct {
	service ServiceInterface
}

func NewHandler(service ServiceInterface) *Handler {
	return &Handler{service: service}
}

func (h *Handler) RegisterRoutes(rg *gin.RouterGroup) {
	emps := rg.Group("/employees")
	emps.GET("", h.List)
	emps.POST("", h.Create)
	emps.GET("/:id", h.getOrMe) // handles both "me" and UUID
	emps.PUT("/:id", h.Update)
	emps.DELETE("/:id", h.Deactivate)
}

// getOrMe dispatches to GetMe when :id is "me", otherwise to Get.
func (h *Handler) getOrMe(c *gin.Context) {
	if c.Param("id") == "me" {
		h.GetMe(c)
		return
	}
	h.Get(c)
}

func (h *Handler) GetMe(c *gin.Context) {
	orgID := middleware.OrgIDFromCtx(c)
	userID := middleware.UserIDFromCtx(c)

	emp, err := h.service.GetByUserID(c.Request.Context(), orgID, userID)
	if err != nil {
		c.JSON(apperr.HTTPStatus(err), apperr.Response(err))
		return
	}

	c.JSON(http.StatusOK, gin.H{"data": emp})
}

func (h *Handler) List(c *gin.Context) {
	orgID := middleware.OrgIDFromCtx(c)

	f := ListFilters{
		Cursor: c.Query("cursor"),
	}
	if s := c.Query("status"); s != "" {
		f.Status = &s
	}
	if d := c.Query("department_id"); d != "" {
		f.DepartmentID = &d
	}
	if l, err := strconv.Atoi(c.Query("limit")); err == nil && l > 0 {
		f.Limit = l
	} else {
		f.Limit = paginate.DefaultLimit
	}

	result, err := h.service.List(c.Request.Context(), orgID, f)
	if err != nil {
		c.JSON(apperr.HTTPStatus(err), apperr.Response(err))
		return
	}

	c.JSON(http.StatusOK, gin.H{"data": result.Employees, "meta": result.Meta})
}

func (h *Handler) Create(c *gin.Context) {
	orgID := middleware.OrgIDFromCtx(c)

	var req CreateEmployeeRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, apperr.ValidationError(err))
		return
	}
	if err := validate.Struct(req); err != nil {
		c.JSON(http.StatusBadRequest, apperr.ValidationError(err))
		return
	}

	emp, err := h.service.Create(c.Request.Context(), orgID, req)
	if err != nil {
		c.JSON(apperr.HTTPStatus(err), apperr.Response(err))
		return
	}

	c.JSON(http.StatusCreated, gin.H{"data": emp})
}

func (h *Handler) Get(c *gin.Context) {
	orgID := middleware.OrgIDFromCtx(c)
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, apperr.ValidationError(err))
		return
	}

	emp, err := h.service.Get(c.Request.Context(), orgID, id)
	if err != nil {
		c.JSON(apperr.HTTPStatus(err), apperr.Response(err))
		return
	}

	c.JSON(http.StatusOK, gin.H{"data": emp})
}

func (h *Handler) Update(c *gin.Context) {
	orgID := middleware.OrgIDFromCtx(c)
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, apperr.ValidationError(err))
		return
	}

	var req UpdateEmployeeRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, apperr.ValidationError(err))
		return
	}
	if err := validate.Struct(req); err != nil {
		c.JSON(http.StatusBadRequest, apperr.ValidationError(err))
		return
	}

	emp, err := h.service.Update(c.Request.Context(), orgID, id, req)
	if err != nil {
		c.JSON(apperr.HTTPStatus(err), apperr.Response(err))
		return
	}

	c.JSON(http.StatusOK, gin.H{"data": emp})
}

func (h *Handler) Deactivate(c *gin.Context) {
	orgID := middleware.OrgIDFromCtx(c)
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, apperr.ValidationError(err))
		return
	}

	if err := h.service.Deactivate(c.Request.Context(), orgID, id); err != nil {
		c.JSON(apperr.HTTPStatus(err), apperr.Response(err))
		return
	}

	c.JSON(http.StatusOK, gin.H{"data": gin.H{"message": "employee deactivated"}})
}
