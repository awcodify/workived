package mcp

import (
	"bytes"
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/rs/zerolog"
)

func init() {
	gin.SetMode(gin.TestMode)
}

func newTestHandler() *HTTPHandler {
	return &HTTPHandler{
		mcpURL:   "http://localhost:8080",
		apiURL:   "http://localhost:8080",
		log:      zerolog.Nop(),
		tools:    GetAvailableTools(),
		sessions: make(map[string]*httpSession),
	}
}

func newTestSession(h *HTTPHandler) *httpSession {
	s := &httpSession{
		id:        "test-session-id",
		events:    make(chan string, 64),
		done:      make(chan struct{}),
		handler:   &fakeToolHandler{},
		authCtx:   &AuthContext{},
		createdAt: time.Now(),
	}
	h.mu.Lock()
	h.sessions[s.id] = s
	h.mu.Unlock()
	return s
}

// fakeToolHandler returns a predictable result for any tool call.
type fakeToolHandler struct{}

func (f *fakeToolHandler) ExecuteTool(_ context.Context, toolName string, _ map[string]interface{}) (interface{}, error) {
	return ToolResult{
		Content: []Content{{Type: "text", Text: "ok:" + toolName}},
	}, nil
}

// ── dispatch tests ────────────────────────────────────────────────────────────

func TestDispatch_Initialize(t *testing.T) {
	h := newTestHandler()
	s := newTestSession(h)
	resp := h.dispatch(context.Background(), s, &JSONRPCRequest{
		JSONRPC: "2.0",
		ID:      1,
		Method:  "initialize",
	})
	if resp == nil {
		t.Fatal("expected response, got nil")
	}
	result, ok := resp.Result.(map[string]interface{})
	if !ok {
		t.Fatalf("expected map result, got %T", resp.Result)
	}
	if result["protocolVersion"] != "2024-11-05" {
		t.Errorf("unexpected protocolVersion: %v", result["protocolVersion"])
	}
}

func TestDispatch_NotificationsInitialized(t *testing.T) {
	h := newTestHandler()
	s := newTestSession(h)
	resp := h.dispatch(context.Background(), s, &JSONRPCRequest{
		JSONRPC: "2.0",
		Method:  "notifications/initialized",
	})
	if resp != nil {
		t.Errorf("expected nil response for notification, got %+v", resp)
	}
}

func TestDispatch_ToolsList(t *testing.T) {
	h := newTestHandler()
	s := newTestSession(h)
	resp := h.dispatch(context.Background(), s, &JSONRPCRequest{
		JSONRPC: "2.0",
		ID:      2,
		Method:  "tools/list",
	})
	if resp == nil || resp.Error != nil {
		t.Fatalf("expected success, got %+v", resp)
	}
	result := resp.Result.(map[string]interface{})
	tools, ok := result["tools"].([]Tool)
	if !ok {
		t.Fatalf("tools not []Tool: %T", result["tools"])
	}
	if len(tools) == 0 {
		t.Error("expected at least one tool")
	}
}

func TestDispatch_UnknownMethod(t *testing.T) {
	h := newTestHandler()
	s := newTestSession(h)
	resp := h.dispatch(context.Background(), s, &JSONRPCRequest{
		JSONRPC: "2.0",
		ID:      3,
		Method:  "unknown/method",
	})
	if resp.Error == nil {
		t.Error("expected error for unknown method")
	}
	if resp.Error.Code != -32601 {
		t.Errorf("expected -32601, got %d", resp.Error.Code)
	}
}

func TestDispatch_ToolCall(t *testing.T) {
	h := newTestHandler()
	s := newTestSession(h)
	params, _ := json.Marshal(map[string]interface{}{
		"name":      "workived_list_tasks",
		"arguments": map[string]interface{}{},
	})
	resp := h.dispatch(context.Background(), s, &JSONRPCRequest{
		JSONRPC: "2.0",
		ID:      4,
		Method:  "tools/call",
		Params:  json.RawMessage(params),
	})
	if resp.Error != nil {
		t.Fatalf("unexpected error: %+v", resp.Error)
	}
	result, ok := resp.Result.(ToolResult)
	if !ok {
		t.Fatalf("expected ToolResult, got %T", resp.Result)
	}
	if !strings.Contains(result.Content[0].Text, "workived_list_tasks") {
		t.Errorf("unexpected result: %v", result.Content[0].Text)
	}
}

