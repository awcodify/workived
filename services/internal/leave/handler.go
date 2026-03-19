package leave

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
	// Policies
	ListPolicies(ctx context.Context, orgID uuid.UUID) ([]Policy, error)
	CreatePolicy(ctx context.Context, orgID uuid.UUID, req CreatePolicyRequest) (*Policy, error)
	UpdatePolicy(ctx context.Context, orgID, policyID uuid.UUID, req UpdatePolicyRequest) (*Policy, error)
	DeactivatePolicy(ctx context.Context, orgID, policyID uuid.UUID) error

	// Balances
	ListBalances(ctx context.Context, orgID uuid.UUID, year int) ([]BalanceWithPolicy, error)
	ListMyBalances(ctx context.Context, orgID, employeeID uuid.UUID, year int) ([]BalanceWithPolicy, error)

	// Requests
	SubmitRequest(ctx context.Context, orgID, employeeID uuid.UUID, input SubmitRequestInput) (*Request, error)
	ListRequests(ctx context.Context, orgID uuid.UUID, filter ListRequestsFilter) ([]RequestWithDetails, error)
	ListMyRequests(ctx context.Context, orgID, employeeID uuid.UUID) ([]RequestWithDetails, error)
	ApproveRequest(ctx context.Context, orgID, reviewerEmployeeID, requestID uuid.UUID) (*Request, error)
	RejectRequest(ctx context.Context, orgID, reviewerEmployeeID, requestID uuid.UUID, note *string) (*Request, error)
	CancelRequest(ctx context.Context, orgID, employeeID, requestID uuid.UUID) (*Request, error)

	// Calendar
	GetCalendar(ctx context.Context, orgID uuid.UUID, year, month int) ([]CalendarEntry, error)
}

// EmployeeLookupFunc resolves the authenticated user's employee ID from their user ID.
type EmployeeLookupFunc func(ctx context.Context, orgID, userID uuid.UUID) (uuid.UUID, error)

type Handler struct {
	service   ServiceInterface
	empLookup EmployeeLookupFunc
}

func NewHandler(service ServiceInterface, empLookup EmployeeLookupFunc) *Handler {
	return &Handler{service: service, empLookup: empLookup}
}

func (h *Handler) RegisterRoutes(rg *gin.RouterGroup) {
	leave := rg.Group("/leave")

	// Policies — admin/owner only
	leave.GET("/policies", middleware.Require(middleware.PermLeaveRead), h.ListPolicies)
	leave.POST("/policies", middleware.Require(middleware.PermLeaveWrite), h.CreatePolicy)
	leave.PUT("/policies/:id", middleware.Require(middleware.PermLeaveWrite), h.UpdatePolicy)
	leave.DELETE("/policies/:id", middleware.Require(middleware.PermLeaveWrite), h.DeactivatePolicy)

	// Balances — admin sees all, employee sees own
	leave.GET("/balances", middleware.Require(middleware.PermLeaveRead), h.ListBalances)
	leave.GET("/balances/me", middleware.Require(middleware.PermSelfLeave), h.ListMyBalances)

	// Requests — submit & view own
	leave.POST("/requests", middleware.Require(middleware.PermSelfLeave), h.SubmitRequest)
	leave.GET("/requests", middleware.Require(middleware.PermLeaveRead), h.ListRequests)
	leave.GET("/requests/me", middleware.Require(middleware.PermSelfLeave), h.ListMyRequests)
	leave.POST("/requests/:id/cancel", middleware.Require(middleware.PermSelfLeave), h.CancelRequest)

	// Approve / reject — admin or manager
	leave.POST("/requests/:id/approve", middleware.RequireAny(middleware.PermLeaveApprove, middleware.PermTeamLeaveApprove), h.ApproveRequest)
	leave.POST("/requests/:id/reject", middleware.RequireAny(middleware.PermLeaveApprove, middleware.PermTeamLeaveApprove), h.RejectRequest)

	// Calendar
	leave.GET("/calendar", middleware.Require(middleware.PermLeaveRead), h.GetCalendar)
}

// ── Policies ──────────────────────────────────────────────────────────────────

func (h *Handler) ListPolicies(c *gin.Context) {
	orgID := middleware.OrgIDFromCtx(c)

	policies, err := h.service.ListPolicies(c.Request.Context(), orgID)
	if err != nil {
		c.JSON(apperr.HTTPStatus(err), apperr.Response(err))
		return
	}

	c.JSON(http.StatusOK, gin.H{"data": policies})
}

