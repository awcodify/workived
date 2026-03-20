package tasks

import (
	"context"
	"fmt"

	"github.com/google/uuid"
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

	task, err := s.repo.MoveTask(ctx, orgID, taskID, req.TaskListID, req.Position)
	if err != nil {
		return nil, err
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

	task, err := s.repo.ToggleTaskCompletion(ctx, orgID, taskID)
	if err != nil {
		return nil, err
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

// ── Comments ─────────────────────────────────────────────────────────────────

func (s *Service) ListComments(ctx context.Context, orgID, taskID uuid.UUID) ([]TaskCommentWithAuthor, error) {
	// Verify task exists first
	_, err := s.repo.GetTask(ctx, orgID, taskID)
	if err != nil {
		return nil, err
	}

	return s.repo.ListComments(ctx, orgID, taskID)
}

func (s *Service) CreateComment(ctx context.Context, orgID, taskID, authorID uuid.UUID, body string, actorUserID ...uuid.UUID) (*TaskComment, error) {
	comment, err := s.repo.CreateComment(ctx, orgID, taskID, authorID, body)
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
