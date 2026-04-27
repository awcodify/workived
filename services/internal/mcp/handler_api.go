package mcp

import (
	"context"
	"encoding/json"
	"fmt"
	"strings"

	"github.com/gomarkdown/markdown"
	"github.com/gomarkdown/markdown/html"
	"github.com/gomarkdown/markdown/parser"
	"github.com/rs/zerolog"
)

// APIToolHandler executes MCP tools by calling the Workived API
type APIToolHandler struct {
	client *APIClient
	log    zerolog.Logger
}

// NewAPIToolHandler creates a new API-based tool handler
func NewAPIToolHandler(apiClient *APIClient, log zerolog.Logger) *APIToolHandler {
	return &APIToolHandler{
		client: apiClient,
		log:    log,
	}
}

// markdownToHTML converts markdown text to HTML
// If the text doesn't contain markdown syntax, it returns the text wrapped in <p> tags
func markdownToHTML(text string) string {
	if text == "" {
		return ""
	}

	// Create markdown parser with extensions
	extensions := parser.CommonExtensions | parser.AutoHeadingIDs
	p := parser.NewWithExtensions(extensions)

	// Create HTML renderer
	htmlFlags := html.CommonFlags | html.HrefTargetBlank
	opts := html.RendererOptions{Flags: htmlFlags}
	renderer := html.NewRenderer(opts)

	// Convert markdown to HTML
	md := []byte(text)
	htmlBytes := markdown.ToHTML(md, p, renderer)
	htmlStr := strings.TrimSpace(string(htmlBytes))

	// If conversion resulted in just <p>text</p>, it was likely plain text
	// Return it as-is (already has proper HTML wrapping)
	return htmlStr
}

// ExecuteTool executes a tool by calling the appropriate API endpoint
func (h *APIToolHandler) ExecuteTool(ctx context.Context, toolName string, args map[string]interface{}) (interface{}, error) {
	h.log.Debug().Str("tool", toolName).Interface("args", args).Msg("executing tool via API")

	switch toolName {
	// Employee tools
	case "workived_list_employees":
		return h.listEmployees(ctx, args)
	case "workived_get_employee":
		return h.getEmployee(ctx, args)
	case "workived_create_employee":
		return h.createEmployee(ctx, args)
	case "workived_update_employee":
		return h.updateEmployee(ctx, args)

	// Leave tools
	case "workived_list_leave_requests":
		return h.listLeaveRequests(ctx, args)
	case "workived_submit_leave_request":
		return h.submitLeaveRequest(ctx, args)
	case "workived_approve_leave":
		return h.approveLeave(ctx, args)

	// Attendance tools
	case "workived_clock_in":
		return h.clockIn(ctx, args)
	case "workived_clock_out":
		return h.clockOut(ctx, args)
	case "workived_get_attendance_report":
		return h.getAttendanceReport(ctx, args)

	// Department tools
	case "workived_list_departments":
		return h.listDepartments(ctx, args)
	case "workived_create_department":
		return h.createDepartment(ctx, args)

	// Task tools
	case "workived_list_tasks":
		return h.listTasks(ctx, args)
	case "workived_get_task":
		return h.getTask(ctx, args)
	case "workived_create_task":
		return h.createTask(ctx, args)
	case "workived_update_task":
		return h.updateTask(ctx, args)
	case "workived_move_task":
		return h.moveTask(ctx, args)
	case "workived_toggle_task_completion":
		return h.toggleTaskCompletion(ctx, args)
	case "workived_delete_task":
		return h.deleteTask(ctx, args)
	case "workived_list_task_lists":
		return h.listTaskLists(ctx, args)
	case "workived_create_task_list":
		return h.createTaskList(ctx, args)
	case "workived_update_task_list":
		return h.updateTaskList(ctx, args)
	case "workived_delete_task_list":
		return h.deleteTaskList(ctx, args)
	case "workived_list_task_comments":
		return h.listTaskComments(ctx, args)
	case "workived_create_task_comment":
		return h.createTaskComment(ctx, args)
	case "workived_delete_task_comment":
		return h.deleteTaskComment(ctx, args)

	// Dashboard
	case "workived_get_dashboard_stats":
		return h.getDashboardStats(ctx, args)

	default:
		return nil, fmt.Errorf("unknown tool: %s", toolName)
	}
}

