package leave_test

import (
	"bytes"
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/workived/services/internal/leave"
	"github.com/workived/services/internal/platform/middleware"
	"github.com/workived/services/pkg/apperr"
)

func init() {
	gin.SetMode(gin.TestMode)
}

// ── Fake service ─────────────────────────────────────────────────────────────

type fakeService struct {
	listPoliciesFn     func(ctx context.Context, orgID uuid.UUID) ([]leave.Policy, error)
	createPolicyFn     func(ctx context.Context, orgID uuid.UUID, req leave.CreatePolicyRequest) (*leave.Policy, error)
	updatePolicyFn     func(ctx context.Context, orgID, policyID uuid.UUID, req leave.UpdatePolicyRequest) (*leave.Policy, error)
	deactivatePolicyFn func(ctx context.Context, orgID, policyID uuid.UUID) error
	listBalancesFn     func(ctx context.Context, orgID uuid.UUID, year int) ([]leave.BalanceWithPolicy, error)
	listMyBalancesFn   func(ctx context.Context, orgID, employeeID uuid.UUID, year int) ([]leave.BalanceWithPolicy, error)
	submitRequestFn    func(ctx context.Context, orgID, employeeID uuid.UUID, input leave.SubmitRequestInput) (*leave.Request, error)
	listRequestsFn     func(ctx context.Context, orgID uuid.UUID, filter leave.ListRequestsFilter, role string, managerEmployeeID *uuid.UUID) ([]leave.RequestWithDetails, error)
	listMyRequestsFn   func(ctx context.Context, orgID, employeeID uuid.UUID) ([]leave.RequestWithDetails, error)
	approveRequestFn   func(ctx context.Context, orgID, reviewerEmployeeID, requestID uuid.UUID) (*leave.Request, error)
	rejectRequestFn    func(ctx context.Context, orgID, reviewerEmployeeID, requestID uuid.UUID, note *string) (*leave.Request, error)
	cancelRequestFn    func(ctx context.Context, orgID, employeeID, requestID uuid.UUID) (*leave.Request, error)
	getCalendarFn      func(ctx context.Context, orgID uuid.UUID, year, month int) ([]leave.CalendarEntry, error)
}

func (f *fakeService) ListPolicies(ctx context.Context, orgID uuid.UUID) ([]leave.Policy, error) {
	if f.listPoliciesFn != nil {
		return f.listPoliciesFn(ctx, orgID)
	}
	return []leave.Policy{}, nil
}

func (f *fakeService) CreatePolicy(ctx context.Context, orgID uuid.UUID, req leave.CreatePolicyRequest) (*leave.Policy, error) {
	if f.createPolicyFn != nil {
		return f.createPolicyFn(ctx, orgID, req)
	}
	return &leave.Policy{ID: testPolicyID}, nil
}

func (f *fakeService) UpdatePolicy(ctx context.Context, orgID, policyID uuid.UUID, req leave.UpdatePolicyRequest) (*leave.Policy, error) {
	if f.updatePolicyFn != nil {
		return f.updatePolicyFn(ctx, orgID, policyID, req)
	}
	return &leave.Policy{ID: policyID}, nil
}

func (f *fakeService) DeactivatePolicy(ctx context.Context, orgID, policyID uuid.UUID) error {
	if f.deactivatePolicyFn != nil {
		return f.deactivatePolicyFn(ctx, orgID, policyID)
	}
	return nil
}

func (f *fakeService) ListBalances(ctx context.Context, orgID uuid.UUID, year int) ([]leave.BalanceWithPolicy, error) {
	if f.listBalancesFn != nil {
		return f.listBalancesFn(ctx, orgID, year)
	}
	return []leave.BalanceWithPolicy{}, nil
}

func (f *fakeService) ListMyBalances(ctx context.Context, orgID, employeeID uuid.UUID, year int) ([]leave.BalanceWithPolicy, error) {
	if f.listMyBalancesFn != nil {
		return f.listMyBalancesFn(ctx, orgID, employeeID, year)
	}
	return []leave.BalanceWithPolicy{}, nil
}

func (f *fakeService) SubmitRequest(ctx context.Context, orgID, employeeID uuid.UUID, input leave.SubmitRequestInput) (*leave.Request, error) {
	if f.submitRequestFn != nil {
		return f.submitRequestFn(ctx, orgID, employeeID, input)
	}
	return &leave.Request{ID: testReqID}, nil
}

