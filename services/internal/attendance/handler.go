package attendance

import (
	"context"
	"net/http"
	"strconv"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/workived/services/internal/platform/middleware"
	"github.com/workived/services/pkg/apperr"
	"github.com/workived/services/pkg/validate"
)

// ServiceInterface is the subset of Service that the handler depends on.
type ServiceInterface interface {
	ClockIn(ctx context.Context, orgID uuid.UUID, req ClockInRequest) (*Record, error)
	ClockOut(ctx context.Context, orgID uuid.UUID, req ClockOutRequest) (*Record, error)
	GetToday(ctx context.Context, orgID, employeeID uuid.UUID) (*Record, error)
	DailyReport(ctx context.Context, orgID uuid.UUID, filters DailyReportFilters) ([]DailyEntry, error)
	MonthlySummaryReport(ctx context.Context, orgID uuid.UUID, filters MonthlyReportFilters) ([]MonthlySummary, error)
	EmployeeMonthlySummary(ctx context.Context, orgID, employeeID uuid.UUID, filters MonthlyReportFilters) (*MonthlySummary, error)
}

type Handler struct {
	service ServiceInterface
}

func NewHandler(service ServiceInterface) *Handler {
	return &Handler{service: service}
}

func (h *Handler) RegisterRoutes(rg *gin.RouterGroup) {
	att := rg.Group("/attendance")
	att.POST("/clock-in", h.ClockIn)
	att.POST("/clock-out", h.ClockOut)
	att.GET("/today/:employee_id", h.GetToday)
	att.GET("/daily", h.DailyReport)
	att.GET("/monthly", h.MonthlySummaryReport)
	att.GET("/monthly/:employee_id", h.EmployeeMonthlySummary)
}

func (h *Handler) ClockIn(c *gin.Context) {
	orgID := middleware.OrgIDFromCtx(c)

	var req ClockInRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, apperr.ValidationError(err))
		return
	}
	if err := validate.Struct(req); err != nil {
		c.JSON(http.StatusBadRequest, apperr.ValidationError(err))
		return
	}

	rec, err := h.service.ClockIn(c.Request.Context(), orgID, req)
	if err != nil {
		c.JSON(apperr.HTTPStatus(err), apperr.Response(err))
		return
	}

	c.JSON(http.StatusCreated, gin.H{"data": rec})
}

func (h *Handler) ClockOut(c *gin.Context) {
	orgID := middleware.OrgIDFromCtx(c)

	var req ClockOutRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, apperr.ValidationError(err))
		return
	}
	if err := validate.Struct(req); err != nil {
		c.JSON(http.StatusBadRequest, apperr.ValidationError(err))
		return
	}

	rec, err := h.service.ClockOut(c.Request.Context(), orgID, req)
	if err != nil {
		c.JSON(apperr.HTTPStatus(err), apperr.Response(err))
		return
	}

	c.JSON(http.StatusOK, gin.H{"data": rec})
}

func (h *Handler) GetToday(c *gin.Context) {
	orgID := middleware.OrgIDFromCtx(c)
	employeeID, err := uuid.Parse(c.Param("employee_id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, apperr.ValidationError(err))
		return
	}

	rec, err := h.service.GetToday(c.Request.Context(), orgID, employeeID)
	if err != nil {
		c.JSON(apperr.HTTPStatus(err), apperr.Response(err))
		return
	}

	c.JSON(http.StatusOK, gin.H{"data": rec})
}

func (h *Handler) DailyReport(c *gin.Context) {
	orgID := middleware.OrgIDFromCtx(c)

	date := c.Query("date")
	if date == "" {
		c.JSON(http.StatusBadRequest, apperr.ValidationError(apperr.NewField(apperr.CodeValidation, "date is required", "date")))
		return
	}

	entries, err := h.service.DailyReport(c.Request.Context(), orgID, DailyReportFilters{Date: date})
	if err != nil {
		c.JSON(apperr.HTTPStatus(err), apperr.Response(err))
		return
	}

	c.JSON(http.StatusOK, gin.H{"data": entries})
}

func (h *Handler) MonthlySummaryReport(c *gin.Context) {
	orgID := middleware.OrgIDFromCtx(c)

	year, err := strconv.Atoi(c.Query("year"))
	if err != nil || year < 2000 {
		c.JSON(http.StatusBadRequest, apperr.ValidationError(apperr.NewField(apperr.CodeValidation, "valid year is required", "year")))
		return
	}
	month, err := strconv.Atoi(c.Query("month"))
	if err != nil || month < 1 || month > 12 {
		c.JSON(http.StatusBadRequest, apperr.ValidationError(apperr.NewField(apperr.CodeValidation, "valid month (1-12) is required", "month")))
		return
	}

	summaries, err := h.service.MonthlySummaryReport(c.Request.Context(), orgID, MonthlyReportFilters{Year: year, Month: month})
	if err != nil {
		c.JSON(apperr.HTTPStatus(err), apperr.Response(err))
		return
	}

	c.JSON(http.StatusOK, gin.H{"data": summaries})
}

func (h *Handler) EmployeeMonthlySummary(c *gin.Context) {
	orgID := middleware.OrgIDFromCtx(c)
	employeeID, err := uuid.Parse(c.Param("employee_id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, apperr.ValidationError(err))
		return
	}

	year, err := strconv.Atoi(c.Query("year"))
	if err != nil || year < 2000 {
		c.JSON(http.StatusBadRequest, apperr.ValidationError(apperr.NewField(apperr.CodeValidation, "valid year is required", "year")))
		return
	}
	month, err := strconv.Atoi(c.Query("month"))
	if err != nil || month < 1 || month > 12 {
		c.JSON(http.StatusBadRequest, apperr.ValidationError(apperr.NewField(apperr.CodeValidation, "valid month (1-12) is required", "month")))
		return
	}

	summary, err := h.service.EmployeeMonthlySummary(c.Request.Context(), orgID, employeeID, MonthlyReportFilters{Year: year, Month: month})
	if err != nil {
		c.JSON(apperr.HTTPStatus(err), apperr.Response(err))
		return
	}

	c.JSON(http.StatusOK, gin.H{"data": summary})
}
