package linear

import (
	"context"
	"encoding/json"
	"fmt"
	"strings"
	"time"

	"github.com/gomarkdown/markdown"
	"github.com/gomarkdown/markdown/html"
	"github.com/gomarkdown/markdown/parser"
	"github.com/google/uuid"
	"github.com/rs/zerolog"
	"github.com/workived/services/internal/tasks"
)

// MigrationService handles migrating tasks from Linear to Workived
type MigrationService struct {
	linearClient *Client
	taskService  tasks.ServiceInterface
	log          zerolog.Logger
}

// NewMigrationService creates a new migration service
func NewMigrationService(
	linearClient *Client,
	taskService tasks.ServiceInterface,
	log zerolog.Logger,
) *MigrationService {
	return &MigrationService{
		linearClient: linearClient,
		taskService:  taskService,
		log:          log,
	}
}

// MigrationParams contains parameters for the migration
type MigrationParams struct {
	OrgID           uuid.UUID
	ActorUserID     uuid.UUID
	ActorEmployeeID uuid.UUID
	LinearAPIKey    string
	TeamID          *string
	ProjectID       *string
	StateFilter     []string
	AssigneeFilter  *string
	DateFrom        *time.Time
	DateTo          *time.Time
	DryRun          bool
	TestMode        bool // If true, import only 1 task and 1 comment for testing
	IncludeComments bool
	TargetListID    uuid.UUID            // Target task list in Workived
	ActorMappings   map[string]uuid.UUID // Linear user email -> Workived employee ID
}

// MigrationResult contains the results of a migration
type MigrationResult struct {
	TotalIssues      int              `json:"total_issues"`
	SuccessfulTasks  int              `json:"successful_tasks"`
	FailedTasks      int              `json:"failed_tasks"`
	SkippedTasks     int              `json:"skipped_tasks"`
	MigratedComments int              `json:"migrated_comments"`
	MigratedImages   int              `json:"migrated_images"`
	Errors           []MigrationError `json:"errors,omitempty"`
	TaskMappings     []TaskMapping    `json:"task_mappings,omitempty"`
	DryRun           bool             `json:"dry_run"`
}

// MigrationError represents an error during migration
type MigrationError struct {
	IssueID string `json:"issue_id"`
	Issue   string `json:"issue"`
	Error   string `json:"error"`
}

// TaskMapping maps a Linear issue to a Workived task
type TaskMapping struct {
	LinearIssueID    string    `json:"linear_issue_id"`
	LinearIdentifier string    `json:"linear_identifier"`
	WorkivedTaskID   uuid.UUID `json:"workived_task_id"`
	Title            string    `json:"title"`
}

// Migrate performs the migration from Linear to Workived
func (s *MigrationService) Migrate(ctx context.Context, params MigrationParams) (*MigrationResult, error) {
	result := &MigrationResult{
		DryRun: params.DryRun,
	}

	s.log.Info().
		Str("org_id", params.OrgID.String()).
		Bool("dry_run", params.DryRun).
		Msg("starting linear task migration")

	// Fetch all issues from Linear
	fetchParams := FetchIssuesParams{
		TeamID:          params.TeamID,
		ProjectID:       params.ProjectID,
		StateFilter:     params.StateFilter,
		AssigneeFilter:  params.AssigneeFilter,
		DateFrom:        params.DateFrom,
		DateTo:          params.DateTo,
		IncludeComments: params.IncludeComments,
		Limit:           100,
	}

	// Handle pagination
	var allIssues []Issue
	var cursor *string

	for {
		fetchParams.Cursor = cursor
		issuesResp, err := s.linearClient.FetchIssues(ctx, fetchParams)
		if err != nil {
			return nil, fmt.Errorf("fetch issues from linear: %w", err)
		}

		allIssues = append(allIssues, issuesResp.Issues.Nodes...)

		if !issuesResp.Issues.PageInfo.HasNextPage {
			break
		}
		endCursor := issuesResp.Issues.PageInfo.EndCursor
		cursor = &endCursor
	}

	result.TotalIssues = len(allIssues)
	s.log.Info().Int("count", result.TotalIssues).Msg("fetched issues from linear")

	// Use provided actor mappings or empty map
	userMapping := params.ActorMappings
	if userMapping == nil {
		userMapping = make(map[string]uuid.UUID)
		s.log.Info().Msg("no actor mappings provided - assignees will default to task creator")
	} else {
		s.log.Info().Int("mappings", len(userMapping)).Msg("using provided actor mappings")
	}

	// Migrate each issue
	for _, issue := range allIssues {
		if err := s.migrateIssue(ctx, params, issue, userMapping, result); err != nil {
			s.log.Error().
				Err(err).
				Str("issue_id", issue.ID).
				Str("identifier", issue.Identifier).
				Msg("failed to migrate issue")

			result.FailedTasks++
			result.Errors = append(result.Errors, MigrationError{
				IssueID: issue.ID,
				Issue:   issue.Identifier,
				Error:   err.Error(),
			})
			continue
		}
	}

	s.log.Info().
		Int("total", result.TotalIssues).
		Int("successful", result.SuccessfulTasks).
		Int("failed", result.FailedTasks).
		Int("skipped", result.SkippedTasks).
		Msg("migration completed")

	return result, nil
}

