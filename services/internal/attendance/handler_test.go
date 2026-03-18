package attendance_test

import (
	"bytes"
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/workived/services/internal/attendance"
	"github.com/workived/services/internal/platform/middleware"
	"github.com/workived/services/pkg/apperr"
)

func init() {
	gin.SetMode(gin.TestMode)
}

// ── Mock service ─────────────────────────────────────────────────────────────

type mockAttService struct {
	clockInFn           func(ctx context.Context, orgID uuid.UUID, req attendance.ClockInRequest) (*attendance.Record, error)
	clockOutFn          func(ctx context.Context, orgID uuid.UUID, req attendance.ClockOutRequest) (*attendance.Record, error)
	getTodayFn          func(ctx context.Context, orgID, empID uuid.UUID) (*attendance.Record, error)
	dailyReportFn       func(ctx context.Context, orgID uuid.UUID, f attendance.DailyReportFilters) ([]attendance.DailyEntry, error)
	monthlySummaryFn    func(ctx context.Context, orgID uuid.UUID, f attendance.MonthlyReportFilters) ([]attendance.MonthlySummary, error)
	empMonthlySummaryFn func(ctx context.Context, orgID, empID uuid.UUID, f attendance.MonthlyReportFilters) (*attendance.MonthlySummary, error)
}

func (m *mockAttService) ClockIn(ctx context.Context, orgID uuid.UUID, req attendance.ClockInRequest) (*attendance.Record, error) {
	return m.clockInFn(ctx, orgID, req)
}
func (m *mockAttService) ClockOut(ctx context.Context, orgID uuid.UUID, req attendance.ClockOutRequest) (*attendance.Record, error) {
	return m.clockOutFn(ctx, orgID, req)
}
func (m *mockAttService) GetToday(ctx context.Context, orgID, empID uuid.UUID) (*attendance.Record, error) {
	return m.getTodayFn(ctx, orgID, empID)
}
func (m *mockAttService) DailyReport(ctx context.Context, orgID uuid.UUID, f attendance.DailyReportFilters) ([]attendance.DailyEntry, error) {
	return m.dailyReportFn(ctx, orgID, f)
}
func (m *mockAttService) MonthlySummaryReport(ctx context.Context, orgID uuid.UUID, f attendance.MonthlyReportFilters) ([]attendance.MonthlySummary, error) {
	return m.monthlySummaryFn(ctx, orgID, f)
}
func (m *mockAttService) EmployeeMonthlySummary(ctx context.Context, orgID, empID uuid.UUID, f attendance.MonthlyReportFilters) (*attendance.MonthlySummary, error) {
	return m.empMonthlySummaryFn(ctx, orgID, empID, f)
}

// ── Helpers ──────────────────────────────────────────────────────────────────

var (
	hTestOrgID  = uuid.MustParse("00000000-0000-0000-0000-000000000001")
	hTestEmpID  = uuid.MustParse("00000000-0000-0000-0000-000000000002")
	hTestUserID = uuid.MustParse("00000000-0000-0000-0000-000000000003")
)

// defaultEmpLookup always resolves to hTestEmpID.
var defaultEmpLookup = attendance.EmployeeLookupFunc(func(_ context.Context, _, _ uuid.UUID) (uuid.UUID, error) {
	return hTestEmpID, nil
})

func newAttRouter(svc attendance.ServiceInterface) *gin.Engine {
	return newAttRouterWithLookup(svc, defaultEmpLookup)
}

func newAttRouterWithLookup(svc attendance.ServiceInterface, lookup attendance.EmployeeLookupFunc) *gin.Engine {
	r := gin.New()
	r.Use(func(c *gin.Context) {
		c.Set("org_id", hTestOrgID)
		c.Set("user_id", hTestUserID)
		c.Set("role", middleware.RoleMember)
		c.Next()
	})
	h := attendance.NewHandler(svc, lookup)
	h.RegisterRoutes(r.Group("/api/v1"))
	return r
}

func hJsonBody(t *testing.T, v any) *bytes.Buffer {
	t.Helper()
	b, _ := json.Marshal(v)
	return bytes.NewBuffer(b)
}

func hAssertStatus(t *testing.T, w *httptest.ResponseRecorder, want int) {
	t.Helper()
	if w.Code != want {
		t.Errorf("status = %d, want %d; body: %s", w.Code, want, w.Body.String())
	}
}

