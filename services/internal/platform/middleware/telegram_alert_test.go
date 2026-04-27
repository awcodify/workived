package middleware

import (
	"context"
	"net/http"
	"net/http/httptest"
	"sync"
	"testing"
	"time"

	"github.com/gin-gonic/gin"
)

type captureNotifier struct {
	mu       sync.Mutex
	messages []string
}

func (c *captureNotifier) Send(_ context.Context, msg string) error {
	c.mu.Lock()
	c.messages = append(c.messages, msg)
	c.mu.Unlock()
	return nil
}

func (c *captureNotifier) wait(t *testing.T, n int) {
	t.Helper()
	deadline := time.Now().Add(500 * time.Millisecond)
	for time.Now().Before(deadline) {
		c.mu.Lock()
		got := len(c.messages)
		c.mu.Unlock()
		if got >= n {
			return
		}
		time.Sleep(10 * time.Millisecond)
	}
	t.Errorf("timed out waiting for %d messages", n)
}

func TestTelegramAlert_500(t *testing.T) {
	gin.SetMode(gin.TestMode)
	n := &captureNotifier{}
	r := gin.New()
	r.Use(TelegramAlert(n))
	r.GET("/boom", func(c *gin.Context) {
		c.Status(http.StatusInternalServerError)
	})

	req := httptest.NewRequest(http.MethodGet, "/boom", nil)
	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)

	n.wait(t, 1)
	n.mu.Lock()
	defer n.mu.Unlock()
	if len(n.messages) != 1 {
		t.Fatalf("expected 1 message, got %d", len(n.messages))
	}
	msg := n.messages[0]
	if msg == "" {
		t.Error("expected non-empty message")
	}
}

func TestTelegramAlert_200_NoNotify(t *testing.T) {
	gin.SetMode(gin.TestMode)
	n := &captureNotifier{}
	r := gin.New()
	r.Use(TelegramAlert(n))
	r.GET("/ok", func(c *gin.Context) {
		c.Status(http.StatusOK)
	})

	req := httptest.NewRequest(http.MethodGet, "/ok", nil)
	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)

	// Brief wait to confirm no message fired
	time.Sleep(100 * time.Millisecond)
	n.mu.Lock()
	defer n.mu.Unlock()
	if len(n.messages) != 0 {
		t.Errorf("expected no messages for 200, got %d", len(n.messages))
	}
}

func TestTelegramAlert_503_Notifies(t *testing.T) {
	gin.SetMode(gin.TestMode)
	n := &captureNotifier{}
	r := gin.New()
	r.Use(TelegramAlert(n))
	r.GET("/unavail", func(c *gin.Context) {
		c.Status(http.StatusServiceUnavailable)
	})

	req := httptest.NewRequest(http.MethodGet, "/unavail", nil)
	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)

	n.wait(t, 1)
	n.mu.Lock()
	defer n.mu.Unlock()
	if len(n.messages) != 1 {
		t.Errorf("expected 1 message for 503, got %d", len(n.messages))
	}
}

func TestTelegramAlert_404_NoNotify(t *testing.T) {
	gin.SetMode(gin.TestMode)
	n := &captureNotifier{}
	r := gin.New()
	r.Use(TelegramAlert(n))
	r.GET("/notfound", func(c *gin.Context) {
		c.Status(http.StatusNotFound)
	})

	req := httptest.NewRequest(http.MethodGet, "/notfound", nil)
	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)

	time.Sleep(100 * time.Millisecond)
	n.mu.Lock()
	defer n.mu.Unlock()
	if len(n.messages) != 0 {
		t.Errorf("expected no messages for 404, got %d", len(n.messages))
	}
}
