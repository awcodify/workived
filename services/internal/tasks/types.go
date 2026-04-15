package tasks

import (
	"context"
	"encoding/json"
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
	ApprovalType   *string    `json:"approval_type,omitempty"` // 'leave' | 'claim' | NULL
	ApprovalID     *uuid.UUID `json:"approval_id,omitempty"`   // FK to leave_requests.id or claims.id
	CreatedAt      time.Time  `json:"created_at"`
	UpdatedAt      time.Time  `json:"updated_at"`
}

// TaskWithDetails includes joined employee names and custom field values
type TaskWithDetails struct {
	Task
	AssigneeName *string                  `json:"assignee_name,omitempty"`
	CreatorName  string                   `json:"creator_name"`
	ListName     string                   `json:"list_name"`
	FieldValues  []FieldValueWithDefinition `json:"field_values,omitempty"`
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
	Name         string `json:"name" binding:"required,max=100"`
	IsFinalState *bool  `json:"is_final_state,omitempty"`
}

type UpdateListRequest struct {
	Name     *string `json:"name,omitempty" binding:"omitempty,max=100"`
	Position *int    `json:"position,omitempty"`
}

type CreateTaskRequest struct {
	TaskListID   uuid.UUID  `json:"task_list_id" binding:"required"`
	Title        string     `json:"title" binding:"required,max=500"`
	Description  *string    `json:"description,omitempty" binding:"omitempty,max=5000"`
	AssigneeID   *uuid.UUID `json:"assignee_id,omitempty"`
	Priority     string     `json:"priority" binding:"omitempty,oneof=low medium high urgent"`
	DueDate      *string    `json:"due_date,omitempty"` // YYYY-MM-DD format
	ApprovalType *string    `json:"approval_type,omitempty" binding:"omitempty,oneof=leave claim"`
	ApprovalID   *uuid.UUID `json:"approval_id,omitempty"`
}

type UpdateTaskRequest struct {
	Title       *string    `json:"title,omitempty" binding:"omitempty,max=500"`
	Description *string    `json:"description,omitempty" binding:"omitempty,max=5000"`
	AssigneeID  *uuid.UUID `json:"assignee_id,omitempty"`
	Priority    *string    `json:"priority,omitempty" binding:"omitempty,oneof=low medium high urgent"`
	DueDate     *string    `json:"due_date,omitempty"` // YYYY-MM-DD format
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
	TaskListID           *string `form:"task_list_id"`
	AssigneeID           *string `form:"assignee_id"`
	Priority             *string `form:"priority"`
	Status               *string `form:"status"`           // completed, pending
	IncludeCompleted     bool    `form:"include_completed"` // bypass 7-day archive filter
	Search               *string `form:"search"`            // ILIKE title match
	CompletedAfter       *string `form:"completed_after"`   // ISO 8601 date
	CompletedBefore      *string `form:"completed_before"`  // ISO 8601 date
	ExcludeApprovalTasks *bool   `form:"-"`                 // Exclude tasks linked to approvals
	Cursor               string  `form:"cursor"`
	Limit                int     `form:"limit"`
	ArchiveDays          int     `form:"-"` // Days after completion before auto-archiving (default: 7, 0 = disabled)
}

const DefaultArchiveDays = 7

// ── Field Definitions ────────────────────────────────────────────────────────

// ValidFieldTypes is the set of allowed field_type values.
var ValidFieldTypes = map[string]bool{
	"text": true, "number": true, "date": true, "boolean": true,
	"select": true, "multi_select": true, "url": true, "employee": true, "rating": true,
}

// FieldOption is one entry in the options array for select/multi_select fields.
type FieldOption struct {
	Value string  `json:"value"`
	Label string  `json:"label"`
	Color *string `json:"color,omitempty"`
}

// FieldConfig holds type-specific constraints stored in the config JSONB column.
type FieldConfig struct {
	Min    *int64  `json:"min,omitempty"`    // number / rating lower bound
	Max    *int64  `json:"max,omitempty"`    // number / rating upper bound
	Format *string `json:"format,omitempty"` // date display format hint
}