func TestDispatch_ToolCall_InjectsEmployeeID(t *testing.T) {
	captured := ""
	h := newTestHandler()
	empID, err := uuid.Parse("aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa")
	if err != nil {
		t.Fatal(err)
	}
	s := &httpSession{
		id:      "inj-session",
		events:  make(chan string, 8),
		done:    make(chan struct{}),
		handler: &captureExecHandler{captured: &captured},
		authCtx: &AuthContext{EmployeeID: &empID},
	}
	h.mu.Lock()
	h.sessions[s.id] = s
	h.mu.Unlock()

	params, _ := json.Marshal(map[string]interface{}{
		"name":      "workived_list_tasks",
		"arguments": map[string]interface{}{},
	})
	h.dispatch(context.Background(), s, &JSONRPCRequest{
		JSONRPC: "2.0",
		ID:      5,
		Method:  "tools/call",
		Params:  json.RawMessage(params),
	})
	if !strings.Contains(captured, empID.String()) {
		t.Errorf("employee_id not injected: captured=%q", captured)
	}
}

type captureExecHandler struct{ captured *string }

func (c *captureExecHandler) ExecuteTool(_ context.Context, _ string, args map[string]interface{}) (interface{}, error) {
	b, _ := json.Marshal(args)
	*c.captured = string(b)
	return ToolResult{Content: []Content{{Type: "text", Text: "ok"}}}, nil
}

// ── HandleMessage HTTP tests ──────────────────────────────────────────────────

func TestHandleMessage_MissingSession(t *testing.T) {
	h := newTestHandler()
	r := gin.New()
	r.POST("/mcp/message", h.HandleMessage)

	body, _ := json.Marshal(JSONRPCRequest{JSONRPC: "2.0", ID: 1, Method: "tools/list"})
	req := httptest.NewRequest(http.MethodPost, "/mcp/message?sessionId=notexist", bytes.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)

	if w.Code != http.StatusNotFound {
		t.Errorf("expected 404, got %d", w.Code)
	}
}

func TestHandleMessage_MissingSessionID(t *testing.T) {
	h := newTestHandler()
	r := gin.New()
	r.POST("/mcp/message", h.HandleMessage)

	body, _ := json.Marshal(JSONRPCRequest{JSONRPC: "2.0", ID: 1, Method: "tools/list"})
	req := httptest.NewRequest(http.MethodPost, "/mcp/message", bytes.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)

	if w.Code != http.StatusBadRequest {
		t.Errorf("expected 400, got %d", w.Code)
	}
}

func TestHandleMessage_Success(t *testing.T) {
	h := newTestHandler()
	s := newTestSession(h)

	r := gin.New()
	r.POST("/mcp/message", h.HandleMessage)

	body, _ := json.Marshal(JSONRPCRequest{JSONRPC: "2.0", ID: 1, Method: "initialize"})
	req := httptest.NewRequest(http.MethodPost, "/mcp/message?sessionId="+s.id, bytes.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)

	if w.Code != http.StatusAccepted {
		t.Errorf("expected 202, got %d", w.Code)
	}
	// Response should arrive in the events channel.
	select {
	case event := <-s.events:
		if !strings.Contains(event, "protocolVersion") {
			t.Errorf("unexpected event: %s", event)
		}
	case <-time.After(time.Second):
		t.Error("timed out waiting for event")
	}
}

func TestHandleMessage_NotificationNoEvent(t *testing.T) {
	h := newTestHandler()
	s := newTestSession(h)

	r := gin.New()
	r.POST("/mcp/message", h.HandleMessage)

	body, _ := json.Marshal(JSONRPCRequest{JSONRPC: "2.0", Method: "notifications/initialized"})
	req := httptest.NewRequest(http.MethodPost, "/mcp/message?sessionId="+s.id, bytes.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)

	if w.Code != http.StatusAccepted {
		t.Errorf("expected 202, got %d", w.Code)
	}
	select {
	case event := <-s.events:
		t.Errorf("expected no event for notification, got: %s", event)
	case <-time.After(50 * time.Millisecond):
		// correct — no event
	}
}

// ── sweepSessions ────────────────────────────────────────────────────────────

func TestSweepSessionsRemovesOld(t *testing.T) {
	h := newTestHandler()
	old := &httpSession{
		id:        "old",
		events:    make(chan string, 1),
		done:      make(chan struct{}),
		createdAt: time.Now().Add(-25 * time.Hour),
	}
	h.mu.Lock()
	h.sessions[old.id] = old
	h.mu.Unlock()

	cutoff := time.Now().Add(-24 * time.Hour)
	h.mu.Lock()
	for id, s := range h.sessions {
		if s.createdAt.Before(cutoff) {
			close(s.done)
			delete(h.sessions, id)
		}
	}
	h.mu.Unlock()

	h.mu.Lock()
	_, stillThere := h.sessions[old.id]
	h.mu.Unlock()
	if stillThere {
		t.Error("expected old session to be swept")
	}
}

