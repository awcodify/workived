package tasks

import (
	"context"
	"errors"
	"fmt"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgconn"
	"github.com/rs/zerolog"
	"github.com/workived/services/internal/audit"
)

type Service struct {
	repo     RepositoryInterface
	auditLog audit.Logger
	log      zerolog.Logger
}

func NewService(repo RepositoryInterface, opts ...ServiceOption) *Service {
	s := &Service{repo: repo}
	for _, opt := range opts {
		opt(s)
	}
	return s
}

type ServiceOption func(*Service)

func WithAuditLog(al audit.Logger) ServiceOption {
	return func(s *Service) {
		s.auditLog = al
	}
}

func WithLogger(log zerolog.Logger) ServiceOption {
	return func(s *Service) {
		s.log = log
	}
}

// logAudit is a helper to safely log audit entries
func (s *Service) logAudit(ctx context.Context, entry audit.LogEntry) {
	if s.auditLog == nil {
		return
	}
	if err := s.auditLog.Log(ctx, entry); err != nil {
		s.log.Error().Err(err).Msg("audit log error")
	}
}

// ── Task Lists ───────────────────────────────────────────────────────────────

func (s *Service) ListTaskLists(ctx context.Context, orgID uuid.UUID) ([]TaskList, error) {
	lists, err := s.repo.ListTaskLists(ctx, orgID)
	if err != nil {
		return nil, err
	}

	// Lazy init: create default lists if none exist
	if len(lists) == 0 {
		if err := s.EnsureDefaultLists(ctx, orgID); err != nil {
			s.log.Warn().Err(err).Str("org_id", orgID.String()).Msg("failed to create default task lists")
		} else {
			// Retry list query after creating defaults
			lists, err = s.repo.ListTaskLists(ctx, orgID)
			if err != nil {
				return nil, err
			}
		}
	}

	return lists, nil
}

func (s *Service) EnsureDefaultLists(ctx context.Context, orgID uuid.UUID) error {
	count, err := s.repo.CountTaskLists(ctx, orgID)
	if err != nil {
		return err
	}
	if count > 0 {
		return nil // Lists already exist
	}

	defaultLists := []string{"To Do", "In Progress", "Done"}
	for _, name := range defaultLists {
		_, err := s.repo.CreateTaskList(ctx, orgID, CreateListRequest{Name: name})
		if err != nil {
			// Ignore unique constraint violations (race condition - another request created it)
			var pgErr *pgconn.PgError
			if errors.As(err, &pgErr) && pgErr.Code == "23505" {
				// Unique constraint violation - list already exists from concurrent request
				continue
			}
			return fmt.Errorf("failed to create default list '%s': %w", name, err)
		}
	}

	s.log.Info().Str("org_id", orgID.String()).Msg("task_lists.default_created")
	return nil
}

func (s *Service) CreateTaskList(ctx context.Context, orgID uuid.UUID, req CreateListRequest, actorUserID ...uuid.UUID) (*TaskList, error) {
	list, err := s.repo.CreateTaskList(ctx, orgID, req)
	if err != nil {
		return nil, err
	}

	if len(actorUserID) > 0 {
		s.logAudit(ctx, audit.LogEntry{
			OrgID:        orgID,
			ActorUserID:  actorUserID[0],
			Action:       "task_list.created",
			ResourceType: "task_list",
			ResourceID:   list.ID,
			AfterState:   list,
		})
	}

	s.log.Info().
		Str("org_id", orgID.String()).
		Str("list_id", list.ID.String()).
		Str("name", list.Name).
		Msg("task_list.created")

	return list, nil
}

func (s *Service) UpdateTaskList(ctx context.Context, orgID, id uuid.UUID, req UpdateListRequest, actorUserID ...uuid.UUID) (*TaskList, error) {
	// Get before state for audit
	before, err := s.repo.GetTaskList(ctx, orgID, id)
	if err != nil {
		return nil, err
	}

	list, err := s.repo.UpdateTaskList(ctx, orgID, id, req)
	if err != nil {
		return nil, err
	}

	if len(actorUserID) > 0 {
		s.logAudit(ctx, audit.LogEntry{
			OrgID:        orgID,
			ActorUserID:  actorUserID[0],
			Action:       "task_list.updated",
			ResourceType: "task_list",
			ResourceID:   list.ID,
			BeforeState:  before,
			AfterState:   list,
		})
	}

	s.log.Info().
		Str("org_id", orgID.String()).
		Str("list_id", list.ID.String()).
		Msg("task_list.updated")

	return list, nil
}