func defaultRecord() *attendance.Record {
	return &attendance.Record{
		ID:             uuid.New(),
		OrganisationID: hTestOrgID,
		EmployeeID:     hTestEmpID,
		Date:           "2026-03-16",
		ClockInAt:      time.Now().UTC(),
	}
}

// ── ClockIn handler tests ────────────────────────────────────────────────────

func TestHandler_ClockIn(t *testing.T) {
	tests := []struct {
		name       string
		body       any
		empLookup  attendance.EmployeeLookupFunc
		serviceErr error
		wantStatus int
	}{
		{
			name:       "success — empty body",
			body:       nil,
			wantStatus: http.StatusCreated,
		},
		{
			name:       "success — with note",
			body:       map[string]string{"note": "WFH"},
			wantStatus: http.StatusCreated,
		},
		{
			name:       "employee not linked to user",
			body:       nil,
			empLookup:  func(_ context.Context, _, _ uuid.UUID) (uuid.UUID, error) { return uuid.Nil, apperr.NotFound("employee") },
			wantStatus: http.StatusNotFound,
		},
		{
			name:       "conflict — already clocked in",
			body:       nil,
			serviceErr: apperr.Conflict("already clocked in today"),
			wantStatus: http.StatusConflict,
		},
		{
			name:       "internal error",
			body:       nil,
			serviceErr: apperr.Internal(),
			wantStatus: http.StatusInternalServerError,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			svc := &mockAttService{
				clockInFn: func(_ context.Context, _ uuid.UUID, _ attendance.ClockInRequest) (*attendance.Record, error) {
					if tt.serviceErr != nil {
						return nil, tt.serviceErr
					}
					return defaultRecord(), nil
				},
			}
			lookup := defaultEmpLookup
			if tt.empLookup != nil {
				lookup = tt.empLookup
			}
			w := httptest.NewRecorder()
			var buf *bytes.Buffer
			if tt.body != nil {
				buf = hJsonBody(t, tt.body)
			} else {
				buf = bytes.NewBuffer(nil)
			}
			req, _ := http.NewRequest(http.MethodPost, "/api/v1/attendance/clock-in", buf)
			req.Header.Set("Content-Type", "application/json")
			newAttRouterWithLookup(svc, lookup).ServeHTTP(w, req)
			hAssertStatus(t, w, tt.wantStatus)
		})
	}
}

// ── ClockOut handler tests ───────────────────────────────────────────────────

func TestHandler_ClockOut(t *testing.T) {
	tests := []struct {
		name       string
		body       any
		empLookup  attendance.EmployeeLookupFunc
		serviceErr error
		wantStatus int
	}{
		{
			name:       "success",
			body:       nil,
			wantStatus: http.StatusOK,
		},
		{
			name:       "employee not linked to user",
			body:       nil,
			empLookup:  func(_ context.Context, _, _ uuid.UUID) (uuid.UUID, error) { return uuid.Nil, apperr.NotFound("employee") },
			wantStatus: http.StatusNotFound,
		},
		{
			name:       "conflict — already clocked out",
			body:       nil,
			serviceErr: apperr.Conflict("already clocked out today"),
			wantStatus: http.StatusConflict,
		},
		{
			name:       "not found",
			body:       nil,
			serviceErr: apperr.NotFound("attendance record"),
			wantStatus: http.StatusNotFound,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			svc := &mockAttService{
				clockOutFn: func(_ context.Context, _ uuid.UUID, _ attendance.ClockOutRequest) (*attendance.Record, error) {
					if tt.serviceErr != nil {
						return nil, tt.serviceErr
					}
					rec := defaultRecord()
					now := time.Now().UTC()
					rec.ClockOutAt = &now
					return rec, nil
				},
			}
			lookup := defaultEmpLookup
			if tt.empLookup != nil {
				lookup = tt.empLookup
			}
			w := httptest.NewRecorder()
			var buf *bytes.Buffer
			if tt.body != nil {
				buf = hJsonBody(t, tt.body)
			} else {
				buf = bytes.NewBuffer(nil)
			}
			req, _ := http.NewRequest(http.MethodPost, "/api/v1/attendance/clock-out", buf)
			req.Header.Set("Content-Type", "application/json")
			newAttRouterWithLookup(svc, lookup).ServeHTTP(w, req)
			hAssertStatus(t, w, tt.wantStatus)
		})
	}
}

// ── GetToday handler tests ───────────────────────────────────────────────────

