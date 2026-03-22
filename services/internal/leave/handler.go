package leave

import (
	"context"
	"net/http"
	"strconv"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/rs/zerolog"
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
	SubmitRequest(ctx context.Context, orgID, employeeID uuid.UUID, role string, input SubmitRequestInput) (*Request, error)
	ListRequests(ctx context.Context, orgID uuid.UUID, filter ListRequestsFilter, role string, managerEmployeeID *uuid.UUID) ([]RequestWithDetails, error)
	ListMyRequests(ctx context.Context, orgID, employeeID uuid.UUID) ([]RequestWithDetails, error)
	GetRequest(ctx context.Context, orgID, requestID uuid.UUID) (*Request, error)
	ApproveRequest(ctx context.Context, orgID, reviewerEmployeeID, requestID uuid.UUID) (*Request, error)
	RejectRequest(ctx context.Context, orgID, reviewerEmployeeID, requestID uuid.UUID, note *string) (*Request, error)
	CancelRequest(ctx context.Context, orgID, employeeID, requestID uuid.UUID) (*Request, error)
	VerifyManagerRelationship(ctx context.Context, orgID, employeeID, managerEmployeeID uuid.UUID) error

	// Notifications
	GetNotificationCount(ctx context.Context, orgID uuid.UUID, role string, managerEmployeeID *uuid.UUID) (int, error)

	// Calendar
	GetCalendar(ctx context.Context, orgID uuid.UUID, year, month int) ([]CalendarEntry, error)
	ListHolidays(ctx context.Context, orgID uuid.UUID, startDate, endDate string) ([]PublicHoliday, error)

	// Templates
	ListTemplates(ctx context.Context, orgID uuid.UUID, countryCode *string) ([]PolicyTemplate, error)
	ImportPolicies(ctx context.Context, orgID uuid.UUID, input ImportPoliciesInput) ([]Policy, error)
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

func (h *Handler) RegisterRoutes(rg *gin.RouterGroup) {
	leave := rg.Group("/leave")

	// Policies — admin/owner only
	leave.GET("/policies", middleware.Require(middleware.PermLeaveRead), h.ListPolicies)
	leave.POST("/policies", middleware.Require(middleware.PermLeaveWrite), h.CreatePolicy)
	leave.POST("/policies/import", middleware.Require(middleware.PermLeaveWrite), h.ImportPolicies)
	leave.PUT("/policies/:id", middleware.Require(middleware.PermLeaveWrite), h.UpdatePolicy)
	leave.DELETE("/policies/:id", middleware.Require(middleware.PermLeaveWrite), h.DeactivatePolicy)

	// Templates — admin can list and import
	leave.GET("/templates", middleware.Require(middleware.PermLeaveRead), h.ListTemplates)

	// Balances — approvers + admins see all, employees see own
	leave.GET("/balances", middleware.RequireAny(middleware.PermLeaveApprove, middleware.PermLeaveWrite, middleware.PermTeamLeaveApprove), h.ListBalances)
	leave.GET("/balances/me", middleware.Require(middleware.PermSelfLeave), h.ListMyBalances)

	// Requests — submit & view own
	leave.POST("/requests", middleware.Require(middleware.PermSelfLeave), h.SubmitRequest)
	leave.GET("/requests", middleware.RequireAny(middleware.PermLeaveApprove, middleware.PermLeaveWrite, middleware.PermTeamLeaveApprove), h.ListRequests)
	leave.GET("/requests/me", middleware.Require(middleware.PermSelfLeave), h.ListMyRequests)
	leave.GET("/requests/:id", middleware.Require(middleware.PermSelfLeave), h.GetRequest)
	leave.POST("/requests/:id/cancel", middleware.Require(middleware.PermSelfLeave), h.CancelRequest)

	// Notifications — pending approvals count (approvers + admins)
	leave.GET("/notifications/count", middleware.RequireAny(middleware.PermLeaveApprove, middleware.PermLeaveWrite, middleware.PermTeamLeaveApprove), h.GetNotificationCount)

	// Approve / reject — admin, manager, or direct report manager
	leave.POST("/requests/:id/approve", middleware.RequireAny(middleware.PermLeaveApprove, middleware.PermTeamLeaveApprove, middleware.PermLeaveWrite), h.ApproveRequest)
	leave.POST("/requests/:id/reject", middleware.RequireAny(middleware.PermLeaveApprove, middleware.PermTeamLeaveApprove, middleware.PermLeaveWrite), h.RejectRequest)

	// Calendar
	leave.GET("/calendar", middleware.Require(middleware.PermLeaveRead), h.GetCalendar)
	leave.GET("/holidays", middleware.Require(middleware.PermSelfLeave), h.ListHolidays)
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
	role := middleware.RoleFromCtx(c)

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

	req, err := h.service.SubmitRequest(c.Request.Context(), orgID, employeeID, role, input)
	if err != nil {
		c.JSON(apperr.HTTPStatus(err), apperr.Response(err))
		return
	}

	c.JSON(http.StatusCreated, gin.H{"data": req})
}

func (h *Handler) GetRequest(c *gin.Context) {
	orgID := middleware.OrgIDFromCtx(c)

	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, apperr.ValidationError(err))
		return
	}

	req, err := h.service.GetRequest(c.Request.Context(), orgID, id)
	if err != nil {
		c.JSON(apperr.HTTPStatus(err), apperr.Response(err))
		return
	}

	c.JSON(http.StatusOK, gin.H{"data": req})
}

