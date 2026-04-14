package tasks

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"strings"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/rs/zerolog"
	"github.com/workived/services/pkg/apperr"
	"github.com/workived/services/pkg/paginate"
)

type Repository struct {
	db  *pgxpool.Pool
	log zerolog.Logger
}

func NewRepository(db *pgxpool.Pool, log zerolog.Logger) *Repository {
	return &Repository{db: db, log: log}
}

// parseDateString parses a date string in "YYYY-MM-DD" format to *time.Time
// Returns nil if input is nil or empty string
// Uses UTC for deterministic date extraction regardless of server timezone
func parseDateString(dateStr *string) (*time.Time, error) {
	if dateStr == nil || *dateStr == "" {
		return nil, nil
	}
	// Parse in UTC to ensure the date is always what the user intended
	// When PostgreSQL extracts DATE from time.Time, UTC ensures correct date
	parsed, err := time.ParseInLocation("2006-01-02", *dateStr, time.UTC)
	if err != nil {
		return nil, fmt.Errorf("invalid date format, expected YYYY-MM-DD: %w", err)
	}
	return &parsed, nil
}

// ── Task Lists ───────────────────────────────────────────────────────────────

func (r *Repository) ListTaskLists(ctx context.Context, orgID uuid.UUID) ([]TaskList, error) {
	rows, err := r.db.Query(ctx, `
		SELECT id, organisation_id, name, position, is_final_state, is_active, created_at, updated_at
		FROM task_lists
		WHERE organisation_id = $1 AND is_active = TRUE
		ORDER BY position ASC, created_at ASC
	`, orgID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var lists []TaskList
	for rows.Next() {
		var tl TaskList
		if err := rows.Scan(&tl.ID, &tl.OrganisationID, &tl.Name, &tl.Position, &tl.IsFinalState, &tl.IsActive, &tl.CreatedAt, &tl.UpdatedAt); err != nil {
			return nil, err
		}
		lists = append(lists, tl)
	}
	return lists, rows.Err()
}

func (r *Repository) GetTaskList(ctx context.Context, orgID, id uuid.UUID) (*TaskList, error) {
	var tl TaskList
	err := r.db.QueryRow(ctx, `
		SELECT id, organisation_id, name, position, is_final_state, is_active, created_at, updated_at
		FROM task_lists
		WHERE organisation_id = $1 AND id = $2
	`, orgID, id).Scan(&tl.ID, &tl.OrganisationID, &tl.Name, &tl.Position, &tl.IsFinalState, &tl.IsActive, &tl.CreatedAt, &tl.UpdatedAt)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, ErrTaskListNotFound()
		}
		return nil, err
	}
	return &tl, nil
}

func (r *Repository) GetFinalStateList(ctx context.Context, orgID uuid.UUID) (*TaskList, error) {
	var tl TaskList
	err := r.db.QueryRow(ctx, `
		SELECT id, organisation_id, name, position, is_final_state, is_active, created_at, updated_at
		FROM task_lists
		WHERE organisation_id = $1 AND is_final_state = TRUE AND is_active = TRUE
		LIMIT 1
	`, orgID).Scan(&tl.ID, &tl.OrganisationID, &tl.Name, &tl.Position, &tl.IsFinalState, &tl.IsActive, &tl.CreatedAt, &tl.UpdatedAt)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, ErrTaskListNotFound()
		}
		return nil, err
	}
	return &tl, nil
}

func (r *Repository) CreateTaskList(ctx context.Context, orgID uuid.UUID, req CreateListRequest) (*TaskList, error) {
	// Get next position
	var maxPosition int
	err := r.db.QueryRow(ctx, `
		SELECT COALESCE(MAX(position), -1000) FROM task_lists WHERE organisation_id = $1
	`, orgID).Scan(&maxPosition)
	if err != nil {
		return nil, err
	}

	// Default is_final_state to false if not provided
	isFinalState := false
	if req.IsFinalState != nil {
		isFinalState = *req.IsFinalState
	}

	var tl TaskList
	err = r.db.QueryRow(ctx, `
		INSERT INTO task_lists (organisation_id, name, position, is_final_state)
		VALUES ($1, $2, $3, $4)
		RETURNING id, organisation_id, name, position, is_final_state, is_active, created_at, updated_at
	`, orgID, req.Name, maxPosition+1000, isFinalState).Scan(&tl.ID, &tl.OrganisationID, &tl.Name, &tl.Position, &tl.IsFinalState, &tl.IsActive, &tl.CreatedAt, &tl.UpdatedAt)
	if err != nil {
		return nil, err
	}
	return &tl, nil
}