func (f *fakeService) ListRequests(ctx context.Context, orgID uuid.UUID, filter leave.ListRequestsFilter, role string, managerEmployeeID *uuid.UUID) ([]leave.RequestWithDetails, error) {
	if f.listRequestsFn != nil {
		return f.listRequestsFn(ctx, orgID, filter, role, managerEmployeeID)
	}
	return []leave.RequestWithDetails{}, nil
}

func (f *fakeService) ListMyRequests(ctx context.Context, orgID, employeeID uuid.UUID) ([]leave.RequestWithDetails, error) {
	if f.listMyRequestsFn != nil {
		return f.listMyRequestsFn(ctx, orgID, employeeID)
	}
	return []leave.RequestWithDetails{}, nil
}

func (f *fakeService) ApproveRequest(ctx context.Context, orgID, reviewerEmployeeID, requestID uuid.UUID) (*leave.Request, error) {
	if f.approveRequestFn != nil {
		return f.approveRequestFn(ctx, orgID, reviewerEmployeeID, requestID)
	}
	return &leave.Request{ID: requestID, Status: "approved"}, nil
}

func (f *fakeService) RejectRequest(ctx context.Context, orgID, reviewerEmployeeID, requestID uuid.UUID, note *string) (*leave.Request, error) {
	if f.rejectRequestFn != nil {
		return f.rejectRequestFn(ctx, orgID, reviewerEmployeeID, requestID, note)
	}
	return &leave.Request{ID: requestID, Status: "rejected"}, nil
}

func (f *fakeService) CancelRequest(ctx context.Context, orgID, employeeID, requestID uuid.UUID) (*leave.Request, error) {
	if f.cancelRequestFn != nil {
		return f.cancelRequestFn(ctx, orgID, employeeID, requestID)
	}
	return &leave.Request{ID: requestID, Status: "cancelled"}, nil
}

func (f *fakeService) GetCalendar(ctx context.Context, orgID uuid.UUID, year, month int) ([]leave.CalendarEntry, error) {
	if f.getCalendarFn != nil {
		return f.getCalendarFn(ctx, orgID, year, month)
	}
	return []leave.CalendarEntry{}, nil
}

func (f *fakeService) ListHolidays(ctx context.Context, orgID uuid.UUID, startDate, endDate string) ([]leave.PublicHoliday, error) {
	return []leave.PublicHoliday{}, nil
}

func (f *fakeService) GetNotificationCount(ctx context.Context, orgID uuid.UUID, role string, managerEmployeeID *uuid.UUID) (int, error) {
	return 0, nil
}

func (f *fakeService) ListTemplates(ctx context.Context, orgID uuid.UUID, countryCode *string) ([]leave.PolicyTemplate, error) {
	return []leave.PolicyTemplate{}, nil
}

func (f *fakeService) ImportPolicies(ctx context.Context, orgID uuid.UUID, input leave.ImportPoliciesInput) ([]leave.Policy, error) {
	return []leave.Policy{}, nil
}

// ── Helpers ──────────────────────────────────────────────────────────────────

var defaultEmpLookup = leave.EmployeeLookupFunc(func(_ context.Context, _, _ uuid.UUID) (uuid.UUID, error) {
	return testEmpID, nil
})

func newRouter(svc leave.ServiceInterface) *gin.Engine {
	return newRouterWithLookup(svc, defaultEmpLookup)
}

func newRouterWithLookup(svc leave.ServiceInterface, lookup leave.EmployeeLookupFunc) *gin.Engine {
	r := gin.New()
	r.Use(func(c *gin.Context) {
		c.Set("org_id", testOrgID)
		c.Set("user_id", testUserID)
		c.Set("role", middleware.RoleAdmin)
		c.Next()
	})
	h := leave.NewHandler(svc, lookup)
	h.RegisterRoutes(r.Group("/api/v1"))
	return r
}

func jsonBody(t *testing.T, v any) *bytes.Buffer {
	t.Helper()
	b, _ := json.Marshal(v)
	return bytes.NewBuffer(b)
}

func assertStatus(t *testing.T, w *httptest.ResponseRecorder, want int) {
	t.Helper()
	if w.Code != want {
		t.Errorf("status = %d, want %d; body: %s", w.Code, want, w.Body.String())
	}
}