func (s *Service) DeactivateTaskList(ctx context.Context, orgID, id uuid.UUID, actorUserID ...uuid.UUID) error {
	// Get list for audit before deleting
	list, err := s.repo.GetTaskList(ctx, orgID, id)
	if err != nil {
		return err
	}

	if err := s.repo.DeactivateTaskList(ctx, orgID, id); err != nil {
		return err
	}

	if len(actorUserID) > 0 {
		s.logAudit(ctx, audit.LogEntry{
			OrgID:        orgID,
			ActorUserID:  actorUserID[0],
			Action:       "task_list.deactivated",
			ResourceType: "task_list",
			ResourceID:   id,
			BeforeState:  list,
		})
	}

	s.log.Info().
		Str("org_id", orgID.String()).
		Str("list_id", id.String()).
		Msg("task_list.deactivated")

	return nil
}

// ── Tasks ────────────────────────────────────────────────────────────────────

func (s *Service) ListTasks(ctx context.Context, orgID uuid.UUID, filters TaskFilters) ([]TaskWithDetails, error) {
	// Ensure default lists exist before listing tasks
	if err := s.EnsureDefaultLists(ctx, orgID); err != nil {
		s.log.Warn().Err(err).Str("org_id", orgID.String()).Msg("failed to ensure default lists")
	}

	return s.repo.ListTasks(ctx, orgID, filters)
}

func (s *Service) GetTask(ctx context.Context, orgID, id uuid.UUID) (*TaskWithDetails, error) {
	return s.repo.GetTask(ctx, orgID, id)
}

func (s *Service) CreateTask(ctx context.Context, orgID, createdBy uuid.UUID, req CreateTaskRequest, actorUserID ...uuid.UUID) (*Task, error) {
	// Validate priority if provided
	if req.Priority != "" && req.Priority != "low" && req.Priority != "medium" && req.Priority != "high" && req.Priority != "urgent" {
		return nil, ErrInvalidPriority(req.Priority)
	}

	task, err := s.repo.CreateTask(ctx, orgID, createdBy, req)
	if err != nil {
		return nil, err
	}

	if len(actorUserID) > 0 {
		s.logAudit(ctx, audit.LogEntry{
			OrgID:        orgID,
			ActorUserID:  actorUserID[0],
			Action:       "task.created",
			ResourceType: "task",
			ResourceID:   task.ID,
			AfterState:   task,
		})
	}

	s.log.Info().
		Str("org_id", orgID.String()).
		Str("task_id", task.ID.String()).
		Str("list_id", task.TaskListID.String()).
		Str("title", task.Title).
		Str("priority", task.Priority).
		Msg("task.created")

	return task, nil
}

func (s *Service) UpdateTask(ctx context.Context, orgID, id uuid.UUID, req UpdateTaskRequest, actorUserID ...uuid.UUID) (*Task, error) {
	// Validate priority if provided
	if req.Priority != nil && *req.Priority != "low" && *req.Priority != "medium" && *req.Priority != "high" && *req.Priority != "urgent" {
		return nil, ErrInvalidPriority(*req.Priority)
	}

	// Get before state for audit
	before, err := s.repo.GetTask(ctx, orgID, id)
	if err != nil {
		return nil, err
	}

	task, err := s.repo.UpdateTask(ctx, orgID, id, req)
	if err != nil {
		return nil, err
	}

	if len(actorUserID) > 0 {
		s.logAudit(ctx, audit.LogEntry{
			OrgID:        orgID,
			ActorUserID:  actorUserID[0],
			Action:       "task.updated",
			ResourceType: "task",
			ResourceID:   task.ID,
			BeforeState:  before,
			AfterState:   task,
		})
	}

	s.log.Info().
		Str("org_id", orgID.String()).
		Str("task_id", task.ID.String()).
		Msg("task.updated")

	return task, nil
}

