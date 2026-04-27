package admin_test

import (
	"context"
	"net/http"
	"net/http/httptest"
	"sync"
	"testing"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/rs/zerolog"
	"github.com/workived/services/internal/admin"
)

type captureNotifier struct {
	mu       sync.Mutex
	messages []string
	err      error
}

func (c *captureNotifier) Send(_ context.Context, msg string) error {
	c.mu.Lock()
	defer c.mu.Unlock()
	if c.err != nil {
		return c.err
	}
	c.messages = append(c.messages, msg)
	return nil
}

func setupTestRouter(notifier *captureNotifier, role string) *gin.Engine {
	gin.SetMode(gin.TestMode)
	svc := admin.NewService(nil, admin.WithCache(nil))
	h := admin.NewHandler(svc, zerolog.Nop()).WithNotifier(notifier)

	r := gin.New()
	r.Use(func(c *gin.Context) {
		c.Set("org_id", uuid.New())
		c.Set("user_id", uuid.New())
		c.Set("role", role)
		c.Set("request_id", "test-req-id")
		c.Next()
	})
	h.RegisterPublicRoutes(r.Group("/api/v1"))
	return r
}

func TestSendTestNotification_Owner(t *testing.T) {
	n := &captureNotifier{}
	r := setupTestRouter(n, "owner")

	req := httptest.NewRequest(http.MethodPost, "/api/v1/notifications/test", nil)
	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)

	if w.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d: %s", w.Code, w.Body.String())
	}
	n.mu.Lock()
	defer n.mu.Unlock()
	if len(n.messages) != 1 {
		t.Fatalf("expected 1 message sent, got %d", len(n.messages))
	}
	if n.messages[0] == "" {
		t.Error("expected non-empty message")
	}
}

func TestSendTestNotification_NonOwner(t *testing.T) {
	for _, role := range []string{"member", "hr_admin", "manager"} {
		t.Run(role, func(t *testing.T) {
			n := &captureNotifier{}
			r := setupTestRouter(n, role)

			req := httptest.NewRequest(http.MethodPost, "/api/v1/notifications/test", nil)
			w := httptest.NewRecorder()
			r.ServeHTTP(w, req)

			if w.Code != http.StatusForbidden {
				t.Errorf("role=%s: expected 403, got %d", role, w.Code)
			}
			n.mu.Lock()
			if len(n.messages) != 0 {
				t.Errorf("role=%s: expected no messages, got %d", role, len(n.messages))
			}
			n.mu.Unlock()
		})
	}
}