func (h *Handler) CreatePolicy(c *gin.Context) {
	orgID := middleware.OrgIDFromCtx(c)

	var req CreatePolicyRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, apperr.ValidationError(err))
		return
	}
	if err := validate.Struct(&req); err != nil {
		c.JSON(http.StatusBadRequest, apperr.ValidationError(err))
		return
	}

	policy, err := h.service.CreatePolicy(c.Request.Context(), orgID, req)
	if err != nil {
		c.JSON(apperr.HTTPStatus(err), apperr.Response(err))
		return
	}

	c.JSON(http.StatusCreated, gin.H{"data": policy})
}

func (h *Handler) UpdatePolicy(c *gin.Context) {
	orgID := middleware.OrgIDFromCtx(c)
	policyID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, apperr.ValidationError(err))
		return
	}

	var req UpdatePolicyRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, apperr.ValidationError(err))
		return
	}
	if err := validate.Struct(&req); err != nil {
		c.JSON(http.StatusBadRequest, apperr.ValidationError(err))
		return
	}

	policy, err := h.service.UpdatePolicy(c.Request.Context(), orgID, policyID, req)
	if err != nil {
		c.JSON(apperr.HTTPStatus(err), apperr.Response(err))
		return
	}

	c.JSON(http.StatusOK, gin.H{"data": policy})
}

func (h *Handler) DeactivatePolicy(c *gin.Context) {
	orgID := middleware.OrgIDFromCtx(c)
	policyID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, apperr.ValidationError(err))
		return
	}

	if err := h.service.DeactivatePolicy(c.Request.Context(), orgID, policyID); err != nil {
		c.JSON(apperr.HTTPStatus(err), apperr.Response(err))
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "policy deactivated"})
}

// ── Balances ──────────────────────────────────────────────────────────────────

func (h *Handler) ListBalances(c *gin.Context) {
	orgID := middleware.OrgIDFromCtx(c)

	year, err := strconv.Atoi(c.Query("year"))
	if err != nil || year < 2000 {
		c.JSON(http.StatusBadRequest, apperr.ValidationError(
			apperr.NewField(apperr.CodeValidation, "valid year is required", "year")))
		return
	}

	balances, err := h.service.ListBalances(c.Request.Context(), orgID, year)
	if err != nil {
		c.JSON(apperr.HTTPStatus(err), apperr.Response(err))
		return
	}

	c.JSON(http.StatusOK, gin.H{"data": balances})
}

func (h *Handler) ListMyBalances(c *gin.Context) {
	orgID := middleware.OrgIDFromCtx(c)
	userID := middleware.UserIDFromCtx(c)

	employeeID, err := h.empLookup(c.Request.Context(), orgID, userID)
	if err != nil {
		c.JSON(apperr.HTTPStatus(err), apperr.Response(err))
		return
	}

	year, err := strconv.Atoi(c.Query("year"))
	if err != nil || year < 2000 {
		c.JSON(http.StatusBadRequest, apperr.ValidationError(
			apperr.NewField(apperr.CodeValidation, "valid year is required", "year")))
		return
	}

	balances, err := h.service.ListMyBalances(c.Request.Context(), orgID, employeeID, year)
	if err != nil {
		c.JSON(apperr.HTTPStatus(err), apperr.Response(err))
		return
	}

	c.JSON(http.StatusOK, gin.H{"data": balances})
}

// ── Requests ──────────────────────────────────────────────────────────────────

func (h *Handler) SubmitRequest(c *gin.Context) {
	orgID := middleware.OrgIDFromCtx(c)
	userID := middleware.UserIDFromCtx(c)

	employeeID, err := h.empLookup(c.Request.Context(), orgID, userID)
	if err != nil {
		c.JSON(apperr.HTTPStatus(err), apperr.Response(err))
		return
	}

	var input SubmitRequestInput
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, apperr.ValidationError(err))
		return
	}
	if err := validate.Struct(&input); err != nil {
		c.JSON(http.StatusBadRequest, apperr.ValidationError(err))
		return
	}

	req, err := h.service.SubmitRequest(c.Request.Context(), orgID, employeeID, input)
	if err != nil {
		c.JSON(apperr.HTTPStatus(err), apperr.Response(err))
		return
	}

	c.JSON(http.StatusCreated, gin.H{"data": req})
}

