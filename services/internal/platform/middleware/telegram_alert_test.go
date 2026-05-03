package middleware

import (
	"context"
	"net/http"
	"net/http/httptest"
	"strings"
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

func TestTelegramAlert_ErrorDetailFromJSONBody(t *testing.T) {
	gin.SetMode(gin.TestMode)
	n := &captureNotifier{}
	r := gin.New()
	r.Use(TelegramAlert(n))
	r.GET("/boom", func(c *gin.Context) {
		c.JSON(http.StatusInternalServerError, map[string]any{
			"error": map[string]any{
				"code":    "internal",
				"message": "database connection failed",
			},
		})
	})

	req := httptest.NewRequest(http.MethodGet, "/boom", nil)
	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)

	n.wait(t, 1)
	n.mu.Lock()
	defer n.mu.Unlock()
	msg := n.messages[0]
	if !strings.Contains(msg, "database connection failed") {
		t.Errorf("expected error message in notification, got: %s", msg)
	}
	if !strings.Contains(msg, "internal") {
		t.Errorf("expected error code in notification, got: %s", msg)
	}
	if strings.Contains(msg, "no error detail") {
		t.Errorf("should not contain fallback text, got: %s", msg)
	}
}

func TestTelegramAlert_EmptyBody(t *testing.T) {
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
	msg := n.messages[0]
	if !strings.Contains(msg, "empty response body") {
		t.Errorf("expected empty body fallback, got: %s", msg)
	}
}

func TestExtractErrorSummary(t *testing.T) {
	cases := []struct {
		name     string
		body     string
		contains string
	}{
		{
			name:     "apperr JSON",
			body:     `{"error":{"code":"not_found","message":"employee not found"}}`,
			contains: "[not_found] employee not found",
		},
		{
			name:     "no code",
			body:     `{"error":{"message":"something broke"}}`,
			contains: "something broke",
		},
		{
			name:     "empty body",
			body:     "",
			contains: "empty response body",
		},
		{
			name:     "non-JSON body",
			body:     "internal server error",
			contains: "internal server error",
		},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			got := extractErrorSummary([]byte(tc.body))
			if !strings.Contains(got, tc.contains) {
				t.Errorf("extractErrorSummary(%q) = %q, want containing %q", tc.body, got, tc.contains)
			}
		})
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