func TestHandler_GetToday(t *testing.T) {
	tests := []struct {
		name       string
		empID      string
		serviceErr error
		wantStatus int
	}{
		{
			name:       "success",
			empID:      hTestEmpID.String(),
			wantStatus: http.StatusOK,
		},
		{
			name:       "invalid uuid",
			empID:      "not-a-uuid",
			wantStatus: http.StatusBadRequest,
		},
		{
			name:       "not found",
			empID:      hTestEmpID.String(),
			serviceErr: apperr.NotFound("attendance record"),
			wantStatus: http.StatusNotFound,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			svc := &mockAttService{
				getTodayFn: func(_ context.Context, _, _ uuid.UUID) (*attendance.Record, error) {
					if tt.serviceErr != nil {
						return nil, tt.serviceErr
					}
					return defaultRecord(), nil
				},
			}
			w := httptest.NewRecorder()
			req, _ := http.NewRequest(http.MethodGet, "/api/v1/attendance/today/"+tt.empID, nil)
			newAttRouter(svc).ServeHTTP(w, req)
			hAssertStatus(t, w, tt.wantStatus)
		})
	}
}

// ── DailyReport handler tests ────────────────────────────────────────────────

func TestHandler_DailyReport(t *testing.T) {
	tests := []struct {
		name       string
		query      string
		serviceErr error
		wantStatus int
	}{
		{
			name:       "success",
			query:      "?date=2026-03-16",
			wantStatus: http.StatusOK,
		},
		{
			name:       "missing date",
			query:      "",
			wantStatus: http.StatusBadRequest,
		},
		{
			name:       "service error",
			query:      "?date=2026-03-16",
			serviceErr: apperr.Internal(),
			wantStatus: http.StatusInternalServerError,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			svc := &mockAttService{
				dailyReportFn: func(_ context.Context, _ uuid.UUID, _ attendance.DailyReportFilters) ([]attendance.DailyEntry, error) {
					if tt.serviceErr != nil {
						return nil, tt.serviceErr
					}
					return []attendance.DailyEntry{}, nil
				},
			}
			w := httptest.NewRecorder()
			req, _ := http.NewRequest(http.MethodGet, "/api/v1/attendance/daily"+tt.query, nil)
			newAttRouter(svc).ServeHTTP(w, req)
			hAssertStatus(t, w, tt.wantStatus)
		})
	}
}

// ── MonthlySummaryReport handler tests ───────────────────────────────────────

func TestHandler_MonthlySummaryReport(t *testing.T) {
	tests := []struct {
		name       string
		query      string
		serviceErr error
		wantStatus int
	}{
		{
			name:       "success",
			query:      "?year=2026&month=3",
			wantStatus: http.StatusOK,
		},
		{
			name:       "missing year",
			query:      "?month=3",
			wantStatus: http.StatusBadRequest,
		},
		{
			name:       "invalid year",
			query:      "?year=abc&month=3",
			wantStatus: http.StatusBadRequest,
		},
		{
			name:       "year too low",
			query:      "?year=1999&month=3",
			wantStatus: http.StatusBadRequest,
		},
		{
			name:       "missing month",
			query:      "?year=2026",
			wantStatus: http.StatusBadRequest,
		},
		{
			name:       "invalid month",
			query:      "?year=2026&month=abc",
			wantStatus: http.StatusBadRequest,
		},
		{
			name:       "month out of range — 0",
			query:      "?year=2026&month=0",
			wantStatus: http.StatusBadRequest,
		},
		{
			name:       "month out of range — 13",
			query:      "?year=2026&month=13",
			wantStatus: http.StatusBadRequest,
		},
		{
			name:       "service error",
			query:      "?year=2026&month=3",
			serviceErr: apperr.Internal(),
			wantStatus: http.StatusInternalServerError,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			svc := &mockAttService{
				monthlySummaryFn: func(_ context.Context, _ uuid.UUID, _ attendance.MonthlyReportFilters) ([]attendance.MonthlySummary, error) {
					if tt.serviceErr != nil {
						return nil, tt.serviceErr
					}
					return []attendance.MonthlySummary{}, nil
				},
			}
			w := httptest.NewRecorder()
			req, _ := http.NewRequest(http.MethodGet, "/api/v1/attendance/monthly"+tt.query, nil)
			newAttRouter(svc).ServeHTTP(w, req)
			hAssertStatus(t, w, tt.wantStatus)
		})
	}
}

// ── EmployeeMonthlySummary handler tests ─────────────────────────────────────

