package admin

import (
	"context"
	"fmt"
	"net/http"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/rs/zerolog"
	"github.com/workived/services/internal/integrations/linear"
	"github.com/workived/services/internal/platform/storage"
	"github.com/workived/services/internal/tasks"
	"github.com/workived/services/pkg/apperr"
)

// ImportHandler handles data import operations for staff admins
type ImportHandler struct {
	taskService tasks.ServiceInterface
	storage     *storage.Client
	db          *pgxpool.Pool
	log         zerolog.Logger
}

// NewImportHandler creates a new import handler
func NewImportHandler(
	taskService tasks.ServiceInterface,
	storage *storage.Client,
	db *pgxpool.Pool,
	log zerolog.Logger,
) *ImportHandler {
	return &ImportHandler{
		taskService: taskService,
		storage:     storage,
		db:          db,
		log:         log,
	}
}

// getLinearAPIKey retrieves the Linear API key from request or admin_config
func (h *ImportHandler) getLinearAPIKey(ctx context.Context, providedKey string) (string, error) {
	// If provided in request, use it
	if providedKey != "" {
		h.log.Debug().
			Int("key_length", len(providedKey)).
			Str("key_prefix", providedKey[:min(4, len(providedKey))]).
			Msg("using linear api key from request")
		return providedKey, nil
	}

	h.log.Debug().Msg("no api key provided in request, fetching from admin_config")

	// Otherwise, fetch from admin_config
	// Using #>>'{}' to extract JSONB string value as text (auto-unwraps quotes)
	var apiKey string
	err := h.db.QueryRow(ctx, `
		SELECT value#>>'{}'
		FROM admin_config
		WHERE key = 'linear_api_key'
	`).Scan(&apiKey)

	if err != nil {
		h.log.Error().Err(err).Msg("failed to query admin_config for linear_api_key")
		return "", fmt.Errorf("linear_api_key not provided and not found in admin_config: %w", err)
	}

	h.log.Debug().
		Int("raw_key_length", len(apiKey)).
		Bool("is_empty", apiKey == "").
		Msg("fetched linear api key from admin_config (raw)")

	// Trim any whitespace
	apiKey = strings.TrimSpace(apiKey)

	if apiKey == "" {
		h.log.Error().Msg("linear api key from admin_config is empty after trimming")
		return "", fmt.Errorf("linear_api_key in admin_config is empty")
	}

	h.log.Debug().
		Int("final_key_length", len(apiKey)).
		Str("final_key_prefix", apiKey[:min(4, len(apiKey))]).
		Msg("using linear_api_key from admin_config")

	return apiKey, nil
}

func min(a, b int) int {
	if a < b {
		return a
	}
	return b
}

// ImportLinearTasksRequest represents the request to import Linear tasks
type ImportLinearTasksRequest struct {
	OrganisationID  uuid.UUID         `json:"organisation_id" binding:"required"`
	ActorUserID     uuid.UUID         `json:"actor_user_id"`     // Optional - will find org admin if not provided
	ActorEmployeeID *uuid.UUID        `json:"actor_employee_id"` // Optional - deprecated, use actor_user_id
	LinearAPIKey    string            `json:"linear_api_key"`    // Optional - will use admin_config if not provided
	TeamID          *string           `json:"team_id"`
	ProjectID       *string           `json:"project_id"`
	StateFilter     []string          `json:"state_filter"`
	AssigneeFilter  *string           `json:"assignee_filter"`
	DateFrom        *time.Time        `json:"date_from"`
	DateTo          *time.Time        `json:"date_to"`
	TargetListID    *uuid.UUID        `json:"target_list_id"` // Optional if using state_mappings
	StateMappings   map[string]string `json:"state_mappings"` // Linear State ID -> Workived Task List UUID
	ActorMappings   map[string]string `json:"actor_mappings"` // Linear User Email -> Workived Employee UUID
	DryRun          bool              `json:"dry_run"`
	TestMode        bool              `json:"test_mode"` // If true, import only 1 task and 1 comment for testing
	IncludeComments bool              `json:"include_comments"`
}

