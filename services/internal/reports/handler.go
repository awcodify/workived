package reports

import (
	"context"
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/rs/zerolog"
	"github.com/workived/services/internal/platform/middleware"
	"github.com/workived/services/pkg/apperr"
	"github.com/workived/services/pkg/validate"
)

// ServiceInterface is the subset of Service that the handler depends on.
type ServiceInterface interface {
	GetConfig(ctx context.Context, orgID uuid.UUID) (*ScorecardConfig, error)
	UpdateConfig(ctx context.Context, orgID uuid.UUID, input ConfigUpdateInput) (*ScorecardConfig, error)
	GetEmployeeScorecard(ctx context.Context, orgID, employeeID uuid.UUID, periodKey string) (*Scorecard, error)
	GetTeamScorecard(ctx context.Context, orgID uuid.UUID, periodKey string) (*TeamScorecard, error)
	GetCompanySummary(ctx context.Context, orgID uuid.UUID, periodKey string) (*CompanySummary, error)
}

// EmployeeLookupFunc resolves the authenticated user's employee ID from their user ID.
type EmployeeLookupFunc func(ctx context.Context, orgID, userID uuid.UUID) (uuid.UUID, error)

type Handler struct {
	service   ServiceInterface
	empLookup EmployeeLookupFunc
	log       zerolog.Logger
}

func NewHandler(service ServiceInterface, empLookup EmployeeLookupFunc, log zerolog.Logger) *Handler {
	return &Handler{service: service, empLookup: empLookup, log: log}
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
	rpt := rg.Group("/reports")

	// Config — read: any authenticated user, write: admin/owner only
	rpt.GET("/config", middleware.Require(middleware.PermSelfRead), h.GetConfig)
	rpt.PUT("/config", middleware.Require(middleware.PermOrgSettings), h.UpdateConfig)

	// My scorecard — any authenticated employee
	rpt.GET("/scorecard/me", middleware.Require(middleware.PermSelfRead), h.GetMyScorecard)

	// Individual employee scorecard — admin/hr/finance
	rpt.GET("/scorecard/:employee_id", middleware.Require(middleware.PermReportsRead), h.GetEmployeeScorecardByID)

	// Team scorecard — any authenticated user (shown on People page sidebar)
	rpt.GET("/scorecard/team", middleware.Require(middleware.PermSelfRead), h.GetTeamScorecard)

	// Company summary — any authenticated user (shown on People page sidebar)
	rpt.GET("/summary", middleware.Require(middleware.PermSelfRead), h.GetCompanySummary)
}

// GET /reports/config
func (h *Handler) GetConfig(c *gin.Context) {
	orgID := middleware.OrgIDFromCtx(c)

	cfg, err := h.service.GetConfig(c.Request.Context(), orgID)
	if err != nil {
		h.logAndRespondError(c, err, "failed to get scorecard config", map[string]string{
			"org_id": orgID.String(),
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{"config": cfg})
}

// PUT /reports/config
func (h *Handler) UpdateConfig(c *gin.Context) {
	orgID := middleware.OrgIDFromCtx(c)

	var input ConfigUpdateInput
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, apperr.ValidationError(err))
		return
	}
	if err := validate.Struct(input); err != nil {
		c.JSON(http.StatusBadRequest, apperr.ValidationError(err))
		return
	}

	cfg, err := h.service.UpdateConfig(c.Request.Context(), orgID, input)
	if err != nil {
		h.logAndRespondError(c, err, "failed to update scorecard config", map[string]string{
			"org_id": orgID.String(),
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{"config": cfg})
}

// GET /reports/scorecard/me?period=this_month
func (h *Handler) GetMyScorecard(c *gin.Context) {
	orgID := middleware.OrgIDFromCtx(c)
	userID := middleware.UserIDFromCtx(c)

	employeeID, err := h.empLookup(c.Request.Context(), orgID, userID)
	if err != nil {
		h.logAndRespondError(c, err, "failed to lookup employee", map[string]string{
			"org_id":  orgID.String(),
			"user_id": userID.String(),
		})
		return
	}

	period := c.DefaultQuery("period", "this_month")

	sc, err := h.service.GetEmployeeScorecard(c.Request.Context(), orgID, employeeID, period)
	if err != nil {
		h.logAndRespondError(c, err, "failed to get employee scorecard", map[string]string{
			"org_id":      orgID.String(),
			"employee_id": employeeID.String(),
			"period":      period,
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{"scorecard": sc})
}

// GET /reports/scorecard/:employee_id?period=this_month
func (h *Handler) GetEmployeeScorecardByID(c *gin.Context) {
	orgID := middleware.OrgIDFromCtx(c)

	employeeID, err := uuid.Parse(c.Param("employee_id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, apperr.New(apperr.CodeValidation, "invalid employee_id"))
		return
	}

	period := c.DefaultQuery("period", "this_month")

	sc, err := h.service.GetEmployeeScorecard(c.Request.Context(), orgID, employeeID, period)
	if err != nil {
		h.logAndRespondError(c, err, "failed to get employee scorecard", map[string]string{
			"org_id":      orgID.String(),
			"employee_id": employeeID.String(),
			"period":      period,
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{"scorecard": sc})
}

// GET /reports/scorecard/team?period=this_month
func (h *Handler) GetTeamScorecard(c *gin.Context) {
	orgID := middleware.OrgIDFromCtx(c)
	period := c.DefaultQuery("period", "this_month")

	team, err := h.service.GetTeamScorecard(c.Request.Context(), orgID, period)
	if err != nil {
		h.logAndRespondError(c, err, "failed to get team scorecard", map[string]string{
			"org_id": orgID.String(),
			"period": period,
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{"team_scorecard": team})
}

// GET /reports/summary?period=this_month
func (h *Handler) GetCompanySummary(c *gin.Context) {
	orgID := middleware.OrgIDFromCtx(c)
	period := c.DefaultQuery("period", "this_month")

	summary, err := h.service.GetCompanySummary(c.Request.Context(), orgID, period)
	if err != nil {
		h.logAndRespondError(c, err, "failed to get company summary", map[string]string{
			"org_id": orgID.String(),
			"period": period,
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{"summary": summary})
}
