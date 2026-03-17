package department

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
	depts := rg.Group("/departments")
	depts.GET("", h.List)
	depts.POST("", h.Create)
	depts.PUT("/:id", h.Update)
	depts.DELETE("/:id", h.Deactivate)
}

// List godoc
// @Summary      List departments
// @Tags         Departments
// @Produce      json
// @Security     BearerAuth
// @Success      200  {object}  object{data=[]Department}
// @Failure      401  {object}  object{error=apperr.AppError}
// @Router       /departments [get]
func (h *Handler) List(c *gin.Context) {
	orgID := middleware.OrgIDFromCtx(c)
	depts, err := h.service.List(c.Request.Context(), orgID)
	if err != nil {
		c.JSON(apperr.HTTPStatus(err), apperr.Response(err))
		return
	}
	c.JSON(http.StatusOK, gin.H{"data": depts})
}

// Create godoc
// @Summary      Create a new department
// @Tags         Departments
// @Accept       json
// @Produce      json
// @Security     BearerAuth
// @Param        body  body      CreateDepartmentRequest  true  "Department details"
// @Success      201   {object}  object{data=Department}
// @Failure      400   {object}  object{error=apperr.AppError}
// @Failure      401   {object}  object{error=apperr.AppError}
// @Router       /departments [post]
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
		c.JSON(apperr.HTTPStatus(err), apperr.Response(err))
		return
	}
	c.JSON(http.StatusCreated, gin.H{"data": dept})
}

// Update godoc
// @Summary      Update a department
// @Tags         Departments
// @Accept       json
// @Produce      json
// @Security     BearerAuth
// @Param        id    path      string                   true  "Department UUID"
// @Param        body  body      UpdateDepartmentRequest  true  "Fields to update"
// @Success      200   {object}  object{data=Department}
// @Failure      400   {object}  object{error=apperr.AppError}
// @Failure      401   {object}  object{error=apperr.AppError}
// @Failure      404   {object}  object{error=apperr.AppError}
// @Router       /departments/{id} [put]
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
		c.JSON(apperr.HTTPStatus(err), apperr.Response(err))
		return
	}
	c.JSON(http.StatusOK, gin.H{"data": dept})
}

// Deactivate godoc
// @Summary      Deactivate (soft-delete) a department
// @Tags         Departments
// @Produce      json
// @Security     BearerAuth
// @Param        id   path      string  true  "Department UUID"
// @Success      200  {object}  object{data=object{message=string}}
// @Failure      401  {object}  object{error=apperr.AppError}
// @Failure      404  {object}  object{error=apperr.AppError}
// @Router       /departments/{id} [delete]
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
	c.JSON(http.StatusOK, gin.H{"data": gin.H{"message": "department deactivated"}})
}
