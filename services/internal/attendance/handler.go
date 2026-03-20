package attendance

import (
	"context"
	"net/http"
	"strconv"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/rs/zerolog"
	"github.com/workived/services/internal/platform/middleware"
	"github.com/workived/services/pkg/apperr"
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

// EmployeeLookupFunc resolves the authenticated user's employee ID from their user ID.
// It is a function type that satisfies itself — pass it directly when wiring.
type EmployeeLookupFunc func(ctx context.Context, orgID, userID uuid.UUID) (uuid.UUID, error)

type Handler struct {
	service   ServiceInterface
	empLookup EmployeeLookupFunc
	log       zerolog.Logger
}

func NewHandler(service ServiceInterface, empLookup EmployeeLookupFunc, log zerolog.Logger) *Handler {
	return &Handler{service: service, empLookup: empLookup, log: log}
}

// logAndRespondError logs the error with context and sends JSON response to client
func (h *Handler) logAndRespondError(c *gin.Context, err error, msg string, fields map[string]string) {
	event := h.log.Error().Err(err)
	for k, v := range fields {
		event = event.Str(k, v)
	}
	event.Msg(msg)
	c.JSON(apperr.HTTPStatus(err), apperr.Response(err))
}

func (h *Handler) RegisterRoutes(rg *gin.RouterGroup) {
	att := rg.Group("/attendance")
	att.POST("/clock-in", middleware.Require(middleware.PermSelfAttendance), h.ClockIn)
	att.POST("/clock-out", middleware.Require(middleware.PermSelfAttendance), h.ClockOut)
	att.GET("/today/:employee_id", middleware.RequireAny(middleware.PermAttendanceRead, middleware.PermSelfAttendance), h.GetToday)
	att.GET("/daily", middleware.Require(middleware.PermAttendanceRead), h.DailyReport)
	att.GET("/monthly", middleware.Require(middleware.PermAttendanceRead), h.MonthlySummaryReport)
	att.GET("/monthly/:employee_id", middleware.RequireAny(middleware.PermAttendanceRead, middleware.PermSelfAttendance), h.EmployeeMonthlySummary)
}

func (h *Handler) ClockIn(c *gin.Context) {
	orgID := middleware.OrgIDFromCtx(c)
	userID := middleware.UserIDFromCtx(c)

	employeeID, err := h.empLookup(c.Request.Context(), orgID, userID)
	if err != nil {
		h.logAndRespondError(c, err, "failed to lookup employee for clock-in", map[string]string{
			"org_id":  orgID.String(),
			"user_id": userID.String(),
		})
		return
	}

	var httpReq clockHTTPRequest
	// Allow empty body (note is optional)
	_ = c.ShouldBindJSON(&httpReq)

	rec, err := h.service.ClockIn(c.Request.Context(), orgID, ClockInRequest{
		EmployeeID: employeeID,
		Note:       httpReq.Note,
	})
	if err != nil {
		h.logAndRespondError(c, err, "failed to clock in", map[string]string{
			"org_id":      orgID.String(),
			"employee_id": employeeID.String(),
		})
		return
	}

	c.JSON(http.StatusCreated, gin.H{"data": rec})
}

func (h *Handler) ClockOut(c *gin.Context) {
	orgID := middleware.OrgIDFromCtx(c)
	userID := middleware.UserIDFromCtx(c)

	employeeID, err := h.empLookup(c.Request.Context(), orgID, userID)
	if err != nil {
		h.logAndRespondError(c, err, "failed to lookup employee for clock-out", map[string]string{
			"org_id":  orgID.String(),
			"user_id": userID.String(),
		})
		return
	}

	var httpReq clockHTTPRequest
	_ = c.ShouldBindJSON(&httpReq)

	rec, err := h.service.ClockOut(c.Request.Context(), orgID, ClockOutRequest{
		EmployeeID: employeeID,
		Note:       httpReq.Note,
	})
	if err != nil {
		h.logAndRespondError(c, err, "failed to clock out", map[string]string{
			"org_id":      orgID.String(),
			"employee_id": employeeID.String(),
		})
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