// migrateIssue migrates a single Linear issue to Workived
func (s *MigrationService) migrateIssue(
	ctx context.Context,
	params MigrationParams,
	issue Issue,
	userMapping map[string]uuid.UUID,
	result *MigrationResult,
) error {
	s.log.Debug().
		Str("issue", issue.Identifier).
		Str("title", issue.Title).
		Msg("migrating issue")

	// Convert ProseMirror description to markdown (preserves formatting)
	// Fall back to plain text if conversion fails or is empty
	description := ConvertProseMirrorToMarkdown(issue.DescriptionState)
	if description == "" {
		description = issue.Description
	}

	// Convert markdown to HTML for database storage (Linear image URLs remain unchanged)
	description = MarkdownToHTML(description)

	// Map assignee
	var assigneeID *uuid.UUID
	if issue.Assignee != nil {
		if empID, ok := userMapping[issue.Assignee.Email]; ok {
			assigneeID = &empID
		} else {
			// Default to creator if assignee not found
			assigneeID = &params.ActorEmployeeID
		}
	}

	// Map priority (Linear: 0=None, 1=Urgent, 2=High, 3=Normal, 4=Low)
	// Workived: low, medium, high, urgent
	priority := "medium"
	switch issue.Priority {
	case 1:
		priority = "urgent"
	case 2:
		priority = "high"
	case 3:
		priority = "medium"
	case 4:
		priority = "low"
	default:
		priority = "medium"
	}

	// Determine if task should be marked as completed
	var completedAt *time.Time
	if issue.State.Type == "completed" && issue.CompletedAt != nil {
		completedAt = issue.CompletedAt
	}

	// Convert due date to string pointer
	var dueDate *string
	if issue.DueDate != nil {
		dueDateStr := issue.DueDate.Format("2006-01-02")
		dueDate = &dueDateStr
	}

	// Build task request
	taskReq := tasks.CreateTaskRequest{
		TaskListID:  params.TargetListID,
		Title:       issue.Title,
		Description: &description,
		AssigneeID:  assigneeID,
		Priority:    priority,
		DueDate:     dueDate,
	}

	if params.DryRun {
		s.log.Info().
			Str("issue", issue.Identifier).
			Str("title", issue.Title).
			Msg("DRY RUN: would create task")
		result.SuccessfulTasks++
		return nil
	}

	// Create task in Workived
	task, err := s.taskService.CreateTask(
		ctx,
		params.OrgID,
		params.ActorEmployeeID,
		taskReq,
		params.ActorUserID,
	)
	if err != nil {
		return fmt.Errorf("create task: %w", err)
	}

	result.SuccessfulTasks++
	result.TaskMappings = append(result.TaskMappings, TaskMapping{
		LinearIssueID:    issue.ID,
		LinearIdentifier: issue.Identifier,
		WorkivedTaskID:   task.ID,
		Title:            task.Title,
	})

	// Mark as completed if needed
	if completedAt != nil {
		if _, err := s.taskService.ToggleTaskCompletion(ctx, params.OrgID, task.ID, params.ActorUserID); err != nil {
			s.log.Warn().Err(err).Str("task_id", task.ID.String()).Msg("failed to mark task as completed")
		}
	}

	// Migrate comments if requested
	if params.IncludeComments && len(issue.Comments.Nodes) > 0 {
		// For the Migrate function, we don't have userIDMapping, so pass nil
		// Comments will use the actorUserID as fallback
		if err := s.MigrateComments(ctx, params.OrgID, params.ActorUserID, params.ActorEmployeeID, params.TestMode, issue, task.ID, userMapping, nil, result); err != nil {
			s.log.Warn().Err(err).Str("task_id", task.ID.String()).Msg("failed to migrate comments")
			// Continue - comments are not critical
		}
	}

	return nil
}