func (r *Repository) UpdateTaskList(ctx context.Context, orgID, id uuid.UUID, req UpdateListRequest) (*TaskList, error) {
	// Build dynamic update query based on what's provided
	updates := []string{}
	args := []interface{}{orgID, id}
	argIdx := 3

	if req.Name != nil {
		updates = append(updates, fmt.Sprintf("name = $%d", argIdx))
		args = append(args, *req.Name)
		argIdx++
	}
	if req.Position != nil {
		updates = append(updates, fmt.Sprintf("position = $%d", argIdx))
		args = append(args, *req.Position)
	}

	if len(updates) == 0 {
		return r.GetTaskList(ctx, orgID, id)
	}

	var tl TaskList
	query := fmt.Sprintf(`
		UPDATE task_lists SET %s
		WHERE organisation_id = $1 AND id = $2
		RETURNING id, organisation_id, name, position, is_final_state, is_active, created_at, updated_at
	`, strings.Join(updates, ", "))

	err := r.db.QueryRow(ctx, query, args...).Scan(&tl.ID, &tl.OrganisationID, &tl.Name, &tl.Position, &tl.IsFinalState, &tl.IsActive, &tl.CreatedAt, &tl.UpdatedAt)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, ErrTaskListNotFound()
		}
		return nil, err
	}
	return &tl, nil
}

func (r *Repository) DeactivateTaskList(ctx context.Context, orgID, id uuid.UUID) error {
	tag, err := r.db.Exec(ctx, `
		UPDATE task_lists SET is_active = FALSE
		WHERE organisation_id = $1 AND id = $2 AND is_active = TRUE
	`, orgID, id)
	if err != nil {
		return err
	}
	if tag.RowsAffected() == 0 {
		return ErrTaskListNotFound()
	}
	return nil
}

func (r *Repository) CountTaskLists(ctx context.Context, orgID uuid.UUID) (int, error) {
	var count int
	err := r.db.QueryRow(ctx, `
		SELECT COUNT(*) FROM task_lists WHERE organisation_id = $1 AND is_active = TRUE
	`, orgID).Scan(&count)
	return count, err
}

// ── Tasks ────────────────────────────────────────────────────────────────────

func (r *Repository) ListTasks(ctx context.Context, orgID uuid.UUID, filters TaskFilters) ([]TaskWithDetails, error) {
	limit := paginate.ClampLimit(filters.Limit)
	cursor := paginate.Decode(filters.Cursor)

	query := `
		SELECT 
			t.id, t.organisation_id, t.task_list_id, t.title, t.description,
			t.assignee_id, t.created_by, t.priority, t.due_date, t.position,
			t.completed_at, t.approval_type, t.approval_id, t.created_at, t.updated_at,
			assignee.full_name AS assignee_name,
			creator.full_name AS creator_name,
			tl.name AS list_name
		FROM tasks t
		JOIN employees creator ON t.created_by = creator.id
		JOIN task_lists tl ON t.task_list_id = tl.id
		LEFT JOIN employees assignee ON t.assignee_id = assignee.id
		WHERE t.organisation_id = $1
		  AND ($2::uuid IS NULL OR t.task_list_id = $2::uuid)
		  AND (
			  -- Regular tasks: show to all org members (collaborative workspace)
			  t.approval_type IS NULL
			  -- Approval tasks: show only to assignee OR creator
			  OR (t.approval_type IS NOT NULL AND ($3::uuid IS NULL OR t.assignee_id = $3::uuid OR t.created_by = $3::uuid))
		  )
		  AND ($9::boolean IS NULL OR $9 = false OR t.approval_type IS NULL)
		  AND ($4::varchar IS NULL OR t.priority = $4)
		  AND ($5::varchar IS NULL OR (
			  CASE WHEN $5 = 'completed' THEN t.completed_at IS NOT NULL
			       WHEN $5 = 'pending' THEN t.completed_at IS NULL
			       ELSE TRUE END
		  ))
		  AND (
			  -- Auto-archive: hide completed tasks older than N days (unless explicitly filtering for completed)
			  $5 = 'completed'
			  OR t.completed_at IS NULL
			  OR $8::int = 0
			  OR t.completed_at > NOW() - ($8::int || ' days')::interval
		  )
		  AND ($6::timestamptz IS NULL OR t.created_at < $6::timestamptz)
		ORDER BY t.created_at DESC
		LIMIT $7
	`

	archiveDays := filters.ArchiveDays
	if archiveDays == 0 {
		archiveDays = DefaultArchiveDays
	}

	rows, err := r.db.Query(ctx, query,
		orgID,
		ptrToUUID(filters.TaskListID),
		ptrToUUID(filters.AssigneeID),
		filters.Priority,
		filters.Status,
		nilIfEmpty(cursor.Value),
		limit+1,
		archiveDays,
		filters.ExcludeApprovalTasks,
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var tasks []TaskWithDetails
	for rows.Next() {
		var t TaskWithDetails
		if err := rows.Scan(
			&t.ID, &t.OrganisationID, &t.TaskListID, &t.Title, &t.Description,
			&t.AssigneeID, &t.CreatedBy, &t.Priority, &t.DueDate, &t.Position,
			&t.CompletedAt, &t.ApprovalType, &t.ApprovalID, &t.CreatedAt, &t.UpdatedAt,
			&t.AssigneeName, &t.CreatorName, &t.ListName,
		); err != nil {
			return nil, err
		}
		tasks = append(tasks, t)
	}
	return tasks, rows.Err()
}

func (r *Repository) GetTask(ctx context.Context, orgID, id uuid.UUID) (*TaskWithDetails, error) {
	var t TaskWithDetails
	err := r.db.QueryRow(ctx, `
		SELECT 
			t.id, t.organisation_id, t.task_list_id, t.title, t.description,
			t.assignee_id, t.created_by, t.priority, t.due_date, t.position,
			t.completed_at, t.approval_type, t.approval_id, t.created_at, t.updated_at,
			assignee.full_name AS assignee_name,
			creator.full_name AS creator_name,
			tl.name AS list_name
		FROM tasks t
		JOIN employees creator ON t.created_by = creator.id
		JOIN task_lists tl ON t.task_list_id = tl.id
		LEFT JOIN employees assignee ON t.assignee_id = assignee.id
		WHERE t.organisation_id = $1 AND t.id = $2
	`, orgID, id).Scan(
		&t.ID, &t.OrganisationID, &t.TaskListID, &t.Title, &t.Description,
		&t.AssigneeID, &t.CreatedBy, &t.Priority, &t.DueDate, &t.Position,
		&t.CompletedAt, &t.ApprovalType, &t.ApprovalID, &t.CreatedAt, &t.UpdatedAt,
		&t.AssigneeName, &t.CreatorName, &t.ListName,
	)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, ErrTaskNotFound()
		}
		return nil, err
	}
	return &t, nil
}