// ImportLinearTasks imports tasks from Linear to Workived
// This is a long-running operation that can take several minutes for large imports.
// The staff server is configured with extended timeouts (10 minutes) to accommodate:
// - Fetching paginated issues from Linear
// - Downloading and uploading images (with retry logic)
// - Creating tasks and comments in Workived
func (h *ImportHandler) ImportLinearTasks(c *gin.Context) {
	var req ImportLinearTasksRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, apperr.Response(apperr.New(apperr.CodeValidation, err.Error())))
		return
	}

	// Validate: must have either target_list_id or state_mappings
	if req.TargetListID == nil && len(req.StateMappings) == 0 {
		c.JSON(http.StatusBadRequest, apperr.Response(apperr.New(apperr.CodeValidation, "Either target_list_id or state_mappings is required")))
		return
	}

	// Find an active admin/owner in the target organisation to use as the actor
	// Staff admins performing imports are not members of customer organisations,
	// so we need to use an actual organisation member
	var actorUserID uuid.UUID
	var actorEmployeeID uuid.UUID
	err := h.db.QueryRow(c.Request.Context(), `
		SELECT user_id, employee_id 
		FROM organisation_members 
		WHERE organisation_id = $1 
		  AND is_active = TRUE 
		  AND role IN ('owner', 'admin')
		  AND employee_id IS NOT NULL
		ORDER BY 
		  CASE role 
		    WHEN 'owner' THEN 1 
		    WHEN 'admin' THEN 2 
		    ELSE 3 
		  END,
		  created_at ASC
		LIMIT 1
	`, req.OrganisationID).Scan(&actorUserID, &actorEmployeeID)

	if err != nil {
		h.log.Error().Err(err).
			Str("org_id", req.OrganisationID.String()).
			Msg("failed to find active admin/owner in organisation for task import")
		c.JSON(http.StatusBadRequest, apperr.Response(apperr.New(apperr.CodeValidation, "No active admin or owner found in organisation")))
		return
	}

	h.log.Debug().
		Str("actor_user_id", actorUserID.String()).
		Str("actor_employee_id", actorEmployeeID.String()).
		Msg("found active admin/owner in organisation to use as import actor")

	// Get Linear API key from request or admin_config
	linearAPIKey, err := h.getLinearAPIKey(c.Request.Context(), req.LinearAPIKey)
	if err != nil {
		h.log.Error().Err(err).Msg("failed to get linear api key")
		c.JSON(http.StatusBadRequest, apperr.Response(apperr.New(apperr.CodeValidation, "Linear API key is required. Please save it in admin config or provide it in the request.")))
		return
	}

	if linearAPIKey == "" {
		h.log.Error().Msg("linear api key is empty after retrieval")
		c.JSON(http.StatusBadRequest, apperr.Response(apperr.New(apperr.CodeValidation, "Linear API key is empty")))
		return
	}

	h.log.Info().
		Str("org_id", req.OrganisationID.String()).
		Str("actor_user_id", actorUserID.String()).
		Str("actor_employee_id", actorEmployeeID.String()).
		Int("api_key_length", len(linearAPIKey)).
		Str("api_key_prefix", linearAPIKey[:min(4, len(linearAPIKey))]).
		Bool("dry_run", req.DryRun).
		Bool("use_state_mappings", len(req.StateMappings) > 0).
		Bool("api_key_from_config", req.LinearAPIKey == "").
		Msg("starting linear task import")

	// Create Linear client
	linearClient := linear.NewClient(linear.Config{
		APIKey: linearAPIKey,
	})

	// Create migration service
	migrationService := linear.NewMigrationService(
		linearClient,
		h.taskService,
		h.log,
	)

	// If using state mappings, import with state-based routing
	if len(req.StateMappings) > 0 {
		h.importWithStateMappings(c, req, migrationService, actorEmployeeID, actorUserID, linearAPIKey)
		return
	}

	// Legacy single-list import
	h.importToSingleList(c, req, migrationService, actorEmployeeID, actorUserID)
}

// importToSingleList imports all tasks to a single target list (legacy method)
func (h *ImportHandler) importToSingleList(c *gin.Context, req ImportLinearTasksRequest, migrationService *linear.MigrationService, actorEmployeeID uuid.UUID, actorUserID uuid.UUID) {
	if req.TargetListID == nil {
		c.JSON(http.StatusBadRequest, apperr.Response(apperr.New(apperr.CodeValidation, "target_list_id is required")))
		return
	}

	// Parse actor mappings
	actorMappings := make(map[string]uuid.UUID)
	for email, employeeUUIDStr := range req.ActorMappings {
		employeeUUID, err := uuid.Parse(employeeUUIDStr)
		if err != nil {
			h.log.Warn().
				Str("email", email).
				Str("uuid", employeeUUIDStr).
				Msg("invalid employee UUID in actor mapping, skipping")
			continue
		}
		actorMappings[email] = employeeUUID
	}

	// Execute migration
	result, err := migrationService.Migrate(c.Request.Context(), linear.MigrationParams{
		OrgID:           req.OrganisationID,
		ActorUserID:     actorUserID,
		ActorEmployeeID: actorEmployeeID,
		LinearAPIKey:    req.LinearAPIKey,
		TeamID:          req.TeamID,
		ProjectID:       req.ProjectID,
		StateFilter:     req.StateFilter,
		AssigneeFilter:  req.AssigneeFilter,
		DateFrom:        req.DateFrom,
		DateTo:          req.DateTo,
		DryRun:          req.DryRun,
		TestMode:        req.TestMode,
		IncludeComments: req.IncludeComments,
		TargetListID:    *req.TargetListID,
		ActorMappings:   actorMappings,
	})

	if err != nil {
		h.log.Error().
			Err(err).
			Str("org_id", req.OrganisationID.String()).
			Msg("linear import failed")
		c.JSON(http.StatusInternalServerError, apperr.Response(apperr.New(apperr.CodeInternal, "Failed to import tasks from Linear")))
		return
	}

	h.log.Info().
		Str("org_id", req.OrganisationID.String()).
		Int("total", result.TotalIssues).
		Int("successful", result.SuccessfulTasks).
		Int("failed", result.FailedTasks).
		Msg("linear import completed")

	c.JSON(http.StatusOK, gin.H{"data": result})
}

