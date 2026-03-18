package employee_test

import (
	"bytes"
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/workived/services/internal/employee"
	"github.com/workived/services/internal/platform/middleware"
	"github.com/workived/services/pkg/apperr"
	"github.com/workived/services/pkg/paginate"
)

func init() {
	gin.SetMode(gin.TestMode)
}

// ── Mock service ──────────────────────────────────────────────────────────────

type mockEmpService struct {
	listFn         func(ctx context.Context, orgID uuid.UUID, f employee.ListFilters) (*employee.ListResult, error)
	createFn       func(ctx context.Context, orgID uuid.UUID, req employee.CreateEmployeeRequest) (*employee.Employee, error)
	getFn          func(ctx context.Context, orgID, id uuid.UUID) (*employee.Employee, error)
	getByUserIDFn  func(ctx context.Context, orgID, userID uuid.UUID) (*employee.Employee, error)
	updateFn       func(ctx context.Context, orgID, id uuid.UUID, req employee.UpdateEmployeeRequest) (*employee.Employee, error)
	deactivateFn   func(ctx context.Context, orgID, id uuid.UUID) error
}

func (m *mockEmpService) List(ctx context.Context, orgID uuid.UUID, f employee.ListFilters) (*employee.ListResult, error) {
	return m.listFn(ctx, orgID, f)
}
func (m *mockEmpService) Create(ctx context.Context, orgID uuid.UUID, req employee.CreateEmployeeRequest) (*employee.Employee, error) {
	return m.createFn(ctx, orgID, req)
}
func (m *mockEmpService) Get(ctx context.Context, orgID, id uuid.UUID) (*employee.Employee, error) {
	return m.getFn(ctx, orgID, id)
}
func (m *mockEmpService) GetByUserID(ctx context.Context, orgID, userID uuid.UUID) (*employee.Employee, error) {
	if m.getByUserIDFn != nil {
		return m.getByUserIDFn(ctx, orgID, userID)
	}
	return nil, apperr.NotFound("employee")
}
func (m *mockEmpService) Update(ctx context.Context, orgID, id uuid.UUID, req employee.UpdateEmployeeRequest) (*employee.Employee, error) {
	return m.updateFn(ctx, orgID, id, req)
}
func (m *mockEmpService) Deactivate(ctx context.Context, orgID, id uuid.UUID) error {
	return m.deactivateFn(ctx, orgID, id)
}

// ── Helpers ───────────────────────────────────────────────────────────────────

var testOrgID = uuid.MustParse("00000000-0000-0000-0000-000000000001")
var testEmpID = uuid.MustParse("00000000-0000-0000-0000-000000000002")
var testUserID = uuid.MustParse("00000000-0000-0000-0000-000000000003")

func newEmpRouter(svc employee.ServiceInterface) *gin.Engine {
	r := gin.New()
	// Inject org_id and user_id into context the way middleware would
	r.Use(func(c *gin.Context) {
		c.Set("org_id", testOrgID)
		c.Set("user_id", testUserID)
		c.Set("role", middleware.RoleAdmin)
		c.Next()
	})
	h := employee.NewHandler(svc)
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

// ── List tests ────────────────────────────────────────────────────────────────

func TestEmployeeHandler_List(t *testing.T) {
	tests := []struct {
		name       string
		query      string
		serviceErr error
		wantStatus int
	}{
		{
			name:       "success",
			wantStatus: http.StatusOK,
		},
		{
			name:       "with status filter",
			query:      "?status=active",
			wantStatus: http.StatusOK,
		},
		{
			name:       "with department filter",
			query:      "?department_id=abc",
			wantStatus: http.StatusOK,
		},
		{
			name:       "with explicit limit",
			query:      "?limit=5",
			wantStatus: http.StatusOK,
		},
		{
			name:       "service error",
			serviceErr: apperr.Internal(),
			wantStatus: http.StatusInternalServerError,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			svc := &mockEmpService{
				listFn: func(_ context.Context, _ uuid.UUID, _ employee.ListFilters) (*employee.ListResult, error) {
					if tt.serviceErr != nil {
						return nil, tt.serviceErr
					}
					return &employee.ListResult{
						Employees: []employee.Employee{},
						Meta:      paginate.Meta{Limit: 20},
					}, nil
				},
			}
			w := httptest.NewRecorder()
			req, _ := http.NewRequest(http.MethodGet, "/api/v1/employees"+tt.query, nil)
			newEmpRouter(svc).ServeHTTP(w, req)
			assertStatus(t, w, tt.wantStatus)
		})
	}
}

// ── Create tests ──────────────────────────────────────────────────────────────

