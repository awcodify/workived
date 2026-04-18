package announcements_test

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
	"github.com/rs/zerolog"
	"github.com/workived/services/internal/announcements"
	"github.com/workived/services/internal/platform/middleware"
)

func init() {
	gin.SetMode(gin.TestMode)
}

var (
	hOrgID  = uuid.MustParse("00000000-0000-0000-0000-000000000001")
	hEmpID  = uuid.MustParse("00000000-0000-0000-0000-000000000002")
	hUserID = uuid.MustParse("00000000-0000-0000-0000-000000000003")
)

// ── Mock service ─────────────────────────────────────────────────────────────

type mockSvc struct{}

func (m *mockSvc) List(_ context.Context, _, _ uuid.UUID) ([]announcements.Announcement, error) {
	return []announcements.Announcement{{ID: uuid.New(), Title: "Test"}}, nil
}
func (m *mockSvc) ListAdmin(_ context.Context, _ uuid.UUID) ([]announcements.Announcement, error) {
	return []announcements.Announcement{}, nil
}
func (m *mockSvc) GetByID(_ context.Context, _, id uuid.UUID) (*announcements.Announcement, error) {
	return &announcements.Announcement{ID: id}, nil
}
func (m *mockSvc) Create(_ context.Context, orgID, _ uuid.UUID, req announcements.CreateAnnouncementRequest) (*announcements.Announcement, error) {
	return &announcements.Announcement{ID: uuid.New(), OrganisationID: orgID, Title: req.Title}, nil
}
func (m *mockSvc) Update(_ context.Context, _, id uuid.UUID, req announcements.UpdateAnnouncementRequest) (*announcements.Announcement, error) {
	return &announcements.Announcement{ID: id, Title: req.Title}, nil
}
func (m *mockSvc) Publish(_ context.Context, _, id uuid.UUID) (*announcements.Announcement, error) {
	now := time.Now()
	return &announcements.Announcement{ID: id, PublishedAt: &now}, nil
}
func (m *mockSvc) SetPinned(_ context.Context, _, id uuid.UUID, pinned bool) (*announcements.Announcement, error) {
	return &announcements.Announcement{ID: id, IsPinned: pinned}, nil
}
func (m *mockSvc) Delete(_ context.Context, _, _ uuid.UUID) error  { return nil }
func (m *mockSvc) MarkRead(_ context.Context, _, _, _ uuid.UUID) error { return nil }
func (m *mockSvc) CountUnread(_ context.Context, _, _ uuid.UUID) (int, error) {
	return 2, nil
}

// ── Router helper ─────────────────────────────────────────────────────────────

func newRouter() *gin.Engine {
	r := gin.New()
	r.Use(func(c *gin.Context) {
		c.Set("org_id", hOrgID)
		c.Set("user_id", hUserID)
		c.Set("role", middleware.RoleAdmin)
		c.Next()
	})
	empLookup := announcements.EmployeeLookupFunc(func(_ context.Context, _, _ uuid.UUID) (uuid.UUID, error) {
		return hEmpID, nil
	})
	h := announcements.NewHandler(&mockSvc{}, empLookup, zerolog.Nop())
	h.RegisterRoutes(r.Group("/api/v1"))
	return r
}

func assertStatus(t *testing.T, w *httptest.ResponseRecorder, want int) {
	t.Helper()
	if w.Code != want {
		t.Errorf("status = %d, want %d; body: %s", w.Code, want, w.Body.String())
	}
}

// ── Tests ─────────────────────────────────────────────────────────────────────

func TestHandler_List(t *testing.T) {
	w := httptest.NewRecorder()
	req, _ := http.NewRequest(http.MethodGet, "/api/v1/announcements", nil)
	newRouter().ServeHTTP(w, req)
	assertStatus(t, w, http.StatusOK)
}

func TestHandler_ListAdmin(t *testing.T) {
	w := httptest.NewRecorder()
	req, _ := http.NewRequest(http.MethodGet, "/api/v1/announcements/admin", nil)
	newRouter().ServeHTTP(w, req)
	assertStatus(t, w, http.StatusOK)
}

func TestHandler_UnreadCount(t *testing.T) {
	w := httptest.NewRecorder()
	req, _ := http.NewRequest(http.MethodGet, "/api/v1/announcements/unread-count", nil)
	newRouter().ServeHTTP(w, req)
	assertStatus(t, w, http.StatusOK)

	var resp map[string]map[string]int
	json.Unmarshal(w.Body.Bytes(), &resp) //nolint:errcheck
	if resp["data"]["count"] != 2 {
		t.Errorf("expected count=2, got %d", resp["data"]["count"])
	}
}

func TestHandler_Create(t *testing.T) {
	body, _ := json.Marshal(map[string]interface{}{
		"title":   "Company Outing",
		"body":    "We're having a team outing next Friday.",
		"publish": true,
	})
	w := httptest.NewRecorder()
	req, _ := http.NewRequest(http.MethodPost, "/api/v1/announcements", bytes.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	newRouter().ServeHTTP(w, req)
	assertStatus(t, w, http.StatusCreated)
}

func TestHandler_Update(t *testing.T) {
	id := uuid.New()
	body, _ := json.Marshal(map[string]interface{}{
		"title": "Updated Title",
		"body":  "Updated body content here.",
	})
	w := httptest.NewRecorder()
	req, _ := http.NewRequest(http.MethodPut, "/api/v1/announcements/"+id.String(), bytes.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	newRouter().ServeHTTP(w, req)
	assertStatus(t, w, http.StatusOK)
}

func TestHandler_Delete(t *testing.T) {
	id := uuid.New()
	w := httptest.NewRecorder()
	req, _ := http.NewRequest(http.MethodDelete, "/api/v1/announcements/"+id.String(), nil)
	newRouter().ServeHTTP(w, req)
	assertStatus(t, w, http.StatusNoContent)
}

func TestHandler_Publish(t *testing.T) {
	id := uuid.New()
	w := httptest.NewRecorder()
	req, _ := http.NewRequest(http.MethodPatch, "/api/v1/announcements/"+id.String()+"/publish", nil)
	newRouter().ServeHTTP(w, req)
	assertStatus(t, w, http.StatusOK)
}

func TestHandler_Pin(t *testing.T) {
	id := uuid.New()
	w := httptest.NewRecorder()
	req, _ := http.NewRequest(http.MethodPatch, "/api/v1/announcements/"+id.String()+"/pin", nil)
	newRouter().ServeHTTP(w, req)
	assertStatus(t, w, http.StatusOK)
}

func TestHandler_Unpin(t *testing.T) {
	id := uuid.New()
	w := httptest.NewRecorder()
	req, _ := http.NewRequest(http.MethodPatch, "/api/v1/announcements/"+id.String()+"/unpin", nil)
	newRouter().ServeHTTP(w, req)
	assertStatus(t, w, http.StatusOK)
}

func TestHandler_MarkRead(t *testing.T) {
	id := uuid.New()
	w := httptest.NewRecorder()
	req, _ := http.NewRequest(http.MethodPost, "/api/v1/announcements/"+id.String()+"/read", nil)
	newRouter().ServeHTTP(w, req)
	assertStatus(t, w, http.StatusNoContent)
}