// importWithStateMappings imports tasks with state-to-list mappings
// Tasks are routed to different lists based on their Linear workflow state
func (h *ImportHandler) importWithStateMappings(c *gin.Context, req ImportLinearTasksRequest, migrationService *linear.MigrationService, actorEmployeeID uuid.UUID, actorUserID uuid.UUID, linearAPIKey string) {
	// Parse state mappings to UUIDs
	stateMappings := make(map[string]uuid.UUID)
	for stateID, listIDStr := range req.StateMappings {
		listID, err := uuid.Parse(listIDStr)
		if err != nil {
			c.JSON(http.StatusBadRequest, apperr.Response(apperr.New(apperr.CodeValidation, "Invalid task list UUID for state "+stateID)))
			return
		}
		stateMappings[stateID] = listID
	}

	// Parse actor mappings to UUIDs (Linear email -> Workived employee UUID)
	actorMappings := make(map[string]uuid.UUID)
	for email, employeeUUIDStr := range req.ActorMappings {
		employeeUUID, err := uuid.Parse(employeeUUIDStr)
		if err != nil {
			h.log.Warn().
				Str("email", email).
				Str("uuid", employeeUUIDStr).
				Msg("invalid employee UUID in actor mapping, skipping")
			continue
		}
		actorMappings[email] = employeeUUID
	}

	// Build employee_id -> user_id mapping for comment authors
	// This ensures comments are created with the correct user_id
	userIDMapping := make(map[uuid.UUID]uuid.UUID)
	for _, employeeID := range actorMappings {
		var userID uuid.UUID
		err := h.db.QueryRow(c.Request.Context(), `
			SELECT user_id 
			FROM organisation_members 
			WHERE organisation_id = $1 AND employee_id = $2 AND is_active = TRUE
			LIMIT 1
		`, req.OrganisationID, employeeID).Scan(&userID)

		if err == nil {
			userIDMapping[employeeID] = userID
			h.log.Debug().
				Str("employee_id", employeeID.String()).
				Str("user_id", userID.String()).
				Msg("mapped employee to user for comments")
		} else {
			h.log.Warn().
				Err(err).
				Str("employee_id", employeeID.String()).
				Msg("failed to find user for employee - comments from this user will use fallback")
		}
	}

	h.log.Info().
		Int("state_mappings", len(stateMappings)).
		Int("actor_mappings", len(actorMappings)).
		Int("user_id_mappings", len(userIDMapping)).
		Bool("dry_run", req.DryRun).
		Bool("include_comments", req.IncludeComments).
		Msg("starting linear import with state mappings")

	// Fetch all issues first
	linearClient := linear.NewClient(linear.Config{
		APIKey: linearAPIKey,
	})

	params := linear.FetchIssuesParams{
		TeamID:          req.TeamID,
		ProjectID:       req.ProjectID,
		StateFilter:     req.StateFilter,
		AssigneeFilter:  req.AssigneeFilter,
		DateFrom:        req.DateFrom,
		IncludeComments: req.IncludeComments,
		Limit:           50,
	}

	totalResult := &linear.MigrationResult{
		DryRun: req.DryRun,
	}

	// Group issues by state
	issuesByState := make(map[string][]linear.Issue)
	cursor := (*string)(nil)
	pageCount := 0
	totalFetched := 0

	h.log.Info().
		Bool("include_comments", req.IncludeComments).
		Msg("fetching issues from Linear...")

	for {
		pageCount++
		params.Cursor = cursor
		resp, err := linearClient.FetchIssues(c.Request.Context(), params)
		if err != nil {
			h.log.Error().Err(err).Msg("failed to fetch issues")
			c.JSON(http.StatusInternalServerError, apperr.Response(apperr.New(apperr.CodeInternal, "Failed to fetch Linear issues")))
			return
		}

		fetchedInPage := len(resp.Issues.Nodes)
		totalFetched += fetchedInPage

		h.log.Info().
			Int("page", pageCount).
			Int("issues_in_page", fetchedInPage).
			Int("total_fetched", totalFetched).
			Bool("has_next_page", resp.Issues.PageInfo.HasNextPage).
			Msg("fetched page from Linear")

		// Group by state ID
		for _, issue := range resp.Issues.Nodes {
			issuesByState[issue.State.ID] = append(issuesByState[issue.State.ID], issue)
		}

		if !resp.Issues.PageInfo.HasNextPage {
			break
		}
		cursor = &resp.Issues.PageInfo.EndCursor
	}

	// Count issues with comments for logging
	issuesWithComments := 0
	issuesWithAttachments := 0
	for _, issues := range issuesByState {
		for _, issue := range issues {
			if len(issue.Comments.Nodes) > 0 {
				issuesWithComments++
			}
			if len(issue.Attachments.Nodes) > 0 {
				issuesWithAttachments++
			}
		}
	}

	h.log.Info().
		Int("total_issues", totalFetched).
		Int("unique_states", len(issuesByState)).
		Int("issues_with_comments", issuesWithComments).
		Int("issues_with_attachments", issuesWithAttachments).
		Msg("completed fetching all issues from Linear")

	// If dry run, generate preview and return early
	if req.DryRun {
		preview := h.generateImportPreview(issuesByState, stateMappings, actorMappings, issuesWithComments, issuesWithAttachments)
		h.log.Info().
			Int("total_issues", preview.TotalIssues).
			Int("total_comments", preview.TotalComments).
			Int("total_images", preview.TotalImages).
			Msg("dry run preview generated")
		c.JSON(http.StatusOK, gin.H{"data": preview})
		return
	}

	// Import issues for each state to its mapped list
	stateNum := 0
	for stateID, targetListID := range stateMappings {
		stateNum++
		issues := issuesByState[stateID]
		if len(issues) == 0 {
			h.log.Info().
				Str("state_id", stateID).
				Int("state_num", stateNum).
				Int("total_states", len(stateMappings)).
				Msg("no issues in this state, skipping")
			continue
		}

		h.log.Info().
			Str("state_id", stateID).
			Str("target_list_id", targetListID.String()).
			Int("issue_count", len(issues)).
			Int("state_num", stateNum).
			Int("total_states", len(stateMappings)).
			Msg("========== BEGIN: Processing state ==========")

		// Migrate each issue to the target list
		for idx, issue := range issues {
			// Find assignee employee ID from actor mappings
			assigneeID := actorEmployeeID
			assigneeMapped := false
			assigneeEmail := "<unassigned>"
			if issue.Assignee != nil && issue.Assignee.Email != "" {
				assigneeEmail = issue.Assignee.Email
				if mappedID, ok := actorMappings[issue.Assignee.Email]; ok {
					assigneeID = mappedID
					assigneeMapped = true
				}
			}

			h.log.Info().
				Int("issue_num", idx+1).
				Int("total_in_state", len(issues)).
				Str("issue_id", issue.Identifier).
				Str("title", issue.Title).
				Str("assignee_email", assigneeEmail).
				Bool("assignee_mapped", assigneeMapped).
				Msg("processing issue")

			if req.DryRun {
				h.log.Info().
					Str("issue_id", issue.Identifier).
					Str("title", issue.Title).
					Str("target_list", targetListID.String()).
					Str("assignee", assigneeID.String()).
					Bool("assignee_mapped", assigneeMapped).
					Msg("[DRY RUN] ✓ Would create task")
				totalResult.TotalIssues++
				totalResult.SuccessfulTasks++
				continue
			}

			// Create task in Workived
			priority := h.mapPriority(issue.Priority)

			// Convert ProseMirror description to markdown and then to HTML
			description := linear.ConvertProseMirrorToMarkdown(issue.DescriptionState)
			if description == "" {
				description = issue.Description
			}
			description = linear.MarkdownToHTML(description)
			taskReq := tasks.CreateTaskRequest{
				Title:       issue.Title,
				Description: &description,
				Priority:    priority,
				TaskListID:  targetListID,
				AssigneeID:  &assigneeID,
			}

			if issue.DueDate != nil {
				dueDateStr := issue.DueDate.Format("2006-01-02")
				taskReq.DueDate = &dueDateStr
			}

			// Use the validated actorEmployeeID for task creation
			// This was already validated to belong to the organisation
			task, err := h.taskService.CreateTask(c.Request.Context(), req.OrganisationID, actorEmployeeID, taskReq)
			if err != nil {
				h.log.Error().
					Err(err).
					Int("issue_num", idx+1).
					Int("total_in_state", len(issues)).
					Str("issue_id", issue.Identifier).
					Str("title", issue.Title).
					Msg("✗ Failed to create task")
				totalResult.FailedTasks++
				totalResult.Errors = append(totalResult.Errors, linear.MigrationError{
					IssueID: issue.ID,
					Issue:   issue.Identifier,
					Error:   err.Error(),
				})
				continue
			}

			totalResult.TotalIssues++
			totalResult.SuccessfulTasks++
			h.log.Info().
				Int("issue_num", idx+1).
				Int("total_in_state", len(issues)).
				Str("issue_id", issue.Identifier).
				Str("task_id", task.ID.String()).
				Str("title", issue.Title).
				Str("priority", priority).
				Bool("assignee_mapped", assigneeMapped).
				Msg("✓ Task created successfully")

			// Migrate comments if requested
			if req.IncludeComments && len(issue.Comments.Nodes) > 0 {
				err := migrationService.MigrateComments(
					c.Request.Context(),
					req.OrganisationID,
					actorUserID,  // Use the validated actor user_id for task creation
					assigneeID,   // Use the mapped assignee as default comment author
					req.TestMode, // Limit to 1 comment if testing
					issue,
					task.ID,
					actorMappings, // Email -> Employee ID mapping
					userIDMapping, // Employee ID -> User ID mapping
					totalResult,
				)
				if err != nil {
					h.log.Warn().
						Err(err).
						Str("issue_id", issue.Identifier).
						Str("task_id", task.ID.String()).
						Msg("failed to migrate comments")
				} else {
					h.log.Info().
						Int("comments_migrated", totalResult.MigratedComments).
						Str("issue_id", issue.Identifier).
						Msg("migrated comments")
				}
			}

			// If test mode, stop after first task
			if req.TestMode {
				h.log.Info().Msg("[TEST MODE] Stopping after first task")
				break
			}
		}

		h.log.Info().
			Str("state_id", stateID).
			Int("processed", len(issues)).
			Int("state_num", stateNum).
			Int("total_states", len(stateMappings)).
			Msg("========== END: Completed state ==========")
	}

	h.log.Info().
		Str("org_id", req.OrganisationID.String()).
		Int("total_issues", totalResult.TotalIssues).
		Int("successful_tasks", totalResult.SuccessfulTasks).
		Int("failed_tasks", totalResult.FailedTasks).
		Int("migrated_comments", totalResult.MigratedComments).
		Int("migrated_images", totalResult.MigratedImages).
		Int("states_processed", len(stateMappings)).
		Int("actor_mappings_used", len(actorMappings)).
		Bool("dry_run", req.DryRun).
		Msg("========== LINEAR IMPORT COMPLETED ==========")

	if totalResult.FailedTasks > 0 {
		h.log.Warn().
			Int("failed_count", totalResult.FailedTasks).
			Int("error_count", len(totalResult.Errors)).
			Msg("some tasks failed to import - check errors in response")
	}

	c.JSON(http.StatusOK, gin.H{"data": totalResult})
}