func (s *Service) MoveTask(ctx context.Context, orgID, taskID uuid.UUID, req MoveTaskRequest, actorUserID ...uuid.UUID) (*Task, error) {
	// Get before state
	before, err := s.repo.GetTask(ctx, orgID, taskID)
	if err != nil {
		return nil, err
	}

	// Check source and target list states
	sourceList, err := s.repo.GetTaskList(ctx, orgID, before.TaskListID)
	if err != nil {
		return nil, err
	}

	targetList, err := s.repo.GetTaskList(ctx, orgID, req.TaskListID)
	if err != nil {
		return nil, err
	}

	// First move the task
	task, err := s.repo.MoveTask(ctx, orgID, taskID, req.TaskListID, req.Position)
	if err != nil {
		return nil, err
	}

	// Auto-complete if moving TO a final state and task is not already complete
	if targetList.IsFinalState && task.CompletedAt == nil {
		task, err = s.repo.ToggleTaskCompletion(ctx, orgID, taskID)
		if err != nil {
			s.log.Warn().Err(err).Str("task_id", taskID.String()).Msg("failed to auto-complete task")
			// Don't fail the move operation if auto-complete fails
		} else {
			s.log.Info().
				Str("task_id", taskID.String()).
				Str("list_id", req.TaskListID.String()).
				Msg("task auto-completed")
		}
	}

	// Auto-uncomplete if moving FROM a final state and task is currently complete
	if sourceList.IsFinalState && !targetList.IsFinalState && task.CompletedAt != nil {
		task, err = s.repo.ToggleTaskCompletion(ctx, orgID, taskID)
		if err != nil {
			s.log.Warn().Err(err).Str("task_id", taskID.String()).Msg("failed to auto-uncomplete task")
			// Don't fail the move operation if auto-uncomplete fails
		} else {
			s.log.Info().
				Str("task_id", taskID.String()).
				Str("source_list_id", sourceList.ID.String()).
				Msg("task auto-uncompleted")
		}
	}

	if len(actorUserID) > 0 {
		s.logAudit(ctx, audit.LogEntry{
			OrgID:        orgID,
			ActorUserID:  actorUserID[0],
			Action:       "task.moved",
			ResourceType: "task",
			ResourceID:   task.ID,
			BeforeState:  before,
			AfterState:   task,
		})
	}

	s.log.Info().
		Str("org_id", orgID.String()).
		Str("task_id", task.ID.String()).
		Str("old_list_id", before.TaskListID.String()).
		Str("new_list_id", req.TaskListID.String()).
		Msg("task.moved")

	return task, nil
}

