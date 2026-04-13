package reports_test

import (
	"bytes"
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/rs/zerolog"
	"github.com/workived/services/internal/platform/middleware"
	"github.com/workived/services/internal/reports"
	"github.com/workived/services/pkg/apperr"
)

func init() {
	gin.SetMode(gin.TestMode)
}

// ── Mock service ───────────────────────────────────────────────────────────

type mockService struct {
	getConfigFn      func(ctx context.Context, orgID uuid.UUID) (*reports.ScorecardConfig, error)
	updateConfigFn   func(ctx context.Context, orgID uuid.UUID, input reports.ConfigUpdateInput) (*reports.ScorecardConfig, error)
	getEmpScorecardFn func(ctx context.Context, orgID, empID uuid.UUID, period string) (*reports.Scorecard, error)
	getTeamScorecardFn func(ctx context.Context, orgID uuid.UUID, period string) (*reports.TeamScorecard, error)
	getCompanySummaryFn func(ctx context.Context, orgID uuid.UUID, period string) (*reports.CompanySummary, error)
}

func (m *mockService) GetConfig(ctx context.Context, orgID uuid.UUID) (*reports.ScorecardConfig, error) {
	if m.getConfigFn != nil {
		return m.getConfigFn(ctx, orgID)
	}
	d := reports.DefaultConfig(orgID)
	return &d, nil
}

func (m *mockService) UpdateConfig(ctx context.Context, orgID uuid.UUID, input reports.ConfigUpdateInput) (*reports.ScorecardConfig, error) {
	if m.updateConfigFn != nil {
		return m.updateConfigFn(ctx, orgID, input)
	}
	return nil, nil
}

func (m *mockService) GetEmployeeScorecard(ctx context.Context, orgID, empID uuid.UUID, period string) (*reports.Scorecard, error) {
	if m.getEmpScorecardFn != nil {
		return m.getEmpScorecardFn(ctx, orgID, empID, period)
	}
	return nil, nil
}

func (m *mockService) GetTeamScorecard(ctx context.Context, orgID uuid.UUID, period string) (*reports.TeamScorecard, error) {
	if m.getTeamScorecardFn != nil {
		return m.getTeamScorecardFn(ctx, orgID, period)
	}
	return nil, nil
}

func (m *mockService) GetCompanySummary(ctx context.Context, orgID uuid.UUID, period string) (*reports.CompanySummary, error) {
	if m.getCompanySummaryFn != nil {
		return m.getCompanySummaryFn(ctx, orgID, period)
	}
	return nil, nil
}

// ── Helpers ────────────────────────────────────────────────────────────────

var (
	hTestOrgID  = uuid.MustParse("00000000-0000-0000-0000-000000000001")
	hTestUserID = uuid.MustParse("00000000-0000-0000-0000-000000000003")
	hTestEmpID  = uuid.MustParse("00000000-0000-0000-0000-000000000002")
)

var defaultEmpLookup = reports.EmployeeLookupFunc(func(_ context.Context, _, _ uuid.UUID) (uuid.UUID, error) {
	return hTestEmpID, nil
})

