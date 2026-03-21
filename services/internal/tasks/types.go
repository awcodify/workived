package tasks

import (
	"context"
	"fmt"
	"time"

	"github.com/google/uuid"
	"github.com/workived/services/pkg/apperr"
)

// ── Domain Models ────────────────────────────────────────────────────────────

type TaskList struct {
	ID             uuid.UUID `json:"id"`
	OrganisationID uuid.UUID `json:"organisation_id"`
	Name           string    `json:"name"`
	Position       int       `json:"position"`
	IsFinalState   bool      `json:"is_final_state"` // Auto-mark tasks as complete when moved to this list
	IsActive       bool      `json:"is_active"`
	CreatedAt      time.Time `json:"created_at"`
	UpdatedAt      time.Time `json:"updated_at"`
}

type Task struct {
	ID             uuid.UUID  `json:"id"`
	OrganisationID uuid.UUID  `json:"organisation_id"`
	TaskListID     uuid.UUID  `json:"task_list_id"`
	Title          string     `json:"title"`
	Description    *string    `json:"description,omitempty"`
	AssigneeID     *uuid.UUID `json:"assignee_id,omitempty"`
	CreatedBy      uuid.UUID  `json:"created_by"`
	Priority       string     `json:"priority"` // low, medium, high, urgent
	DueDate        *time.Time `json:"due_date,omitempty"`
	Position       int        `json:"position"`
	CompletedAt    *time.Time `json:"completed_at,omitempty"`
	CreatedAt      time.Time  `json:"created_at"`
	UpdatedAt      time.Time  `json:"updated_at"`
}

// TaskWithDetails includes joined employee names
type TaskWithDetails struct {
	Task
	AssigneeName *string `json:"assignee_name,omitempty"`
	CreatorName  string  `json:"creator_name"`
	ListName     string  `json:"list_name"`
}

type TaskComment struct {
	ID             uuid.UUID  `json:"id"`
	OrganisationID uuid.UUID  `json:"organisation_id"`
	TaskID         uuid.UUID  `json:"task_id"`
	AuthorID       uuid.UUID  `json:"author_id"`
	ParentID       *uuid.UUID `json:"parent_id,omitempty"` // For nested replies
	Body           string     `json:"body"`
	ContentType    string     `json:"content_type"` // "plain" or "markdown"
	CreatedAt      time.Time  `json:"created_at"`
	UpdatedAt      time.Time  `json:"updated_at"`
}

// TaskCommentWithAuthor includes author name and nested replies
type TaskCommentWithAuthor struct {
	TaskComment
	AuthorName string                  `json:"author_name"`
	Replies    []TaskCommentWithAuthor `json:"replies,omitempty"` // Nested comments
}

// CommentReaction represents an emoji reaction to a comment
type CommentReaction struct {
	ID             uuid.UUID `json:"id"`
	OrganisationID uuid.UUID `json:"organisation_id"`
	CommentID      uuid.UUID `json:"comment_id"`
	EmployeeID     uuid.UUID `json:"employee_id"`
	Emoji          string    `json:"emoji"`
	CreatedAt      time.Time `json:"created_at"`
}

// CommentReactionSummary represents aggregated reaction counts
type CommentReactionSummary struct {
	Emoji       string `json:"emoji"`
	Count       int    `json:"count"`
	UserReacted bool   `json:"user_reacted"` // Whether current user reacted with this emoji
}

// ── Request DTOs ─────────────────────────────────────────────────────────────

type CreateListRequest struct {
	Name string `json:"name" binding:"required,max=100"`
}

type UpdateListRequest struct {
	Name     *string `json:"name,omitempty" binding:"omitempty,max=100"`
	Position *int    `json:"position,omitempty"`
}

type CreateTaskRequest struct {
	TaskListID  uuid.UUID  `json:"task_list_id" binding:"required"`
	Title       string     `json:"title" binding:"required,max=500"`
	Description *string    `json:"description,omitempty" binding:"omitempty,max=5000"`
	AssigneeID  *uuid.UUID `json:"assignee_id,omitempty"`
	Priority    string     `json:"priority" binding:"omitempty,oneof=low medium high urgent"`
	DueDate     *time.Time `json:"due_date,omitempty"`
}

type UpdateTaskRequest struct {
	Title       *string    `json:"title,omitempty" binding:"omitempty,max=500"`
	Description *string    `json:"description,omitempty" binding:"omitempty,max=5000"`
	AssigneeID  *uuid.UUID `json:"assignee_id,omitempty"`
	Priority    *string    `json:"priority,omitempty" binding:"omitempty,oneof=low medium high urgent"`
	DueDate     *time.Time `json:"due_date,omitempty"`
}

type MoveTaskRequest struct {
	TaskListID uuid.UUID `json:"task_list_id" binding:"required"`
	Position   int       `json:"position" binding:"min=0"`
}

type CreateCommentRequest struct {
	ParentID    *uuid.UUID `json:"parent_id,omitempty"`
	Body        string     `json:"body" binding:"required,max=5000"`
	ContentType string     `json:"content_type,omitempty" binding:"omitempty,oneof=plain markdown"`
}

type ToggleReactionRequest struct {
	Emoji string `json:"emoji" binding:"required,max=10"`
}

// ── Filter types ─────────────────────────────────────────────────────────────

type TaskFilters struct {
	TaskListID *string `form:"task_list_id"`
	AssigneeID *string `form:"assignee_id"`
	Priority   *string `form:"priority"`
	Status     *string `form:"status"` // completed, pending
	Cursor     string  `form:"cursor"`
	Limit      int     `form:"limit"`
}