func (s *Service) ToggleTaskCompletion(ctx context.Context, orgID, taskID uuid.UUID, actorUserID ...uuid.UUID) (*Task, error) {
	before, err := s.repo.GetTask(ctx, orgID, taskID)
	if err != nil {
		return nil, err
	}

	// Toggle completion status
	task, err := s.repo.ToggleTaskCompletion(ctx, orgID, taskID)
	if err != nil {
		return nil, err
	}

	s.log.Info().
		Str("task_id", taskID.String()).
		Bool("is_now_complete", task.CompletedAt != nil).
		Str("current_list_id", task.TaskListID.String()).
		Msg("task completion toggled")

	// Auto-move task based on completion status
	currentList, err := s.repo.GetTaskList(ctx, orgID, task.TaskListID)
	if err != nil {
		s.log.Error().Err(err).
			Str("task_id", taskID.String()).
			Str("list_id", task.TaskListID.String()).
			Msg("failed to get current list for auto-move - skipping auto-move")
		// Continue without auto-move
	} else {
		s.log.Info().
			Str("current_list", currentList.Name).
			Bool("is_final_state", currentList.IsFinalState).
			Msg("current list state")

		if task.CompletedAt != nil && !currentList.IsFinalState {
			// Task was marked complete but not in final state - move to first final state list
			s.log.Info().Msg("task marked complete in non-final state, searching for final state list")
			lists, err := s.repo.ListTaskLists(ctx, orgID)
			if err == nil {
				for _, list := range lists {
					if list.IsFinalState {
						s.log.Info().
							Str("target_list", list.Name).
							Str("target_list_id", list.ID.String()).
							Msg("found final state list, moving task")

						// Get max position in target list
						listIDStr := list.ID.String()
						tasksInList, err := s.repo.ListTasks(ctx, orgID, TaskFilters{TaskListID: &listIDStr})
						if err != nil {
							s.log.Warn().Err(err).Msg("failed to get tasks for auto-move")
							break
						}
						maxPos := 0
						for _, t := range tasksInList {
							if t.Position > maxPos {
								maxPos = t.Position
							}
						}
						newPos := maxPos + 1000

						// Move task to final state list
						task, err = s.repo.MoveTask(ctx, orgID, taskID, list.ID, newPos)
						if err != nil {
							s.log.Error().Err(err).Str("target_list", list.ID.String()).Msg("FAILED to auto-move completed task")
						} else {
							s.log.Info().
								Str("task_id", taskID.String()).
								Str("list_id", list.ID.String()).
								Int("position", newPos).
								Msg("SUCCESS: task auto-moved to final state list")
						}
						break
					}
				}
			} else {
				s.log.Error().Err(err).Msg("failed to list task lists for auto-move")
			}
		} else if task.CompletedAt == nil && currentList.IsFinalState {
			// Task was marked incomplete but in final state - move to first non-final state list
			s.log.Info().Msg("task marked incomplete in final state, searching for non-final state list")
			lists, err := s.repo.ListTaskLists(ctx, orgID)
			if err == nil {
				for _, list := range lists {
					if !list.IsFinalState {
						s.log.Info().
							Str("target_list", list.Name).
							Str("target_list_id", list.ID.String()).
							Msg("found non-final state list, moving task")

						// Get max position in target list
						listIDStr := list.ID.String()
						tasksInList, err := s.repo.ListTasks(ctx, orgID, TaskFilters{TaskListID: &listIDStr})
						if err != nil {
							s.log.Warn().Err(err).Msg("failed to get tasks for auto-move")
							break
						}
						maxPos := 0
						for _, t := range tasksInList {
							if t.Position > maxPos {
								maxPos = t.Position
							}
						}
						newPos := maxPos + 1000

						// Move task to non-final state list
						task, err = s.repo.MoveTask(ctx, orgID, taskID, list.ID, newPos)
						if err != nil {
							s.log.Error().Err(err).Str("target_list", list.ID.String()).Msg("FAILED to auto-move reopened task")
						} else {
							s.log.Info().
								Str("task_id", taskID.String()).
								Str("list_id", list.ID.String()).
								Int("position", newPos).
								Msg("SUCCESS: task auto-moved out of final state list")
						}
						break
					}
				}
			} else {
				s.log.Error().Err(err).Msg("failed to list task lists for auto-move")
			}
		} else {
			s.log.Info().Msg("no auto-move needed - task already in appropriate list")
		}
	}

	action := "task.completed"
	if task.CompletedAt == nil {
		action = "task.reopened"
	}

	if len(actorUserID) > 0 {
		s.logAudit(ctx, audit.LogEntry{
			OrgID:        orgID,
			ActorUserID:  actorUserID[0],
			Action:       action,
			ResourceType: "task",
			ResourceID:   task.ID,
			BeforeState:  before,
			AfterState:   task,
		})
	}

	s.log.Info().
		Str("org_id", orgID.String()).
		Str("task_id", task.ID.String()).
		Bool("completed", task.CompletedAt != nil).
		Msg(action)

	return task, nil
}

func (s *Service) DeleteTask(ctx context.Context, orgID, id uuid.UUID, actorUserID ...uuid.UUID) error {
	// Get task for audit before deleting
	task, err := s.repo.GetTask(ctx, orgID, id)
	if err != nil {
		return err
	}

	// Prevent deletion of pending approval tasks
	if task.ApprovalType != nil && task.CompletedAt == nil {
		return ErrCannotDeleteApprovalTask()
	}

	if err := s.repo.DeleteTask(ctx, orgID, id); err != nil {
		return err
	}

	if len(actorUserID) > 0 {
		s.logAudit(ctx, audit.LogEntry{
			OrgID:        orgID,
			ActorUserID:  actorUserID[0],
			Action:       "task.deleted",
			ResourceType: "task",
			ResourceID:   id,
			BeforeState:  task,
		})
	}

	s.log.Info().
		Str("org_id", orgID.String()).
		Str("task_id", id.String()).
		Msg("task.deleted")

	return nil
}