func (h *Handler) ListRequests(c *gin.Context) {
	orgID := middleware.OrgIDFromCtx(c)
	userID := middleware.UserIDFromCtx(c)
	role := middleware.RoleFromCtx(c)

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
	if d := c.Query("date"); d != "" {
		filter.Date = &d
	}

	// For non-admin roles, filter by direct reports (reporting_to relationship)
	// Admins (owner, admin, hr_admin) can see all requests
	var managerEmployeeID *uuid.UUID
	hasFullApprovalRights := role == "owner" || role == "admin" || role == "hr_admin" || role == "super_admin"

	if !hasFullApprovalRights {
		// Lookup current user's employee_id to filter by their direct reports
		empID, err := h.empLookup(c.Request.Context(), orgID, userID)
		if err != nil {
			c.JSON(apperr.HTTPStatus(err), apperr.Response(err))
			return
		}
		managerEmployeeID = &empID
	}

	requests, err := h.service.ListRequests(c.Request.Context(), orgID, filter, role, managerEmployeeID)
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
	role := middleware.RoleFromCtx(c)

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

	// If not an admin, verify they are the actual manager of the requester
	hasFullApprovalRights := role == "owner" || role == "admin" || role == "hr_admin" || role == "super_admin"
	if !hasFullApprovalRights {
		// Get the request to check the reporting relationship
		request, err := h.service.GetRequest(c.Request.Context(), orgID, requestID)
		if err != nil {
			c.JSON(apperr.HTTPStatus(err), apperr.Response(err))
			return
		}

		// Verify the reviewer is the requester's manager
		if err := h.service.VerifyManagerRelationship(c.Request.Context(), orgID, request.EmployeeID, reviewerEmployeeID); err != nil {
			c.JSON(http.StatusForbidden, apperr.Response(apperr.New(apperr.CodeForbidden, "you can only approve requests from your direct reports")))
			return
		}
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
	role := middleware.RoleFromCtx(c)

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

	// If not an admin, verify they are the actual manager of the requester
	hasFullApprovalRights := role == "owner" || role == "admin" || role == "hr_admin" || role == "super_admin"
	if !hasFullApprovalRights {
		// Get the request to check the reporting relationship
		request, err := h.service.GetRequest(c.Request.Context(), orgID, requestID)
		if err != nil {
			c.JSON(apperr.HTTPStatus(err), apperr.Response(err))
			return
		}

		// Verify the reviewer is the requester's manager
		if err := h.service.VerifyManagerRelationship(c.Request.Context(), orgID, request.EmployeeID, reviewerEmployeeID); err != nil {
			c.JSON(http.StatusForbidden, apperr.Response(apperr.New(apperr.CodeForbidden, "you can only reject requests from your direct reports")))
			return
		}
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

func (h *Handler) ListHolidays(c *gin.Context) {
	orgID := middleware.OrgIDFromCtx(c)

	// Query params for date range
	startDate := c.Query("start_date")
	endDate := c.Query("end_date")

	if startDate == "" || endDate == "" {
		c.JSON(http.StatusBadRequest, apperr.ValidationError(
			apperr.NewField(apperr.CodeValidation, "start_date and end_date are required", "start_date")))
		return
	}

	holidays, err := h.service.ListHolidays(c.Request.Context(), orgID, startDate, endDate)
	if err != nil {
		c.JSON(apperr.HTTPStatus(err), apperr.Response(err))
		return
	}

	c.JSON(http.StatusOK, gin.H{"data": holidays})
}

// ── Notifications ─────────────────────────────────────────────────────────────

func (h *Handler) GetNotificationCount(c *gin.Context) {
	orgID := middleware.OrgIDFromCtx(c)
	userID := middleware.UserIDFromCtx(c)
	role := middleware.RoleFromCtx(c)

	// For non-admin roles, filter by direct reports
	var managerEmployeeID *uuid.UUID
	hasFullApprovalRights := role == "owner" || role == "admin" || role == "hr_admin" || role == "super_admin"

	if !hasFullApprovalRights {
		empID, err := h.empLookup(c.Request.Context(), orgID, userID)
		if err != nil {
			c.JSON(apperr.HTTPStatus(err), apperr.Response(err))
			return
		}
		managerEmployeeID = &empID
	}

	count, err := h.service.GetNotificationCount(c.Request.Context(), orgID, role, managerEmployeeID)
	if err != nil {
		c.JSON(apperr.HTTPStatus(err), apperr.Response(err))
		return
	}

	c.JSON(http.StatusOK, gin.H{"data": gin.H{"count": count}})
}

// ── Templates ─────────────────────────────────────────────────────────────────

func (h *Handler) ListTemplates(c *gin.Context) {
	orgID := middleware.OrgIDFromCtx(c)

	// Optional country_code query param (defaults to org's country)
	countryCode := c.Query("country_code")
	var cc *string
	if countryCode != "" {
		cc = &countryCode
	}

	templates, err := h.service.ListTemplates(c.Request.Context(), orgID, cc)
	if err != nil {
		c.JSON(apperr.HTTPStatus(err), apperr.Response(err))
		return
	}

	c.JSON(http.StatusOK, gin.H{"data": templates})
}

func (h *Handler) ImportPolicies(c *gin.Context) {
	orgID := middleware.OrgIDFromCtx(c)

	var input ImportPoliciesInput
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, apperr.ValidationError(err))
		return
	}

	if err := validate.Struct(input); err != nil {
		c.JSON(http.StatusBadRequest, apperr.ValidationError(err))
		return
	}

	policies, err := h.service.ImportPolicies(c.Request.Context(), orgID, input)
	if err != nil {
		c.JSON(apperr.HTTPStatus(err), apperr.Response(err))
		return
	}

	c.JSON(http.StatusCreated, gin.H{
		"data": gin.H{
			"created_count": len(policies),
			"policies":      policies,
		},
	})
}