func (r *Repository) GetTaskByApproval(ctx context.Context, approvalType string, approvalID uuid.UUID) (*TaskWithDetails, error) {
	var t TaskWithDetails
	err := r.db.QueryRow(ctx, `
		SELECT 
			t.id, t.organisation_id, t.task_list_id, t.title, t.description,
			t.assignee_id, t.created_by, t.priority, t.due_date, t.position,
			t.completed_at, t.approval_type, t.approval_id, t.created_at, t.updated_at,
			assignee.full_name AS assignee_name,
			creator.full_name AS creator_name,
			tl.name AS list_name
		FROM tasks t
		JOIN employees creator ON t.created_by = creator.id
		JOIN task_lists tl ON t.task_list_id = tl.id
		LEFT JOIN employees assignee ON t.assignee_id = assignee.id
		WHERE t.approval_type = $1 AND t.approval_id = $2
		LIMIT 1
	`, approvalType, approvalID).Scan(
		&t.ID, &t.OrganisationID, &t.TaskListID, &t.Title, &t.Description,
		&t.AssigneeID, &t.CreatedBy, &t.Priority, &t.DueDate, &t.Position,
		&t.CompletedAt, &t.ApprovalType, &t.ApprovalID, &t.CreatedAt, &t.UpdatedAt,
		&t.AssigneeName, &t.CreatorName, &t.ListName,
	)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, ErrTaskNotFound()
		}
		return nil, err
	}
	return &t, nil
}

func (r *Repository) CreateTask(ctx context.Context, orgID, createdBy uuid.UUID, req CreateTaskRequest) (*Task, error) {
	// Verify task list exists, is active, and get is_final_state flag
	var isActive bool
	var isFinalState bool
	err := r.db.QueryRow(ctx, `
		SELECT is_active, is_final_state FROM task_lists WHERE organisation_id = $1 AND id = $2
	`, orgID, req.TaskListID).Scan(&isActive, &isFinalState)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, ErrTaskListNotFound()
		}
		return nil, err
	}
	if !isActive {
		return nil, ErrTaskListInactive("")
	}

	// Get next position in list
	var maxPosition int
	err = r.db.QueryRow(ctx, `
		SELECT COALESCE(MAX(position), -1000) FROM tasks 
		WHERE organisation_id = $1 AND task_list_id = $2
	`, orgID, req.TaskListID).Scan(&maxPosition)
	if err != nil {
		return nil, err
	}

	// Default priority if not provided
	priority := req.Priority
	if priority == "" {
		priority = "medium"
	}

	// Parse due date string to time.Time
	dueDate, err := parseDateString(req.DueDate)
	if err != nil {
		return nil, apperr.New(apperr.CodeValidation, err.Error())
	}

	// If list is a final state (e.g., "Done" column), set completed_at to now
	var completedAt *time.Time
	if isFinalState {
		now := time.Now()
		completedAt = &now
	}

	var t Task
	err = r.db.QueryRow(ctx, `
		INSERT INTO tasks (
			organisation_id, task_list_id, title, description, assignee_id,
			created_by, priority, due_date, position, completed_at, approval_type, approval_id
		) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
		RETURNING id, organisation_id, task_list_id, title, description, assignee_id,
		          created_by, priority, due_date, position, completed_at, approval_type, approval_id, created_at, updated_at
	`, orgID, req.TaskListID, req.Title, req.Description, req.AssigneeID,
		createdBy, priority, dueDate, maxPosition+1000, completedAt, req.ApprovalType, req.ApprovalID).Scan(
		&t.ID, &t.OrganisationID, &t.TaskListID, &t.Title, &t.Description, &t.AssigneeID,
		&t.CreatedBy, &t.Priority, &t.DueDate, &t.Position, &t.CompletedAt, &t.ApprovalType, &t.ApprovalID, &t.CreatedAt, &t.UpdatedAt,
	)
	if err != nil {
		return nil, err
	}
	return &t, nil
}