// ── Approval Task Helpers ────────────────────────────────────────────────────
// These methods are called by leave and claims services to manage approval tasks

// CreateApprovalTask creates a task for an approval workflow (leave or claim).
// CreateApprovalTask creates a task for a pending approval (leave or claim).
// Returns error if task creation fails.
func (s *Service) CreateApprovalTask(
	ctx context.Context,
	orgID uuid.UUID,
	approvalType string, // "leave" or "claim"
	approvalID uuid.UUID,
	title string,
	description string,
	assigneeID uuid.UUID,
	dueDate *string, // YYYY-MM-DD format, optional
) error {
	// Get "Approvals" list (or first available list as fallback)
	lists, err := s.repo.ListTaskLists(ctx, orgID)
	if err != nil {
		return fmt.Errorf("list task lists: %w", err)
	}
	if len(lists) == 0 {
		return fmt.Errorf("no task lists available")
	}

	// Find "Approvals" list or use first list
	var targetList uuid.UUID
	for _, list := range lists {
		if list.Name == "Approvals" {
			targetList = list.ID
			break
		}
	}
	if targetList == uuid.Nil {
		// Fallback to first list if "Approvals" doesn't exist
		targetList = lists[0].ID
	}

	// Validate approval type
	if approvalType != "leave" && approvalType != "claim" {
		return fmt.Errorf("invalid approval_type: %s", approvalType)
	}

	req := CreateTaskRequest{
		TaskListID:   targetList,
		Title:        title,
		Description:  &description,
		AssigneeID:   &assigneeID,
		Priority:     "urgent",
		DueDate:      dueDate,
		ApprovalType: &approvalType,
		ApprovalID:   &approvalID,
	}

	task, err := s.repo.CreateTask(ctx, orgID, assigneeID, req)
	if err != nil {
		return fmt.Errorf("create approval task: %w", err)
	}

	s.log.Info().
		Str("org_id", orgID.String()).
		Str("task_id", task.ID.String()).
		Str("approval_type", approvalType).
		Str("approval_id", approvalID.String()).
		Msg("approval_task.created")

	return nil
}

// CompleteApprovalTask marks an approval task as completed.
// Called when the underlying approval is processed (approved/rejected).
func (s *Service) CompleteApprovalTask(
	ctx context.Context,
	approvalType string,
	approvalID uuid.UUID,
) error {
	task, err := s.repo.GetTaskByApproval(ctx, approvalType, approvalID)
	if err != nil {
		// If task not found, it may have been manually deleted - log and continue
		if errors.Is(err, ErrTaskNotFound()) {
			s.log.Warn().
				Str("approval_type", approvalType).
				Str("approval_id", approvalID.String()).
				Msg("approval_task.not_found_for_completion")
			return nil
		}
		return fmt.Errorf("get approval task: %w", err)
	}

	// If already completed, skip
	if task.CompletedAt != nil {
		s.log.Debug().
			Str("task_id", task.ID.String()).
			Str("approval_type", approvalType).
			Msg("approval_task.already_completed")
		return nil
	}

	// Toggle completion (will mark as complete)
	_, err = s.repo.ToggleTaskCompletion(ctx, task.OrganisationID, task.ID)
	if err != nil {
		return fmt.Errorf("complete approval task: %w", err)
	}

	s.log.Info().
		Str("org_id", task.OrganisationID.String()).
		Str("task_id", task.ID.String()).
		Str("approval_type", approvalType).
		Str("approval_id", approvalID.String()).
		Msg("approval_task.completed")

	return nil
}

