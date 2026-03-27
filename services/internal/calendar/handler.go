package calendar

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
	ListHolidays(ctx context.Context, orgID uuid.UUID, startDate, endDate string) ([]PublicHoliday, error)
	ListCustomHolidays(ctx context.Context, orgID uuid.UUID) ([]PublicHoliday, error)
	CreateCustomHoliday(ctx context.Context, orgID uuid.UUID, req CreateCustomHolidayRequest) (*PublicHoliday, error)
	DeleteCustomHoliday(ctx context.Context, orgID, holidayID uuid.UUID) error
}

type Handler struct {
	service ServiceInterface
	log     zerolog.Logger
}

func NewHandler(service ServiceInterface, log zerolog.Logger) *Handler {
	return &Handler{service: service, log: log}
}

func (h *Handler) RegisterRoutes(rg *gin.RouterGroup) {
	cal := rg.Group("/calendar")

	// Public holidays (all employees can see)
	cal.GET("/holidays", middleware.Require(middleware.PermLeaveRead), h.ListHolidays)

	// Custom holidays — admin/owner only
	cal.GET("/holidays/custom", middleware.Require(middleware.PermLeaveWrite), h.ListCustomHolidays)
	cal.POST("/holidays/custom", middleware.Require(middleware.PermLeaveWrite), h.CreateCustomHoliday)
	cal.DELETE("/holidays/custom/:id", middleware.Require(middleware.PermLeaveWrite), h.DeleteCustomHoliday)
}

func (h *Handler) ListHolidays(c *gin.Context) {
	orgID := middleware.OrgIDFromCtx(c)

	startDate := c.Query("start_date")
	endDate := c.Query("end_date")
	if startDate == "" || endDate == "" {
		c.JSON(http.StatusBadRequest, apperr.ValidationError(
			apperr.NewField(apperr.CodeValidation, "start_date and end_date are required", "start_date")))
		return
	}

	holidays, err := h.service.ListHolidays(c.Request.Context(), orgID, startDate, endDate)
	if err != nil {
		h.log.Error().Err(err).Str("org_id", orgID.String()).Msg("failed to list holidays")
		c.JSON(apperr.HTTPStatus(err), apperr.Response(err))
		return
	}

	c.JSON(http.StatusOK, gin.H{"data": holidays})
}

func (h *Handler) ListCustomHolidays(c *gin.Context) {
	orgID := middleware.OrgIDFromCtx(c)

	holidays, err := h.service.ListCustomHolidays(c.Request.Context(), orgID)
	if err != nil {
		h.log.Error().Err(err).Str("org_id", orgID.String()).Msg("failed to list custom holidays")
		c.JSON(apperr.HTTPStatus(err), apperr.Response(err))
		return
	}

	c.JSON(http.StatusOK, gin.H{"data": holidays})
}

func (h *Handler) CreateCustomHoliday(c *gin.Context) {
	orgID := middleware.OrgIDFromCtx(c)

	var req CreateCustomHolidayRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, apperr.Response(apperr.New(apperr.CodeValidation, "invalid request body")))
		return
	}

	holiday, err := h.service.CreateCustomHoliday(c.Request.Context(), orgID, req)
	if err != nil {
		h.log.Error().Err(err).Str("org_id", orgID.String()).Str("date", req.Date).Str("name", req.Name).Msg("failed to create custom holiday")
		c.JSON(apperr.HTTPStatus(err), apperr.Response(err))
		return
	}

	c.JSON(http.StatusCreated, gin.H{"data": holiday})
}

func (h *Handler) DeleteCustomHoliday(c *gin.Context) {
	orgID := middleware.OrgIDFromCtx(c)

	holidayID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, apperr.Response(apperr.New(apperr.CodeValidation, "invalid holiday ID")))
		return
	}

	if err := h.service.DeleteCustomHoliday(c.Request.Context(), orgID, holidayID); err != nil {
		h.log.Error().Err(err).Str("org_id", orgID.String()).Str("holiday_id", holidayID.String()).Msg("failed to delete custom holiday")
		c.JSON(apperr.HTTPStatus(err), apperr.Response(err))
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "custom holiday deleted"})
}