func assertHasDataKey(t *testing.T, w *httptest.ResponseRecorder) {
	t.Helper()
	var body map[string]json.RawMessage
	if err := json.Unmarshal(w.Body.Bytes(), &body); err != nil {
		t.Fatalf("failed to unmarshal body: %v", err)
	}
	if _, ok := body["data"]; !ok {
		t.Errorf("response body missing \"data\" key; got: %s", w.Body.String())
	}
}

// ── TestHandler_ListPolicies ─────────────────────────────────────────────────

func TestHandler_ListPolicies(t *testing.T) {
	tests := []struct {
		name       string
		svcFn      func(ctx context.Context, orgID uuid.UUID) ([]leave.Policy, error)
		wantStatus int
	}{
		{
			name: "200 — returns policies",
			svcFn: func(_ context.Context, _ uuid.UUID) ([]leave.Policy, error) {
				return []leave.Policy{
					{ID: testPolicyID, Name: "Annual Leave", DaysPerYear: 12},
				}, nil
			},
			wantStatus: http.StatusOK,
		},
		{
			name: "500 — service error",
			svcFn: func(_ context.Context, _ uuid.UUID) ([]leave.Policy, error) {
				return nil, apperr.Internal()
			},
			wantStatus: http.StatusInternalServerError,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			svc := &fakeService{listPoliciesFn: tt.svcFn}
			w := httptest.NewRecorder()
			req, _ := http.NewRequest(http.MethodGet, "/api/v1/leave/policies", nil)
			newRouter(svc).ServeHTTP(w, req)
			assertStatus(t, w, tt.wantStatus)
			if tt.wantStatus == http.StatusOK {
				assertHasDataKey(t, w)
			}
		})
	}
}

// ── TestHandler_CreatePolicy ─────────────────────────────────────────────────

func TestHandler_CreatePolicy(t *testing.T) {
	tests := []struct {
		name       string
		body       any
		svcFn      func(ctx context.Context, orgID uuid.UUID, req leave.CreatePolicyRequest) (*leave.Policy, error)
		wantStatus int
	}{
		{
			name: "201 — created",
			body: map[string]any{
				"name":          "Annual Leave",
				"days_per_year": 12,
			},
			wantStatus: http.StatusCreated,
		},
		{
			name:       "400 — invalid JSON",
			body:       "not-json{{{",
			wantStatus: http.StatusBadRequest,
		},
		{
			name: "400 — validation error (missing name)",
			body: map[string]any{
				"days_per_year": 12,
			},
			wantStatus: http.StatusBadRequest,
		},
		{
			name: "400 — validation error (days_per_year too high)",
			body: map[string]any{
				"name":          "Test",
				"days_per_year": 999,
			},
			wantStatus: http.StatusBadRequest,
		},
		{
			name: "500 — service error",
			body: map[string]any{
				"name":          "Annual Leave",
				"days_per_year": 12,
			},
			svcFn: func(_ context.Context, _ uuid.UUID, _ leave.CreatePolicyRequest) (*leave.Policy, error) {
				return nil, apperr.Internal()
			},
			wantStatus: http.StatusInternalServerError,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			svc := &fakeService{createPolicyFn: tt.svcFn}
			w := httptest.NewRecorder()
			var buf *bytes.Buffer
			switch v := tt.body.(type) {
			case string:
				buf = bytes.NewBufferString(v)
			default:
				buf = jsonBody(t, v)
			}
			req, _ := http.NewRequest(http.MethodPost, "/api/v1/leave/policies", buf)
			req.Header.Set("Content-Type", "application/json")
			newRouter(svc).ServeHTTP(w, req)
			assertStatus(t, w, tt.wantStatus)
		})
	}
}

// ── TestHandler_UpdatePolicy ─────────────────────────────────────────────────