func TestHandler_EmployeeMonthlySummary(t *testing.T) {
	tests := []struct {
		name       string
		empID      string
		query      string
		serviceErr error
		wantStatus int
	}{
		{
			name:       "success",
			empID:      hTestEmpID.String(),
			query:      "?year=2026&month=3",
			wantStatus: http.StatusOK,
		},
		{
			name:       "invalid uuid",
			empID:      "bad-uuid",
			query:      "?year=2026&month=3",
			wantStatus: http.StatusBadRequest,
		},
		{
			name:       "missing year",
			empID:      hTestEmpID.String(),
			query:      "?month=3",
			wantStatus: http.StatusBadRequest,
		},
		{
			name:       "invalid year",
			empID:      hTestEmpID.String(),
			query:      "?year=abc&month=3",
			wantStatus: http.StatusBadRequest,
		},
		{
			name:       "year too low",
			empID:      hTestEmpID.String(),
			query:      "?year=1999&month=3",
			wantStatus: http.StatusBadRequest,
		},
		{
			name:       "missing month",
			empID:      hTestEmpID.String(),
			query:      "?year=2026",
			wantStatus: http.StatusBadRequest,
		},
		{
			name:       "invalid month",
			empID:      hTestEmpID.String(),
			query:      "?year=2026&month=abc",
			wantStatus: http.StatusBadRequest,
		},
		{
			name:       "month 0",
			empID:      hTestEmpID.String(),
			query:      "?year=2026&month=0",
			wantStatus: http.StatusBadRequest,
		},
		{
			name:       "month 13",
			empID:      hTestEmpID.String(),
			query:      "?year=2026&month=13",
			wantStatus: http.StatusBadRequest,
		},
		{
			name:       "not found",
			empID:      hTestEmpID.String(),
			query:      "?year=2026&month=3",
			serviceErr: apperr.NotFound("employee"),
			wantStatus: http.StatusNotFound,
		},
		{
			name:       "service error",
			empID:      hTestEmpID.String(),
			query:      "?year=2026&month=3",
			serviceErr: apperr.Internal(),
			wantStatus: http.StatusInternalServerError,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			svc := &mockAttService{
				empMonthlySummaryFn: func(_ context.Context, _, _ uuid.UUID, _ attendance.MonthlyReportFilters) (*attendance.MonthlySummary, error) {
					if tt.serviceErr != nil {
						return nil, tt.serviceErr
					}
					return &attendance.MonthlySummary{
						EmployeeID:   hTestEmpID,
						EmployeeName: "Ahmad",
						Present:      20,
						Late:         1,
						Absent:       1,
						WorkingDays:  22,
					}, nil
				},
			}
			w := httptest.NewRecorder()
			req, _ := http.NewRequest(http.MethodGet, "/api/v1/attendance/monthly/"+tt.empID+tt.query, nil)
			newAttRouter(svc).ServeHTTP(w, req)
			hAssertStatus(t, w, tt.wantStatus)
		})
	}
}

// ── ClockIn with note ────────────────────────────────────────────────────────

func TestHandler_ClockIn_WithNote(t *testing.T) {
	svc := &mockAttService{
		clockInFn: func(_ context.Context, _ uuid.UUID, req attendance.ClockInRequest) (*attendance.Record, error) {
			if req.Note == nil {
				t.Error("expected note to be set")
			}
			return defaultRecord(), nil
		},
	}
	body := map[string]string{"note": "Working from home"}
	w := httptest.NewRecorder()
	req, _ := http.NewRequest(http.MethodPost, "/api/v1/attendance/clock-in", hJsonBody(t, body))
	req.Header.Set("Content-Type", "application/json")
	newAttRouter(svc).ServeHTTP(w, req)
	hAssertStatus(t, w, http.StatusCreated)
}

// ── ClockOut with note ───────────────────────────────────────────────────────

func TestHandler_ClockOut_WithNote(t *testing.T) {
	svc := &mockAttService{
		clockOutFn: func(_ context.Context, _ uuid.UUID, req attendance.ClockOutRequest) (*attendance.Record, error) {
			if req.Note == nil {
				t.Error("expected note to be set")
			}
			rec := defaultRecord()
			now := time.Now().UTC()
			rec.ClockOutAt = &now
			return rec, nil
		},
	}
	body := map[string]string{"note": "Leaving early"}
	w := httptest.NewRecorder()
	req, _ := http.NewRequest(http.MethodPost, "/api/v1/attendance/clock-out", hJsonBody(t, body))
	req.Header.Set("Content-Type", "application/json")
	newAttRouter(svc).ServeHTTP(w, req)
	hAssertStatus(t, w, http.StatusOK)
}
