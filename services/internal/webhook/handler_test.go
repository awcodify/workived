package webhook

import (
	"bytes"
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"sync"
	"testing"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/rs/zerolog"
)

func init() { gin.SetMode(gin.TestMode) }

// ── fakeNotifier ─────────────────────────────────────────────────────────────

type fakeNotifier struct {
	mu   sync.Mutex
	msgs []string
}

func (f *fakeNotifier) Send(_ context.Context, msg string) error {
	f.mu.Lock()
	f.msgs = append(f.msgs, msg)
	f.mu.Unlock()
	return nil
}

func (f *fakeNotifier) wait(t *testing.T, n int) {
	t.Helper()
	deadline := time.Now().Add(500 * time.Millisecond)
	for time.Now().Before(deadline) {
		f.mu.Lock()
		got := len(f.msgs)
		f.mu.Unlock()
		if got >= n {
			return
		}
		time.Sleep(10 * time.Millisecond)
	}
	t.Errorf("timed out waiting for %d notification(s)", n)
}

// ── helpers ───────────────────────────────────────────────────────────────────

func newRouter(notifier *fakeNotifier, token string) *gin.Engine {
	r := gin.New()
	NewHandler(notifier, token, zerolog.Nop()).RegisterRoutes(r)
	return r
}

func samplePayload(eventType, severity string) RailwayPayload {
	return RailwayPayload{
		Type:      eventType,
		Severity:  severity,
		Timestamp: "2025-11-21T23:48:42.311Z",
		Details: RailwayDetails{
			Status:        "FAILED",
			Branch:        "main",
			CommitHash:    "abc1234def567",
			CommitAuthor:  "Ahmad",
			CommitMessage: "fix: broken thing",
		},
		Resource: RailwayResource{
			Project:     RailwayProject{Name: "workived"},
			Environment: RailwayEnvironment{Name: "production"},
			Service:     RailwayService{Name: "api"},
		},
	}
}

// ── tests ─────────────────────────────────────────────────────────────────────

func TestRailwayWebhook_NoToken_Rejects(t *testing.T) {
	n := &fakeNotifier{}
	r := newRouter(n, "")

	body, _ := json.Marshal(samplePayload("Deployment.failed", "ERROR"))
	req := httptest.NewRequest(http.MethodPost, "/webhooks/railway", bytes.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)

	if w.Code != http.StatusInternalServerError {
		t.Fatalf("expected 500, got %d", w.Code)
	}
	time.Sleep(50 * time.Millisecond)
	if len(n.msgs) != 0 {
		t.Error("no notification should be sent when token not configured")
	}
}

func TestRailwayWebhook_ValidToken_Accepts(t *testing.T) {
	token := "super-secret-token"
	n := &fakeNotifier{}
	r := newRouter(n, token)

	body, _ := json.Marshal(samplePayload("Deployment.success", "INFO"))
	req := httptest.NewRequest(http.MethodPost, "/webhooks/railway?token="+token, bytes.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)

	if w.Code != http.StatusNoContent {
		t.Fatalf("expected 204, got %d", w.Code)
	}
	n.wait(t, 1)
}

func TestRailwayWebhook_InvalidToken_Rejects(t *testing.T) {
	n := &fakeNotifier{}
	r := newRouter(n, "correct-token")

	body, _ := json.Marshal(samplePayload("Deployment.failed", "ERROR"))
	req := httptest.NewRequest(http.MethodPost, "/webhooks/railway?token=wrong-token", bytes.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)

	if w.Code != http.StatusUnauthorized {
		t.Fatalf("expected 401, got %d", w.Code)
	}
	time.Sleep(50 * time.Millisecond)
	if len(n.msgs) != 0 {
		t.Error("no notification should be sent for invalid token")
	}
}