func TestHandler_UpdatePolicy(t *testing.T) {
	newName := "Sick Leave"
	tests := []struct {
		name       string
		paramID    string
		body       any
		wantStatus int
	}{
		{
			name:    "200 — updated",
			paramID: testPolicyID.String(),
			body: map[string]any{
				"name": newName,
			},
			wantStatus: http.StatusOK,
		},
		{
			name:       "400 — invalid UUID param",
			paramID:    "not-a-uuid",
			body:       map[string]any{"name": newName},
			wantStatus: http.StatusBadRequest,
		},
		{
			name:       "400 — invalid body",
			paramID:    testPolicyID.String(),
			body:       "not-json{{{",
			wantStatus: http.StatusBadRequest,
		},
		{
			name:    "400 — validation error (name too long)",
			paramID: testPolicyID.String(),
			body: map[string]any{
				"name": string(make([]byte, 101)),
			},
			wantStatus: http.StatusBadRequest,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			svc := &fakeService{}
			w := httptest.NewRecorder()
			var buf *bytes.Buffer
			switch v := tt.body.(type) {
			case string:
				buf = bytes.NewBufferString(v)
			default:
				buf = jsonBody(t, v)
			}
			req, _ := http.NewRequest(http.MethodPut, "/api/v1/leave/policies/"+tt.paramID, buf)
			req.Header.Set("Content-Type", "application/json")
			newRouter(svc).ServeHTTP(w, req)
			assertStatus(t, w, tt.wantStatus)
		})
	}
}

// ── TestHandler_DeactivatePolicy ─────────────────────────────────────────────

func TestHandler_DeactivatePolicy(t *testing.T) {
	tests := []struct {
		name       string
		paramID    string
		svcErr     error
		wantStatus int
	}{
		{
			name:       "200 — deactivated",
			paramID:    testPolicyID.String(),
			wantStatus: http.StatusOK,
		},
		{
			name:       "400 — invalid UUID",
			paramID:    "bad-uuid",
			wantStatus: http.StatusBadRequest,
		},
		{
			name:       "404 — not found",
			paramID:    testPolicyID.String(),
			svcErr:     apperr.NotFound("policy"),
			wantStatus: http.StatusNotFound,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			svc := &fakeService{
				deactivatePolicyFn: func(_ context.Context, _, _ uuid.UUID) error {
					return tt.svcErr
				},
			}
			w := httptest.NewRecorder()
			req, _ := http.NewRequest(http.MethodDelete, "/api/v1/leave/policies/"+tt.paramID, nil)
			newRouter(svc).ServeHTTP(w, req)
			assertStatus(t, w, tt.wantStatus)
		})
	}
}

// ── TestHandler_ListBalances ─────────────────────────────────────────────────

func TestHandler_ListBalances(t *testing.T) {
	tests := []struct {
		name       string
		query      string
		wantStatus int
	}{
		{
			name:       "200 — with year",
			query:      "?year=2026",
			wantStatus: http.StatusOK,
		},
		{
			name:       "400 — missing year",
			query:      "",
			wantStatus: http.StatusBadRequest,
		},
		{
			name:       "400 — invalid year (not a number)",
			query:      "?year=abc",
			wantStatus: http.StatusBadRequest,
		},
		{
			name:       "400 — year too low",
			query:      "?year=1999",
			wantStatus: http.StatusBadRequest,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			svc := &fakeService{}
			w := httptest.NewRecorder()
			req, _ := http.NewRequest(http.MethodGet, "/api/v1/leave/balances"+tt.query, nil)
			newRouter(svc).ServeHTTP(w, req)
			assertStatus(t, w, tt.wantStatus)
			if tt.wantStatus == http.StatusOK {
				assertHasDataKey(t, w)
			}
		})
	}
}

// ── TestHandler_ListMyBalances ───────────────────────────────────────────────

func TestHandler_ListMyBalances(t *testing.T) {
	tests := []struct {
		name       string
		query      string
		empLookup  leave.EmployeeLookupFunc
		wantStatus int
	}{
		{
			name:       "200 — with year",
			query:      "?year=2026",
			wantStatus: http.StatusOK,
		},
		{
			name:       "400 — missing year",
			query:      "",
			wantStatus: http.StatusBadRequest,
		},
		{
			name:  "404 — empLookup error",
			query: "?year=2026",
			empLookup: func(_ context.Context, _, _ uuid.UUID) (uuid.UUID, error) {
				return uuid.Nil, apperr.NotFound("employee")
			},
			wantStatus: http.StatusNotFound,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			svc := &fakeService{}
			lookup := defaultEmpLookup
			if tt.empLookup != nil {
				lookup = tt.empLookup
			}
			w := httptest.NewRecorder()
			req, _ := http.NewRequest(http.MethodGet, "/api/v1/leave/balances/me"+tt.query, nil)
			newRouterWithLookup(svc, lookup).ServeHTTP(w, req)
			assertStatus(t, w, tt.wantStatus)
			if tt.wantStatus == http.StatusOK {
				assertHasDataKey(t, w)
			}
		})
	}
}