func (r *Repository) UpdateTask(ctx context.Context, orgID, id uuid.UUID, req UpdateTaskRequest) (*Task, error) {
	updates := []string{}
	args := []interface{}{orgID, id}
	argIdx := 3

	if req.Title != nil {
		updates = append(updates, fmt.Sprintf("title = $%d", argIdx))
		args = append(args, *req.Title)
		argIdx++
	}
	if req.Description != nil {
		updates = append(updates, fmt.Sprintf("description = $%d", argIdx))
		args = append(args, *req.Description)
		argIdx++
	}
	if req.AssigneeID != nil {
		updates = append(updates, fmt.Sprintf("assignee_id = $%d", argIdx))
		args = append(args, *req.AssigneeID)
		argIdx++
	}
	if req.Priority != nil {
		updates = append(updates, fmt.Sprintf("priority = $%d", argIdx))
		args = append(args, *req.Priority)
		argIdx++
	}
	if req.DueDate != nil {
		// Parse date string
		dueDate, err := parseDateString(req.DueDate)
		if err != nil {
			return nil, apperr.New(apperr.CodeValidation, err.Error())
		}
		updates = append(updates, fmt.Sprintf("due_date = $%d", argIdx))
		args = append(args, dueDate)
		// argIdx++ // Not needed as this is the last field
	}

	if len(updates) == 0 {
		// No updates - just fetch and return
		task, err := r.GetTask(ctx, orgID, id)
		if err != nil {
			return nil, err
		}
		return &task.Task, nil
	}

	var t Task
	query := fmt.Sprintf(`
		UPDATE tasks SET %s
		WHERE organisation_id = $1 AND id = $2
		RETURNING id, organisation_id, task_list_id, title, description, assignee_id,
		          created_by, priority, due_date, position, completed_at, created_at, updated_at
	`, strings.Join(updates, ", "))

	err := r.db.QueryRow(ctx, query, args...).Scan(
		&t.ID, &t.OrganisationID, &t.TaskListID, &t.Title, &t.Description, &t.AssigneeID,
		&t.CreatedBy, &t.Priority, &t.DueDate, &t.Position, &t.CompletedAt, &t.CreatedAt, &t.UpdatedAt,
	)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, ErrTaskNotFound()
		}
		return nil, err
	}
	return &t, nil
}

func (r *Repository) MoveTask(ctx context.Context, orgID, taskID uuid.UUID, newListID uuid.UUID, newPosition int) (*Task, error) {
	// Verify new list exists, is active, and check if it's a final state
	var isActive, isFinalState bool
	err := r.db.QueryRow(ctx, `
		SELECT is_active, is_final_state FROM task_lists WHERE organisation_id = $1 AND id = $2
	`, orgID, newListID).Scan(&isActive, &isFinalState)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, ErrTaskListNotFound()
		}
		return nil, err
	}
	if !isActive {
		return nil, ErrTaskListInactive("")
	}

	// Set completed_at when moving to final state, clear when moving out
	var t Task
	err = r.db.QueryRow(ctx, `
		UPDATE tasks
		SET task_list_id = $3, position = $4,
		    completed_at = CASE WHEN $5 THEN COALESCE(completed_at, NOW()) ELSE NULL END
		WHERE organisation_id = $1 AND id = $2
		RETURNING id, organisation_id, task_list_id, title, description, assignee_id,
		          created_by, priority, due_date, position, completed_at, created_at, updated_at
	`, orgID, taskID, newListID, newPosition, isFinalState).Scan(
		&t.ID, &t.OrganisationID, &t.TaskListID, &t.Title, &t.Description, &t.AssigneeID,
		&t.CreatedBy, &t.Priority, &t.DueDate, &t.Position, &t.CompletedAt, &t.CreatedAt, &t.UpdatedAt,
	)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, ErrTaskNotFound()
		}
		return nil, err
	}
	return &t, nil
}

func (r *Repository) ToggleTaskCompletion(ctx context.Context, orgID, taskID uuid.UUID) (*Task, error) {
	var t Task
	err := r.db.QueryRow(ctx, `
		UPDATE tasks 
		SET completed_at = CASE WHEN completed_at IS NULL THEN NOW() ELSE NULL END
		WHERE organisation_id = $1 AND id = $2
		RETURNING id, organisation_id, task_list_id, title, description, assignee_id,
		          created_by, priority, due_date, position, completed_at, created_at, updated_at
	`, orgID, taskID).Scan(
		&t.ID, &t.OrganisationID, &t.TaskListID, &t.Title, &t.Description, &t.AssigneeID,
		&t.CreatedBy, &t.Priority, &t.DueDate, &t.Position, &t.CompletedAt, &t.CreatedAt, &t.UpdatedAt,
	)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, ErrTaskNotFound()
		}
		return nil, err
	}
	return &t, nil
}

func (r *Repository) DeleteTask(ctx context.Context, orgID, id uuid.UUID) error {
	tag, err := r.db.Exec(ctx, `
		DELETE FROM tasks WHERE organisation_id = $1 AND id = $2
	`, orgID, id)
	if err != nil {
		return err
	}
	if tag.RowsAffected() == 0 {
		return ErrTaskNotFound()
	}
	return nil
}

// ── Comments ─────────────────────────────────────────────────────────────────