// DeleteApprovalTask deletes an approval task when the underlying request is cancelled.
func (s *Service) DeleteApprovalTask(
	ctx context.Context,
	approvalType string,
	approvalID uuid.UUID,
) error {
	task, err := s.repo.GetTaskByApproval(ctx, approvalType, approvalID)
	if err != nil {
		// If task not found, it may have been manually deleted - log and continue
		if errors.Is(err, ErrTaskNotFound()) {
			s.log.Warn().
				Str("approval_type", approvalType).
				Str("approval_id", approvalID.String()).
				Msg("approval_task.not_found_for_deletion")
			return nil
		}
		return fmt.Errorf("get approval task: %w", err)
	}

	err = s.repo.DeleteTask(ctx, task.OrganisationID, task.ID)
	if err != nil {
		return fmt.Errorf("delete approval task: %w", err)
	}

	s.log.Info().
		Str("org_id", task.OrganisationID.String()).
		Str("task_id", task.ID.String()).
		Str("approval_type", approvalType).
		Str("approval_id", approvalID.String()).
		Msg("approval_task.deleted")

	return nil
}

// ── Comments ─────────────────────────────────────────────────────────────────

func (s *Service) ListComments(ctx context.Context, orgID, taskID uuid.UUID) ([]TaskCommentWithAuthor, error) {
	// Verify task exists first
	_, err := s.repo.GetTask(ctx, orgID, taskID)
	if err != nil {
		return nil, err
	}

	return s.repo.ListComments(ctx, orgID, taskID)
}

func (s *Service) CreateComment(ctx context.Context, orgID, taskID, authorID uuid.UUID, parentID *uuid.UUID, body, contentType string, actorUserID ...uuid.UUID) (*TaskComment, error) {
	comment, err := s.repo.CreateComment(ctx, orgID, taskID, authorID, parentID, body, contentType)
	if err != nil {
		return nil, err
	}

	if len(actorUserID) > 0 {
		s.logAudit(ctx, audit.LogEntry{
			OrgID:        orgID,
			ActorUserID:  actorUserID[0],
			Action:       "task_comment.created",
			ResourceType: "task_comment",
			ResourceID:   comment.ID,
			AfterState:   comment,
		})
	}

	s.log.Info().
		Str("org_id", orgID.String()).
		Str("task_id", taskID.String()).
		Str("comment_id", comment.ID.String()).
		Bool("is_reply", parentID != nil).
		Str("content_type", contentType).
		Msg("task_comment.created")

	return comment, nil
}

func (s *Service) DeleteComment(ctx context.Context, orgID, commentID, authorID uuid.UUID, actorUserID ...uuid.UUID) error {
	if err := s.repo.DeleteComment(ctx, orgID, commentID, authorID); err != nil {
		return err
	}

	if len(actorUserID) > 0 {
		s.logAudit(ctx, audit.LogEntry{
			OrgID:        orgID,
			ActorUserID:  actorUserID[0],
			Action:       "task_comment.deleted",
			ResourceType: "task_comment",
			ResourceID:   commentID,
		})
	}

	s.log.Info().
		Str("org_id", orgID.String()).
		Str("comment_id", commentID.String()).
		Msg("task_comment.deleted")

	return nil
}

// ── Reactions ────────────────────────────────────────────────────────────────

func (s *Service) ToggleReaction(ctx context.Context, orgID, commentID, employeeID uuid.UUID, emoji string, actorUserID ...uuid.UUID) (added bool, err error) {
	added, err = s.repo.ToggleReaction(ctx, orgID, commentID, employeeID, emoji)
	if err != nil {
		return false, err
	}

	action := "comment_reaction.removed"
	if added {
		action = "comment_reaction.added"
	}

	if len(actorUserID) > 0 {
		s.logAudit(ctx, audit.LogEntry{
			OrgID:        orgID,
			ActorUserID:  actorUserID[0],
			Action:       action,
			ResourceType: "comment_reaction",
			ResourceID:   commentID,
			AfterState: map[string]any{
				"emoji":       emoji,
				"employee_id": employeeID,
				"added":       added,
			},
		})
	}

	s.log.Info().
		Str("org_id", orgID.String()).
		Str("comment_id", commentID.String()).
		Str("emoji", emoji).
		Bool("added", added).
		Msg(action)

	return added, nil
}

func (s *Service) ListReactions(ctx context.Context, orgID, commentID, currentEmployeeID uuid.UUID) ([]CommentReactionSummary, error) {
	return s.repo.ListReactions(ctx, orgID, commentID, currentEmployeeID)
}