// MigrateComments migrates comments from Linear to Workived
func (s *MigrationService) MigrateComments(
	ctx context.Context,
	orgID uuid.UUID,
	actorUserID uuid.UUID,
	actorEmployeeID uuid.UUID,
	testMode bool, // If true, migrate only 1 comment
	issue Issue,
	taskID uuid.UUID,
	userMapping map[string]uuid.UUID,
	userIDMapping map[uuid.UUID]uuid.UUID, // employee_id -> user_id
	result *MigrationResult,
) error {
	// Fetch all comments (handle pagination)
	comments, err := s.linearClient.FetchAllComments(ctx, issue.ID)
	if err != nil {
		return fmt.Errorf("fetch comments: %w", err)
	}

	for _, comment := range comments {
		// Map comment author by email first
		authorEmployeeID := actorEmployeeID
		if empID, ok := userMapping[comment.User.Email]; ok {
			authorEmployeeID = empID
			s.log.Debug().
				Str("linear_user", comment.User.Email).
				Str("workived_employee", empID.String()).
				Msg("mapped comment author")
		}

		// Get the user_id for this employee (if userIDMapping is provided)
		commentUserID := actorUserID // fallback
		if userIDMapping != nil {
			if userID, ok := userIDMapping[authorEmployeeID]; ok {
				commentUserID = userID
			}
		}

		// Convert ProseMirror comment body to markdown (preserves formatting)
		// Fall back to plain text if conversion fails or is empty
		body := ConvertProseMirrorToMarkdown(comment.BodyData)
		if body == "" {
			body = comment.Body
		}

		// Debug: log the markdown output
		pmPreview := comment.BodyData
		if len(pmPreview) > 2000 {
			pmPreview = pmPreview[:2000] + "..."
		}
		s.log.Debug().
			Str("comment_id", comment.ID).
			Str("prosemirror_json", pmPreview).
			Str("markdown_output", body).
			Msg("converted prosemirror to markdown")

		// Convert markdown to HTML for database storage (Linear image URLs remain unchanged)
		body = MarkdownToHTML(body)

		// Create comment in Workived
		// Note: parent comment threading is not yet supported in this version
		_, err := s.taskService.CreateComment(
			ctx,
			orgID,
			taskID,
			authorEmployeeID,
			nil, // parentID - threading not yet supported
			body,
			"html",
			commentUserID,
		)
		if err != nil {
			s.log.Warn().
				Err(err).
				Str("comment_id", comment.ID).
				Msg("failed to create comment")
			continue
		}

		result.MigratedComments++

		// If test mode, stop after first comment
		if testMode {
			s.log.Info().Msg("[TEST MODE] Stopping after first comment")
			break
		}
	}

	return nil
}

// ConvertProseMirrorToMarkdown converts Linear's ProseMirror JSON to markdown
func ConvertProseMirrorToMarkdown(prosemirrorJSON string) string {
	if prosemirrorJSON == "" {
		return ""
	}

	var doc struct {
		Type    string                   `json:"type"`
		Content []map[string]interface{} `json:"content"`
	}

	if err := json.Unmarshal([]byte(prosemirrorJSON), &doc); err != nil {
		// If parsing fails, return empty string (will fall back to plain text)
		return ""
	}

	var result strings.Builder
	processContent(doc.Content, &result, 0)
	return strings.TrimSpace(result.String())
}