// Helper to parse API responses
func parseAPIResponse(data []byte, target interface{}) error {
	var wrapper struct {
		Data json.RawMessage `json:"data"`
	}
	if err := json.Unmarshal(data, &wrapper); err != nil {
		return fmt.Errorf("parse response wrapper: %w", err)
	}
	if err := json.Unmarshal(wrapper.Data, target); err != nil {
		return fmt.Errorf("parse response data: %w", err)
	}
	return nil
}

// Employee tools
func (h *APIToolHandler) listEmployees(ctx context.Context, args map[string]interface{}) (interface{}, error) {
	params := make(map[string]string)
	if status, ok := args["status"].(string); ok {
		params["status"] = status
	}
	if departmentID, ok := args["department_id"].(string); ok {
		params["department_id"] = departmentID
	}

	data, err := h.client.Get(ctx, "/api/v1/employees", params)
	if err != nil {
		return apiErrorResult(err.Error()), nil
	}

	var employees []interface{}
	if err := parseAPIResponse(data, &employees); err != nil {
		return apiErrorResult(err.Error()), nil
	}

	return apiSuccessResult(fmt.Sprintf("Found %d employees", len(employees)), employees), nil
}

func (h *APIToolHandler) getEmployee(ctx context.Context, args map[string]interface{}) (interface{}, error) {
	employeeID, ok := args["employee_id"].(string)
	if !ok {
		return apiErrorResult("employee_id is required"), nil
	}

	data, err := h.client.Get(ctx, "/api/v1/employees/"+employeeID, nil)
	if err != nil {
		return apiErrorResult(err.Error()), nil
	}

	var employee interface{}
	if err := parseAPIResponse(data, &employee); err != nil {
		return apiErrorResult(err.Error()), nil
	}

	return apiSuccessResult("Employee retrieved successfully", employee), nil
}

func (h *APIToolHandler) createEmployee(ctx context.Context, args map[string]interface{}) (interface{}, error) {
	data, err := h.client.Post(ctx, "/api/v1/employees", args)
	if err != nil {
		return apiErrorResult(err.Error()), nil
	}

	var employee interface{}
	if err := parseAPIResponse(data, &employee); err != nil {
		return apiErrorResult(err.Error()), nil
	}

	return apiSuccessResult("Employee created successfully", employee), nil
}

func (h *APIToolHandler) updateEmployee(ctx context.Context, args map[string]interface{}) (interface{}, error) {
	employeeID, ok := args["employee_id"].(string)
	if !ok {
		return apiErrorResult("employee_id is required"), nil
	}

	// Remove employee_id from args since it's in the path
	updates := make(map[string]interface{})
	for k, v := range args {
		if k != "employee_id" && k != "organisation_id" {
			updates[k] = v
		}
	}

	data, err := h.client.Put(ctx, "/api/v1/employees/"+employeeID, updates)
	if err != nil {
		return apiErrorResult(err.Error()), nil
	}

	var employee interface{}
	if err := parseAPIResponse(data, &employee); err != nil {
		return apiErrorResult(err.Error()), nil
	}

	return apiSuccessResult("Employee updated successfully", employee), nil
}

// Leave tools
func (h *APIToolHandler) listLeaveRequests(ctx context.Context, args map[string]interface{}) (interface{}, error) {
	params := make(map[string]string)
	if status, ok := args["status"].(string); ok {
		params["status"] = status
	}
	if employeeID, ok := args["employee_id"].(string); ok {
		params["employee_id"] = employeeID
	}

	data, err := h.client.Get(ctx, "/api/v1/leave/requests", params)
	if err != nil {
		return apiErrorResult(err.Error()), nil
	}

	var requests []interface{}
	if err := parseAPIResponse(data, &requests); err != nil {
		return apiErrorResult(err.Error()), nil
	}

	return apiSuccessResult(fmt.Sprintf("Found %d leave requests", len(requests)), requests), nil
}

