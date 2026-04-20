package mcp

import (
	"bufio"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"os"

	"github.com/google/uuid"
	"github.com/rs/zerolog"
)

// AuthContext holds the authenticated user's context
type AuthContext struct {
	UserID         uuid.UUID
	OrganisationID uuid.UUID
	EmployeeID     *uuid.UUID // Nullable - not all users are employees
	Role           string
	Email          string
	AccessToken    string // JWT access token for API calls
	RefreshToken   string // Refresh token for renewing access
}

// Server implements the Model Context Protocol server
type Server struct {
	appURL  string
	log     zerolog.Logger
	tools   []Tool
	handler ToolExecutor
	authCtx *AuthContext // Authenticated user context
}

// ToolExecutor interface for executing tools
type ToolExecutor interface {
	ExecuteTool(ctx context.Context, toolName string, args map[string]interface{}) (interface{}, error)
}

// NewServer creates a new MCP server (no database/auth service needed!)
func NewServer(appURL string, log zerolog.Logger) *Server {
	return &Server{
		appURL: appURL,
		log:    log,
		tools:  GetAvailableTools(),
	}
}

// Run starts the MCP server in stdio mode
func (s *Server) Run(ctx context.Context) error {
	if s.authCtx == nil {
		return fmt.Errorf("server not authenticated - call AuthenticateWithSSO() first")
	}

	s.log.Info().
		Str("user", s.authCtx.Email).
		Str("org_id", s.authCtx.OrganisationID.String()).
		Msg("MCP server starting in stdio mode")

	scanner := bufio.NewScanner(os.Stdin)
	writer := bufio.NewWriter(os.Stdout)

	for scanner.Scan() {
		line := scanner.Bytes()

		var req JSONRPCRequest
		if err := json.Unmarshal(line, &req); err != nil {
			s.writeError(writer, "", -32700, "Parse error", err)
			continue
		}

		response := s.handleRequest(ctx, &req)

		responseBytes, err := json.Marshal(response)
		if err != nil {
			s.log.Error().Err(err).Msg("marshal response")
			continue
		}

		if _, err := writer.Write(responseBytes); err != nil {
			s.log.Error().Err(err).Msg("write response")
			continue
		}

		if _, err := writer.Write([]byte("\n")); err != nil {
			s.log.Error().Err(err).Msg("write newline")
			continue
		}

		if err := writer.Flush(); err != nil {
			s.log.Error().Err(err).Msg("flush writer")
			continue
		}
	}

	if err := scanner.Err(); err != nil && err != io.EOF {
		return fmt.Errorf("scanner error: %w", err)
	}

	return nil
}

// handleRequest processes an MCP request
func (s *Server) handleRequest(ctx context.Context, req *JSONRPCRequest) *JSONRPCResponse {
	switch req.Method {
	case "initialize":
		return s.handleInitialize(req)
	case "tools/list":
		return s.handleToolsList(req)
	case "tools/call":
		return s.handleToolsCall(ctx, req)
	default:
		return &JSONRPCResponse{
			JSONRPC: "2.0",
			ID:      req.ID,
			Error: &JSONRPCError{
				Code:    -32601,
				Message: "Method not found",
			},
		}
	}
}

// handleInitialize handles the initialize request
func (s *Server) handleInitialize(req *JSONRPCRequest) *JSONRPCResponse {
	result := map[string]interface{}{
		"protocolVersion": "2024-11-05",
		"capabilities": map[string]interface{}{
			"tools": map[string]interface{}{},
		},
		"serverInfo": map[string]interface{}{
			"name":    "workived-mcp-server",
			"version": "0.1.0",
		},
	}

	return &JSONRPCResponse{
		JSONRPC: "2.0",
		ID:      req.ID,
		Result:  result,
	}
}

// handleToolsList handles the tools/list request
func (s *Server) handleToolsList(req *JSONRPCRequest) *JSONRPCResponse {
	result := map[string]interface{}{
		"tools": s.tools,
	}

	return &JSONRPCResponse{
		JSONRPC: "2.0",
		ID:      req.ID,
		Result:  result,
	}
}

// handleToolsCall handles the tools/call request
func (s *Server) handleToolsCall(ctx context.Context, req *JSONRPCRequest) *JSONRPCResponse {
	var params struct {
		Name      string                 `json:"name"`
		Arguments map[string]interface{} `json:"arguments"`
	}

	paramsBytes, err := json.Marshal(req.Params)
	if err != nil {
		return &JSONRPCResponse{
			JSONRPC: "2.0",
			ID:      req.ID,
			Error: &JSONRPCError{
				Code:    -32602,
				Message: "Invalid params",
				Data:    err.Error(),
			},
		}
	}

	if err := json.Unmarshal(paramsBytes, &params); err != nil {
		return &JSONRPCResponse{
			JSONRPC: "2.0",
			ID:      req.ID,
			Error: &JSONRPCError{
				Code:    -32602,
				Message: "Invalid params",
				Data:    err.Error(),
			},
		}
	}

	// Auto-inject context only when tools need it
	// Note: organisation_id is extracted from JWT by the API automatically
	// We only inject optional employee_id/creator_id when not provided
	if params.Arguments == nil {
		params.Arguments = make(map[string]interface{})
	}

	// Inject employee_id if not provided and user has an employee record
	// (Some tools like clock-in need employee_id)
	if _, exists := params.Arguments["employee_id"]; !exists && s.authCtx.EmployeeID != nil {
		params.Arguments["employee_id"] = s.authCtx.EmployeeID.String()
	}

	// Inject creator_id (used for task creation) if not provided
	if _, exists := params.Arguments["creator_id"]; !exists && s.authCtx.EmployeeID != nil {
		params.Arguments["creator_id"] = s.authCtx.EmployeeID.String()
	}

	result, err := s.handler.ExecuteTool(ctx, params.Name, params.Arguments)
	if err != nil {
		return &JSONRPCResponse{
			JSONRPC: "2.0",
			ID:      req.ID,
			Error: &JSONRPCError{
				Code:    -32000,
				Message: "Tool execution failed",
				Data:    err.Error(),
			},
		}
	}

	return &JSONRPCResponse{
		JSONRPC: "2.0",
		ID:      req.ID,
		Result:  result,
	}
}

func (s *Server) writeError(writer *bufio.Writer, id interface{}, code int, message string, err error) {
	resp := &JSONRPCResponse{
		JSONRPC: "2.0",
		ID:      id,
		Error: &JSONRPCError{
			Code:    code,
			Message: message,
			Data:    err.Error(),
		},
	}

	responseBytes, _ := json.Marshal(resp)
	writer.Write(responseBytes)
	writer.Write([]byte("\n"))
	writer.Flush()
}