// processContent recursively processes ProseMirror content nodes
func processContent(content []map[string]interface{}, result *strings.Builder, depth int) {
	for i, node := range content {
		nodeType, _ := node["type"].(string)

		// Debug: log unhandled node types
		handled := map[string]bool{
			"paragraph": true, "heading": true,
			"bulletList": true, "bullet_list": true,
			"orderedList": true, "ordered_list": true,
			"taskList": true, "task_list": true,
			"table": true, "table_row": true, "table_header": true, "table_cell": true,
			"codeBlock": true, "code_block": true,
			"blockquote":     true,
			"horizontalRule": true, "horizontal_rule": true,
			"image": true,
		}
		if !handled[nodeType] {
			fmt.Printf("[DEBUG] Unhandled ProseMirror node type: %q at depth %d\n", nodeType, depth)
		}

		switch nodeType {
		case "paragraph":
			if childContent, ok := node["content"].([]interface{}); ok {
				processInlineContent(childContent, result)
			}
			result.WriteString("\n\n")

		case "heading":
			level := 1
			if attrs, ok := node["attrs"].(map[string]interface{}); ok {
				if lvl, ok := attrs["level"].(float64); ok {
					level = int(lvl)
				}
			}
			result.WriteString(strings.Repeat("#", level) + " ")
			if childContent, ok := node["content"].([]interface{}); ok {
				processInlineContent(childContent, result)
			}
			result.WriteString("\n\n")

		case "bulletList", "bullet_list":
			if childContent, ok := node["content"].([]interface{}); ok {
				processList(childContent, result, "- ", depth)
			}

		case "orderedList", "ordered_list":
			if childContent, ok := node["content"].([]interface{}); ok {
				processList(childContent, result, "", depth)
			}

		case "taskList", "task_list":
			// Linear's checkbox/task list items
			if childContent, ok := node["content"].([]interface{}); ok {
				processList(childContent, result, "- [ ] ", depth)
			}
		case "table":
			// Convert tables to markdown table format
			if childContent, ok := node["content"].([]interface{}); ok {
				processTable(childContent, result)
			}
		case "codeBlock", "code_block":
			result.WriteString("```")
			if attrs, ok := node["attrs"].(map[string]interface{}); ok {
				if lang, ok := attrs["language"].(string); ok {
					result.WriteString(lang)
				}
			}
			result.WriteString("\n")
			if childContent, ok := node["content"].([]interface{}); ok {
				processInlineContent(childContent, result)
			}
			result.WriteString("\n```\n\n")

		case "blockquote":
			if childContent, ok := node["content"].([]interface{}); ok {
				processBlockquote(childContent, result)
			}

		case "horizontalRule", "horizontal_rule":
			result.WriteString("---\n\n")

		case "image":
			if attrs, ok := node["attrs"].(map[string]interface{}); ok {
				src, _ := attrs["src"].(string)
				alt, _ := attrs["alt"].(string)
				if alt == "" {
					alt = "image"
				}
				result.WriteString(fmt.Sprintf("![%s](%s)\n\n", alt, src))
			}
		}

		// Add spacing between top-level blocks
		if i < len(content)-1 && depth == 0 {
			nodeType2, _ := content[i+1]["type"].(string)
			if nodeType2 == "paragraph" || nodeType2 == "heading" {
				// Already handled in the cases above
			}
		}
	}
}

// processInlineContent processes inline nodes (text, marks, etc.)
func processInlineContent(content []interface{}, result *strings.Builder) {
	for _, item := range content {
		node, ok := item.(map[string]interface{})
		if !ok {
			continue
		}

		nodeType, _ := node["type"].(string)

		switch nodeType {
		case "text":
			text, _ := node["text"].(string)
			marks, _ := node["marks"].([]interface{})

			// Apply marks (bold, italic, code, etc.)
			wrapped := wrapWithMarks(text, marks)
			result.WriteString(wrapped)

		case "hardBreak", "hard_break":
			result.WriteString("  \n")

		case "mention":
			if attrs, ok := node["attrs"].(map[string]interface{}); ok {
				if label, ok := attrs["label"].(string); ok {
					result.WriteString("@" + label)
				}
			}

		case "emoji":
			if attrs, ok := node["attrs"].(map[string]interface{}); ok {
				if emoji, ok := attrs["emoji"].(string); ok {
					result.WriteString(emoji)
				}
			}
		}
	}
}

// wrapWithMarks wraps text with markdown formatting based on ProseMirror marks
func wrapWithMarks(text string, marks []interface{}) string {
	if len(marks) == 0 {
		return text
	}

	var prefix, suffix strings.Builder

	for _, mark := range marks {
		markMap, ok := mark.(map[string]interface{})
		if !ok {
			continue
		}

		markType, _ := markMap["type"].(string)

		switch markType {
		case "strong":
			prefix.WriteString("**")
			suffix.WriteString("**")
		case "em":
			prefix.WriteString("*")
			suffix.WriteString("*")
		case "code":
			prefix.WriteString("`")
			suffix.WriteString("`")
		case "strike":
			prefix.WriteString("~~")
			suffix.WriteString("~~")
		case "link":
			if attrs, ok := markMap["attrs"].(map[string]interface{}); ok {
				if href, ok := attrs["href"].(string); ok {
					return fmt.Sprintf("[%s](%s)", text, href)
				}
			}
		}
	}

	return prefix.String() + text + reverse(suffix.String())
}