// FetchLinearProjectsRequest represents the request to fetch Linear projects
type FetchLinearProjectsRequest struct {
	LinearAPIKey string `json:"linear_api_key"` // Optional - will use admin_config if not provided
}

// FetchLinearProjects fetches all projects from Linear for mapping configuration
func (h *ImportHandler) FetchLinearProjects(c *gin.Context) {
	var req FetchLinearProjectsRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, apperr.Response(apperr.New(apperr.CodeValidation, err.Error())))
		return
	}

	// Get Linear API key from request or admin_config
	linearAPIKey, err := h.getLinearAPIKey(c.Request.Context(), req.LinearAPIKey)
	if err != nil {
		h.log.Error().Err(err).Msg("failed to get linear api key")
		c.JSON(http.StatusBadRequest, apperr.Response(apperr.New(apperr.CodeValidation, "Linear API key is required")))
		return
	}

	// Create Linear client
	linearClient := linear.NewClient(linear.Config{
		APIKey: linearAPIKey,
	})

	// Fetch projects
	projects, err := linearClient.FetchProjects(c.Request.Context())
	if err != nil {
		h.log.Error().Err(err).Msg("failed to fetch linear projects")
		c.JSON(http.StatusInternalServerError, apperr.Response(apperr.New(apperr.CodeInternal, "Failed to fetch Linear projects")))
		return
	}

	c.JSON(http.StatusOK, gin.H{"data": projects})
}

