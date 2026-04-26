package mcp

// GetAvailableTools returns all available MCP tools
func GetAvailableTools() []Tool {
	return []Tool{
		// Employee operations
		{
			Name:        "workived_list_employees",
			Description: "List all employees in an organisation with optional filtering by department, status, or search term",
			InputSchema: map[string]interface{}{
				"type": "object",
				"properties": map[string]interface{}{
					"department_id": map[string]interface{}{
						"type":        "string",
						"description": "Filter by department UUID (optional)",
					},
					"status": map[string]interface{}{
						"type":        "string",
						"enum":        []string{"active", "inactive", "all"},
						"description": "Filter by employee status (default: active)",
					},
					"search": map[string]interface{}{
						"type":        "string",
						"description": "Search by name or email (optional)",
					},
				},
				"required": []string{},
			},
		},
		{
			Name:        "workived_get_employee",
			Description: "Get detailed information about a specific employee",
			InputSchema: map[string]interface{}{
				"type": "object",
				"properties": map[string]interface{}{
					"employee_id": map[string]interface{}{
						"type":        "string",
						"description": "Employee UUID",
					},
				},
				"required": []string{"employee_id"},
			},
		},
		{
			Name:        "workived_create_employee",
			Description: "Create a new employee record",
			InputSchema: map[string]interface{}{
				"type": "object",
				"properties": map[string]interface{}{
					"first_name": map[string]interface{}{
						"type":        "string",
						"description": "Employee first name",
					},
					"last_name": map[string]interface{}{
						"type":        "string",
						"description": "Employee last name",
					},
					"email": map[string]interface{}{
						"type":        "string",
						"description": "Employee email address",
					},
					"department_id": map[string]interface{}{
						"type":        "string",
						"description": "Department UUID",
					},
					"job_title_id": map[string]interface{}{
						"type":        "string",
						"description": "Job title UUID",
					},
					"hire_date": map[string]interface{}{
						"type":        "string",
						"description": "Hire date (YYYY-MM-DD format)",
					},
				},
				"required": []string{"first_name", "last_name", "email", "hire_date"},
			},
		},

		// Leave operations
		{
			Name:        "workived_list_leave_requests",
			Description: "List leave requests with optional filtering by status, employee, or date range",
			InputSchema: map[string]interface{}{
				"type": "object",
				"properties": map[string]interface{}{
					"employee_id": map[string]interface{}{
						"type":        "string",
						"description": "Filter by employee UUID (optional)",
					},
					"status": map[string]interface{}{
						"type":        "string",
						"enum":        []string{"pending", "approved", "rejected", "cancelled", "all"},
						"description": "Filter by request status (optional)",
					},
					"from_date": map[string]interface{}{
						"type":        "string",
						"description": "Start date for filtering (YYYY-MM-DD, optional)",
					},
					"to_date": map[string]interface{}{
						"type":        "string",
						"description": "End date for filtering (YYYY-MM-DD, optional)",
					},
				},
				"required": []string{},
			},
		},
		{
			Name:        "workived_get_leave_balances",
			Description: "Get leave balances for an employee",
			InputSchema: map[string]interface{}{
				"type": "object",
				"properties": map[string]interface{}{
					"employee_id": map[string]interface{}{
						"type":        "string",
						"description": "Employee UUID",
					},
				},
				"required": []string{"employee_id"},
			},
		},
		{
			Name:        "workived_submit_leave_request",
			Description: "Submit a new leave request for an employee",
			InputSchema: map[string]interface{}{
				"type": "object",
				"properties": map[string]interface{}{
					"employee_id": map[string]interface{}{
						"type":        "string",
						"description": "Employee UUID",
					},
					"policy_id": map[string]interface{}{
						"type":        "string",
						"description": "Leave policy UUID",
					},
					"start_date": map[string]interface{}{
						"type":        "string",
						"description": "Leave start date (YYYY-MM-DD)",
					},
					"end_date": map[string]interface{}{
						"type":        "string",
						"description": "Leave end date (YYYY-MM-DD)",
					},
					"reason": map[string]interface{}{
						"type":        "string",
						"description": "Reason for leave",
					},
				},
				"required": []string{"employee_id", "policy_id", "start_date", "end_date"},
			},
		},
		{
			Name:        "workived_approve_leave_request",
			Description: "Approve a pending leave request",
			InputSchema: map[string]interface{}{
				"type": "object",
				"properties": map[string]interface{}{
					"request_id": map[string]interface{}{
						"type":        "string",
						"description": "Leave request UUID",
					},
					"approver_id": map[string]interface{}{
						"type":        "string",
						"description": "Employee UUID of the approver",
					},
					"notes": map[string]interface{}{
						"type":        "string",
						"description": "Optional approval notes",
					},
				},
				"required": []string{"request_id", "approver_id"},
			},
		},

		// Attendance operations
		{
			Name:        "workived_clock_in",
			Description: "Clock in for an employee (start work shift)",
			InputSchema: map[string]interface{}{
				"type": "object",
				"properties": map[string]interface{}{
					"employee_id": map[string]interface{}{
						"type":        "string",
						"description": "Employee UUID",
					},
					"latitude": map[string]interface{}{
						"type":        "number",
						"description": "GPS latitude (optional, if geolocation enabled)",
					},
					"longitude": map[string]interface{}{
						"type":        "number",
						"description": "GPS longitude (optional, if geolocation enabled)",
					},
					"notes": map[string]interface{}{
						"type":        "string",
						"description": "Optional notes",
					},
				},
				"required": []string{"employee_id"},
			},
		},
		{
			Name:        "workived_clock_out",
			Description: "Clock out for an employee (end work shift)",
			InputSchema: map[string]interface{}{
				"type": "object",
				"properties": map[string]interface{}{
					"employee_id": map[string]interface{}{
						"type":        "string",
						"description": "Employee UUID",
					},
					"latitude": map[string]interface{}{
						"type":        "number",
						"description": "GPS latitude (optional, if geolocation enabled)",
					},
					"longitude": map[string]interface{}{
						"type":        "number",
						"description": "GPS longitude (optional, if geolocation enabled)",
					},
					"notes": map[string]interface{}{
						"type":        "string",
						"description": "Optional notes",
					},
				},
				"required": []string{"employee_id"},
			},
		},
		{
			Name:        "workived_get_attendance_report",
			Description: "Get attendance report for a specific date or date range",
			InputSchema: map[string]interface{}{
				"type": "object",
				"properties": map[string]interface{}{
					"date": map[string]interface{}{
						"type":        "string",
						"description": "Date for report (YYYY-MM-DD)",
					},
					"employee_id": map[string]interface{}{
						"type":        "string",
						"description": "Filter by specific employee (optional)",
					},
				},
				"required": []string{"date"},
			},
		},

		// Department operations
		{
			Name:        "workived_list_departments",
			Description: "List all departments in an organisation",
			InputSchema: map[string]interface{}{
				"type":       "object",
				"properties": map[string]interface{}{},
				"required":   []string{},
			},
		},

		// Dashboard/Analytics
		{
			Name:        "workived_get_dashboard_stats",
			Description: "Get dashboard statistics for an organisation including employee count, leave requests, attendance summary",
			InputSchema: map[string]interface{}{
				"type":       "object",
				"properties": map[string]interface{}{},
				"required":   []string{},
			},
		},

		// Task Management - Task Lists
		{
			Name:        "workived_list_task_lists",
			Description: "List all task lists (columns/statuses) in an organisation",
			InputSchema: map[string]interface{}{
				"type":       "object",
				"properties": map[string]interface{}{},
				"required":   []string{},
			},
		},
		{
			Name:        "workived_create_task_list",
			Description: "Create a new task list (column/status)",
			InputSchema: map[string]interface{}{
				"type": "object",
				"properties": map[string]interface{}{
					"name": map[string]interface{}{
						"type":        "string",
						"description": "Name of the task list (e.g., 'To Do', 'In Progress', 'Done')",
					},
					"is_final_state": map[string]interface{}{
						"type":        "boolean",
						"description": "Whether tasks moved to this list are automatically marked complete (optional)",
					},
				},
				"required": []string{"name"},
			},
		},

		// Task Management - Tasks
		{
			Name:        "workived_list_tasks",
			Description: "List tasks with optional filtering by list, assignee, priority, status, or search term",
			InputSchema: map[string]interface{}{
				"type": "object",
				"properties": map[string]interface{}{
					"task_list_id": map[string]interface{}{
						"type":        "string",
						"description": "Filter by task list UUID (optional)",
					},
					"assignee_id": map[string]interface{}{
						"type":        "string",
						"description": "Filter by assignee employee UUID (optional)",
					},
					"priority": map[string]interface{}{
						"type":        "string",
						"enum":        []string{"low", "medium", "high", "urgent"},
						"description": "Filter by priority (optional)",
					},
					"status": map[string]interface{}{
						"type":        "string",
						"enum":        []string{"pending", "completed"},
						"description": "Filter by completion status (optional)",
					},
					"search": map[string]interface{}{
						"type":        "string",
						"description": "Search in task titles and codes (optional)",
					},
					"include_completed": map[string]interface{}{
						"type":        "boolean",
						"description": "Include completed tasks older than 7 days (default: false)",
					},
				},
				"required": []string{},
			},
		},
		{
			Name:        "workived_get_task",
			Description: "Get detailed information about a specific task",
			InputSchema: map[string]interface{}{
				"type": "object",
				"properties": map[string]interface{}{
					"task_id": map[string]interface{}{
						"type":        "string",
						"description": "Task UUID",
					},
				},
				"required": []string{"task_id"},
			},
		},
		{
			Name:        "workived_create_task",
			Description: "Create a new task",
			InputSchema: map[string]interface{}{
				"type": "object",
				"properties": map[string]interface{}{
					"creator_id": map[string]interface{}{
						"type":        "string",
						"description": "Employee UUID of the task creator",
					},
					"task_list_id": map[string]interface{}{
						"type":        "string",
						"description": "Task list UUID where the task will be created",
					},
					"title": map[string]interface{}{
						"type":        "string",
						"description": "Task title",
					},
					"description": map[string]interface{}{
						"type":        "string",
						"description": "Task description (supports HTML formatting)",
					},
					"assignee_id": map[string]interface{}{
						"type":        "string",
						"description": "Assignee employee UUID (optional)",
					},
					"priority": map[string]interface{}{
						"type":        "string",
						"enum":        []string{"low", "medium", "high", "urgent"},
						"description": "Task priority (default: medium)",
					},
					"due_date": map[string]interface{}{
						"type":        "string",
						"description": "Due date (YYYY-MM-DD format, optional)",
					},
				},
				"required": []string{"creator_id", "task_list_id", "title"},
			},
		},
		{
			Name:        "workived_update_task",
			Description: "Update an existing task",
			InputSchema: map[string]interface{}{
				"type": "object",
				"properties": map[string]interface{}{
					"task_id": map[string]interface{}{
						"type":        "string",
						"description": "Task UUID",
					},
					"title": map[string]interface{}{
						"type":        "string",
						"description": "New task title (optional)",
					},
					"description": map[string]interface{}{
						"type":        "string",
						"description": "New task description (optional, supports HTML formatting)",
					},
					"assignee_id": map[string]interface{}{
						"type":        "string",
						"description": "New assignee employee UUID (optional)",
					},
					"priority": map[string]interface{}{
						"type":        "string",
						"enum":        []string{"low", "medium", "high", "urgent"},
						"description": "New priority (optional)",
					},
					"due_date": map[string]interface{}{
						"type":        "string",
						"description": "New due date (YYYY-MM-DD format, optional)",
					},
				},
				"required": []string{"task_id"},
			},
		},
		{
			Name:        "workived_move_task",
			Description: "Move a task to a different task list",
			InputSchema: map[string]interface{}{
				"type": "object",
				"properties": map[string]interface{}{
					"task_id": map[string]interface{}{
						"type":        "string",
						"description": "Task UUID",
					},
					"task_list_id": map[string]interface{}{
						"type":        "string",
						"description": "Target task list UUID",
					},
					"position": map[string]interface{}{
						"type":        "integer",
						"description": "Position in the new list (0-based, default: 0)",
					},
				},
				"required": []string{"task_id", "task_list_id"},
			},
		},
		{
			Name:        "workived_toggle_task_completion",
			Description: "Toggle a task's completion status (mark as complete or incomplete)",
			InputSchema: map[string]interface{}{
				"type": "object",
				"properties": map[string]interface{}{
					"task_id": map[string]interface{}{
						"type":        "string",
						"description": "Task UUID",
					},
				},
				"required": []string{"task_id"},
			},
		},
		{
			Name:        "workived_delete_task",
			Description: "Delete a task permanently",
			InputSchema: map[string]interface{}{
				"type": "object",
				"properties": map[string]interface{}{
					"task_id": map[string]interface{}{
						"type":        "string",
						"description": "Task UUID",
					},
				},
				"required": []string{"task_id"},
			},
		},

		// Task Management - Comments
		{
			Name:        "workived_list_task_comments",
			Description: "List all comments on a task (includes nested replies)",
			InputSchema: map[string]interface{}{
				"type": "object",
				"properties": map[string]interface{}{
					"task_id": map[string]interface{}{
						"type":        "string",
						"description": "Task UUID",
					},
				},
				"required": []string{"task_id"},
			},
		},
		{
			Name:        "workived_create_task_comment",
			Description: "Add a comment to a task (supports markdown)",
			InputSchema: map[string]interface{}{
				"type": "object",
				"properties": map[string]interface{}{
					"task_id": map[string]interface{}{
						"type":        "string",
						"description": "Task UUID",
					},
					"author_id": map[string]interface{}{
						"type":        "string",
						"description": "Author employee UUID",
					},
					"body": map[string]interface{}{
						"type":        "string",
						"description": "Comment text (supports HTML formatting)",
					},
					"parent_id": map[string]interface{}{
						"type":        "string",
						"description": "Parent comment UUID for nested replies (optional)",
					},
					"content_type": map[string]interface{}{
						"type":        "string",
						"enum":        []string{"plain", "markdown"},
						"description": "Content format (default: plain)",
					},
				},
				"required": []string{"task_id", "author_id", "body"},
			},
		},
		{
			Name:        "workived_delete_task_comment",
			Description: "Delete a comment from a task",
			InputSchema: map[string]interface{}{
				"type": "object",
				"properties": map[string]interface{}{
					"task_id": map[string]interface{}{
						"type":        "string",
						"description": "Task UUID",
					},
					"comment_id": map[string]interface{}{
						"type":        "string",
						"description": "Comment UUID",
					},
				},
				"required": []string{"task_id", "comment_id"},
			},
		},
	}
}