func (r *Repository) ListComments(ctx context.Context, orgID, taskID uuid.UUID) ([]TaskCommentWithAuthor, error) {
	rows, err := r.db.Query(ctx, `
		SELECT 
			tc.id, tc.organisation_id, tc.task_id, tc.author_id, tc.parent_id,
			tc.body, tc.content_type, tc.created_at, tc.updated_at,
			e.full_name AS author_name
		FROM task_comments tc
		JOIN employees e ON tc.author_id = e.id
		WHERE tc.organisation_id = $1 AND tc.task_id = $2
		ORDER BY tc.created_at ASC
	`, orgID, taskID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	// Build flat list with all comments
	var allComments []TaskCommentWithAuthor

	for rows.Next() {
		var tc TaskCommentWithAuthor
		if err := rows.Scan(
			&tc.ID, &tc.OrganisationID, &tc.TaskID, &tc.AuthorID, &tc.ParentID,
			&tc.Body, &tc.ContentType, &tc.CreatedAt, &tc.UpdatedAt, &tc.AuthorName,
		); err != nil {
			return nil, err
		}
		allComments = append(allComments, tc)
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}

	// Return flat list - let frontend build hierarchy
	return allComments, nil
}

func (r *Repository) CreateComment(ctx context.Context, orgID, taskID, authorID uuid.UUID, parentID *uuid.UUID, body, contentType string) (*TaskComment, error) {
	// Verify task exists
	var exists bool
	err := r.db.QueryRow(ctx, `
		SELECT EXISTS(SELECT 1 FROM tasks WHERE organisation_id = $1 AND id = $2)
	`, orgID, taskID).Scan(&exists)
	if err != nil {
		return nil, err
	}
	if !exists {
		return nil, ErrTaskNotFound()
	}

	// Verify parent comment exists and belongs to same task (if parentID provided)
	if parentID != nil {
		err := r.db.QueryRow(ctx, `
			SELECT EXISTS(
				SELECT 1 FROM task_comments 
				WHERE organisation_id = $1 AND id = $2 AND task_id = $3
			)
		`, orgID, *parentID, taskID).Scan(&exists)
		if err != nil {
			return nil, err
		}
		if !exists {
			return nil, apperr.New(apperr.CodeNotFound, "parent comment not found")
		}
	}

	// Default to 'plain' if not specified
	if contentType == "" {
		contentType = "plain"
	}

	var tc TaskComment
	err = r.db.QueryRow(ctx, `
		INSERT INTO task_comments (organisation_id, task_id, author_id, parent_id, body, content_type)
		VALUES ($1, $2, $3, $4, $5, $6)
		RETURNING id, organisation_id, task_id, author_id, parent_id, body, content_type, created_at, updated_at
	`, orgID, taskID, authorID, parentID, body, contentType).Scan(
		&tc.ID, &tc.OrganisationID, &tc.TaskID, &tc.AuthorID, &tc.ParentID, &tc.Body, &tc.ContentType, &tc.CreatedAt, &tc.UpdatedAt,
	)
	if err != nil {
		return nil, err
	}
	return &tc, nil
}

func (r *Repository) DeleteComment(ctx context.Context, orgID, commentID, authorID uuid.UUID) error {
	tag, err := r.db.Exec(ctx, `
		DELETE FROM task_comments 
		WHERE organisation_id = $1 AND id = $2 AND author_id = $3
	`, orgID, commentID, authorID)
	if err != nil {
		return err
	}
	if tag.RowsAffected() == 0 {
		return ErrUnauthorizedCommentDelete()
	}
	return nil
}

// ── Reactions ────────────────────────────────────────────────────────────────

func (r *Repository) ToggleReaction(ctx context.Context, orgID, commentID, employeeID uuid.UUID, emoji string) (added bool, err error) {
	// Check if reaction already exists
	var exists bool
	err = r.db.QueryRow(ctx, `
		SELECT EXISTS(
			SELECT 1 FROM comment_reactions 
			WHERE organisation_id = $1 AND comment_id = $2 AND employee_id = $3 AND emoji = $4
		)
	`, orgID, commentID, employeeID, emoji).Scan(&exists)
	if err != nil {
		return false, err
	}

	if exists {
		// Remove reaction
		_, err = r.db.Exec(ctx, `
			DELETE FROM comment_reactions 
			WHERE organisation_id = $1 AND comment_id = $2 AND employee_id = $3 AND emoji = $4
		`, orgID, commentID, employeeID, emoji)
		return false, err
	}

	// Add reaction
	_, err = r.db.Exec(ctx, `
		INSERT INTO comment_reactions (organisation_id, comment_id, employee_id, emoji)
		VALUES ($1, $2, $3, $4)
	`, orgID, commentID, employeeID, emoji)
	return true, err
}

func (r *Repository) ListReactions(ctx context.Context, orgID, commentID, currentEmployeeID uuid.UUID) ([]CommentReactionSummary, error) {
	rows, err := r.db.Query(ctx, `
		SELECT 
			emoji,
			COUNT(*) as count,
			BOOL_OR(employee_id = $3) as user_reacted
		FROM comment_reactions
		WHERE organisation_id = $1 AND comment_id = $2
		GROUP BY emoji
		ORDER BY count DESC, emoji ASC
	`, orgID, commentID, currentEmployeeID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var reactions []CommentReactionSummary
	for rows.Next() {
		var r CommentReactionSummary
		if err := rows.Scan(&r.Emoji, &r.Count, &r.UserReacted); err != nil {
			return nil, err
		}
		reactions = append(reactions, r)
	}
	return reactions, rows.Err()
}

// ── Helper Functions ─────────────────────────────────────────────────────────

func nilIfEmpty(s string) *string {
	if s == "" {
		return nil
	}
	return &s
}

func ptrToUUID(s *string) *uuid.UUID {
	if s == nil || *s == "" {
		return nil
	}
	id, err := uuid.Parse(*s)
	if err != nil {
		return nil
	}
	return &id
}

// ── Field Definitions ─────────────────────────────────────────────────────────

// scanFieldDefinition scans a single row into a FieldDefinition, decoding JSONB columns.
func scanFieldDefinition(row pgx.Row) (*FieldDefinition, error) {
	var fd FieldDefinition
	var optionsRaw, configRaw []byte
	err := row.Scan(
		&fd.ID, &fd.OrganisationID, &fd.Name, &fd.FieldType,
		&fd.Description, &optionsRaw, &configRaw,
		&fd.SortOrder, &fd.IsActive, &fd.CreatedAt, &fd.UpdatedAt,
	)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, ErrFieldDefinitionNotFound()
		}
		return nil, err
	}
	if len(optionsRaw) > 0 {
		if err := json.Unmarshal(optionsRaw, &fd.Options); err != nil {
			return nil, fmt.Errorf("decode options: %w", err)
		}
	}
	if len(configRaw) > 0 {
		if err := json.Unmarshal(configRaw, &fd.Config); err != nil {
			return nil, fmt.Errorf("decode config: %w", err)
		}
	}
	return &fd, nil
}