// FetchLinearUsersRequest represents the request to fetch Linear users
type FetchLinearUsersRequest struct {
	LinearAPIKey string `json:"linear_api_key"` // Optional - will use admin_config if not provided
}

// FetchLinearUsers fetches all users from Linear for actor mapping configuration
func (h *ImportHandler) FetchLinearUsers(c *gin.Context) {
	var req FetchLinearUsersRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, apperr.Response(apperr.New(apperr.CodeValidation, err.Error())))
		return
	}

	// Get Linear API key from request or admin_config
	linearAPIKey, err := h.getLinearAPIKey(c.Request.Context(), req.LinearAPIKey)
	if err != nil {
		h.log.Error().Err(err).Msg("failed to get linear api key")
		c.JSON(http.StatusBadRequest, apperr.Response(apperr.New(apperr.CodeValidation, "Linear API key is required")))
		return
	}

	// Create Linear client
	linearClient := linear.NewClient(linear.Config{
		APIKey: linearAPIKey,
	})

	// Fetch users
	users, err := linearClient.FetchUsers(c.Request.Context())
	if err != nil {
		h.log.Error().Err(err).Msg("failed to fetch linear users")
		c.JSON(http.StatusInternalServerError, apperr.Response(apperr.New(apperr.CodeInternal, "Failed to fetch Linear users")))
		return
	}

	c.JSON(http.StatusOK, gin.H{"data": users})
}