func TestEmployeeHandler_Create(t *testing.T) {
	validBody := map[string]string{
		"full_name":       "Ahmad Rashid",
		"email":           "ahmad@example.com",
		"employment_type": "full_time",
		"start_date":      "2026-01-01",
	}

	tests := []struct {
		name       string
		body       any
		serviceErr error
		wantStatus int
	}{
		{
			name:       "success",
			body:       validBody,
			wantStatus: http.StatusCreated,
		},
		{
			name:       "bad json",
			body:       "not-json",
			wantStatus: http.StatusBadRequest,
		},
		{
			name:       "missing required fields",
			body:       map[string]string{"email": "x@x.com"},
			wantStatus: http.StatusBadRequest,
		},
		{
			name:       "employee limit reached",
			body:       validBody,
			serviceErr: apperr.New(apperr.CodeEmployeeLimitReached, "limit reached"),
			wantStatus: http.StatusPaymentRequired,
		},
		{
			name:       "conflict — duplicate email",
			body:       validBody,
			serviceErr: apperr.Conflict("email exists"),
			wantStatus: http.StatusConflict,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			svc := &mockEmpService{
				createFn: func(_ context.Context, _ uuid.UUID, _ employee.CreateEmployeeRequest) (*employee.Employee, error) {
					if tt.serviceErr != nil {
						return nil, tt.serviceErr
					}
					return &employee.Employee{ID: testEmpID, FullName: "Ahmad Rashid"}, nil
				},
			}
			w := httptest.NewRecorder()
			var buf *bytes.Buffer
			if s, ok := tt.body.(string); ok {
				buf = bytes.NewBufferString(s)
			} else {
				buf = jsonBody(t, tt.body)
			}
			req, _ := http.NewRequest(http.MethodPost, "/api/v1/employees", buf)
			req.Header.Set("Content-Type", "application/json")
			newEmpRouter(svc).ServeHTTP(w, req)
			assertStatus(t, w, tt.wantStatus)
		})
	}
}

// ── Get tests ─────────────────────────────────────────────────────────────────

func TestEmployeeHandler_Get(t *testing.T) {
	tests := []struct {
		name       string
		id         string
		serviceErr error
		wantStatus int
	}{
		{
			name:       "success",
			id:         testEmpID.String(),
			wantStatus: http.StatusOK,
		},
		{
			name:       "not found",
			id:         testEmpID.String(),
			serviceErr: apperr.NotFound("employee"),
			wantStatus: http.StatusNotFound,
		},
		{
			name:       "invalid uuid",
			id:         "not-a-uuid",
			wantStatus: http.StatusBadRequest,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			svc := &mockEmpService{
				getFn: func(_ context.Context, _, _ uuid.UUID) (*employee.Employee, error) {
					if tt.serviceErr != nil {
						return nil, tt.serviceErr
					}
					return &employee.Employee{ID: testEmpID}, nil
				},
			}
			w := httptest.NewRecorder()
			req, _ := http.NewRequest(http.MethodGet, "/api/v1/employees/"+tt.id, nil)
			newEmpRouter(svc).ServeHTTP(w, req)
			assertStatus(t, w, tt.wantStatus)
		})
	}
}

// ── Update tests ──────────────────────────────────────────────────────────────

func TestEmployeeHandler_Update(t *testing.T) {
	name := "Updated Name"
	tests := []struct {
		name       string
		id         string
		body       any
		serviceErr error
		wantStatus int
	}{
		{
			name:       "success",
			id:         testEmpID.String(),
			body:       map[string]string{"full_name": name},
			wantStatus: http.StatusOK,
		},
		{
			name:       "invalid uuid",
			id:         "bad-id",
			body:       map[string]string{},
			wantStatus: http.StatusBadRequest,
		},
		{
			name:       "bad json",
			id:         testEmpID.String(),
			body:       "not-json",
			wantStatus: http.StatusBadRequest,
		},
		{
			name:       "not found",
			id:         testEmpID.String(),
			body:       map[string]string{"full_name": name},
			serviceErr: apperr.NotFound("employee"),
			wantStatus: http.StatusNotFound,
		},
		{
			name:       "validation error — invalid status value",
			id:         testEmpID.String(),
			body:       map[string]string{"status": "not-a-valid-status"},
			wantStatus: http.StatusBadRequest,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			svc := &mockEmpService{
				updateFn: func(_ context.Context, _, _ uuid.UUID, _ employee.UpdateEmployeeRequest) (*employee.Employee, error) {
					if tt.serviceErr != nil {
						return nil, tt.serviceErr
					}
					return &employee.Employee{ID: testEmpID, FullName: name}, nil
				},
			}
			w := httptest.NewRecorder()
			var buf *bytes.Buffer
			if s, ok := tt.body.(string); ok {
				buf = bytes.NewBufferString(s)
			} else {
				buf = jsonBody(t, tt.body)
			}
			req, _ := http.NewRequest(http.MethodPut, "/api/v1/employees/"+tt.id, buf)
			req.Header.Set("Content-Type", "application/json")
			newEmpRouter(svc).ServeHTTP(w, req)
			assertStatus(t, w, tt.wantStatus)
		})
	}
}

// ── Deactivate tests ──────────────────────────────────────────────────────────

func TestEmployeeHandler_Deactivate(t *testing.T) {
	tests := []struct {
		name       string
		id         string
		serviceErr error
		wantStatus int
	}{
		{
			name:       "success",
			id:         testEmpID.String(),
			wantStatus: http.StatusOK,
		},
		{
			name:       "invalid uuid",
			id:         "bad-uuid",
			wantStatus: http.StatusBadRequest,
		},
		{
			name:       "not found",
			id:         testEmpID.String(),
			serviceErr: apperr.NotFound("employee"),
			wantStatus: http.StatusNotFound,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			svc := &mockEmpService{
				deactivateFn: func(_ context.Context, _, _ uuid.UUID) error {
					return tt.serviceErr
				},
			}
			w := httptest.NewRecorder()
			req, _ := http.NewRequest(http.MethodDelete, "/api/v1/employees/"+tt.id, nil)
			newEmpRouter(svc).ServeHTTP(w, req)
			assertStatus(t, w, tt.wantStatus)
		})
	}
}