func newRouter(svc reports.ServiceInterface) *gin.Engine {
	r := gin.New()
	r.Use(func(c *gin.Context) {
		c.Set("org_id", hTestOrgID)
		c.Set("user_id", hTestUserID)
		c.Set("role", middleware.RoleAdmin)
		c.Next()
	})
	h := reports.NewHandler(svc, defaultEmpLookup, zerolog.Nop())
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

// ── GetConfig tests ────────────────────────────────────────────────────────

func TestHandler_GetConfig(t *testing.T) {
	svc := &mockService{}
	r := newRouter(svc)

	w := httptest.NewRecorder()
	req, _ := http.NewRequest("GET", "/api/v1/reports/config", nil)
	r.ServeHTTP(w, req)

	assertStatus(t, w, http.StatusOK)
}

func TestHandler_GetConfig_Error(t *testing.T) {
	svc := &mockService{
		getConfigFn: func(_ context.Context, _ uuid.UUID) (*reports.ScorecardConfig, error) {
			return nil, apperr.Internal()
		},
	}
	r := newRouter(svc)

	w := httptest.NewRecorder()
	req, _ := http.NewRequest("GET", "/api/v1/reports/config", nil)
	r.ServeHTTP(w, req)

	assertStatus(t, w, http.StatusInternalServerError)
}

// ── UpdateConfig tests ─────────────────────────────────────────────────────

func TestHandler_UpdateConfig_Success(t *testing.T) {
	svc := &mockService{
		updateConfigFn: func(_ context.Context, orgID uuid.UUID, _ reports.ConfigUpdateInput) (*reports.ScorecardConfig, error) {
			d := reports.DefaultConfig(orgID)
			return &d, nil
		},
	}
	r := newRouter(svc)

	body := reports.ConfigUpdateInput{
		AttendanceWeight:   30,
		PunctualityWeight:  20,
		LeaveWeight:        15,
		TasksWeight:        35,
		GradeAMin:          90,
		GradeBMin:          75,
		GradeCMin:          60,
		LateFlagThreshold:  3,
		LeaveWarningPct:    90,
		TaskConcernPct:     60,
		ScoreDropThreshold: 10,
		MinWorkingDays:     5,
	}

	w := httptest.NewRecorder()
	req, _ := http.NewRequest("PUT", "/api/v1/reports/config", jsonBody(t, body))
	req.Header.Set("Content-Type", "application/json")
	r.ServeHTTP(w, req)

	assertStatus(t, w, http.StatusOK)
}

func TestHandler_UpdateConfig_BadJSON(t *testing.T) {
	svc := &mockService{}
	r := newRouter(svc)

	w := httptest.NewRecorder()
	req, _ := http.NewRequest("PUT", "/api/v1/reports/config", bytes.NewBufferString("{bad"))
	req.Header.Set("Content-Type", "application/json")
	r.ServeHTTP(w, req)

	assertStatus(t, w, http.StatusBadRequest)
}

func TestHandler_UpdateConfig_ValidationError(t *testing.T) {
	svc := &mockService{
		updateConfigFn: func(_ context.Context, _ uuid.UUID, _ reports.ConfigUpdateInput) (*reports.ScorecardConfig, error) {
			return nil, apperr.New(apperr.CodeValidation, "weights must sum to 100")
		},
	}
	r := newRouter(svc)

	// Valid JSON but service returns validation error
	body := reports.ConfigUpdateInput{
		AttendanceWeight:   30,
		PunctualityWeight:  20,
		LeaveWeight:        15,
		TasksWeight:        35,
		GradeAMin:          90,
		GradeBMin:          75,
		GradeCMin:          60,
		LateFlagThreshold:  3,
		LeaveWarningPct:    90,
		TaskConcernPct:     60,
		ScoreDropThreshold: 10,
		MinWorkingDays:     5,
	}

	w := httptest.NewRecorder()
	req, _ := http.NewRequest("PUT", "/api/v1/reports/config", jsonBody(t, body))
	req.Header.Set("Content-Type", "application/json")
	r.ServeHTTP(w, req)

	assertStatus(t, w, http.StatusBadRequest)
}

// ── GetEmployeeScorecardByID tests ────────────────────────────────────────

func TestHandler_GetEmployeeScorecardByID(t *testing.T) {
	svc := &mockService{
		getEmpScorecardFn: func(_ context.Context, _, _ uuid.UUID, _ string) (*reports.Scorecard, error) {
			return &reports.Scorecard{
				EmployeeID:   hTestEmpID,
				EmployeeName: "Alice",
				OverallScore: 85,
				Grade:        "B",
				Breakdown:    map[string]reports.Breakdown{},
			}, nil
		},
	}
	r := newRouter(svc)

	w := httptest.NewRecorder()
	req, _ := http.NewRequest("GET", "/api/v1/reports/scorecard/"+hTestEmpID.String()+"?period=this_month", nil)
	r.ServeHTTP(w, req)

	assertStatus(t, w, http.StatusOK)
}

func TestHandler_GetEmployeeScorecardByID_InvalidUUID(t *testing.T) {
	svc := &mockService{}
	r := newRouter(svc)

	w := httptest.NewRecorder()
	req, _ := http.NewRequest("GET", "/api/v1/reports/scorecard/not-a-uuid", nil)
	r.ServeHTTP(w, req)

	assertStatus(t, w, http.StatusBadRequest)
}

func TestHandler_GetEmployeeScorecardByID_NotFound(t *testing.T) {
	svc := &mockService{
		getEmpScorecardFn: func(_ context.Context, _, _ uuid.UUID, _ string) (*reports.Scorecard, error) {
			return nil, apperr.NotFound("employee")
		},
	}
	r := newRouter(svc)

	w := httptest.NewRecorder()
	req, _ := http.NewRequest("GET", "/api/v1/reports/scorecard/"+hTestEmpID.String(), nil)
	r.ServeHTTP(w, req)

	assertStatus(t, w, http.StatusNotFound)
}

// ── GetMyScorecard tests ───────────────────────────────────────────────────

func TestHandler_GetMyScorecard(t *testing.T) {
	svc := &mockService{
		getEmpScorecardFn: func(_ context.Context, _, _ uuid.UUID, _ string) (*reports.Scorecard, error) {
			return &reports.Scorecard{
				EmployeeID:   hTestEmpID,
				EmployeeName: "Alice",
				OverallScore: 85,
				Grade:        "B",
				Breakdown:    map[string]reports.Breakdown{},
			}, nil
		},
	}
	r := newRouter(svc)

	w := httptest.NewRecorder()
	req, _ := http.NewRequest("GET", "/api/v1/reports/scorecard/me?period=this_month", nil)
	r.ServeHTTP(w, req)

	assertStatus(t, w, http.StatusOK)
}

func TestHandler_GetMyScorecard_DefaultPeriod(t *testing.T) {
	var capturedPeriod string
	svc := &mockService{
		getEmpScorecardFn: func(_ context.Context, _, _ uuid.UUID, period string) (*reports.Scorecard, error) {
			capturedPeriod = period
			return &reports.Scorecard{Breakdown: map[string]reports.Breakdown{}}, nil
		},
	}
	r := newRouter(svc)

	w := httptest.NewRecorder()
	req, _ := http.NewRequest("GET", "/api/v1/reports/scorecard/me", nil)
	r.ServeHTTP(w, req)

	assertStatus(t, w, http.StatusOK)
	if capturedPeriod != "this_month" {
		t.Errorf("period = %q, want this_month", capturedPeriod)
	}
}

func TestHandler_GetMyScorecard_EmpLookupFails(t *testing.T) {
	svc := &mockService{}
	r := gin.New()
	r.Use(func(c *gin.Context) {
		c.Set("org_id", hTestOrgID)
		c.Set("user_id", hTestUserID)
		c.Set("role", middleware.RoleAdmin)
		c.Next()
	})
	failLookup := reports.EmployeeLookupFunc(func(_ context.Context, _, _ uuid.UUID) (uuid.UUID, error) {
		return uuid.Nil, apperr.NotFound("employee")
	})
	h := reports.NewHandler(svc, failLookup, zerolog.Nop())
	h.RegisterRoutes(r.Group("/api/v1"))

	w := httptest.NewRecorder()
	req, _ := http.NewRequest("GET", "/api/v1/reports/scorecard/me", nil)
	r.ServeHTTP(w, req)

	assertStatus(t, w, http.StatusNotFound)
}

// ── GetTeamScorecard tests ─────────────────────────────────────────────────

func TestHandler_GetTeamScorecard(t *testing.T) {
	svc := &mockService{
		getTeamScorecardFn: func(_ context.Context, _ uuid.UUID, _ string) (*reports.TeamScorecard, error) {
			return &reports.TeamScorecard{
				Period:      "this_month",
				TeamAverage: 82,
				Employees:   []reports.EmployeeScore{},
			}, nil
		},
	}
	r := newRouter(svc)

	w := httptest.NewRecorder()
	req, _ := http.NewRequest("GET", "/api/v1/reports/scorecard/team?period=this_quarter", nil)
	r.ServeHTTP(w, req)

	assertStatus(t, w, http.StatusOK)
}

func TestHandler_GetTeamScorecard_Error(t *testing.T) {
	svc := &mockService{
		getTeamScorecardFn: func(_ context.Context, _ uuid.UUID, _ string) (*reports.TeamScorecard, error) {
			return nil, apperr.New(apperr.CodeValidation, "invalid period")
		},
	}
	r := newRouter(svc)

	w := httptest.NewRecorder()
	req, _ := http.NewRequest("GET", "/api/v1/reports/scorecard/team?period=bad", nil)
	r.ServeHTTP(w, req)

	assertStatus(t, w, http.StatusBadRequest)
}

// ── GetCompanySummary tests ────────────────────────────────────────────────

func TestHandler_GetCompanySummary(t *testing.T) {
	svc := &mockService{
		getCompanySummaryFn: func(_ context.Context, _ uuid.UUID, _ string) (*reports.CompanySummary, error) {
			return &reports.CompanySummary{
				Period:   "this_month",
				AvgScore: 78,
			}, nil
		},
	}
	r := newRouter(svc)

	w := httptest.NewRecorder()
	req, _ := http.NewRequest("GET", "/api/v1/reports/summary?period=this_month", nil)
	r.ServeHTTP(w, req)

	assertStatus(t, w, http.StatusOK)
}

func TestHandler_GetCompanySummary_Error(t *testing.T) {
	svc := &mockService{
		getCompanySummaryFn: func(_ context.Context, _ uuid.UUID, _ string) (*reports.CompanySummary, error) {
			return nil, apperr.Internal()
		},
	}
	r := newRouter(svc)

	w := httptest.NewRecorder()
	req, _ := http.NewRequest("GET", "/api/v1/reports/summary", nil)
	r.ServeHTTP(w, req)

	assertStatus(t, w, http.StatusInternalServerError)
}