// FetchEmployeesRequest represents the request to fetch employees for an organization
type FetchEmployeesRequest struct {
	OrganisationID uuid.UUID `json:"organisation_id" binding:"required"`
}

// EmployeeSummary represents an employee for mapping
type EmployeeSummary struct {
	ID    string `json:"id"`
	Name  string `json:"name"`
	Email string `json:"email"`
}

// FetchEmployees fetches all active employees for an organization
func (h *ImportHandler) FetchEmployees(c *gin.Context) {
	var req FetchEmployeesRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, apperr.Response(apperr.New(apperr.CodeValidation, err.Error())))
		return
	}

	// Query employees directly from database
	rows, err := h.db.Query(c.Request.Context(), `
		SELECT id, full_name, COALESCE(email, '') as email
		FROM employees
		WHERE organisation_id = $1 AND is_active = TRUE
		ORDER BY full_name ASC
	`, req.OrganisationID)
	if err != nil {
		h.log.Error().Err(err).Msg("failed to query employees")
		c.JSON(http.StatusInternalServerError, apperr.Response(apperr.New(apperr.CodeInternal, "Failed to fetch employees")))
		return
	}
	defer rows.Close()

	employees := make([]EmployeeSummary, 0)
	for rows.Next() {
		var emp EmployeeSummary
		if err := rows.Scan(&emp.ID, &emp.Name, &emp.Email); err != nil {
			h.log.Error().Err(err).Msg("failed to scan employee")
			continue
		}
		employees = append(employees, emp)
	}

	if err := rows.Err(); err != nil {
		h.log.Error().Err(err).Msg("error iterating employees")
		c.JSON(http.StatusInternalServerError, apperr.Response(apperr.New(apperr.CodeInternal, "Failed to fetch employees")))
		return
	}

	c.JSON(http.StatusOK, gin.H{"data": employees})
}

// mapPriority converts Linear priority (0-4) to Workived priority (low/medium/high/urgent)
func (h *ImportHandler) mapPriority(linearPriority int) string {
	switch linearPriority {
	case 1:
		return "urgent"
	case 2:
		return "high"
	case 3:
		return "medium"
	case 4:
		return "low"
	default:
		return "medium"
	}
}

// ImportPreview represents a preview of what will be imported
type ImportPreview struct {
	TotalIssues    int                       `json:"total_issues"`
	TotalComments  int                       `json:"total_comments"`
	TotalImages    int                       `json:"total_images"`
	StateBreakdown []StatePreview            `json:"state_breakdown"`
	UserBreakdown  []UserPreview             `json:"user_breakdown"`
	IssuesByState  map[string][]IssuePreview `json:"issues_by_state"`
	DryRun         bool                      `json:"dry_run"`
}

// StatePreview shows preview for a single state
type StatePreview struct {
	StateID      string `json:"state_id"`
	TargetListID string `json:"target_list_id"`
	IssueCount   int    `json:"issue_count"`
	CommentCount int    `json:"comment_count"`
	ImageCount   int    `json:"image_count"`
}

// UserPreview shows which Linear users will be mapped
type UserPreview struct {
	LinearEmail      string `json:"linear_email"`
	WorkivedEmployee string `json:"workived_employee,omitempty"`
	IsMapped         bool   `json:"is_mapped"`
	IssueCount       int    `json:"issue_count"`
	CommentCount     int    `json:"comment_count"`
}

// IssuePreview shows a preview of an issue
type IssuePreview struct {
	Identifier      string `json:"identifier"`
	Title           string `json:"title"`
	Priority        string `json:"priority"`
	Assignee        string `json:"assignee,omitempty"`
	CommentCount    int    `json:"comment_count"`
	AttachmentCount int    `json:"attachment_count"`
}