// FieldDefinition is the domain model for a custom field schema.
type FieldDefinition struct {
	ID             uuid.UUID     `json:"id"`
	OrganisationID uuid.UUID     `json:"organisation_id"`
	Name           string        `json:"name"`
	FieldType      string        `json:"field_type"`
	Description    *string       `json:"description,omitempty"`
	Options        []FieldOption `json:"options,omitempty"`
	Config         *FieldConfig  `json:"config,omitempty"`
	SortOrder      int           `json:"sort_order"`
	IsActive       bool          `json:"is_active"`
	CreatedAt      time.Time     `json:"created_at"`
	UpdatedAt      time.Time     `json:"updated_at"`
}

// ── Field Values ─────────────────────────────────────────────────────────────

// FieldValue is a raw stored value row from task_field_values.
type FieldValue struct {
	ID             uuid.UUID `json:"id"`
	OrganisationID uuid.UUID `json:"organisation_id"`
	TaskID         uuid.UUID `json:"task_id"`
	FieldID        uuid.UUID `json:"field_id"`
	// Only one of these is set depending on field_type:
	ValueText    *string          `json:"value_text,omitempty"`
	ValueNumber  *int64           `json:"value_number,omitempty"`
	ValueDate    *string          `json:"value_date,omitempty"` // YYYY-MM-DD
	ValueBoolean *bool            `json:"value_boolean,omitempty"`
	ValueJSON    *json.RawMessage `json:"value_json,omitempty"` // select, multi_select, employee
	CreatedAt    time.Time        `json:"created_at"`
	UpdatedAt    time.Time        `json:"updated_at"`
}

// FieldValueWithDefinition embeds the field name and type for rendering without a second lookup.
type FieldValueWithDefinition struct {
	FieldID   uuid.UUID `json:"field_id"`
	FieldName string    `json:"field_name"`
	FieldType string    `json:"field_type"`
	// Resolved display value — only the relevant field is set:
	ValueText    *string          `json:"value_text,omitempty"`
	ValueNumber  *int64           `json:"value_number,omitempty"`
	ValueDate    *string          `json:"value_date,omitempty"`
	ValueBoolean *bool            `json:"value_boolean,omitempty"`
	ValueJSON    *json.RawMessage `json:"value_json,omitempty"`
}

// SetFieldValueRequest is the payload for upsert. Value is decoded based on field_type.
type SetFieldValueRequest struct {
	// Value is the raw JSON value — type validated against field definition at service layer.
	Value json.RawMessage `json:"value" binding:"required"`
}

// ── Field Definition Request DTOs ────────────────────────────────────────────

type CreateFieldDefinitionRequest struct {
	Name        string        `json:"name" binding:"required,max=100"`
	FieldType   string        `json:"field_type" binding:"required"`
	Description *string       `json:"description,omitempty" binding:"omitempty,max=500"`
	Options     []FieldOption `json:"options,omitempty"`
	Config      *FieldConfig  `json:"config,omitempty"`
	SortOrder   int           `json:"sort_order,omitempty"`
}

type UpdateFieldDefinitionRequest struct {
	Name        *string       `json:"name,omitempty" binding:"omitempty,max=100"`
	Description *string       `json:"description,omitempty" binding:"omitempty,max=500"`
	Options     []FieldOption `json:"options,omitempty"`
	Config      *FieldConfig  `json:"config,omitempty"`
	SortOrder   *int          `json:"sort_order,omitempty"`
}

// ── Repository Interface ─────────────────────────────────────────────────────