func (h *APIToolHandler) submitLeaveRequest(ctx context.Context, args map[string]interface{}) (interface{}, error) {
	data, err := h.client.Post(ctx, "/api/v1/leave/requests", args)
	if err != nil {
		return apiErrorResult(err.Error()), nil
	}

	var request interface{}
	if err := parseAPIResponse(data, &request); err != nil {
		return apiErrorResult(err.Error()), nil
	}

	return apiSuccessResult("Leave request submitted successfully", request), nil
}

func (h *APIToolHandler) approveLeave(ctx context.Context, args map[string]interface{}) (interface{}, error) {
	requestID, ok := args["request_id"].(string)
	if !ok {
		return apiErrorResult("request_id is required"), nil
	}

	action := make(map[string]interface{})
	action["approved"] = args["approved"]
	if notes, ok := args["notes"]; ok {
		action["notes"] = notes
	}

	data, err := h.client.Put(ctx, "/api/v1/leave/requests/"+requestID+"/decision", action)
	if err != nil {
		return apiErrorResult(err.Error()), nil
	}

	var request interface{}
	if err := parseAPIResponse(data, &request); err != nil {
		return apiErrorResult(err.Error()), nil
	}

	return apiSuccessResult("Leave request processed successfully", request), nil
}

// Attendance tools
func (h *APIToolHandler) clockIn(ctx context.Context, args map[string]interface{}) (interface{}, error) {
	data, err := h.client.Post(ctx, "/api/v1/attendance/clock-in", args)
	if err != nil {
		return apiErrorResult(err.Error()), nil
	}

	var record interface{}
	if err := parseAPIResponse(data, &record); err != nil {
		return apiErrorResult(err.Error()), nil
	}

	return apiSuccessResult("Clocked in successfully", record), nil
}

func (h *APIToolHandler) clockOut(ctx context.Context, args map[string]interface{}) (interface{}, error) {
	data, err := h.client.Post(ctx, "/api/v1/attendance/clock-out", args)
	if err != nil {
		return apiErrorResult(err.Error()), nil
	}

	var record interface{}
	if err := parseAPIResponse(data, &record); err != nil {
		return apiErrorResult(err.Error()), nil
	}

	return apiSuccessResult("Clocked out successfully", record), nil
}

func (h *APIToolHandler) getAttendanceReport(ctx context.Context, args map[string]interface{}) (interface{}, error) {
	params := make(map[string]string)
	if date, ok := args["date"].(string); ok {
		params["date"] = date
	}
	if employeeID, ok := args["employee_id"].(string); ok {
		params["employee_id"] = employeeID
	}

	data, err := h.client.Get(ctx, "/api/v1/attendance/daily", params)
	if err != nil {
		return apiErrorResult(err.Error()), nil
	}

	var report interface{}
	if err := parseAPIResponse(data, &report); err != nil {
		return apiErrorResult(err.Error()), nil
	}

	return apiSuccessResult("Attendance report retrieved successfully", report), nil
}

// Department tools
func (h *APIToolHandler) listDepartments(ctx context.Context, args map[string]interface{}) (interface{}, error) {
	data, err := h.client.Get(ctx, "/api/v1/departments", nil)
	if err != nil {
		return apiErrorResult(err.Error()), nil
	}

	var departments []interface{}
	if err := parseAPIResponse(data, &departments); err != nil {
		return apiErrorResult(err.Error()), nil
	}

	return apiSuccessResult(fmt.Sprintf("Found %d departments", len(departments)), departments), nil
}