// ── TestHandler_SubmitRequest ────────────────────────────────────────────────

func TestHandler_SubmitRequest(t *testing.T) {
	validBody := map[string]any{
		"leave_policy_id": testPolicyID.String(),
		"start_date":      "2026-04-01",
		"end_date":        "2026-04-03",
	}

	tests := []struct {
		name       string
		body       any
		empLookup  leave.EmployeeLookupFunc
		svcFn      func(ctx context.Context, orgID, employeeID uuid.UUID, input leave.SubmitRequestInput) (*leave.Request, error)
		wantStatus int
	}{
		{
			name:       "201 — created",
			body:       validBody,
			wantStatus: http.StatusCreated,
		},
		{
			name:       "400 — invalid body",
			body:       "not-json{{{",
			wantStatus: http.StatusBadRequest,
		},
		{
			name: "400 — validation error (missing start_date)",
			body: map[string]any{
				"leave_policy_id": testPolicyID.String(),
				"end_date":        "2026-04-03",
			},
			wantStatus: http.StatusBadRequest,
		},
		{
			name: "404 — empLookup error",
			body: validBody,
			empLookup: func(_ context.Context, _, _ uuid.UUID) (uuid.UUID, error) {
				return uuid.Nil, apperr.NotFound("employee")
			},
			wantStatus: http.StatusNotFound,
		},
		{
			name: "409 — service conflict error",
			body: validBody,
			svcFn: func(_ context.Context, _, _ uuid.UUID, _ leave.SubmitRequestInput) (*leave.Request, error) {
				return nil, apperr.Conflict("overlapping leave request")
			},
			wantStatus: http.StatusConflict,
		},
		{
			name: "500 — service internal error",
			body: validBody,
			svcFn: func(_ context.Context, _, _ uuid.UUID, _ leave.SubmitRequestInput) (*leave.Request, error) {
				return nil, apperr.Internal()
			},
			wantStatus: http.StatusInternalServerError,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			svc := &fakeService{submitRequestFn: tt.svcFn}
			lookup := defaultEmpLookup
			if tt.empLookup != nil {
				lookup = tt.empLookup
			}
			w := httptest.NewRecorder()
			var buf *bytes.Buffer
			switch v := tt.body.(type) {
			case string:
				buf = bytes.NewBufferString(v)
			default:
				buf = jsonBody(t, v)
			}
			req, _ := http.NewRequest(http.MethodPost, "/api/v1/leave/requests", buf)
			req.Header.Set("Content-Type", "application/json")
			newRouterWithLookup(svc, lookup).ServeHTTP(w, req)
			assertStatus(t, w, tt.wantStatus)
		})
	}
}

// ── TestHandler_ListRequests ─────────────────────────────────────────────────

func TestHandler_ListRequests(t *testing.T) {
	tests := []struct {
		name       string
		query      string
		wantStatus int
	}{
		{
			name:       "200 — no filters",
			query:      "",
			wantStatus: http.StatusOK,
		},
		{
			name:       "200 — with status filter",
			query:      "?status=pending",
			wantStatus: http.StatusOK,
		},
		{
			name:       "200 — with employee_id filter",
			query:      "?employee_id=" + testEmpID.String(),
			wantStatus: http.StatusOK,
		},
		{
			name:       "200 — with year filter",
			query:      "?year=2026",
			wantStatus: http.StatusOK,
		},
		{
			name:       "200 — with all filters",
			query:      "?status=approved&employee_id=" + testEmpID.String() + "&year=2026",
			wantStatus: http.StatusOK,
		},
		{
			name:       "400 — invalid employee_id",
			query:      "?employee_id=not-a-uuid",
			wantStatus: http.StatusBadRequest,
		},
		{
			name:       "400 — invalid year",
			query:      "?year=abc",
			wantStatus: http.StatusBadRequest,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			svc := &fakeService{}
			w := httptest.NewRecorder()
			req, _ := http.NewRequest(http.MethodGet, "/api/v1/leave/requests"+tt.query, nil)
			newRouter(svc).ServeHTTP(w, req)
			assertStatus(t, w, tt.wantStatus)
			if tt.wantStatus == http.StatusOK {
				assertHasDataKey(t, w)
			}
		})
	}
}

// ── TestHandler_ListMyRequests ───────────────────────────────────────────────

