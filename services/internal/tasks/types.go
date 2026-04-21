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
	Code           *string    `json:"code,omitempty"` // e.g. WOR-123, AC-456
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
	ParentTaskID   *uuid.UUID `json:"parent_task_id,omitempty"`
	HierarchyLevel int        `json:"hierarchy_level"`
	CreatedAt      time.Time  `json:"created_at"`
	UpdatedAt      time.Time  `json:"updated_at"`
}

// TaskWithDetails includes joined employee names and custom field values
type TaskWithDetails struct {
	Task
	AssigneeName *string                    `json:"assignee_name,omitempty"`
	CreatorName  string                     `json:"creator_name"`
	ListName     string                     `json:"list_name"`
	FieldValues  []FieldValueWithDefinition `json:"field_values,omitempty"`
	SubtaskCount *SubtaskCounts             `json:"subtask_counts,omitempty"`
}

// SubtaskCounts represents the completion stats for subtasks
type SubtaskCounts struct {
	Total     int `json:"total"`
	Completed int `json:"completed"`
}

// LinkType constants for task relationships
const (
	LinkTypeBlocks      = "blocks"
	LinkTypeBlockedBy   = "blocked_by"
	LinkTypeRelatedTo   = "related_to"
	LinkTypeDuplicates  = "duplicates"
	LinkTypeDuplicateOf = "duplicate_of"
	LinkTypeFollows     = "follows"
	LinkTypePrecedes    = "precedes"
)

// TaskLink represents a relationship between two tasks
type TaskLink struct {
	ID             uuid.UUID `json:"id"`
	OrganisationID uuid.UUID `json:"organisation_id"`
	SourceTaskID   uuid.UUID `json:"source_task_id"`
	TargetTaskID   uuid.UUID `json:"target_task_id"`
	LinkType       string    `json:"link_type"`
	CreatedAt      time.Time `json:"created_at"`
	CreatedBy      uuid.UUID `json:"created_by"`
}

// TaskLinkWithTask includes the linked task details
type TaskLinkWithTask struct {
	TaskLink
	TargetTask TaskSummary `json:"target_task"`
}

// TaskSummary is a minimal task representation for links
type TaskSummary struct {
	ID          uuid.UUID  `json:"id"`
	Title       string     `json:"title"`
	Priority    string     `json:"priority"`
	CompletedAt *time.Time `json:"completed_at,omitempty"`
	ListName    string     `json:"list_name"`
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
	Name         *string `json:"name,omitempty" binding:"omitempty,max=100"`
	Position     *int    `json:"position,omitempty"`
	IsFinalState *bool   `json:"is_final_state,omitempty"`
}

type ReorderListsRequest struct {
	ListIDs []uuid.UUID `json:"list_ids" binding:"required,min=1"`
}

type DeleteListRequest struct {
	MoveTasksTo *uuid.UUID `json:"move_tasks_to,omitempty"` // Required if list has tasks
}