// generateImportPreview creates a detailed preview of what will be imported
func (h *ImportHandler) generateImportPreview(
	issuesByState map[string][]linear.Issue,
	stateMappings map[string]uuid.UUID,
	actorMappings map[string]uuid.UUID,
	totalComments int,
	totalImages int,
) *ImportPreview {
	preview := &ImportPreview{
		DryRun:         true,
		StateBreakdown: make([]StatePreview, 0),
		UserBreakdown:  make([]UserPreview, 0),
		IssuesByState:  make(map[string][]IssuePreview),
	}

	// Track users across all issues and comments
	userStats := make(map[string]*UserPreview)

	for stateID, targetListID := range stateMappings {
		issues := issuesByState[stateID]
		if len(issues) == 0 {
			continue
		}

		statePreview := StatePreview{
			StateID:      stateID,
			TargetListID: targetListID.String(),
			IssueCount:   len(issues),
		}

		issuePreviews := make([]IssuePreview, 0, len(issues))

		for _, issue := range issues {
			// Count comments and images for this issue
			commentCount := len(issue.Comments.Nodes)
			attachmentCount := len(issue.Attachments.Nodes)

			statePreview.CommentCount += commentCount
			statePreview.ImageCount += attachmentCount

			// Track assignee
			assigneeEmail := ""
			if issue.Assignee != nil {
				assigneeEmail = issue.Assignee.Email
				if userStats[assigneeEmail] == nil {
					_, isMapped := actorMappings[assigneeEmail]
					empID := ""
					if empUUID, ok := actorMappings[assigneeEmail]; ok {
						empID = empUUID.String()
					}
					userStats[assigneeEmail] = &UserPreview{
						LinearEmail:      assigneeEmail,
						WorkivedEmployee: empID,
						IsMapped:         isMapped,
					}
				}
				userStats[assigneeEmail].IssueCount++
			}

			// Track comment authors
			for _, comment := range issue.Comments.Nodes {
				email := comment.User.Email
				if userStats[email] == nil {
					_, isMapped := actorMappings[email]
					empID := ""
					if empUUID, ok := actorMappings[email]; ok {
						empID = empUUID.String()
					}
					userStats[email] = &UserPreview{
						LinearEmail:      email,
						WorkivedEmployee: empID,
						IsMapped:         isMapped,
					}
				}
				userStats[email].CommentCount++
			}

			issuePreviews = append(issuePreviews, IssuePreview{
				Identifier:      issue.Identifier,
				Title:           issue.Title,
				Priority:        h.mapPriority(issue.Priority),
				Assignee:        assigneeEmail,
				CommentCount:    commentCount,
				AttachmentCount: attachmentCount,
			})
		}

		preview.StateBreakdown = append(preview.StateBreakdown, statePreview)
		preview.IssuesByState[stateID] = issuePreviews
		preview.TotalIssues += len(issues)
	}

	// Convert user stats to array
	for _, userPreview := range userStats {
		preview.UserBreakdown = append(preview.UserBreakdown, *userPreview)
	}

	preview.TotalComments = totalComments
	preview.TotalImages = totalImages

	return preview
}

// FetchTaskListsRequest represents the request to fetch task lists for an organization
type FetchTaskListsRequest struct {
	OrganisationID uuid.UUID `json:"organisation_id" binding:"required"`
}

// FetchTaskLists fetches all task lists for an organization
func (h *ImportHandler) FetchTaskLists(c *gin.Context) {
	var req FetchTaskListsRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, apperr.Response(apperr.New(apperr.CodeValidation, err.Error())))
		return
	}

	// Fetch task lists for the organization
	lists, err := h.taskService.ListTaskLists(c.Request.Context(), req.OrganisationID)
	if err != nil {
		h.log.Error().Err(err).Msg("failed to fetch task lists")
		c.JSON(http.StatusInternalServerError, apperr.Response(apperr.New(apperr.CodeInternal, "Failed to fetch task lists")))
		return
	}

	c.JSON(http.StatusOK, gin.H{"data": lists})
}

// FetchLinearWorkflowStatesRequest represents the request to fetch Linear workflow states
type FetchLinearWorkflowStatesRequest struct {
	LinearAPIKey string `json:"linear_api_key"` // Optional - will use admin_config if not provided
}

