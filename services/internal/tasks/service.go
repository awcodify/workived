package tasks

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgconn"
	"github.com/rs/zerolog"
	"github.com/workived/services/internal/audit"
	"github.com/workived/services/pkg/apperr"
)

type Service struct {
	repo            RepositoryInterface
	orgRepo         OrgRepository
	proLicenseCheck ProLicenseChecker
	auditLog        audit.Logger
	log             zerolog.Logger
}

func NewService(repo RepositoryInterface, opts ...ServiceOption) *Service {
	s := &Service{repo: repo}
	for _, opt := range opts {
		opt(s)
	}
	return s
}

type ServiceOption func(*Service)

func WithProLicenseChecker(checker ProLicenseChecker) ServiceOption {
	return func(s *Service) {
		s.proLicenseCheck = checker
	}
}

func WithOrgRepository(repo OrgRepository) ServiceOption {
	return func(s *Service) {
		s.orgRepo = repo
	}
}

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

// checkProFeature returns an error if the organisation doesn't have Pro tier and the feature requires it.
func (s *Service) checkProFeature(ctx context.Context, orgID uuid.UUID, feature string) error {
	if s.proLicenseCheck == nil {
		// If no checker is configured, allow all operations (backward compatibility)
		return nil
	}

	hasPro, err := s.proLicenseCheck.HasActiveProLicense(ctx, orgID)
	if err != nil {
		return err
	}

	if !hasPro {
		return ErrProFeatureRequired(feature)
	}

	return nil
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

	// Create default task lists
	defaultLists := []struct {
		name         string
		isFinalState bool
	}{
		{"To Do", false},
		{"In Progress", false},
		{"Done", true}, // Done is the final state - tasks here are automatically marked complete
	}

	for _, list := range defaultLists {
		isFinalState := list.isFinalState
		_, err := s.repo.CreateTaskList(ctx, orgID, CreateListRequest{
			Name:         list.name,
			IsFinalState: &isFinalState,
		})
		if err != nil {
			// Ignore unique constraint violations (race condition - another request created it)
			var pgErr *pgconn.PgError
			if errors.As(err, &pgErr) && pgErr.Code == "23505" {
				// Unique constraint violation - list already exists from concurrent request
				continue
			}
			return fmt.Errorf("failed to create default list '%s': %w", list.name, err)
		}
	}

	s.log.Info().Str("org_id", orgID.String()).Msg("task_lists.default_created")
	return nil
}

