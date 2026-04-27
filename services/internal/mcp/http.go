package mcp

import (
	"context"
	"crypto/rand"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"net/http"
	"strings"
	"sync"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/rs/zerolog"
)

// HTTPHandler implements MCP over HTTP/SSE transport (MCP spec 2024-11-05).
// Client connects via GET /mcp/sse, receives an endpoint URL, then POSTs
// JSON-RPC messages to that URL. Responses flow back over the SSE stream.
type HTTPHandler struct {
	appURL   string
	log      zerolog.Logger
	tools    []Tool
	mu       sync.Mutex
	sessions map[string]*httpSession
}

type httpSession struct {
	id        string
	events    chan string
	done      chan struct{}
	handler   ToolExecutor
	authCtx   *AuthContext
	createdAt time.Time
}

func NewHTTPHandler(appURL string, log zerolog.Logger) *HTTPHandler {
	h := &HTTPHandler{
		appURL:   appURL,
		log:      log,
		tools:    GetAvailableTools(),
		sessions: make(map[string]*httpSession),
	}
	go h.sweepSessions()
	return h
}

// sweepSessions removes stale sessions every 5 minutes.
func (h *HTTPHandler) sweepSessions() {
	ticker := time.NewTicker(5 * time.Minute)
	defer ticker.Stop()
	for range ticker.C {
		cutoff := time.Now().Add(-24 * time.Hour)
		h.mu.Lock()
		for id, s := range h.sessions {
			if s.createdAt.Before(cutoff) {
				close(s.done)
				delete(h.sessions, id)
			}
		}
		h.mu.Unlock()
	}
}

// HandleSSE handles GET /mcp/sse.
// Validates the Bearer JWT, creates a session, then streams SSE events.
func (h *HTTPHandler) HandleSSE(c *gin.Context) {
	accessToken := extractBearer(c)
	if accessToken == "" {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "missing Bearer token"})
		return
	}

	apiClient := NewAPIClient(h.appURL, accessToken, "", h.log)

	authCtx, err := fetchEmployeeContext(c.Request.Context(), apiClient)
	if err != nil {
		h.log.Warn().Err(err).Msg("mcp/sse: could not fetch employee context")
		authCtx = &AuthContext{AccessToken: accessToken}
	}

	sessionID := randomHex(16)
	session := &httpSession{
		id:        sessionID,
		events:    make(chan string, 64),
		done:      make(chan struct{}),
		handler:   NewAPIToolHandler(apiClient, h.log),
		authCtx:   authCtx,
		createdAt: time.Now(),
	}

	h.mu.Lock()
	h.sessions[sessionID] = session
	h.mu.Unlock()

	c.Header("Content-Type", "text/event-stream")
	c.Header("Cache-Control", "no-cache")
	c.Header("Connection", "keep-alive")
	c.Header("X-Accel-Buffering", "no")
	c.Header("Access-Control-Allow-Origin", "*")
	c.Writer.WriteHeader(http.StatusOK)

	// Tell the client where to POST messages — must be a full URL.
	fmt.Fprintf(c.Writer, "event: endpoint\ndata: %s/mcp/message?sessionId=%s\n\n", h.appURL, sessionID)
	c.Writer.Flush()

	h.log.Info().
		Str("session_id", sessionID).
		Str("email", authCtx.Email).
		Msg("mcp: SSE session started")

	ctx := c.Request.Context()
	defer func() {
		h.mu.Lock()
		delete(h.sessions, sessionID)
		h.mu.Unlock()
		close(session.done)
		h.log.Info().Str("session_id", sessionID).Msg("mcp: SSE session ended")
	}()

	for {
		select {
		case event := <-session.events:
			fmt.Fprintf(c.Writer, "event: message\ndata: %s\n\n", event)
			c.Writer.Flush()
		case <-ctx.Done():
			return
		}
	}
}

// HandleMessage handles POST /mcp/message?sessionId=<id>.
// Receives JSON-RPC from client and routes the response back via the SSE stream.
func (h *HTTPHandler) HandleMessage(c *gin.Context) {
	sessionID := c.Query("sessionId")
	if sessionID == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "missing sessionId"})
		return
	}

	h.mu.Lock()
	session, ok := h.sessions[sessionID]
	h.mu.Unlock()
	if !ok {
		c.JSON(http.StatusNotFound, gin.H{"error": "session not found or expired"})
		return
	}

	var req JSONRPCRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	response := h.dispatch(c.Request.Context(), session, &req)

	// Notifications have no id and expect no response.
	if response == nil {
		c.Status(http.StatusAccepted)
		return
	}

	b, err := json.Marshal(response)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "marshal failed"})
		return
	}

	select {
	case session.events <- string(b):
	case <-time.After(10 * time.Second):
		c.JSON(http.StatusGatewayTimeout, gin.H{"error": "session write timeout"})
		return
	}

	c.Status(http.StatusAccepted)
}