func TestHandler_ListMyRequests(t *testing.T) {
	tests := []struct {
		name       string
		empLookup  leave.EmployeeLookupFunc
		wantStatus int
	}{
		{
			name:       "200 — success",
			wantStatus: http.StatusOK,
		},
		{
			name: "404 — empLookup error",
			empLookup: func(_ context.Context, _, _ uuid.UUID) (uuid.UUID, error) {
				return uuid.Nil, apperr.NotFound("employee")
			},
			wantStatus: http.StatusNotFound,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			svc := &fakeService{}
			lookup := defaultEmpLookup
			if tt.empLookup != nil {
				lookup = tt.empLookup
			}
			w := httptest.NewRecorder()
			req, _ := http.NewRequest(http.MethodGet, "/api/v1/leave/requests/me", nil)
			newRouterWithLookup(svc, lookup).ServeHTTP(w, req)
			assertStatus(t, w, tt.wantStatus)
			if tt.wantStatus == http.StatusOK {
				assertHasDataKey(t, w)
			}
		})
	}
}

// ── TestHandler_ApproveRequest ───────────────────────────────────────────────

func TestHandler_ApproveRequest(t *testing.T) {
	tests := []struct {
		name       string
		paramID    string
		empLookup  leave.EmployeeLookupFunc
		svcFn      func(ctx context.Context, orgID, reviewerEmployeeID, requestID uuid.UUID) (*leave.Request, error)
		wantStatus int
	}{
		{
			name:       "200 — approved",
			paramID:    testReqID.String(),
			wantStatus: http.StatusOK,
		},
		{
			name:       "400 — invalid UUID",
			paramID:    "bad-uuid",
			wantStatus: http.StatusBadRequest,
		},
		{
			name:    "404 — empLookup error",
			paramID: testReqID.String(),
			empLookup: func(_ context.Context, _, _ uuid.UUID) (uuid.UUID, error) {
				return uuid.Nil, apperr.NotFound("employee")
			},
			wantStatus: http.StatusNotFound,
		},
		{
			name:    "404 — request not found",
			paramID: testReqID.String(),
			svcFn: func(_ context.Context, _, _, _ uuid.UUID) (*leave.Request, error) {
				return nil, apperr.NotFound("leave request")
			},
			wantStatus: http.StatusNotFound,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			svc := &fakeService{approveRequestFn: tt.svcFn}
			lookup := defaultEmpLookup
			if tt.empLookup != nil {
				lookup = tt.empLookup
			}
			w := httptest.NewRecorder()
			req, _ := http.NewRequest(http.MethodPost, "/api/v1/leave/requests/"+tt.paramID+"/approve", nil)
			newRouterWithLookup(svc, lookup).ServeHTTP(w, req)
			assertStatus(t, w, tt.wantStatus)
		})
	}
}

// ── TestHandler_RejectRequest ────────────────────────────────────────────────

func TestHandler_RejectRequest(t *testing.T) {
	tests := []struct {
		name       string
		paramID    string
		body       any
		empLookup  leave.EmployeeLookupFunc
		wantStatus int
	}{
		{
			name:       "200 — rejected with note",
			paramID:    testReqID.String(),
			body:       map[string]string{"note": "Insufficient coverage"},
			wantStatus: http.StatusOK,
		},
		{
			name:       "200 — rejected without note",
			paramID:    testReqID.String(),
			body:       nil,
			wantStatus: http.StatusOK,
		},
		{
			name:       "400 — invalid UUID",
			paramID:    "bad-uuid",
			body:       nil,
			wantStatus: http.StatusBadRequest,
		},
		{
			name:    "404 — empLookup error",
			paramID: testReqID.String(),
			body:    nil,
			empLookup: func(_ context.Context, _, _ uuid.UUID) (uuid.UUID, error) {
				return uuid.Nil, apperr.NotFound("employee")
			},
			wantStatus: http.StatusNotFound,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			svc := &fakeService{}
			lookup := defaultEmpLookup
			if tt.empLookup != nil {
				lookup = tt.empLookup
			}
			w := httptest.NewRecorder()
			var buf *bytes.Buffer
			if tt.body != nil {
				buf = jsonBody(t, tt.body)
			} else {
				buf = bytes.NewBuffer(nil)
			}
			req, _ := http.NewRequest(http.MethodPost, "/api/v1/leave/requests/"+tt.paramID+"/reject", buf)
			req.Header.Set("Content-Type", "application/json")
			newRouterWithLookup(svc, lookup).ServeHTTP(w, req)
			assertStatus(t, w, tt.wantStatus)
		})
	}
}