const fieldDefinitionColumns = `id, organisation_id, name, field_type, description, options, config, sort_order, is_active, created_at, updated_at`

func (r *Repository) ListFieldDefinitions(ctx context.Context, orgID uuid.UUID) ([]FieldDefinition, error) {
	rows, err := r.db.Query(ctx, `
		SELECT `+fieldDefinitionColumns+`
		FROM task_field_definitions
		WHERE organisation_id = $1 AND is_active = TRUE
		ORDER BY sort_order ASC, created_at ASC
	`, orgID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var defs []FieldDefinition
	for rows.Next() {
		var fd FieldDefinition
		var optionsRaw, configRaw []byte
		if err := rows.Scan(
			&fd.ID, &fd.OrganisationID, &fd.Name, &fd.FieldType,
			&fd.Description, &optionsRaw, &configRaw,
			&fd.SortOrder, &fd.IsActive, &fd.CreatedAt, &fd.UpdatedAt,
		); err != nil {
			return nil, err
		}
		if len(optionsRaw) > 0 {
			if err := json.Unmarshal(optionsRaw, &fd.Options); err != nil {
				return nil, fmt.Errorf("decode options: %w", err)
			}
		}
		if len(configRaw) > 0 {
			if err := json.Unmarshal(configRaw, &fd.Config); err != nil {
				return nil, fmt.Errorf("decode config: %w", err)
			}
		}
		defs = append(defs, fd)
	}
	return defs, rows.Err()
}

func (r *Repository) GetFieldDefinition(ctx context.Context, orgID, id uuid.UUID) (*FieldDefinition, error) {
	row := r.db.QueryRow(ctx, `
		SELECT `+fieldDefinitionColumns+`
		FROM task_field_definitions
		WHERE organisation_id = $1 AND id = $2
	`, orgID, id)
	return scanFieldDefinition(row)
}

func (r *Repository) CreateFieldDefinition(ctx context.Context, orgID uuid.UUID, req CreateFieldDefinitionRequest) (*FieldDefinition, error) {
	optionsJSON, err := marshalFieldOptions(req.Options)
	if err != nil {
		return nil, err
	}
	configJSON, err := marshalFieldConfig(req.Config)
	if err != nil {
		return nil, err
	}

	row := r.db.QueryRow(ctx, `
		INSERT INTO task_field_definitions
			(organisation_id, name, field_type, description, options, config, sort_order)
		VALUES ($1, $2, $3, $4, $5, $6, $7)
		RETURNING `+fieldDefinitionColumns,
		orgID, req.Name, req.FieldType, req.Description, optionsJSON, configJSON, req.SortOrder,
	)
	fd, err := scanFieldDefinition(row)
	if err != nil {
		if isUniqueViolation(err) {
			return nil, ErrFieldDefinitionDuplicate(req.Name)
		}
		return nil, err
	}
	return fd, nil
}

func (r *Repository) UpdateFieldDefinition(ctx context.Context, orgID, id uuid.UUID, req UpdateFieldDefinitionRequest) (*FieldDefinition, error) {
	optionsJSON, err := marshalFieldOptions(req.Options)
	if err != nil {
		return nil, err
	}

	setClauses := []string{"updated_at = NOW()"}
	args := []any{orgID, id}
	argIdx := 3

	if req.Name != nil {
		setClauses = append(setClauses, fmt.Sprintf("name = $%d", argIdx))
		args = append(args, *req.Name)
		argIdx++
	}
	if req.Description != nil {
		setClauses = append(setClauses, fmt.Sprintf("description = $%d", argIdx))
		args = append(args, *req.Description)
		argIdx++
	}
	if req.Options != nil {
		setClauses = append(setClauses, fmt.Sprintf("options = $%d", argIdx))
		args = append(args, optionsJSON)
		argIdx++
	}
	if req.Config != nil {
		configJSON, err := marshalFieldConfig(req.Config)
		if err != nil {
			return nil, err
		}
		setClauses = append(setClauses, fmt.Sprintf("config = $%d", argIdx))
		args = append(args, configJSON)
		argIdx++
	}
	if req.SortOrder != nil {
		setClauses = append(setClauses, fmt.Sprintf("sort_order = $%d", argIdx))
		args = append(args, *req.SortOrder)
		argIdx++
	}

	query := fmt.Sprintf(`
		UPDATE task_field_definitions
		SET %s
		WHERE organisation_id = $1 AND id = $2 AND is_active = TRUE
		RETURNING `+fieldDefinitionColumns,
		strings.Join(setClauses, ", "),
	)

	row := r.db.QueryRow(ctx, query, args...)
	fd, err := scanFieldDefinition(row)
	if err != nil {
		if isUniqueViolation(err) {
			return nil, ErrFieldDefinitionDuplicate(*req.Name)
		}
		return nil, err
	}
	return fd, nil
}

func (r *Repository) DeactivateFieldDefinition(ctx context.Context, orgID, id uuid.UUID) error {
	tag, err := r.db.Exec(ctx, `
		UPDATE task_field_definitions
		SET is_active = FALSE, updated_at = NOW()
		WHERE organisation_id = $1 AND id = $2 AND is_active = TRUE
	`, orgID, id)
	if err != nil {
		return err
	}
	if tag.RowsAffected() == 0 {
		return ErrFieldDefinitionNotFound()
	}
	return nil
}

// ── Field Definition helpers ──────────────────────────────────────────────────

func marshalFieldOptions(opts []FieldOption) ([]byte, error) {
	if len(opts) == 0 {
		return nil, nil
	}
	b, err := json.Marshal(opts)
	if err != nil {
		return nil, fmt.Errorf("marshal options: %w", err)
	}
	return b, nil
}

func marshalFieldConfig(cfg *FieldConfig) ([]byte, error) {
	if cfg == nil {
		return nil, nil
	}
	b, err := json.Marshal(cfg)
	if err != nil {
		return nil, fmt.Errorf("marshal config: %w", err)
	}
	return b, nil
}

// isUniqueViolation checks if an error is a PostgreSQL unique constraint violation (23505).
// Defined here to avoid circular dependency; same logic used in employee repository.
func isUniqueViolation(err error) bool {
	if err == nil {
		return false
	}
	return strings.Contains(err.Error(), "23505") || strings.Contains(err.Error(), "unique constraint")
}

// ── Field Values ──────────────────────────────────────────────────────────────

const fieldValueJoinColumns = `
	tfv.id, tfv.organisation_id, tfv.task_id, tfv.field_id,
	tfv.value_text, tfv.value_number, tfv.value_date, tfv.value_boolean, tfv.value_json,
	tfv.created_at, tfv.updated_at,
	tfd.name AS field_name, tfd.field_type`

func scanFieldValueWithDef(rows pgx.Rows) (FieldValueWithDefinition, error) {
	var fv FieldValueWithDefinition
	var valueDate *time.Time
	var valueJSON []byte
	if err := rows.Scan(
		new(string), new(string), new(string), &fv.FieldID,
		&fv.ValueText, &fv.ValueNumber, &valueDate, &fv.ValueBoolean, &valueJSON,
		new(time.Time), new(time.Time),
		&fv.FieldName, &fv.FieldType,
	); err != nil {
		return fv, err
	}
	if valueDate != nil {
		s := valueDate.Format("2006-01-02")
		fv.ValueDate = &s
	}
	if len(valueJSON) > 0 {
		raw := json.RawMessage(valueJSON)
		fv.ValueJSON = &raw
	}
	return fv, nil
}

func (r *Repository) GetTaskFieldValues(ctx context.Context, orgID, taskID uuid.UUID) ([]FieldValueWithDefinition, error) {
	rows, err := r.db.Query(ctx, `
		SELECT `+fieldValueJoinColumns+`
		FROM task_field_values tfv
		JOIN task_field_definitions tfd ON tfv.field_id = tfd.id
		WHERE tfv.organisation_id = $1 AND tfv.task_id = $2
		ORDER BY tfd.sort_order ASC, tfd.created_at ASC
	`, orgID, taskID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var vals []FieldValueWithDefinition
	for rows.Next() {
		fv, err := scanFieldValueWithDef(rows)
		if err != nil {
			return nil, err
		}
		vals = append(vals, fv)
	}
	return vals, rows.Err()
}

func (r *Repository) BatchGetFieldValues(ctx context.Context, orgID uuid.UUID, taskIDs []uuid.UUID) (map[uuid.UUID][]FieldValueWithDefinition, error) {
	if len(taskIDs) == 0 {
		return map[uuid.UUID][]FieldValueWithDefinition{}, nil
	}

	rows, err := r.db.Query(ctx, `
		SELECT tfv.task_id, `+fieldValueJoinColumns+`
		FROM task_field_values tfv
		JOIN task_field_definitions tfd ON tfv.field_id = tfd.id
		WHERE tfv.organisation_id = $1 AND tfv.task_id = ANY($2)
		ORDER BY tfv.task_id, tfd.sort_order ASC, tfd.created_at ASC
	`, orgID, taskIDs)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	result := make(map[uuid.UUID][]FieldValueWithDefinition)
	for rows.Next() {
		var taskID uuid.UUID
		var fv FieldValueWithDefinition
		var valueDate *time.Time
		var valueJSON []byte
		if err := rows.Scan(
			&taskID,
			new(uuid.UUID), new(uuid.UUID), new(uuid.UUID), &fv.FieldID,
			&fv.ValueText, &fv.ValueNumber, &valueDate, &fv.ValueBoolean, &valueJSON,
			new(time.Time), new(time.Time),
			&fv.FieldName, &fv.FieldType,
		); err != nil {
			return nil, err
		}
		if valueDate != nil {
			s := valueDate.Format("2006-01-02")
			fv.ValueDate = &s
		}
		if len(valueJSON) > 0 {
			raw := json.RawMessage(valueJSON)
			fv.ValueJSON = &raw
		}
		result[taskID] = append(result[taskID], fv)
	}
	return result, rows.Err()
}

// SetFieldValue upserts a value into task_field_values.
// fieldType drives which column is written; other columns are set to NULL.
func (r *Repository) SetFieldValue(ctx context.Context, orgID, taskID, fieldID uuid.UUID, req SetFieldValueRequest, fieldType string) (*FieldValue, error) {
	// Decode the raw JSON value into the appropriate typed column
	var (
		valueText    *string
		valueNumber  *int64
		valueDate    *time.Time
		valueBoolean *bool
		valueJSON    []byte
	)

	switch fieldType {
	case "text", "url":
		var s string
		if err := json.Unmarshal(req.Value, &s); err != nil {
			return nil, ErrFieldValueInvalidType(fieldType)
		}
		valueText = &s
	case "number", "rating":
		var n int64
		if err := json.Unmarshal(req.Value, &n); err != nil {
			return nil, ErrFieldValueInvalidType(fieldType)
		}
		valueNumber = &n
	case "date":
		var s string
		if err := json.Unmarshal(req.Value, &s); err != nil {
			return nil, ErrFieldValueInvalidType(fieldType)
		}
		t, err := time.ParseInLocation("2006-01-02", s, time.UTC)
		if err != nil {
			return nil, ErrFieldValueInvalidType(fieldType)
		}
		valueDate = &t
	case "boolean":
		var b bool
		if err := json.Unmarshal(req.Value, &b); err != nil {
			return nil, ErrFieldValueInvalidType(fieldType)
		}
		valueBoolean = &b
	case "select", "multi_select", "employee":
		// Store as-is in value_json; caller validates select options at service layer
		valueJSON = req.Value
	default:
		return nil, ErrInvalidFieldType(fieldType)
	}

	var fv FieldValue
	var scannedDate *time.Time
	var scannedJSON []byte

	err := r.db.QueryRow(ctx, `
		INSERT INTO task_field_values
			(organisation_id, task_id, field_id, value_text, value_number, value_date, value_boolean, value_json)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
		ON CONFLICT (task_id, field_id) DO UPDATE SET
			value_text    = EXCLUDED.value_text,
			value_number  = EXCLUDED.value_number,
			value_date    = EXCLUDED.value_date,
			value_boolean = EXCLUDED.value_boolean,
			value_json    = EXCLUDED.value_json,
			updated_at    = NOW()
		RETURNING id, organisation_id, task_id, field_id,
			value_text, value_number, value_date, value_boolean, value_json,
			created_at, updated_at
	`, orgID, taskID, fieldID, valueText, valueNumber, valueDate, valueBoolean, valueJSON,
	).Scan(
		&fv.ID, &fv.OrganisationID, &fv.TaskID, &fv.FieldID,
		&fv.ValueText, &fv.ValueNumber, &scannedDate, &fv.ValueBoolean, &scannedJSON,
		&fv.CreatedAt, &fv.UpdatedAt,
	)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, ErrTaskFieldNotFound()
		}
		return nil, err
	}

	if scannedDate != nil {
		s := scannedDate.Format("2006-01-02")
		fv.ValueDate = &s
	}
	if len(scannedJSON) > 0 {
		raw := json.RawMessage(scannedJSON)
		fv.ValueJSON = &raw
	}
	return &fv, nil
}

func (r *Repository) ClearFieldValue(ctx context.Context, orgID, taskID, fieldID uuid.UUID) error {
	tag, err := r.db.Exec(ctx, `
		DELETE FROM task_field_values
		WHERE organisation_id = $1 AND task_id = $2 AND field_id = $3
	`, orgID, taskID, fieldID)
	if err != nil {
		return err
	}
	if tag.RowsAffected() == 0 {
		return ErrFieldValueNotFound()
	}
	return nil
}