type CreateTaskRequest struct {
	TaskListID   uuid.UUID  `json:"task_list_id" binding:"required"`
	Code         *string    `json:"code,omitempty"` // Auto-generated task code (e.g. WOR-123)
	Title        string     `json:"title" binding:"required,max=500"`
	Description  *string    `json:"description,omitempty" binding:"omitempty,max=5000"`
	AssigneeID   *uuid.UUID `json:"assignee_id,omitempty"`
	Priority     string     `json:"priority" binding:"omitempty,oneof=low medium high urgent"`
	DueDate      *string    `json:"due_date,omitempty"` // YYYY-MM-DD or RFC3339 datetime
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

type CreateTaskLinkRequest struct {
	TargetTaskID uuid.UUID `json:"target_task_id" binding:"required"`
	LinkType     string    `json:"link_type" binding:"required,oneof=blocks blocked_by related_to duplicates duplicate_of follows precedes"`
}

type CreateSubtaskRequest struct {
	Title       string     `json:"title" binding:"required,max=500"`
	Description *string    `json:"description,omitempty" binding:"omitempty,max=5000"`
	AssigneeID  *uuid.UUID `json:"assignee_id,omitempty"`
	Priority    string     `json:"priority" binding:"omitempty,oneof=low medium high urgent"`
	DueDate     *string    `json:"due_date,omitempty"` // YYYY-MM-DD or RFC3339 datetime
}

type ChangeParentRequest struct {
	ParentTaskID *uuid.UUID `json:"parent_task_id"` // null to promote to root
}

type ReorderSubtasksRequest struct {
	SubtaskIDs []uuid.UUID `json:"subtask_ids" binding:"required,min=1"`
}

// ── Filter types ─────────────────────────────────────────────────────────────

type TaskFilters struct {
	TaskListID           *string `form:"task_list_id"`
	AssigneeID           *string `form:"assignee_id"`
	Priority             *string `form:"priority"`
	Status               *string `form:"status"`            // completed, pending
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

// ── Interfaces ───────────────────────────────────────────────────────────────

// OrganisationInfo contains minimal organisation data needed for task code generation.
type OrganisationInfo struct {
	ID   uuid.UUID
	Name string
}

// OrgRepository provides organisation data and sequence management for task codes.
type OrgRepository interface {
	GetOrgName(ctx context.Context, orgID uuid.UUID) (string, error)
	IncrementTaskSequence(ctx context.Context, orgID uuid.UUID) (int, error)
}

// ProLicenseChecker checks if an organisation has an active Pro license.
type ProLicenseChecker interface {
	HasActiveProLicense(ctx context.Context, orgID uuid.UUID) (bool, error)
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
	CountTasksInList(ctx context.Context, orgID, listID uuid.UUID) (int, error)
	MoveTasksToList(ctx context.Context, orgID, fromListID, toListID uuid.UUID) error
	ReorderTaskLists(ctx context.Context, orgID uuid.UUID, listIDs []uuid.UUID) error

	// Tasks
	ListTasks(ctx context.Context, orgID uuid.UUID, filters TaskFilters) ([]TaskWithDetails, error)
	GetTask(ctx context.Context, orgID, id uuid.UUID) (*TaskWithDetails, error)
	GetTaskByApproval(ctx context.Context, approvalType string, approvalID uuid.UUID) (*TaskWithDetails, error)
	NextTaskCode(ctx context.Context, orgID uuid.UUID) (string, error)
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

	// Task Links
	CreateTaskLink(ctx context.Context, orgID, sourceTaskID, targetTaskID, createdBy uuid.UUID, linkType string) (*TaskLink, error)
	ListTaskLinks(ctx context.Context, orgID, taskID uuid.UUID) ([]TaskLinkWithTask, error)
	DeleteTaskLink(ctx context.Context, orgID, linkID uuid.UUID) error
	LinkExists(ctx context.Context, orgID, sourceTaskID, targetTaskID uuid.UUID, linkType string) (bool, error)

	// Subtasks / Hierarchy
	ListSubtasks(ctx context.Context, orgID, parentTaskID uuid.UUID) ([]TaskWithDetails, error)
	GetSubtaskCounts(ctx context.Context, orgID, parentTaskID uuid.UUID) (*SubtaskCounts, error)
	ChangeTaskParent(ctx context.Context, orgID, taskID uuid.UUID, newParentID *uuid.UUID, newHierarchyLevel int) error
	GetTaskHierarchyPath(ctx context.Context, orgID, taskID uuid.UUID) ([]uuid.UUID, error)
	ReorderSubtasks(ctx context.Context, orgID, parentTaskID uuid.UUID, subtaskIDs []uuid.UUID) error
}

// ── Service Interface ────────────────────────────────────────────────────────

type ServiceInterface interface {
	// Task Lists
	ListTaskLists(ctx context.Context, orgID uuid.UUID) ([]TaskList, error)
	CreateTaskList(ctx context.Context, orgID uuid.UUID, req CreateListRequest, actorUserID ...uuid.UUID) (*TaskList, error)
	UpdateTaskList(ctx context.Context, orgID, id uuid.UUID, req UpdateListRequest, actorUserID ...uuid.UUID) (*TaskList, error)
	DeactivateTaskList(ctx context.Context, orgID, id uuid.UUID, req DeleteListRequest, actorUserID ...uuid.UUID) error
	ReorderTaskLists(ctx context.Context, orgID uuid.UUID, req ReorderListsRequest, actorUserID ...uuid.UUID) error
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

	// Task Links
	CreateTaskLink(ctx context.Context, orgID, sourceTaskID uuid.UUID, req CreateTaskLinkRequest, createdBy uuid.UUID, actorUserID ...uuid.UUID) (*TaskLink, error)
	ListTaskLinks(ctx context.Context, orgID, taskID uuid.UUID) ([]TaskLinkWithTask, error)
	DeleteTaskLink(ctx context.Context, orgID, linkID uuid.UUID, actorUserID ...uuid.UUID) error

	// Subtasks / Hierarchy
	CreateSubtask(ctx context.Context, orgID, parentTaskID, createdBy uuid.UUID, req CreateSubtaskRequest, actorUserID ...uuid.UUID) (*Task, error)
	ListSubtasks(ctx context.Context, orgID, parentTaskID uuid.UUID) ([]TaskWithDetails, error)
	GetSubtaskCounts(ctx context.Context, orgID, parentTaskID uuid.UUID) (*SubtaskCounts, error)
	ChangeTaskParent(ctx context.Context, orgID, taskID uuid.UUID, req ChangeParentRequest, actorUserID ...uuid.UUID) error
	ReorderSubtasks(ctx context.Context, orgID, parentTaskID uuid.UUID, req ReorderSubtasksRequest, actorUserID ...uuid.UUID) error
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

func ErrProFeatureRequired(feature string) *apperr.AppError {
	return apperr.New(apperr.CodeForbidden, fmt.Sprintf("Pro tier required for %s. Upgrade at /settings/billing", feature))
}

func ErrCannotDeleteLastList() *apperr.AppError {
	return apperr.New(apperr.CodeValidation, "cannot delete the last task list - at least one list is required")
}

func ErrListHasTasks(count int) *apperr.AppError {
	return apperr.New(apperr.CodeValidation, fmt.Sprintf("task list has %d task(s) - specify 'move_tasks_to' to migrate them", count))
}

func ErrMaxTaskListsExceeded(max int) *apperr.AppError {
	return apperr.New(apperr.CodeValidation, fmt.Sprintf("maximum %d task lists allowed", max))
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

func ErrTaskLinkNotFound() *apperr.AppError {
	return apperr.NotFound("task link")
}

func ErrCircularDependency() *apperr.AppError {
	return apperr.New(apperr.CodeValidation, "circular dependency detected")
}

func ErrSelfLinking() *apperr.AppError {
	return apperr.New(apperr.CodeValidation, "cannot link task to itself")
}

func ErrMaxHierarchyDepth(maxDepth int) *apperr.AppError {
	return apperr.New(apperr.CodeValidation, fmt.Sprintf("maximum hierarchy depth is %d levels", maxDepth))
}

func ErrLinkAlreadyExists() *apperr.AppError {
	return apperr.New(apperr.CodeValidation, "link already exists between these tasks")
}

func ErrTasksNotInSameOrg() *apperr.AppError {
	return apperr.New(apperr.CodeValidation, "tasks must belong to the same organisation")
}