// ── TestHandler_CancelRequest ────────────────────────────────────────────────

func TestHandler_CancelRequest(t *testing.T) {
	tests := []struct {
		name       string
		paramID    string
		empLookup  leave.EmployeeLookupFunc
		svcFn      func(ctx context.Context, orgID, employeeID, requestID uuid.UUID) (*leave.Request, error)
		wantStatus int
	}{
		{
			name:       "200 — cancelled",
			paramID:    testReqID.String(),
			wantStatus: http.StatusOK,
		},
		{
			name:       "400 — invalid UUID",
			paramID:    "bad-uuid",
			wantStatus: http.StatusBadRequest,
		},
		{
			name:    "404 — empLookup error",
			paramID: testReqID.String(),
			empLookup: func(_ context.Context, _, _ uuid.UUID) (uuid.UUID, error) {
				return uuid.Nil, apperr.NotFound("employee")
			},
			wantStatus: http.StatusNotFound,
		},
		{
			name:    "409 — already approved",
			paramID: testReqID.String(),
			svcFn: func(_ context.Context, _, _, _ uuid.UUID) (*leave.Request, error) {
				return nil, apperr.Conflict("cannot cancel approved request")
			},
			wantStatus: http.StatusConflict,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			svc := &fakeService{cancelRequestFn: tt.svcFn}
			lookup := defaultEmpLookup
			if tt.empLookup != nil {
				lookup = tt.empLookup
			}
			w := httptest.NewRecorder()
			req, _ := http.NewRequest(http.MethodPost, "/api/v1/leave/requests/"+tt.paramID+"/cancel", nil)
			newRouterWithLookup(svc, lookup).ServeHTTP(w, req)
			assertStatus(t, w, tt.wantStatus)
		})
	}
}

// ── TestHandler_GetCalendar ──────────────────────────────────────────────────

func TestHandler_GetCalendar(t *testing.T) {
	tests := []struct {
		name       string
		query      string
		svcFn      func(ctx context.Context, orgID uuid.UUID, year, month int) ([]leave.CalendarEntry, error)
		wantStatus int
	}{
		{
			name:  "200 — success",
			query: "?year=2026&month=3",
			svcFn: func(_ context.Context, _ uuid.UUID, _, _ int) ([]leave.CalendarEntry, error) {
				return []leave.CalendarEntry{
					{EmployeeID: testEmpID, EmployeeName: "Ahmad", PolicyName: "Annual Leave", StartDate: "2026-03-10", EndDate: "2026-03-12", TotalDays: 3},
				}, nil
			},
			wantStatus: http.StatusOK,
		},
		{
			name:       "400 — missing year",
			query:      "?month=3",
			wantStatus: http.StatusBadRequest,
		},
		{
			name:       "400 — invalid year",
			query:      "?year=abc&month=3",
			wantStatus: http.StatusBadRequest,
		},
		{
			name:       "400 — year too low",
			query:      "?year=1999&month=3",
			wantStatus: http.StatusBadRequest,
		},
		{
			name:       "400 — missing month",
			query:      "?year=2026",
			wantStatus: http.StatusBadRequest,
		},
		{
			name:       "400 — invalid month (not a number)",
			query:      "?year=2026&month=abc",
			wantStatus: http.StatusBadRequest,
		},
		{
			name:       "400 — month out of range (0)",
			query:      "?year=2026&month=0",
			wantStatus: http.StatusBadRequest,
		},
		{
			name:       "400 — month out of range (13)",
			query:      "?year=2026&month=13",
			wantStatus: http.StatusBadRequest,
		},
		{
			name:  "500 — service error",
			query: "?year=2026&month=3",
			svcFn: func(_ context.Context, _ uuid.UUID, _, _ int) ([]leave.CalendarEntry, error) {
				return nil, apperr.Internal()
			},
			wantStatus: http.StatusInternalServerError,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			svc := &fakeService{getCalendarFn: tt.svcFn}
			w := httptest.NewRecorder()
			req, _ := http.NewRequest(http.MethodGet, "/api/v1/leave/calendar"+tt.query, nil)
			newRouter(svc).ServeHTTP(w, req)
			assertStatus(t, w, tt.wantStatus)
			if tt.wantStatus == http.StatusOK {
				assertHasDataKey(t, w)
			}
		})
	}
}