// FetchLinearWorkflowStates fetches all workflow states from Linear for mapping configuration
func (h *ImportHandler) FetchLinearWorkflowStates(c *gin.Context) {
	var req FetchLinearWorkflowStatesRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, apperr.Response(apperr.New(apperr.CodeValidation, err.Error())))
		return
	}

	// Get Linear API key from request or admin_config
	linearAPIKey, err := h.getLinearAPIKey(c.Request.Context(), req.LinearAPIKey)
	if err != nil {
		h.log.Error().Err(err).Msg("failed to get linear api key")
		c.JSON(http.StatusBadRequest, apperr.Response(apperr.New(apperr.CodeValidation, "Linear API key is required")))
		return
	}

	// Create Linear client
	linearClient := linear.NewClient(linear.Config{
		APIKey: linearAPIKey,
	})

	// Fetch workflow states
	states, err := linearClient.FetchWorkflowStates(c.Request.Context())
	if err != nil {
		h.log.Error().Err(err).Msg("failed to fetch linear workflow states")
		c.JSON(http.StatusInternalServerError, apperr.Response(apperr.New(apperr.CodeInternal, "Failed to fetch Linear workflow states")))
		return
	}

	c.JSON(http.StatusOK, gin.H{"data": states})
}

// GetLinearAPIKeyResponse represents the masked Linear API key response
type GetLinearAPIKeyResponse struct {
	MaskedKey string `json:"masked_key"`
	HasKey    bool   `json:"has_key"`
}

// GetLinearAPIKey fetches the Linear API key from admin_config and returns it masked
func (h *ImportHandler) GetLinearAPIKey(c *gin.Context) {
	var apiKey string
	err := h.db.QueryRow(c.Request.Context(), `
		SELECT value#>>'{}'
		FROM admin_config
		WHERE key = 'linear_api_key'
	`).Scan(&apiKey)

	if err != nil {
		// No key found - return empty response
		c.JSON(http.StatusOK, GetLinearAPIKeyResponse{
			MaskedKey: "",
			HasKey:    false,
		})
		return
	}

	// Remove quotes if the value is stored as JSON string
	if len(apiKey) >= 2 && apiKey[0] == '"' && apiKey[len(apiKey)-1] == '"' {
		apiKey = apiKey[1 : len(apiKey)-1]
	}

	// Mask the API key - show first 4 and last 4 characters
	maskedKey := apiKey
	if len(apiKey) > 8 {
		maskedKey = apiKey[:4] + "..." + apiKey[len(apiKey)-4:]
	}

	c.JSON(http.StatusOK, GetLinearAPIKeyResponse{
		MaskedKey: maskedKey,
		HasKey:    true,
	})
}

// GetLinearAPIKeyUnmasked fetches the actual Linear API key from admin_config (unmasked)
// This is a security-sensitive endpoint - only use for staff admin viewing
func (h *ImportHandler) GetLinearAPIKeyUnmasked(c *gin.Context) {
	var apiKey string
	err := h.db.QueryRow(c.Request.Context(), `
		SELECT value#>>'{}'
		FROM admin_config
		WHERE key = 'linear_api_key'
	`).Scan(&apiKey)

	if err != nil {
		// No key found
		c.JSON(http.StatusNotFound, gin.H{
			"error":   "API key not found",
			"has_key": false,
		})
		return
	}

	// Trim any whitespace
	apiKey = strings.TrimSpace(apiKey)

	c.JSON(http.StatusOK, gin.H{
		"api_key": apiKey,
		"has_key": true,
	})
}

// SaveLinearAPIKeyRequest represents the request to save Linear API key
type SaveLinearAPIKeyRequest struct {
	APIKey string `json:"api_key" binding:"required"`
}

// SaveLinearAPIKey saves the Linear API key to admin_config
func (h *ImportHandler) SaveLinearAPIKey(c *gin.Context) {
	var req SaveLinearAPIKeyRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, apperr.Response(apperr.New(apperr.CodeValidation, err.Error())))
		return
	}

	// Get current staff admin from context (set by auth middleware)
	staffAdminID, exists := c.Get("staff_admin_id")
	if !exists {
		c.JSON(http.StatusUnauthorized, apperr.Response(apperr.Unauthorized()))
		return
	}

	// Update or insert the API key in admin_config
	_, err := h.db.Exec(c.Request.Context(), `
		INSERT INTO admin_config (key, value, description, updated_by, updated_at)
		VALUES ('linear_api_key', to_jsonb($1::text), 'Linear API key for task migration', $2, NOW())
		ON CONFLICT (key) DO UPDATE
		SET value = to_jsonb($1::text), updated_by = $2, updated_at = NOW()
	`, req.APIKey, staffAdminID)

	if err != nil {
		h.log.Error().Err(err).Msg("failed to save linear api key")
		c.JSON(http.StatusInternalServerError, apperr.Response(apperr.New(apperr.CodeInternal, "Failed to save Linear API key")))
		return
	}

	h.log.Info().Msg("linear api key saved to admin_config")

	// Return masked key
	maskedKey := req.APIKey
	if len(req.APIKey) > 8 {
		maskedKey = req.APIKey[:4] + "..." + req.APIKey[len(req.APIKey)-4:]
	}

	c.JSON(http.StatusOK, GetLinearAPIKeyResponse{
		MaskedKey: maskedKey,
		HasKey:    true,
	})
}