// ── Repository Interface ─────────────────────────────────────────────────────

type RepositoryInterface interface {
	// Task Lists
	ListTaskLists(ctx context.Context, orgID uuid.UUID) ([]TaskList, error)
	GetTaskList(ctx context.Context, orgID, id uuid.UUID) (*TaskList, error)
	CreateTaskList(ctx context.Context, orgID uuid.UUID, req CreateListRequest) (*TaskList, error)
	UpdateTaskList(ctx context.Context, orgID, id uuid.UUID, req UpdateListRequest) (*TaskList, error)
	DeactivateTaskList(ctx context.Context, orgID, id uuid.UUID) error
	CountTaskLists(ctx context.Context, orgID uuid.UUID) (int, error)

	// Tasks
	ListTasks(ctx context.Context, orgID uuid.UUID, filters TaskFilters) ([]TaskWithDetails, error)
	GetTask(ctx context.Context, orgID, id uuid.UUID) (*TaskWithDetails, error)
	CreateTask(ctx context.Context, orgID, createdBy uuid.UUID, req CreateTaskRequest) (*Task, error)
	UpdateTask(ctx context.Context, orgID, id uuid.UUID, req UpdateTaskRequest) (*Task, error)
	MoveTask(ctx context.Context, orgID, taskID uuid.UUID, newListID uuid.UUID, newPosition int) (*Task, error)
	ToggleTaskCompletion(ctx context.Context, orgID, taskID uuid.UUID) (*Task, error)
	DeleteTask(ctx context.Context, orgID, id uuid.UUID) error

	// Comments
	ListComments(ctx context.Context, orgID, taskID uuid.UUID) ([]TaskCommentWithAuthor, error)
	CreateComment(ctx context.Context, orgID, taskID, authorID uuid.UUID, parentID *uuid.UUID, body, contentType string) (*TaskComment, error)
	DeleteComment(ctx context.Context, orgID, commentID, authorID uuid.UUID) error

	// Reactions
	ToggleReaction(ctx context.Context, orgID, commentID, employeeID uuid.UUID, emoji string) (added bool, err error)
	ListReactions(ctx context.Context, orgID, commentID, currentEmployeeID uuid.UUID) ([]CommentReactionSummary, error)
}

// ── Service Interface ────────────────────────────────────────────────────────

type ServiceInterface interface {
	// Task Lists
	ListTaskLists(ctx context.Context, orgID uuid.UUID) ([]TaskList, error)
	CreateTaskList(ctx context.Context, orgID uuid.UUID, req CreateListRequest, actorUserID ...uuid.UUID) (*TaskList, error)
	UpdateTaskList(ctx context.Context, orgID, id uuid.UUID, req UpdateListRequest, actorUserID ...uuid.UUID) (*TaskList, error)
	DeactivateTaskList(ctx context.Context, orgID, id uuid.UUID, actorUserID ...uuid.UUID) error
	EnsureDefaultLists(ctx context.Context, orgID uuid.UUID) error

	// Tasks
	ListTasks(ctx context.Context, orgID uuid.UUID, filters TaskFilters) ([]TaskWithDetails, error)
	GetTask(ctx context.Context, orgID, id uuid.UUID) (*TaskWithDetails, error)
	CreateTask(ctx context.Context, orgID, createdBy uuid.UUID, req CreateTaskRequest, actorUserID ...uuid.UUID) (*Task, error)
	UpdateTask(ctx context.Context, orgID, id uuid.UUID, req UpdateTaskRequest, actorUserID ...uuid.UUID) (*Task, error)
	MoveTask(ctx context.Context, orgID, taskID uuid.UUID, req MoveTaskRequest, actorUserID ...uuid.UUID) (*Task, error)
	ToggleTaskCompletion(ctx context.Context, orgID, taskID uuid.UUID, actorUserID ...uuid.UUID) (*Task, error)
	DeleteTask(ctx context.Context, orgID, id uuid.UUID, actorUserID ...uuid.UUID) error

	// Comments
	ListComments(ctx context.Context, orgID, taskID uuid.UUID) ([]TaskCommentWithAuthor, error)
	CreateComment(ctx context.Context, orgID, taskID, authorID uuid.UUID, parentID *uuid.UUID, body, contentType string, actorUserID ...uuid.UUID) (*TaskComment, error)
	DeleteComment(ctx context.Context, orgID, commentID, authorID uuid.UUID, actorUserID ...uuid.UUID) error

	// Reactions
	ToggleReaction(ctx context.Context, orgID, commentID, employeeID uuid.UUID, emoji string, actorUserID ...uuid.UUID) (added bool, err error)
	ListReactions(ctx context.Context, orgID, commentID, currentEmployeeID uuid.UUID) ([]CommentReactionSummary, error)
}

// ── Error Constructors ───────────────────────────────────────────────────────

func ErrTaskListNotFound() *apperr.AppError {
	return apperr.NotFound("task list")
}

func ErrTaskNotFound() *apperr.AppError {
	return apperr.NotFound("task")
}

func ErrCommentNotFound() *apperr.AppError {
	return apperr.NotFound("comment")
}

func ErrTaskListInactive(name string) *apperr.AppError {
	return apperr.New(apperr.CodeValidation, fmt.Sprintf("task list '%s' is inactive", name))
}

func ErrUnauthorizedCommentDelete() *apperr.AppError {
	return apperr.New(apperr.CodeForbidden, "you can only delete your own comments")
}

func ErrInvalidPriority(priority string) *apperr.AppError {
	return apperr.New(apperr.CodeValidation, fmt.Sprintf("invalid priority: %s (must be low, medium, high, or urgent)", priority))
}