func (h *APIToolHandler) createDepartment(ctx context.Context, args map[string]interface{}) (interface{}, error) {
	data, err := h.client.Post(ctx, "/api/v1/departments", args)
	if err != nil {
		return apiErrorResult(err.Error()), nil
	}

	var department interface{}
	if err := parseAPIResponse(data, &department); err != nil {
		return apiErrorResult(err.Error()), nil
	}

	return apiSuccessResult("Department created successfully", department), nil
}

// Task tools
func (h *APIToolHandler) listTasks(ctx context.Context, args map[string]interface{}) (interface{}, error) {
	params := make(map[string]string)
	if listID, ok := args["list_id"].(string); ok {
		params["list_id"] = listID
	}
	if status, ok := args["status"].(string); ok {
		params["status"] = status
	}
	if assigneeID, ok := args["assignee_id"].(string); ok {
		params["assignee_id"] = assigneeID
	}

	data, err := h.client.Get(ctx, "/api/v1/tasks", params)
	if err != nil {
		return apiErrorResult(err.Error()), nil
	}

	var tasks []interface{}
	if err := parseAPIResponse(data, &tasks); err != nil {
		return apiErrorResult(err.Error()), nil
	}

	return apiSuccessResult(fmt.Sprintf("Found %d tasks", len(tasks)), tasks), nil
}

func (h *APIToolHandler) getTask(ctx context.Context, args map[string]interface{}) (interface{}, error) {
	taskID, ok := args["task_id"].(string)
	if !ok {
		return apiErrorResult("task_id is required"), nil
	}

	data, err := h.client.Get(ctx, "/api/v1/tasks/"+taskID, nil)
	if err != nil {
		return apiErrorResult(err.Error()), nil
	}

	var task interface{}
	if err := parseAPIResponse(data, &task); err != nil {
		return apiErrorResult(err.Error()), nil
	}

	return apiSuccessResult("Task retrieved successfully", task), nil
}

func (h *APIToolHandler) createTask(ctx context.Context, args map[string]interface{}) (interface{}, error) {
	// Convert markdown description to HTML if present
	if desc, ok := args["description"].(string); ok && desc != "" {
		args["description"] = markdownToHTML(desc)
	}

	data, err := h.client.Post(ctx, "/api/v1/tasks", args)
	if err != nil {
		return apiErrorResult(err.Error()), nil
	}

	var task interface{}
	if err := parseAPIResponse(data, &task); err != nil {
		return apiErrorResult(err.Error()), nil
	}

	return apiSuccessResult("Task created successfully", task), nil
}

func (h *APIToolHandler) updateTask(ctx context.Context, args map[string]interface{}) (interface{}, error) {
	taskID, ok := args["task_id"].(string)
	if !ok {
		return apiErrorResult("task_id is required"), nil
	}

	updates := make(map[string]interface{})
	for k, v := range args {
		if k != "task_id" && k != "organisation_id" {
			updates[k] = v
		}
	}

	// Convert markdown description to HTML if present
	if desc, ok := updates["description"].(string); ok && desc != "" {
		updates["description"] = markdownToHTML(desc)
	}

	data, err := h.client.Put(ctx, "/api/v1/tasks/"+taskID, updates)
	if err != nil {
		return apiErrorResult(err.Error()), nil
	}

	var task interface{}
	if err := parseAPIResponse(data, &task); err != nil {
		return apiErrorResult(err.Error()), nil
	}

	return apiSuccessResult("Task updated successfully", task), nil
}

func (h *APIToolHandler) moveTask(ctx context.Context, args map[string]interface{}) (interface{}, error) {
	taskID, ok := args["task_id"].(string)
	if !ok {
		return apiErrorResult("task_id is required"), nil
	}

	moveData := make(map[string]interface{})
	if listID, ok := args["task_list_id"]; ok {
		moveData["task_list_id"] = listID
	}
	if position, ok := args["position"]; ok {
		moveData["position"] = position
	}

	data, err := h.client.Put(ctx, "/api/v1/tasks/"+taskID+"/move", moveData)
	if err != nil {
		return apiErrorResult(err.Error()), nil
	}

	var task interface{}
	if err := parseAPIResponse(data, &task); err != nil {
		return apiErrorResult(err.Error()), nil
	}

	return apiSuccessResult("Task moved successfully", task), nil
}