func (s *Service) CreateTaskList(ctx context.Context, orgID uuid.UUID, req CreateListRequest, actorUserID ...uuid.UUID) (*TaskList, error) {
	// Pro tier required for custom task lists
	if err := s.checkProFeature(ctx, orgID, "custom task lists"); err != nil {
		return nil, err
	}

	// Enforce maximum task lists (soft limit to prevent abuse)
	const MaxTaskLists = 20
	count, err := s.repo.CountTaskLists(ctx, orgID)
	if err != nil {
		return nil, err
	}
	if count >= MaxTaskLists {
		return nil, ErrMaxTaskListsExceeded(MaxTaskLists)
	}

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
	// Pro tier required for modifying task lists
	if err := s.checkProFeature(ctx, orgID, "task list customization"); err != nil {
		return nil, err
	}

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

func (s *Service) DeactivateTaskList(ctx context.Context, orgID, id uuid.UUID, req DeleteListRequest, actorUserID ...uuid.UUID) error {
	// Pro tier required for deleting task lists
	if err := s.checkProFeature(ctx, orgID, "task list customization"); err != nil {
		return err
	}

	// Cannot delete the last task list
	count, err := s.repo.CountTaskLists(ctx, orgID)
	if err != nil {
		return err
	}
	if count <= 1 {
		return ErrCannotDeleteLastList()
	}

	// Check if list has tasks
	taskCount, err := s.repo.CountTasksInList(ctx, orgID, id)
	if err != nil {
		return err
	}

	if taskCount > 0 {
		// If list has tasks, must specify where to move them
		if req.MoveTasksTo == nil {
			return ErrListHasTasks(taskCount)
		}

		// Verify target list exists and belongs to same org
		targetList, err := s.repo.GetTaskList(ctx, orgID, *req.MoveTasksTo)
		if err != nil {
			return err
		}

		// Cannot move to the list being deleted
		if targetList.ID == id {
			return apperr.New(apperr.CodeValidation, "cannot move tasks to the list being deleted")
		}

		// Move all tasks to target list
		if err := s.repo.MoveTasksToList(ctx, orgID, id, *req.MoveTasksTo); err != nil {
			return err
		}

		s.log.Info().
			Str("org_id", orgID.String()).
			Str("from_list_id", id.String()).
			Str("to_list_id", req.MoveTasksTo.String()).
			Int("task_count", taskCount).
			Msg("tasks.migrated_before_delete")
	}

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

func (s *Service) ReorderTaskLists(ctx context.Context, orgID uuid.UUID, req ReorderListsRequest, actorUserID ...uuid.UUID) error {
	// Pro tier required for reordering task lists
	if err := s.checkProFeature(ctx, orgID, "task list customization"); err != nil {
		return err
	}

	// Verify all list IDs belong to this org
	for _, listID := range req.ListIDs {
		_, err := s.repo.GetTaskList(ctx, orgID, listID)
		if err != nil {
			return err
		}
	}

	// Reorder the lists
	if err := s.repo.ReorderTaskLists(ctx, orgID, req.ListIDs); err != nil {
		return err
	}

	if len(actorUserID) > 0 {
		s.logAudit(ctx, audit.LogEntry{
			OrgID:        orgID,
			ActorUserID:  actorUserID[0],
			Action:       "task_lists.reordered",
			ResourceType: "task_list",
			AfterState:   req.ListIDs,
		})
	}

	s.log.Info().
		Str("org_id", orgID.String()).
		Int("list_count", len(req.ListIDs)).
		Msg("task_lists.reordered")

	return nil
}

// ── Tasks ────────────────────────────────────────────────────────────────────

func (s *Service) ListTasks(ctx context.Context, orgID uuid.UUID, filters TaskFilters) ([]TaskWithDetails, error) {
	// Ensure default lists exist before listing tasks
	if err := s.EnsureDefaultLists(ctx, orgID); err != nil {
		s.log.Warn().Err(err).Str("org_id", orgID.String()).Msg("failed to ensure default lists")
	}

	tasks, err := s.repo.ListTasks(ctx, orgID, filters)
	if err != nil {
		return nil, err
	}

	// Batch-load field values — one query for all tasks, no N+1
	if len(tasks) > 0 {
		taskIDs := make([]uuid.UUID, len(tasks))
		for i, t := range tasks {
			taskIDs[i] = t.ID
		}
		fieldValsByTask, err := s.repo.BatchGetFieldValues(ctx, orgID, taskIDs)
		if err != nil {
			// Non-fatal: log and continue without field values
			s.log.Warn().Err(err).Str("org_id", orgID.String()).Msg("failed to batch load field values")
		} else {
			for i, t := range tasks {
				if vals, ok := fieldValsByTask[t.ID]; ok {
					tasks[i].FieldValues = vals
				}
			}
		}
	}

	return tasks, nil
}

func (s *Service) GetTask(ctx context.Context, orgID, id uuid.UUID) (*TaskWithDetails, error) {
	task, err := s.repo.GetTask(ctx, orgID, id)
	if err != nil {
		return nil, err
	}

	vals, err := s.repo.GetTaskFieldValues(ctx, orgID, id)
	if err != nil {
		s.log.Warn().Err(err).Str("org_id", orgID.String()).Str("task_id", id.String()).Msg("failed to load field values")
	} else {
		task.FieldValues = vals
	}

	return task, nil
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

// GetUniqueLabels returns all unique labels used in tasks for an organisation
func (s *Service) GetUniqueLabels(ctx context.Context, orgID uuid.UUID) ([]string, error) {
	return s.repo.GetUniqueLabels(ctx, orgID)
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
	requesterEmployeeID uuid.UUID, // Employee who submitted the request
	assigneeID uuid.UUID, // Manager/approver
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

	task, err := s.repo.CreateTask(ctx, orgID, requesterEmployeeID, req)
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

	// Find the Done (final state) list
	doneList, err := s.repo.GetFinalStateList(ctx, task.OrganisationID)
	if err != nil {
		// If no final state list exists, just mark as completed without moving
		s.log.Warn().
			Err(err).
			Str("org_id", task.OrganisationID.String()).
			Msg("approval_task.no_final_state_list_found")

		// Fallback: just toggle completion
		_, err = s.repo.ToggleTaskCompletion(ctx, task.OrganisationID, task.ID)
		if err != nil {
			return fmt.Errorf("complete approval task: %w", err)
		}
	} else {
		// Move to Done list (will automatically set completed_at when moving to final state)
		// Use a high position to place at end of list
		_, err = s.repo.MoveTask(ctx, task.OrganisationID, task.ID, doneList.ID, 999999)
		if err != nil {
			return fmt.Errorf("move approval task to done list: %w", err)
		}
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

// ── Field Definitions ─────────────────────────────────────────────────────────

func (s *Service) ListFieldDefinitions(ctx context.Context, orgID uuid.UUID) ([]FieldDefinition, error) {
	return s.repo.ListFieldDefinitions(ctx, orgID)
}

func (s *Service) CreateFieldDefinition(ctx context.Context, orgID uuid.UUID, req CreateFieldDefinitionRequest, actorUserID ...uuid.UUID) (*FieldDefinition, error) {
	if !ValidFieldTypes[req.FieldType] {
		return nil, ErrInvalidFieldType(req.FieldType)
	}
	if (req.FieldType == "select" || req.FieldType == "multi_select") && len(req.Options) == 0 {
		return nil, ErrOptionsRequiredForType(req.FieldType)
	}

	fd, err := s.repo.CreateFieldDefinition(ctx, orgID, req)
	if err != nil {
		return nil, err
	}

	s.log.Info().
		Str("org_id", orgID.String()).
		Str("field_id", fd.ID.String()).
		Str("name", fd.Name).
		Str("field_type", fd.FieldType).
		Msg("task.field_definition.created")

	if len(actorUserID) > 0 {
		s.logAudit(ctx, audit.LogEntry{
			OrgID:        orgID,
			ActorUserID:  actorUserID[0],
			Action:       "task.field_definition.created",
			ResourceType: "task_field_definition",
			ResourceID:   fd.ID,
		})
	}

	return fd, nil
}

func (s *Service) UpdateFieldDefinition(ctx context.Context, orgID, id uuid.UUID, req UpdateFieldDefinitionRequest, actorUserID ...uuid.UUID) (*FieldDefinition, error) {
	fd, err := s.repo.UpdateFieldDefinition(ctx, orgID, id, req)
	if err != nil {
		return nil, err
	}

	s.log.Info().
		Str("org_id", orgID.String()).
		Str("field_id", id.String()).
		Msg("task.field_definition.updated")

	if len(actorUserID) > 0 {
		s.logAudit(ctx, audit.LogEntry{
			OrgID:        orgID,
			ActorUserID:  actorUserID[0],
			Action:       "task.field_definition.updated",
			ResourceType: "task_field_definition",
			ResourceID:   id,
		})
	}

	return fd, nil
}

func (s *Service) DeactivateFieldDefinition(ctx context.Context, orgID, id uuid.UUID, actorUserID ...uuid.UUID) error {
	if err := s.repo.DeactivateFieldDefinition(ctx, orgID, id); err != nil {
		return err
	}

	s.log.Info().
		Str("org_id", orgID.String()).
		Str("field_id", id.String()).
		Msg("task.field_definition.deactivated")

	if len(actorUserID) > 0 {
		s.logAudit(ctx, audit.LogEntry{
			OrgID:        orgID,
			ActorUserID:  actorUserID[0],
			Action:       "task.field_definition.deactivated",
			ResourceType: "task_field_definition",
			ResourceID:   id,
		})
	}

	return nil
}

// ── Field Values ──────────────────────────────────────────────────────────────

func (s *Service) SetFieldValue(ctx context.Context, orgID, taskID, fieldID uuid.UUID, req SetFieldValueRequest, actorUserID ...uuid.UUID) (*FieldValueWithDefinition, error) {
	// Load field definition to get type and validate options for select types
	fd, err := s.repo.GetFieldDefinition(ctx, orgID, fieldID)
	if err != nil {
		return nil, err
	}

	// For select/multi_select: validate value is one of the defined options
	if fd.FieldType == "select" || fd.FieldType == "multi_select" {
		if err := validateSelectValue(req.Value, fd.Options, fd.FieldType); err != nil {
			return nil, err
		}
	}

	fv, err := s.repo.SetFieldValue(ctx, orgID, taskID, fieldID, req, fd.FieldType)
	if err != nil {
		return nil, err
	}

	s.log.Info().
		Str("org_id", orgID.String()).
		Str("task_id", taskID.String()).
		Str("field_id", fieldID.String()).
		Str("field_type", fd.FieldType).
		Msg("task.field_value.set")

	if len(actorUserID) > 0 {
		s.logAudit(ctx, audit.LogEntry{
			OrgID:        orgID,
			ActorUserID:  actorUserID[0],
			Action:       "task.field_value.set",
			ResourceType: "task_field_value",
			ResourceID:   taskID,
		})
	}

	// Return as FieldValueWithDefinition
	result := &FieldValueWithDefinition{
		FieldID:      fieldID,
		FieldName:    fd.Name,
		FieldType:    fd.FieldType,
		ValueText:    fv.ValueText,
		ValueNumber:  fv.ValueNumber,
		ValueDate:    fv.ValueDate,
		ValueBoolean: fv.ValueBoolean,
		ValueJSON:    fv.ValueJSON,
	}
	return result, nil
}

func (s *Service) ClearFieldValue(ctx context.Context, orgID, taskID, fieldID uuid.UUID, actorUserID ...uuid.UUID) error {
	if err := s.repo.ClearFieldValue(ctx, orgID, taskID, fieldID); err != nil {
		return err
	}

	s.log.Info().
		Str("org_id", orgID.String()).
		Str("task_id", taskID.String()).
		Str("field_id", fieldID.String()).
		Msg("task.field_value.cleared")

	if len(actorUserID) > 0 {
		s.logAudit(ctx, audit.LogEntry{
			OrgID:        orgID,
			ActorUserID:  actorUserID[0],
			Action:       "task.field_value.cleared",
			ResourceType: "task_field_value",
			ResourceID:   taskID,
		})
	}
	return nil
}

// validateSelectValue checks that the value is among the defined options.
func validateSelectValue(raw json.RawMessage, options []FieldOption, fieldType string) error {
	allowed := make(map[string]bool, len(options))
	for _, o := range options {
		allowed[o.Value] = true
	}

	if fieldType == "select" {
		var v string
		if err := json.Unmarshal(raw, &v); err != nil {
			return ErrFieldValueInvalidType(fieldType)
		}
		if !allowed[v] {
			return apperr.New(apperr.CodeValidation, fmt.Sprintf("'%s' is not a valid option", v))
		}
	} else {
		var vals []string
		if err := json.Unmarshal(raw, &vals); err != nil {
			return ErrFieldValueInvalidType(fieldType)
		}
		for _, v := range vals {
			if !allowed[v] {
				return apperr.New(apperr.CodeValidation, fmt.Sprintf("'%s' is not a valid option", v))
			}
		}
	}
	return nil
}

// ── Task Links ───────────────────────────────────────────────────────────────

func (s *Service) CreateTaskLink(ctx context.Context, orgID, sourceTaskID uuid.UUID, req CreateTaskLinkRequest, createdBy uuid.UUID, actorUserID ...uuid.UUID) (*TaskLink, error) {
	// Validate: cannot link task to itself
	if sourceTaskID == req.TargetTaskID {
		return nil, ErrSelfLinking()
	}

	// Verify both tasks exist and belong to same org
	sourceTask, err := s.repo.GetTask(ctx, orgID, sourceTaskID)
	if err != nil {
		return nil, err
	}
	targetTask, err := s.repo.GetTask(ctx, orgID, req.TargetTaskID)
	if err != nil {
		return nil, err
	}
	if sourceTask.OrganisationID != targetTask.OrganisationID {
		return nil, ErrTasksNotInSameOrg()
	}

	// Check if link already exists
	exists, err := s.repo.LinkExists(ctx, orgID, sourceTaskID, req.TargetTaskID, req.LinkType)
	if err != nil {
		return nil, err
	}
	if exists {
		return nil, ErrLinkAlreadyExists()
	}

	// Detect circular dependencies for blocking links
	if req.LinkType == LinkTypeBlocks || req.LinkType == LinkTypeBlockedBy {
		if err := s.checkCircularDependency(ctx, orgID, sourceTaskID, req.TargetTaskID, req.LinkType); err != nil {
			return nil, err
		}
	}

	// Create the primary link
	link, err := s.repo.CreateTaskLink(ctx, orgID, sourceTaskID, req.TargetTaskID, createdBy, req.LinkType)
	if err != nil {
		return nil, err
	}

	// Create bidirectional link automatically
	reciprocalType := getReciprocalLinkType(req.LinkType)
	if reciprocalType != "" {
		_, err := s.repo.CreateTaskLink(ctx, orgID, req.TargetTaskID, sourceTaskID, createdBy, reciprocalType)
		if err != nil {
			s.log.Warn().Err(err).Msg("failed to create reciprocal task link")
		}
	}

	// Audit log
	if len(actorUserID) > 0 {
		s.logAudit(ctx, audit.LogEntry{
			OrgID:        orgID,
			ActorUserID:  actorUserID[0],
			Action:       "task.link.created",
			ResourceType: "task_link",
			ResourceID:   link.ID,
		})
	}

	return link, nil
}

func (s *Service) ListTaskLinks(ctx context.Context, orgID, taskID uuid.UUID) ([]TaskLinkWithTask, error) {
	return s.repo.ListTaskLinks(ctx, orgID, taskID)
}

func (s *Service) DeleteTaskLink(ctx context.Context, orgID, linkID uuid.UUID, actorUserID ...uuid.UUID) error {
	// TODO: Optionally also delete the reciprocal link
	err := s.repo.DeleteTaskLink(ctx, orgID, linkID)
	if err != nil {
		return err
	}

	if len(actorUserID) > 0 {
		s.logAudit(ctx, audit.LogEntry{
			OrgID:        orgID,
			ActorUserID:  actorUserID[0],
			Action:       "task.link.deleted",
			ResourceType: "task_link",
			ResourceID:   linkID,
		})
	}

	return nil
}

// getReciprocalLinkType returns the opposite link type for bidirectional links
func getReciprocalLinkType(linkType string) string {
	switch linkType {
	case LinkTypeBlocks:
		return LinkTypeBlockedBy
	case LinkTypeBlockedBy:
		return LinkTypeBlocks
	case LinkTypeFollows:
		return LinkTypePrecedes
	case LinkTypePrecedes:
		return LinkTypeFollows
	case LinkTypeDuplicates:
		return LinkTypeDuplicateOf
	case LinkTypeDuplicateOf:
		return LinkTypeDuplicates
	case LinkTypeRelatedTo:
		return LinkTypeRelatedTo // Symmetric
	default:
		return ""
	}
}

// checkCircularDependency detects if creating a link would cause a cycle
func (s *Service) checkCircularDependency(ctx context.Context, orgID, sourceTaskID, targetTaskID uuid.UUID, linkType string) error {
	// If A blocks B, then B cannot block A (directly or transitively)
	// Use BFS to check if targetTask already blocks sourceTask
	visited := make(map[uuid.UUID]bool)
	queue := []uuid.UUID{targetTaskID}

	for len(queue) > 0 {
		currentID := queue[0]
		queue = queue[1:]

		if visited[currentID] {
			continue
		}
		visited[currentID] = true

		// Get all tasks that currentTask blocks
		links, err := s.repo.ListTaskLinks(ctx, orgID, currentID)
		if err != nil {
			return err
		}

		for _, link := range links {
			if link.LinkType == LinkTypeBlocks {
				if link.TargetTaskID == sourceTaskID {
					// Cycle detected!
					return ErrCircularDependency()
				}
				queue = append(queue, link.TargetTaskID)
			}
		}
	}

	return nil
}

// ── Subtasks / Hierarchy ─────────────────────────────────────────────────────

const MaxHierarchyDepth = 2 // 0=root, 1=subtask, 2=sub-subtask

func (s *Service) CreateSubtask(ctx context.Context, orgID, parentTaskID, createdBy uuid.UUID, req CreateSubtaskRequest, actorUserID ...uuid.UUID) (*Task, error) {
	// Get parent task
	parentTask, err := s.repo.GetTask(ctx, orgID, parentTaskID)
	if err != nil {
		return nil, err
	}

	// Check max hierarchy depth
	if parentTask.HierarchyLevel >= MaxHierarchyDepth {
		return nil, ErrMaxHierarchyDepth(MaxHierarchyDepth + 1)
	}

	// Create task with parent relationship
	// Subtasks inherit the same task_list_id from parent
	createReq := CreateTaskRequest{
		TaskListID:  parentTask.TaskListID,
		Title:       req.Title,
		Description: req.Description,
		AssigneeID:  req.AssigneeID,
		Priority:    req.Priority,
		DueDate:     req.DueDate,
	}

	task, err := s.repo.CreateTask(ctx, orgID, createdBy, createReq)
	if err != nil {
		return nil, err
	}

	// Update to set parent and hierarchy level
	newHierarchyLevel := parentTask.HierarchyLevel + 1
	if err := s.repo.ChangeTaskParent(ctx, orgID, task.ID, &parentTaskID, newHierarchyLevel); err != nil {
		return nil, err
	}

	// Reload to get updated fields
	updatedTask, err := s.repo.GetTask(ctx, orgID, task.ID)
	if err != nil {
		return nil, err
	}

	// Audit log
	if len(actorUserID) > 0 {
		s.logAudit(ctx, audit.LogEntry{
			OrgID:        orgID,
			ActorUserID:  actorUserID[0],
			Action:       "task.subtask.created",
			ResourceType: "task",
			ResourceID:   task.ID,
		})
	}

	return &updatedTask.Task, nil
}

func (s *Service) ListSubtasks(ctx context.Context, orgID, parentTaskID uuid.UUID) ([]TaskWithDetails, error) {
	return s.repo.ListSubtasks(ctx, orgID, parentTaskID)
}

func (s *Service) GetSubtaskCounts(ctx context.Context, orgID, parentTaskID uuid.UUID) (*SubtaskCounts, error) {
	return s.repo.GetSubtaskCounts(ctx, orgID, parentTaskID)
}

func (s *Service) ChangeTaskParent(ctx context.Context, orgID, taskID uuid.UUID, req ChangeParentRequest, actorUserID ...uuid.UUID) error {
	// Get the task
	_, err := s.repo.GetTask(ctx, orgID, taskID)
	if err != nil {
		return err
	}

	var newHierarchyLevel int

	if req.ParentTaskID == nil {
		// Promote to root level
		newHierarchyLevel = 0
	} else {
		// Get new parent
		newParent, err := s.repo.GetTask(ctx, orgID, *req.ParentTaskID)
		if err != nil {
			return err
		}

		// Check max depth
		if newParent.HierarchyLevel >= MaxHierarchyDepth {
			return ErrMaxHierarchyDepth(MaxHierarchyDepth + 1)
		}

		// Prevent setting as child of own descendant (circular hierarchy)
		path, err := s.repo.GetTaskHierarchyPath(ctx, orgID, *req.ParentTaskID)
		if err != nil {
			return err
		}
		for _, ancestorID := range path {
			if ancestorID == taskID {
				return ErrCircularDependency()
			}
		}

		newHierarchyLevel = newParent.HierarchyLevel + 1
	}

	// Update parent relationship
	if err := s.repo.ChangeTaskParent(ctx, orgID, taskID, req.ParentTaskID, newHierarchyLevel); err != nil {
		return err
	}

	// Audit log
	if len(actorUserID) > 0 {
		s.logAudit(ctx, audit.LogEntry{
			OrgID:        orgID,
			ActorUserID:  actorUserID[0],
			Action:       "task.parent.changed",
			ResourceType: "task",
			ResourceID:   taskID,
		})
	}

	return nil
}

func (s *Service) ReorderSubtasks(ctx context.Context, orgID, parentTaskID uuid.UUID, req ReorderSubtasksRequest, actorUserID ...uuid.UUID) error {
	// Verify all subtasks belong to the parent
	for _, subtaskID := range req.SubtaskIDs {
		task, err := s.repo.GetTask(ctx, orgID, subtaskID)
		if err != nil {
			return err
		}
		if task.ParentTaskID == nil || *task.ParentTaskID != parentTaskID {
			return apperr.New(apperr.CodeValidation, "task is not a subtask of the specified parent")
		}
	}

	if err := s.repo.ReorderSubtasks(ctx, orgID, parentTaskID, req.SubtaskIDs); err != nil {
		return err
	}

	if len(actorUserID) > 0 {
		s.logAudit(ctx, audit.LogEntry{
			OrgID:        orgID,
			ActorUserID:  actorUserID[0],
			Action:       "task.subtasks.reordered",
			ResourceType: "task",
			ResourceID:   parentTaskID,
		})
	}

	return nil
}

// ── Helper Functions ─────────────────────────────────────────────────────────

// generateCompanyInitials creates initials from company name for task codes.
// Examples:
//   - "Workived" → "WOR"
//   - "Acme Corp" → "AC"
//   - "Digital Solutions" → "DS"
//   - "ABC Company Limited" → "ABC"
func generateCompanyInitials(companyName string) string {
	if companyName == "" {
		return "ORG"
	}

	// Split by spaces and filter out common words
	commonWords := map[string]bool{
		"the": true, "and": true, "of": true, "in": true, "a": true, "an": true,
		"inc": true, "ltd": true, "llc": true, "corp": true, "co": true,
		"company": true, "limited": true, "corporation": true,
		"pt": true, "cv": true, "tbk": true, // Indonesian entities
	}

	words := []string{}
	for _, word := range splitWords(companyName) {
		if !commonWords[word] && len(word) > 0 {
			words = append(words, word)
		}
	}

	if len(words) == 0 {
		// Fallback: use first 3 chars of original name
		clean := cleanForInitials(companyName)
		if len(clean) >= 3 {
			return clean[:3]
		}
		return "ORG"
	}

	// Strategy 1: If 3+ significant words, take first letter of each
	if len(words) >= 3 {
		initials := ""
		for i := 0; i < 3 && i < len(words); i++ {
			if len(words[i]) > 0 {
				initials += string(toUpper(rune(words[i][0])))
			}
		}
		return initials
	}

	// Strategy 2: If 2 words, take first letter of each
	if len(words) == 2 {
		return string(toUpper(rune(words[0][0]))) + string(toUpper(rune(words[1][0])))
	}

	// Strategy 3: Single word - take first 3 letters
	word := words[0]
	if len(word) >= 3 {
		return string(toUpper(rune(word[0]))) + string(toUpper(rune(word[1]))) + string(toUpper(rune(word[2])))
	}

	return "ORG"
}

// splitWords splits a string into lowercase words, removing punctuation
func splitWords(s string) []string {
	var words []string
	var current []rune

	for _, r := range s {
		if (r >= 'a' && r <= 'z') || (r >= 'A' && r <= 'Z') || (r >= '0' && r <= '9') {
			current = append(current, toLower(r))
		} else if len(current) > 0 {
			words = append(words, string(current))
			current = nil
		}
	}

	if len(current) > 0 {
		words = append(words, string(current))
	}

	return words
}

// cleanForInitials removes non-alphanumeric chars and converts to uppercase
func cleanForInitials(s string) string {
	var result []rune
	for _, r := range s {
		if (r >= 'a' && r <= 'z') || (r >= 'A' && r <= 'Z') || (r >= '0' && r <= '9') {
			result = append(result, toUpper(r))
		}
	}
	return string(result)
}

func toLower(r rune) rune {
	if r >= 'A' && r <= 'Z' {
		return r + ('a' - 'A')
	}
	return r
}

func toUpper(r rune) rune {
	if r >= 'a' && r <= 'z' {
		return r - ('a' - 'A')
	}
	return r
}