func (h *Handler) ListRequests(c *gin.Context) {
	orgID := middleware.OrgIDFromCtx(c)

	var filter ListRequestsFilter
	if s := c.Query("status"); s != "" {
		filter.Status = &s
	}
	if eid := c.Query("employee_id"); eid != "" {
		id, err := uuid.Parse(eid)
		if err != nil {
			c.JSON(http.StatusBadRequest, apperr.ValidationError(err))
			return
		}
		filter.EmployeeID = &id
	}
	if y := c.Query("year"); y != "" {
		year, err := strconv.Atoi(y)
		if err != nil {
			c.JSON(http.StatusBadRequest, apperr.ValidationError(err))
			return
		}
		filter.Year = &year
	}

	requests, err := h.service.ListRequests(c.Request.Context(), orgID, filter)
	if err != nil {
		c.JSON(apperr.HTTPStatus(err), apperr.Response(err))
		return
	}

	c.JSON(http.StatusOK, gin.H{"data": requests})
}

func (h *Handler) ListMyRequests(c *gin.Context) {
	orgID := middleware.OrgIDFromCtx(c)
	userID := middleware.UserIDFromCtx(c)

	employeeID, err := h.empLookup(c.Request.Context(), orgID, userID)
	if err != nil {
		c.JSON(apperr.HTTPStatus(err), apperr.Response(err))
		return
	}

	requests, err := h.service.ListMyRequests(c.Request.Context(), orgID, employeeID)
	if err != nil {
		c.JSON(apperr.HTTPStatus(err), apperr.Response(err))
		return
	}

	c.JSON(http.StatusOK, gin.H{"data": requests})
}

func (h *Handler) ApproveRequest(c *gin.Context) {
	orgID := middleware.OrgIDFromCtx(c)
	userID := middleware.UserIDFromCtx(c)

	requestID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, apperr.ValidationError(err))
		return
	}

	reviewerEmployeeID, err := h.empLookup(c.Request.Context(), orgID, userID)
	if err != nil {
		c.JSON(apperr.HTTPStatus(err), apperr.Response(err))
		return
	}

	req, err := h.service.ApproveRequest(c.Request.Context(), orgID, reviewerEmployeeID, requestID)
	if err != nil {
		c.JSON(apperr.HTTPStatus(err), apperr.Response(err))
		return
	}

	c.JSON(http.StatusOK, gin.H{"data": req})
}

func (h *Handler) RejectRequest(c *gin.Context) {
	orgID := middleware.OrgIDFromCtx(c)
	userID := middleware.UserIDFromCtx(c)

	requestID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, apperr.ValidationError(err))
		return
	}

	reviewerEmployeeID, err := h.empLookup(c.Request.Context(), orgID, userID)
	if err != nil {
		c.JSON(apperr.HTTPStatus(err), apperr.Response(err))
		return
	}

	var input ReviewInput
	_ = c.ShouldBindJSON(&input) // note is optional

	req, err := h.service.RejectRequest(c.Request.Context(), orgID, reviewerEmployeeID, requestID, input.Note)
	if err != nil {
		c.JSON(apperr.HTTPStatus(err), apperr.Response(err))
		return
	}

	c.JSON(http.StatusOK, gin.H{"data": req})
}

func (h *Handler) CancelRequest(c *gin.Context) {
	orgID := middleware.OrgIDFromCtx(c)
	userID := middleware.UserIDFromCtx(c)

	requestID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, apperr.ValidationError(err))
		return
	}

	employeeID, err := h.empLookup(c.Request.Context(), orgID, userID)
	if err != nil {
		c.JSON(apperr.HTTPStatus(err), apperr.Response(err))
		return
	}

	req, err := h.service.CancelRequest(c.Request.Context(), orgID, employeeID, requestID)
	if err != nil {
		c.JSON(apperr.HTTPStatus(err), apperr.Response(err))
		return
	}

	c.JSON(http.StatusOK, gin.H{"data": req})
}

// ── Calendar ──────────────────────────────────────────────────────────────────

func (h *Handler) GetCalendar(c *gin.Context) {
	orgID := middleware.OrgIDFromCtx(c)

	year, err := strconv.Atoi(c.Query("year"))
	if err != nil || year < 2000 {
		c.JSON(http.StatusBadRequest, apperr.ValidationError(
			apperr.NewField(apperr.CodeValidation, "valid year is required", "year")))
		return
	}
	month, err := strconv.Atoi(c.Query("month"))
	if err != nil || month < 1 || month > 12 {
		c.JSON(http.StatusBadRequest, apperr.ValidationError(
			apperr.NewField(apperr.CodeValidation, "valid month (1-12) is required", "month")))
		return
	}

	entries, err := h.service.GetCalendar(c.Request.Context(), orgID, year, month)
	if err != nil {
		c.JSON(apperr.HTTPStatus(err), apperr.Response(err))
		return
	}

	c.JSON(http.StatusOK, gin.H{"data": entries})
}