func (h *APIToolHandler) toggleTaskCompletion(ctx context.Context, args map[string]interface{}) (interface{}, error) {
	taskID, ok := args["task_id"].(string)
	if !ok {
		return apiErrorResult("task_id is required"), nil
	}

	data, err := h.client.Put(ctx, "/api/v1/tasks/"+taskID+"/toggle", nil)
	if err != nil {
		return apiErrorResult(err.Error()), nil
	}

	var task interface{}
	if err := parseAPIResponse(data, &task); err != nil {
		return apiErrorResult(err.Error()), nil
	}

	return apiSuccessResult("Task completion toggled successfully", task), nil
}

func (h *APIToolHandler) deleteTask(ctx context.Context, args map[string]interface{}) (interface{}, error) {
	taskID, ok := args["task_id"].(string)
	if !ok {
		return apiErrorResult("task_id is required"), nil
	}

	_, err := h.client.Delete(ctx, "/api/v1/tasks/"+taskID)
	if err != nil {
		return apiErrorResult(err.Error()), nil
	}

	return apiSuccessResult("Task deleted successfully", map[string]interface{}{"task_id": taskID}), nil
}

func (h *APIToolHandler) listTaskLists(ctx context.Context, args map[string]interface{}) (interface{}, error) {
	data, err := h.client.Get(ctx, "/api/v1/tasks/lists", nil)
	if err != nil {
		return apiErrorResult(err.Error()), nil
	}

	var lists []interface{}
	if err := parseAPIResponse(data, &lists); err != nil {
		return apiErrorResult(err.Error()), nil
	}

	return apiSuccessResult(fmt.Sprintf("Found %d task lists", len(lists)), lists), nil
}

func (h *APIToolHandler) createTaskList(ctx context.Context, args map[string]interface{}) (interface{}, error) {
	data, err := h.client.Post(ctx, "/api/v1/tasks/lists", args)
	if err != nil {
		return apiErrorResult(err.Error()), nil
	}

	var list interface{}
	if err := parseAPIResponse(data, &list); err != nil {
		return apiErrorResult(err.Error()), nil
	}

	return apiSuccessResult("Task list created successfully", list), nil
}

func (h *APIToolHandler) updateTaskList(ctx context.Context, args map[string]interface{}) (interface{}, error) {
	taskListID, ok := args["task_list_id"].(string)
	if !ok || taskListID == "" {
		return apiErrorResult("task_list_id is required"), nil
	}

	// Remove task_list_id from args since it's in the URL
	updateArgs := make(map[string]interface{})
	for k, v := range args {
		if k != "task_list_id" {
			updateArgs[k] = v
		}
	}

	data, err := h.client.Put(ctx, "/api/v1/tasks/lists/"+taskListID, updateArgs)
	if err != nil {
		return apiErrorResult(err.Error()), nil
	}

	var list interface{}
	if err := parseAPIResponse(data, &list); err != nil {
		return apiErrorResult(err.Error()), nil
	}

	return apiSuccessResult("Task list updated successfully", list), nil
}

func (h *APIToolHandler) deleteTaskList(ctx context.Context, args map[string]interface{}) (interface{}, error) {
	taskListID, ok := args["task_list_id"].(string)
	if !ok || taskListID == "" {
		return apiErrorResult("task_list_id is required"), nil
	}

	// Build query params for move_tasks_to if provided
	params := make(map[string]string)
	if moveTasksTo, ok := args["move_tasks_to"].(string); ok && moveTasksTo != "" {
		params["move_tasks_to"] = moveTasksTo
	}

	_, err := h.client.Delete(ctx, "/api/v1/tasks/lists/"+taskListID, params)
	if err != nil {
		return apiErrorResult(err.Error()), nil
	}

	return apiSuccessResult("Task list deleted successfully", map[string]interface{}{"task_list_id": taskListID}), nil
}