func (h *HTTPHandler) dispatch(ctx context.Context, s *httpSession, req *JSONRPCRequest) *JSONRPCResponse {
	switch req.Method {
	case "initialize":
		return &JSONRPCResponse{
			JSONRPC: "2.0",
			ID:      req.ID,
			Result: map[string]interface{}{
				"protocolVersion": "2024-11-05",
				"capabilities":    map[string]interface{}{"tools": map[string]interface{}{}},
				"serverInfo":      map[string]interface{}{"name": "workived-mcp", "version": "1.0.0"},
			},
		}

	case "notifications/initialized":
		return nil // notification — no response

	case "tools/list":
		return &JSONRPCResponse{
			JSONRPC: "2.0",
			ID:      req.ID,
			Result:  map[string]interface{}{"tools": h.tools},
		}

	case "tools/call":
		return h.callTool(ctx, s, req)

	default:
		return &JSONRPCResponse{
			JSONRPC: "2.0",
			ID:      req.ID,
			Error:   &JSONRPCError{Code: -32601, Message: "Method not found"},
		}
	}
}

func (h *HTTPHandler) callTool(ctx context.Context, s *httpSession, req *JSONRPCRequest) *JSONRPCResponse {
	var params struct {
		Name      string                 `json:"name"`
		Arguments map[string]interface{} `json:"arguments"`
	}
	b, _ := json.Marshal(req.Params)
	if err := json.Unmarshal(b, &params); err != nil {
		return &JSONRPCResponse{
			JSONRPC: "2.0",
			ID:      req.ID,
			Error:   &JSONRPCError{Code: -32602, Message: "Invalid params"},
		}
	}
	if params.Arguments == nil {
		params.Arguments = make(map[string]interface{})
	}

	// Auto-inject employee context the same way the stdio server does.
	if s.authCtx != nil && s.authCtx.EmployeeID != nil {
		if _, ok := params.Arguments["employee_id"]; !ok {
			params.Arguments["employee_id"] = s.authCtx.EmployeeID.String()
		}
		if _, ok := params.Arguments["creator_id"]; !ok {
			params.Arguments["creator_id"] = s.authCtx.EmployeeID.String()
		}
	}

	result, err := s.handler.ExecuteTool(ctx, params.Name, params.Arguments)
	if err != nil {
		return &JSONRPCResponse{
			JSONRPC: "2.0",
			ID:      req.ID,
			Error:   &JSONRPCError{Code: -32000, Message: "Tool execution failed", Data: err.Error()},
		}
	}
	return &JSONRPCResponse{JSONRPC: "2.0", ID: req.ID, Result: result}
}

// fetchEmployeeContext calls /api/v1/employees/me to get the authenticated user's employee record.
func fetchEmployeeContext(ctx context.Context, client *APIClient) (*AuthContext, error) {
	data, err := client.Get(ctx, "/api/v1/employees/me", nil)
	if err != nil {
		return nil, err
	}
	var resp struct {
		Data struct {
			ID             uuid.UUID `json:"id"`
			OrganisationID uuid.UUID `json:"organisation_id"`
			Email          string    `json:"email"`
		} `json:"data"`
	}
	if err := json.Unmarshal(data, &resp); err != nil {
		return nil, err
	}
	empID := resp.Data.ID
	return &AuthContext{
		EmployeeID:     &empID,
		OrganisationID: resp.Data.OrganisationID,
		Email:          resp.Data.Email,
		AccessToken:    client.accessToken,
	}, nil
}

func extractBearer(c *gin.Context) string {
	h := c.GetHeader("Authorization")
	if !strings.HasPrefix(h, "Bearer ") {
		return ""
	}
	return strings.TrimPrefix(h, "Bearer ")
}

func randomHex(n int) string {
	b := make([]byte, n)
	_, _ = rand.Read(b)
	return hex.EncodeToString(b)
}
