package calendar_test

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
	"github.com/workived/services/internal/calendar"
	"github.com/workived/services/internal/platform/middleware"
)

// ── Fake Service ─────────────────────────────────────────────────────────────

type fakeHandlerService struct{}

func (f *fakeHandlerService) ListHolidays(_ context.Context, _ uuid.UUID, _, _ string) ([]calendar.PublicHoliday, error) {
	return []calendar.PublicHoliday{
		{CountryCode: "ID", Date: "2026-01-01", Name: "New Year"},
	}, nil
}

func (f *fakeHandlerService) ListCustomHolidays(_ context.Context, _ uuid.UUID) ([]calendar.PublicHoliday, error) {
	id := uuid.New()
	return []calendar.PublicHoliday{
		{ID: &id, CountryCode: "ID", Date: "2026-06-01", Name: "Company Day", IsCustom: true},
	}, nil
}

func (f *fakeHandlerService) CreateCustomHoliday(_ context.Context, _ uuid.UUID, req calendar.CreateCustomHolidayRequest) (*calendar.PublicHoliday, error) {
	id := uuid.New()
	return &calendar.PublicHoliday{ID: &id, CountryCode: "ID", Date: req.Date, Name: req.Name, IsCustom: true}, nil
}

func (f *fakeHandlerService) DeleteCustomHoliday(_ context.Context, _, _ uuid.UUID) error {
	return nil
}

// ── Router helper ─────────────────────────────────────────────────────────────

func newHandlerRouter() *gin.Engine {
	gin.SetMode(gin.TestMode)
	r := gin.New()

	// Inject fake auth context
	r.Use(func(c *gin.Context) {
		c.Set("org_id", testOrgID)
		c.Set("user_id", uuid.New())
		c.Set("role", middleware.RoleAdmin)
		c.Next()
	})

	handler := calendar.NewHandler(&fakeHandlerService{}, zerolog.Nop())
	handler.RegisterRoutes(r.Group("/api/v1"))
	return r
}

// ── Tests ────────────────────────────────────────────────────────────────────

func TestHandler_ListHolidays(t *testing.T) {
	r := newHandlerRouter()
	w := httptest.NewRecorder()
	req, _ := http.NewRequest("GET", "/api/v1/calendar/holidays?start_date=2026-01-01&end_date=2026-12-31", nil)
	r.ServeHTTP(w, req)

	if w.Code != http.StatusOK {
		t.Fatalf("status = %d, want %d, body: %s", w.Code, http.StatusOK, w.Body.String())
	}
}

func TestHandler_ListHolidays_MissingParams(t *testing.T) {
	r := newHandlerRouter()
	w := httptest.NewRecorder()
	req, _ := http.NewRequest("GET", "/api/v1/calendar/holidays", nil)
	r.ServeHTTP(w, req)

	if w.Code != http.StatusBadRequest {
		t.Fatalf("status = %d, want %d", w.Code, http.StatusBadRequest)
	}
}

func TestHandler_ListCustomHolidays(t *testing.T) {
	r := newHandlerRouter()
	w := httptest.NewRecorder()
	req, _ := http.NewRequest("GET", "/api/v1/calendar/holidays/custom", nil)
	r.ServeHTTP(w, req)

	if w.Code != http.StatusOK {
		t.Fatalf("status = %d, want %d, body: %s", w.Code, http.StatusOK, w.Body.String())
	}
}

func TestHandler_CreateCustomHoliday(t *testing.T) {
	r := newHandlerRouter()
	body, _ := json.Marshal(map[string]string{
		"date": "2026-12-25",
		"name": "Company Anniversary",
	})
	w := httptest.NewRecorder()
	req, _ := http.NewRequest("POST", "/api/v1/calendar/holidays/custom", bytes.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	r.ServeHTTP(w, req)

	if w.Code != http.StatusCreated {
		t.Fatalf("status = %d, want %d, body: %s", w.Code, http.StatusCreated, w.Body.String())
	}
}

func TestHandler_DeleteCustomHoliday(t *testing.T) {
	r := newHandlerRouter()
	w := httptest.NewRecorder()
	req, _ := http.NewRequest("DELETE", "/api/v1/calendar/holidays/custom/"+uuid.New().String(), nil)
	r.ServeHTTP(w, req)

	if w.Code != http.StatusOK {
		t.Fatalf("status = %d, want %d, body: %s", w.Code, http.StatusOK, w.Body.String())
	}
}

func TestHandler_DeleteCustomHoliday_InvalidID(t *testing.T) {
	r := newHandlerRouter()
	w := httptest.NewRecorder()
	req, _ := http.NewRequest("DELETE", "/api/v1/calendar/holidays/custom/not-a-uuid", nil)
	r.ServeHTTP(w, req)

	if w.Code != http.StatusBadRequest {
		t.Fatalf("status = %d, want %d", w.Code, http.StatusBadRequest)
	}
}