type RepositoryInterface interface {
	// Task Lists
	ListTaskLists(ctx context.Context, orgID uuid.UUID) ([]TaskList, error)
	GetTaskList(ctx context.Context, orgID, id uuid.UUID) (*TaskList, error)
	GetFinalStateList(ctx context.Context, orgID uuid.UUID) (*TaskList, error)
	CreateTaskList(ctx context.Context, orgID uuid.UUID, req CreateListRequest) (*TaskList, error)
	UpdateTaskList(ctx context.Context, orgID, id uuid.UUID, req UpdateListRequest) (*TaskList, error)
	DeactivateTaskList(ctx context.Context, orgID, id uuid.UUID) error
	CountTaskLists(ctx context.Context, orgID uuid.UUID) (int, error)

	// Tasks
	ListTasks(ctx context.Context, orgID uuid.UUID, filters TaskFilters) ([]TaskWithDetails, error)
	GetTask(ctx context.Context, orgID, id uuid.UUID) (*TaskWithDetails, error)
	GetTaskByApproval(ctx context.Context, approvalType string, approvalID uuid.UUID) (*TaskWithDetails, error)
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

	// Field Definitions
	ListFieldDefinitions(ctx context.Context, orgID uuid.UUID) ([]FieldDefinition, error)
	GetFieldDefinition(ctx context.Context, orgID, id uuid.UUID) (*FieldDefinition, error)
	CreateFieldDefinition(ctx context.Context, orgID uuid.UUID, req CreateFieldDefinitionRequest) (*FieldDefinition, error)
	UpdateFieldDefinition(ctx context.Context, orgID, id uuid.UUID, req UpdateFieldDefinitionRequest) (*FieldDefinition, error)
	DeactivateFieldDefinition(ctx context.Context, orgID, id uuid.UUID) error

	// Field Values
	SetFieldValue(ctx context.Context, orgID, taskID, fieldID uuid.UUID, req SetFieldValueRequest, fieldType string) (*FieldValue, error)
	ClearFieldValue(ctx context.Context, orgID, taskID, fieldID uuid.UUID) error
	GetTaskFieldValues(ctx context.Context, orgID, taskID uuid.UUID) ([]FieldValueWithDefinition, error)
	BatchGetFieldValues(ctx context.Context, orgID uuid.UUID, taskIDs []uuid.UUID) (map[uuid.UUID][]FieldValueWithDefinition, error)
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

	// Field Definitions
	ListFieldDefinitions(ctx context.Context, orgID uuid.UUID) ([]FieldDefinition, error)
	CreateFieldDefinition(ctx context.Context, orgID uuid.UUID, req CreateFieldDefinitionRequest, actorUserID ...uuid.UUID) (*FieldDefinition, error)
	UpdateFieldDefinition(ctx context.Context, orgID, id uuid.UUID, req UpdateFieldDefinitionRequest, actorUserID ...uuid.UUID) (*FieldDefinition, error)
	DeactivateFieldDefinition(ctx context.Context, orgID, id uuid.UUID, actorUserID ...uuid.UUID) error

	// Field Values
	SetFieldValue(ctx context.Context, orgID, taskID, fieldID uuid.UUID, req SetFieldValueRequest, actorUserID ...uuid.UUID) (*FieldValueWithDefinition, error)
	ClearFieldValue(ctx context.Context, orgID, taskID, fieldID uuid.UUID, actorUserID ...uuid.UUID) error
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

func ErrCannotDeleteApprovalTask() *apperr.AppError {
	return apperr.New(apperr.CodeConflict, "cannot delete pending approval task")
}

func ErrFieldDefinitionNotFound() *apperr.AppError {
	return apperr.NotFound("field definition")
}

func ErrFieldDefinitionDuplicate(name string) *apperr.AppError {
	return apperr.New(apperr.CodeConflict, fmt.Sprintf("field definition with name '%s' already exists", name))
}

func ErrInvalidFieldType(ft string) *apperr.AppError {
	return apperr.New(apperr.CodeValidation, fmt.Sprintf("invalid field_type '%s'", ft))
}

func ErrOptionsRequiredForType(ft string) *apperr.AppError {
	return apperr.New(apperr.CodeValidation, fmt.Sprintf("options are required for field_type '%s'", ft))
}

func ErrFieldValueInvalidType(ft string) *apperr.AppError {
	return apperr.New(apperr.CodeValidation, fmt.Sprintf("value does not match field_type '%s'", ft))
}

func ErrFieldValueNotFound() *apperr.AppError {
	return apperr.NotFound("field value")
}

func ErrTaskFieldNotFound() *apperr.AppError {
	return apperr.NotFound("task or field")
}
