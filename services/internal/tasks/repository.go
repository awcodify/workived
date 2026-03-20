package tasks

import (
	"context"
	"errors"
	"fmt"
	"strings"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/rs/zerolog"
	"github.com/workived/services/pkg/paginate"
)

type Repository struct {
	db  *pgxpool.Pool
	log zerolog.Logger
}

func NewRepository(db *pgxpool.Pool, log zerolog.Logger) *Repository {
	return &Repository{db: db, log: log}
}

// ── Task Lists ───────────────────────────────────────────────────────────────

func (r *Repository) ListTaskLists(ctx context.Context, orgID uuid.UUID) ([]TaskList, error) {
	rows, err := r.db.Query(ctx, `
		SELECT id, organisation_id, name, position, is_active, created_at, updated_at
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
		if err := rows.Scan(&tl.ID, &tl.OrganisationID, &tl.Name, &tl.Position, &tl.IsActive, &tl.CreatedAt, &tl.UpdatedAt); err != nil {
			return nil, err
		}
		lists = append(lists, tl)
	}
	return lists, rows.Err()
}

func (r *Repository) GetTaskList(ctx context.Context, orgID, id uuid.UUID) (*TaskList, error) {
	var tl TaskList
	err := r.db.QueryRow(ctx, `
		SELECT id, organisation_id, name, position, is_active, created_at, updated_at
		FROM task_lists
		WHERE organisation_id = $1 AND id = $2
	`, orgID, id).Scan(&tl.ID, &tl.OrganisationID, &tl.Name, &tl.Position, &tl.IsActive, &tl.CreatedAt, &tl.UpdatedAt)
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

	var tl TaskList
	err = r.db.QueryRow(ctx, `
		INSERT INTO task_lists (organisation_id, name, position)
		VALUES ($1, $2, $3)
		RETURNING id, organisation_id, name, position, is_active, created_at, updated_at
	`, orgID, req.Name, maxPosition+1000).Scan(&tl.ID, &tl.OrganisationID, &tl.Name, &tl.Position, &tl.IsActive, &tl.CreatedAt, &tl.UpdatedAt)
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
		argIdx++
	}

	if len(updates) == 0 {
		return r.GetTaskList(ctx, orgID, id)
	}

	var tl TaskList
	query := fmt.Sprintf(`
		UPDATE task_lists SET %s
		WHERE organisation_id = $1 AND id = $2
		RETURNING id, organisation_id, name, position, is_active, created_at, updated_at
	`, strings.Join(updates, ", "))

	err := r.db.QueryRow(ctx, query, args...).Scan(&tl.ID, &tl.OrganisationID, &tl.Name, &tl.Position, &tl.IsActive, &tl.CreatedAt, &tl.UpdatedAt)
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
			t.completed_at, t.created_at, t.updated_at,
			assignee.full_name AS assignee_name,
			creator.full_name AS creator_name,
			tl.name AS list_name
		FROM tasks t
		JOIN employees creator ON t.created_by = creator.id
		JOIN task_lists tl ON t.task_list_id = tl.id
		LEFT JOIN employees assignee ON t.assignee_id = assignee.id
		WHERE t.organisation_id = $1
		  AND ($2::uuid IS NULL OR t.task_list_id = $2::uuid)
		  AND ($3::uuid IS NULL OR t.assignee_id = $3::uuid)
		  AND ($4::varchar IS NULL OR t.priority = $4)
		  AND ($5::varchar IS NULL OR (
			  CASE WHEN $5 = 'completed' THEN t.completed_at IS NOT NULL
			       WHEN $5 = 'pending' THEN t.completed_at IS NULL
			       ELSE TRUE END
		  ))
		  AND ($6::timestamptz IS NULL OR t.created_at < $6::timestamptz)
		ORDER BY t.created_at DESC
		LIMIT $7
	`

	rows, err := r.db.Query(ctx, query,
		orgID,
		ptrToUUID(filters.TaskListID),
		ptrToUUID(filters.AssigneeID),
		filters.Priority,
		filters.Status,
		nilIfEmpty(cursor.Value),
		limit+1,
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
			&t.CompletedAt, &t.CreatedAt, &t.UpdatedAt,
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
			t.completed_at, t.created_at, t.updated_at,
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
		&t.CompletedAt, &t.CreatedAt, &t.UpdatedAt,
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
	// Verify task list exists and is active
	var isActive bool
	err := r.db.QueryRow(ctx, `
		SELECT is_active FROM task_lists WHERE organisation_id = $1 AND id = $2
	`, orgID, req.TaskListID).Scan(&isActive)
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

	var t Task
	err = r.db.QueryRow(ctx, `
		INSERT INTO tasks (
			organisation_id, task_list_id, title, description, assignee_id,
			created_by, priority, due_date, position
		) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
		RETURNING id, organisation_id, task_list_id, title, description, assignee_id,
		          created_by, priority, due_date, position, completed_at, created_at, updated_at
	`, orgID, req.TaskListID, req.Title, req.Description, req.AssigneeID,
		createdBy, priority, req.DueDate, maxPosition+1000).Scan(
		&t.ID, &t.OrganisationID, &t.TaskListID, &t.Title, &t.Description, &t.AssigneeID,
		&t.CreatedBy, &t.Priority, &t.DueDate, &t.Position, &t.CompletedAt, &t.CreatedAt, &t.UpdatedAt,
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
		updates = append(updates, fmt.Sprintf("due_date = $%d", argIdx))
		args = append(args, *req.DueDate)
		argIdx++
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
	// Verify new list exists and is active
	var isActive bool
	err := r.db.QueryRow(ctx, `
		SELECT is_active FROM task_lists WHERE organisation_id = $1 AND id = $2
	`, orgID, newListID).Scan(&isActive)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, ErrTaskListNotFound()
		}
		return nil, err
	}
	if !isActive {
		return nil, ErrTaskListInactive("")
	}

	var t Task
	err = r.db.QueryRow(ctx, `
		UPDATE tasks 
		SET task_list_id = $3, position = $4
		WHERE organisation_id = $1 AND id = $2
		RETURNING id, organisation_id, task_list_id, title, description, assignee_id,
		          created_by, priority, due_date, position, completed_at, created_at, updated_at
	`, orgID, taskID, newListID, newPosition).Scan(
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
			tc.id, tc.organisation_id, tc.task_id, tc.author_id, tc.body,
			tc.created_at, tc.updated_at,
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

	var comments []TaskCommentWithAuthor
	for rows.Next() {
		var tc TaskCommentWithAuthor
		if err := rows.Scan(
			&tc.ID, &tc.OrganisationID, &tc.TaskID, &tc.AuthorID, &tc.Body,
			&tc.CreatedAt, &tc.UpdatedAt, &tc.AuthorName,
		); err != nil {
			return nil, err
		}
		comments = append(comments, tc)
	}
	return comments, rows.Err()
}

func (r *Repository) CreateComment(ctx context.Context, orgID, taskID, authorID uuid.UUID, body string) (*TaskComment, error) {
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

	var tc TaskComment
	err = r.db.QueryRow(ctx, `
		INSERT INTO task_comments (organisation_id, task_id, author_id, body)
		VALUES ($1, $2, $3, $4)
		RETURNING id, organisation_id, task_id, author_id, body, created_at, updated_at
	`, orgID, taskID, authorID, body).Scan(
		&tc.ID, &tc.OrganisationID, &tc.TaskID, &tc.AuthorID, &tc.Body, &tc.CreatedAt, &tc.UpdatedAt,
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
