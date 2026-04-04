package jobtitle

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
	jts := rg.Group("/job-titles")
	jts.GET("", middleware.Require(middleware.PermEmployeeRead), h.List)
	jts.GET("/search", middleware.Require(middleware.PermEmployeeRead), h.Search)
	jts.POST("", middleware.Require(middleware.PermEmployeeWrite), h.Create)
	jts.PUT("/:id", middleware.Require(middleware.PermEmployeeWrite), h.Update)
	jts.DELETE("/:id", middleware.Require(middleware.PermEmployeeWrite), h.Deactivate)
}

func (h *Handler) List(c *gin.Context) {
	orgID := middleware.OrgIDFromCtx(c)
	jts, err := h.service.List(c.Request.Context(), orgID)
	if err != nil {
		h.logAndRespondError(c, err, "failed to list job_titles", map[string]string{
			"org_id": orgID.String(),
		})
		return
	}
	c.JSON(http.StatusOK, gin.H{"data": jts})
}

func (h *Handler) Search(c *gin.Context) {
	orgID := middleware.OrgIDFromCtx(c)
	query := c.Query("q")

	jts, err := h.service.Search(c.Request.Context(), orgID, query)
	if err != nil {
		h.logAndRespondError(c, err, "failed to search job titles", map[string]string{
			"org_id": orgID.String(),
			"query":  query,
		})
		return
	}
	c.JSON(http.StatusOK, gin.H{"data": jts})
}

func (h *Handler) Create(c *gin.Context) {
	orgID := middleware.OrgIDFromCtx(c)

	var req CreateJobTitleRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, apperr.ValidationError(err))
		return
	}
	if err := validate.Struct(req); err != nil {
		c.JSON(http.StatusBadRequest, apperr.ValidationError(err))
		return
	}

	jt, err := h.service.Create(c.Request.Context(), orgID, req)
	if err != nil {
		h.logAndRespondError(c, err, "failed to create job_title", map[string]string{
			"org_id": orgID.String(),
			"name":   req.Name,
		})
		return
	}
	c.JSON(http.StatusCreated, gin.H{"data": jt})
}

func (h *Handler) Update(c *gin.Context) {
	orgID := middleware.OrgIDFromCtx(c)
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, apperr.ValidationError(err))
		return
	}

	var req UpdateJobTitleRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, apperr.ValidationError(err))
		return
	}
	if err := validate.Struct(req); err != nil {
		c.JSON(http.StatusBadRequest, apperr.ValidationError(err))
		return
	}

	jt, err := h.service.Update(c.Request.Context(), orgID, id, req)
	if err != nil {
		h.logAndRespondError(c, err, "failed to update job_title", map[string]string{
			"org_id":       orgID.String(),
			"job_title_id": id.String(),
		})
		return
	}
	c.JSON(http.StatusOK, gin.H{"data": jt})
}

func (h *Handler) Deactivate(c *gin.Context) {
	orgID := middleware.OrgIDFromCtx(c)
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, apperr.ValidationError(err))
		return
	}

	if err := h.service.Deactivate(c.Request.Context(), orgID, id); err != nil {
		h.logAndRespondError(c, err, "failed to deactivate job_title", map[string]string{
			"org_id":       orgID.String(),
			"job_title_id": id.String(),
		})
		return
	}
	c.JSON(http.StatusOK, gin.H{"data": gin.H{"message": "job_title deactivated"}})
}