func (h *APIToolHandler) listTaskComments(ctx context.Context, args map[string]interface{}) (interface{}, error) {
	taskID, ok := args["task_id"].(string)
	if !ok {
		return apiErrorResult("task_id is required"), nil
	}

	data, err := h.client.Get(ctx, "/api/v1/tasks/"+taskID+"/comments", nil)
	if err != nil {
		return apiErrorResult(err.Error()), nil
	}

	var comments []interface{}
	if err := parseAPIResponse(data, &comments); err != nil {
		return apiErrorResult(err.Error()), nil
	}

	return apiSuccessResult(fmt.Sprintf("Found %d comments", len(comments)), comments), nil
}

func (h *APIToolHandler) createTaskComment(ctx context.Context, args map[string]interface{}) (interface{}, error) {
	taskID, ok := args["task_id"].(string)
	if !ok {
		return apiErrorResult("task_id is required"), nil
	}

	// Prepare comment data - API expects "body" and "content_type"
	commentData := make(map[string]interface{})
	if body, ok := args["body"]; ok {
		// Convert markdown to HTML
		if bodyStr, ok := body.(string); ok && bodyStr != "" {
			commentData["body"] = markdownToHTML(bodyStr)
		} else {
			commentData["body"] = body
		}
	}
	if contentType, ok := args["content_type"]; ok {
		commentData["content_type"] = contentType
	}
	if parentID, ok := args["parent_id"]; ok {
		commentData["parent_id"] = parentID
	}

	data, err := h.client.Post(ctx, "/api/v1/tasks/"+taskID+"/comments", commentData)
	if err != nil {
		return apiErrorResult(err.Error()), nil
	}

	var comment interface{}
	if err := parseAPIResponse(data, &comment); err != nil {
		return apiErrorResult(err.Error()), nil
	}

	return apiSuccessResult("Comment created successfully", comment), nil
}

func (h *APIToolHandler) deleteTaskComment(ctx context.Context, args map[string]interface{}) (interface{}, error) {
	taskID, ok := args["task_id"].(string)
	if !ok {
		return apiErrorResult("task_id is required"), nil
	}
	commentID, ok := args["comment_id"].(string)
	if !ok {
		return apiErrorResult("comment_id is required"), nil
	}

	_, err := h.client.Delete(ctx, "/api/v1/tasks/"+taskID+"/comments/"+commentID)
	if err != nil {
		return apiErrorResult(err.Error()), nil
	}

	return apiSuccessResult("Comment deleted successfully", map[string]interface{}{"comment_id": commentID}), nil
}

// Dashboard
func (h *APIToolHandler) getDashboardStats(ctx context.Context, args map[string]interface{}) (interface{}, error) {
	data, err := h.client.Get(ctx, "/api/v1/dashboard/stats", nil)
	if err != nil {
		return apiErrorResult(err.Error()), nil
	}

	var stats interface{}
	if err := parseAPIResponse(data, &stats); err != nil {
		return apiErrorResult(err.Error()), nil
	}

	return apiSuccessResult("Dashboard stats retrieved successfully", stats), nil
}

// Helper functions to format MCP responses
func apiSuccessResult(message string, data interface{}) ToolResult {
	dataJSON, _ := json.MarshalIndent(data, "", "  ")
	return ToolResult{
		Content: []Content{
			{
				Type: "text",
				Text: fmt.Sprintf("%s\n\n```json\n%s\n```", message, string(dataJSON)),
			},
		},
		IsError: false,
	}
}

func apiErrorResult(message string) ToolResult {
	return ToolResult{
		Content: []Content{
			{
				Type: "text",
				Text: fmt.Sprintf("❌ Error: %s", message),
			},
		},
		IsError: true,
	}
}