func TestRailwayWebhook_MissingToken_Rejects(t *testing.T) {
	n := &fakeNotifier{}
	r := newRouter(n, "my-secret-token")

	body, _ := json.Marshal(samplePayload("Deployment.failed", "ERROR"))
	req := httptest.NewRequest(http.MethodPost, "/webhooks/railway", bytes.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	// No token query parameter
	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)

	if w.Code != http.StatusUnauthorized {
		t.Fatalf("expected 401, got %d", w.Code)
	}
}

func TestRailwayWebhook_InvalidJSON_Returns400(t *testing.T) {
	n := &fakeNotifier{}
	r := newRouter(n, "test-token")

	req := httptest.NewRequest(http.MethodPost, "/webhooks/railway?token=test-token", strings.NewReader("not-json"))
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)

	if w.Code != http.StatusBadRequest {
		t.Fatalf("expected 400, got %d", w.Code)
	}
}

func TestFormatMessage_CriticalEvent(t *testing.T) {
	p := samplePayload(EventDeploymentFailed, "WARNING")
	msg := formatMessage(p)

	if !strings.Contains(msg, "🔴") {
		t.Error("expected red icon for Deployment.Failed")
	}
	if !strings.Contains(msg, EventDeploymentFailed) {
		t.Error("expected event type in message")
	}
	if !strings.Contains(msg, "workived / production") {
		t.Error("expected project/env in message")
	}
	if !strings.Contains(msg, "api") {
		t.Error("expected service name in message")
	}
	if !strings.Contains(msg, "abc1234") {
		t.Error("expected short commit hash in message")
	}
	if !strings.Contains(msg, "Ahmad") {
		t.Error("expected commit author in message")
	}
	if !strings.Contains(msg, "fix: broken thing") {
		t.Error("expected commit message in message")
	}
}

func TestFormatMessage_IconByEventType(t *testing.T) {
	cases := []struct {
		eventType string
		wantIcon  string
	}{
		{EventDeploymentCrashed, "🔴"},
		{EventDeploymentOomKilled, "🔴"},
		{EventDeploymentFailed, "🔴"},
		{EventVolumeAlertTriggered, "🔴"},
		{EventMonitorTriggered, "🔴"},
		{EventDeploymentRestarted, "🟡"},
		{EventDeploymentRemoved, "🟡"},
		{EventDeploymentWaiting, "🟡"},
		{EventDeploymentNeedsApproval, "🟡"},
		{EventMonitorDeleted, "🟡"},
		{EventDeploymentDeployed, "🟢"},
		{EventDeploymentBuilding, "🟢"},
		{EventDeploymentDeploying, "🟢"},
		{EventDeploymentQueued, "🟢"},
		{EventDeploymentSlept, "🟢"},
		{EventDeploymentResumed, "🟢"},
		{EventDeploymentRedeployed, "🟢"},
		{EventMonitorResolved, "🟢"},
		{EventVolumeAlertResolved, "🟢"},
	}
	for _, tc := range cases {
		t.Run(tc.eventType, func(t *testing.T) {
			p := samplePayload(tc.eventType, "INFO")
			msg := formatMessage(p)
			if !strings.Contains(msg, tc.wantIcon) {
				t.Errorf("eventIcon(%q) = wrong icon; got msg: %s", tc.eventType, msg)
			}
		})
	}
}

func TestFormatMessage_LongCommitMessageTruncated(t *testing.T) {
	p := samplePayload("Deployment.success", "INFO")
	p.Details.CommitMessage = strings.Repeat("a", 100)
	msg := formatMessage(p)
	if !strings.Contains(msg, "…") {
		t.Error("expected long commit message to be truncated with ellipsis")
	}
}

func TestFormatMessage_NoCommit_Omits(t *testing.T) {
	p := samplePayload("Deployment.failed", "ERROR")
	p.Details.CommitHash = ""
	p.Details.CommitAuthor = ""
	p.Details.CommitMessage = ""
	msg := formatMessage(p)
	if strings.Contains(msg, "Commit:") {
		t.Error("should not include Commit line when hash is empty")
	}
}