// processList handles bullet and ordered lists
func processList(items []interface{}, result *strings.Builder, bullet string, depth int) {
	indent := strings.Repeat("  ", depth)

	for i, item := range items {
		itemMap, ok := item.(map[string]interface{})
		if !ok {
			continue
		}

		nodeType, _ := itemMap["type"].(string)
		// Support both listItem (bullets/ordered) and taskItem (checkboxes)
		// Linear uses snake_case (list_item, task_item)
		if nodeType != "listItem" && nodeType != "taskItem" && nodeType != "list_item" && nodeType != "task_item" {
			continue
		}

		prefix := bullet
		if bullet == "" {
			// Ordered list
			prefix = fmt.Sprintf("%d. ", i+1)
		} else if nodeType == "taskItem" || nodeType == "task_item" {
			// Task list item - check if it's checked
			checked := false
			if attrs, ok := itemMap["attrs"].(map[string]interface{}); ok {
				if c, ok := attrs["checked"].(bool); ok {
					checked = c
				}
			}
			if checked {
				prefix = "- [x] "
			} else {
				prefix = "- [ ] "
			}
		}

		result.WriteString(indent + prefix)

		if childContent, ok := itemMap["content"].([]interface{}); ok {
			// Process list item content
			for j, child := range childContent {
				childMap, ok := child.(map[string]interface{})
				if !ok {
					continue
				}

				childType, _ := childMap["type"].(string)

				if childType == "paragraph" {
					if content, ok := childMap["content"].([]interface{}); ok {
						processInlineContent(content, result)
					}
				} else if childType == "bulletList" || childType == "bullet_list" || childType == "orderedList" || childType == "ordered_list" || childType == "taskList" || childType == "task_list" {
					result.WriteString("\n")
					if nestedContent, ok := childMap["content"].([]interface{}); ok {
						// Determine correct bullet for nested list
						nestedBullet := "- "
						if childType == "orderedList" || childType == "ordered_list" {
							nestedBullet = ""
						} else if childType == "taskList" || childType == "task_list" {
							nestedBullet = "- [ ] "
						}
						processList(nestedContent, result, nestedBullet, depth+1)
					}
				}

				if j < len(childContent)-1 {
					result.WriteString("\n")
				}
			}
		}

		result.WriteString("\n")
	}

	if depth == 0 {
		result.WriteString("\n")
	}
}

// processBlockquote handles blockquote nodes
func processBlockquote(content []interface{}, result *strings.Builder) {
	for _, item := range content {
		itemMap, ok := item.(map[string]interface{})
		if !ok {
			continue
		}

		result.WriteString("> ")

		if childContent, ok := itemMap["content"].([]interface{}); ok {
			processInlineContent(childContent, result)
		}

		result.WriteString("\n")
	}
	result.WriteString("\n")
}

// processTable converts ProseMirror table to markdown table
func processTable(rows []interface{}, result *strings.Builder) {
	var tableRows [][]string

	for _, row := range rows {
		rowMap, ok := row.(map[string]interface{})
		if !ok {
			continue
		}

		if rowMap["type"] != "table_row" {
			continue
		}

		cells, ok := rowMap["content"].([]interface{})
		if !ok {
			continue
		}

		var rowCells []string
		for _, cell := range cells {
			cellMap, ok := cell.(map[string]interface{})
			if !ok {
				continue
			}

			cellType := cellMap["type"]
			if cellType != "table_header" && cellType != "table_cell" {
				continue
			}

			// Extract cell content
			var cellText strings.Builder
			if cellContent, ok := cellMap["content"].([]interface{}); ok {
				for _, cellNode := range cellContent {
					cellNodeMap, ok := cellNode.(map[string]interface{})
					if !ok {
						continue
					}

					if cellNodeMap["type"] == "paragraph" {
						if paraContent, ok := cellNodeMap["content"].([]interface{}); ok {
							var paraBuilder strings.Builder
							processInlineContent(paraContent, &paraBuilder)
							cellText.WriteString(paraBuilder.String())
						}
					}
				}
			}

			rowCells = append(rowCells, strings.TrimSpace(cellText.String()))
		}

		if len(rowCells) > 0 {
			tableRows = append(tableRows, rowCells)
		}
	}

	// Output markdown table
	if len(tableRows) == 0 {
		return
	}

	// Header row
	result.WriteString("| ")
	result.WriteString(strings.Join(tableRows[0], " | "))
	result.WriteString(" |\n")

	// Separator
	result.WriteString("|")
	for range tableRows[0] {
		result.WriteString("----------|")
	}
	result.WriteString("\n")

	// Data rows
	for i := 1; i < len(tableRows); i++ {
		result.WriteString("| ")
		result.WriteString(strings.Join(tableRows[i], " | "))
		result.WriteString(" |\n")
	}

	result.WriteString("\n")
}

// reverse reverses a string
func reverse(s string) string {
	runes := []rune(s)
	for i, j := 0, len(runes)-1; i < j; i, j = i+1, j-1 {
		runes[i], runes[j] = runes[j], runes[i]
	}
	return string(runes)
}

// MarkdownToHTML converts markdown text to HTML
func MarkdownToHTML(text string) string {
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
	return strings.TrimSpace(string(htmlBytes))
}
