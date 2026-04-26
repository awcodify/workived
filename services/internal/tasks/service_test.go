package tasks_test

import (
	"context"
	"errors"
	"testing"

	"github.com/google/uuid"
	"github.com/rs/zerolog"
	"github.com/workived/services/internal/tasks"
	"github.com/workived/services/pkg/apperr"
)

// ── Mock Repository ─────────────────────────────────────────────────────────

type mockRepo struct {
	listTaskListsFn             func(ctx context.Context, orgID uuid.UUID) ([]tasks.TaskList, error)
	getTaskListFn               func(ctx context.Context, orgID, id uuid.UUID) (*tasks.TaskList, error)
	createTaskListFn            func(ctx context.Context, orgID uuid.UUID, req tasks.CreateListRequest) (*tasks.TaskList, error)
	updateTaskListFn            func(ctx context.Context, orgID, id uuid.UUID, req tasks.UpdateListRequest) (*tasks.TaskList, error)
	deactivateTaskListFn        func(ctx context.Context, orgID, id uuid.UUID) error
	countTaskListsFn            func(ctx context.Context, orgID uuid.UUID) (int, error)
	countTasksInListFn          func(ctx context.Context, orgID, listID uuid.UUID) (int, error)
	moveTasksToListFn           func(ctx context.Context, orgID, fromListID, toListID uuid.UUID) error
	reorderTaskListsFn          func(ctx context.Context, orgID uuid.UUID, listIDs []uuid.UUID) error
	getFinalStateListFn         func(ctx context.Context, orgID uuid.UUID) (*tasks.TaskList, error)
	listTasksFn                 func(ctx context.Context, orgID uuid.UUID, filters tasks.TaskFilters) ([]tasks.TaskWithDetails, error)
	getTaskFn                   func(ctx context.Context, orgID, id uuid.UUID) (*tasks.TaskWithDetails, error)
	getTaskByApprovalFn         func(ctx context.Context, approvalType string, approvalID uuid.UUID) (*tasks.TaskWithDetails, error)
	nextTaskCodeFn              func(ctx context.Context, orgID uuid.UUID) (string, error)
	createTaskFn                func(ctx context.Context, orgID, createdBy uuid.UUID, req tasks.CreateTaskRequest) (*tasks.Task, error)
	updateTaskFn                func(ctx context.Context, orgID, id uuid.UUID, req tasks.UpdateTaskRequest) (*tasks.Task, error)
	moveTaskFn                  func(ctx context.Context, orgID, taskID uuid.UUID, newListID uuid.UUID, newPosition int) (*tasks.Task, error)
	toggleTaskCompletionFn      func(ctx context.Context, orgID, taskID uuid.UUID) (*tasks.Task, error)
	deleteTaskFn                func(ctx context.Context, orgID, id uuid.UUID) error
	listCommentsFn              func(ctx context.Context, orgID, taskID uuid.UUID) ([]tasks.TaskCommentWithAuthor, error)
	createCommentFn             func(ctx context.Context, orgID, taskID, authorID uuid.UUID, parentID *uuid.UUID, body, contentType string) (*tasks.TaskComment, error)
	deleteCommentFn             func(ctx context.Context, orgID, commentID, authorID uuid.UUID) error
	toggleReactionFn            func(ctx context.Context, orgID, commentID, employeeID uuid.UUID, emoji string) (added bool, err error)
	listReactionsFn             func(ctx context.Context, orgID, commentID, currentEmployeeID uuid.UUID) ([]tasks.CommentReactionSummary, error)
	listFieldDefinitionsFn      func(ctx context.Context, orgID uuid.UUID) ([]tasks.FieldDefinition, error)
	getFieldDefinitionFn        func(ctx context.Context, orgID, id uuid.UUID) (*tasks.FieldDefinition, error)
	createFieldDefinitionFn     func(ctx context.Context, orgID uuid.UUID, req tasks.CreateFieldDefinitionRequest) (*tasks.FieldDefinition, error)
	updateFieldDefinitionFn     func(ctx context.Context, orgID, id uuid.UUID, req tasks.UpdateFieldDefinitionRequest) (*tasks.FieldDefinition, error)
	deactivateFieldDefinitionFn func(ctx context.Context, orgID, id uuid.UUID) error
	setFieldValueFn             func(ctx context.Context, orgID, taskID, fieldID uuid.UUID, req tasks.SetFieldValueRequest, fieldType string) (*tasks.FieldValue, error)
	clearFieldValueFn           func(ctx context.Context, orgID, taskID, fieldID uuid.UUID) error
	getTaskFieldValuesFn        func(ctx context.Context, orgID, taskID uuid.UUID) ([]tasks.FieldValueWithDefinition, error)
	batchGetFieldValuesFn       func(ctx context.Context, orgID uuid.UUID, taskIDs []uuid.UUID) (map[uuid.UUID][]tasks.FieldValueWithDefinition, error)
}

func (m *mockRepo) ListTaskLists(ctx context.Context, orgID uuid.UUID) ([]tasks.TaskList, error) {
	if m.listTaskListsFn != nil {
		return m.listTaskListsFn(ctx, orgID)
	}
	return []tasks.TaskList{}, nil
}

func (m *mockRepo) GetTaskList(ctx context.Context, orgID, id uuid.UUID) (*tasks.TaskList, error) {
	if m.getTaskListFn != nil {
		return m.getTaskListFn(ctx, orgID, id)
	}
	return &tasks.TaskList{ID: id, Name: "Test List", OrganisationID: orgID}, nil
}

func (m *mockRepo) GetFinalStateList(ctx context.Context, orgID uuid.UUID) (*tasks.TaskList, error) {
	if m.getFinalStateListFn != nil {
		return m.getFinalStateListFn(ctx, orgID)
	}
	return &tasks.TaskList{ID: uuid.New(), Name: "Done", IsFinalState: true}, nil
}

func (m *mockRepo) CreateTaskList(ctx context.Context, orgID uuid.UUID, req tasks.CreateListRequest) (*tasks.TaskList, error) {
	if m.createTaskListFn != nil {
		return m.createTaskListFn(ctx, orgID, req)
	}
	return &tasks.TaskList{ID: uuid.New(), Name: req.Name, OrganisationID: orgID}, nil
}

func (m *mockRepo) UpdateTaskList(ctx context.Context, orgID, id uuid.UUID, req tasks.UpdateListRequest) (*tasks.TaskList, error) {
	if m.updateTaskListFn != nil {
		return m.updateTaskListFn(ctx, orgID, id, req)
	}
	return &tasks.TaskList{ID: id, OrganisationID: orgID}, nil
}

func (m *mockRepo) DeactivateTaskList(ctx context.Context, orgID, id uuid.UUID) error {
	if m.deactivateTaskListFn != nil {
		return m.deactivateTaskListFn(ctx, orgID, id)
	}
	return nil
}

func (m *mockRepo) CountTaskLists(ctx context.Context, orgID uuid.UUID) (int, error) {
	if m.countTaskListsFn != nil {
		return m.countTaskListsFn(ctx, orgID)
	}
	return 3, nil
}

func (m *mockRepo) CountTasksInList(ctx context.Context, orgID, listID uuid.UUID) (int, error) {
	if m.countTasksInListFn != nil {
		return m.countTasksInListFn(ctx, orgID, listID)
	}
	return 0, nil
}

func (m *mockRepo) MoveTasksToList(ctx context.Context, orgID, fromListID, toListID uuid.UUID) error {
	if m.moveTasksToListFn != nil {
		return m.moveTasksToListFn(ctx, orgID, fromListID, toListID)
	}
	return nil
}

func (m *mockRepo) ReorderTaskLists(ctx context.Context, orgID uuid.UUID, listIDs []uuid.UUID) error {
	if m.reorderTaskListsFn != nil {
		return m.reorderTaskListsFn(ctx, orgID, listIDs)
	}
	return nil
}

// Stub implementations for other required methods
func (m *mockRepo) ListTasks(ctx context.Context, orgID uuid.UUID, filters tasks.TaskFilters) ([]tasks.TaskWithDetails, error) {
	if m.listTasksFn != nil {
		return m.listTasksFn(ctx, orgID, filters)
	}
	return []tasks.TaskWithDetails{}, nil
}

func (m *mockRepo) GetTask(ctx context.Context, orgID, id uuid.UUID) (*tasks.TaskWithDetails, error) {
	if m.getTaskFn != nil {
		return m.getTaskFn(ctx, orgID, id)
	}
	return &tasks.TaskWithDetails{}, nil
}

func (m *mockRepo) GetTaskByApproval(ctx context.Context, approvalType string, approvalID uuid.UUID) (*tasks.TaskWithDetails, error) {
	if m.getTaskByApprovalFn != nil {
		return m.getTaskByApprovalFn(ctx, approvalType, approvalID)
	}
	return &tasks.TaskWithDetails{}, nil
}

func (m *mockRepo) NextTaskCode(ctx context.Context, orgID uuid.UUID) (string, error) {
	if m.nextTaskCodeFn != nil {
		return m.nextTaskCodeFn(ctx, orgID)
	}
	return "TEST-1", nil
}

func (m *mockRepo) CreateTask(ctx context.Context, orgID, createdBy uuid.UUID, req tasks.CreateTaskRequest) (*tasks.Task, error) {
	if m.createTaskFn != nil {
		return m.createTaskFn(ctx, orgID, createdBy, req)
	}
	return &tasks.Task{}, nil
}

func (m *mockRepo) UpdateTask(ctx context.Context, orgID, id uuid.UUID, req tasks.UpdateTaskRequest) (*tasks.Task, error) {
	if m.updateTaskFn != nil {
		return m.updateTaskFn(ctx, orgID, id, req)
	}
	return &tasks.Task{}, nil
}

func (m *mockRepo) MoveTask(ctx context.Context, orgID, taskID uuid.UUID, newListID uuid.UUID, newPosition int) (*tasks.Task, error) {
	if m.moveTaskFn != nil {
		return m.moveTaskFn(ctx, orgID, taskID, newListID, newPosition)
	}
	return &tasks.Task{}, nil
}

func (m *mockRepo) ToggleTaskCompletion(ctx context.Context, orgID, taskID uuid.UUID) (*tasks.Task, error) {
	if m.toggleTaskCompletionFn != nil {
		return m.toggleTaskCompletionFn(ctx, orgID, taskID)
	}
	return &tasks.Task{}, nil
}

func (m *mockRepo) DeleteTask(ctx context.Context, orgID, id uuid.UUID) error {
	if m.deleteTaskFn != nil {
		return m.deleteTaskFn(ctx, orgID, id)
	}
	return nil
}

func (m *mockRepo) ListComments(ctx context.Context, orgID, taskID uuid.UUID) ([]tasks.TaskCommentWithAuthor, error) {
	if m.listCommentsFn != nil {
		return m.listCommentsFn(ctx, orgID, taskID)
	}
	return []tasks.TaskCommentWithAuthor{}, nil
}

func (m *mockRepo) CreateComment(ctx context.Context, orgID, taskID, authorID uuid.UUID, parentID *uuid.UUID, body, contentType string) (*tasks.TaskComment, error) {
	if m.createCommentFn != nil {
		return m.createCommentFn(ctx, orgID, taskID, authorID, parentID, body, contentType)
	}
	return &tasks.TaskComment{}, nil
}

func (m *mockRepo) DeleteComment(ctx context.Context, orgID, commentID, authorID uuid.UUID) error {
	if m.deleteCommentFn != nil {
		return m.deleteCommentFn(ctx, orgID, commentID, authorID)
	}
	return nil
}

func (m *mockRepo) ToggleReaction(ctx context.Context, orgID, commentID, employeeID uuid.UUID, emoji string) (added bool, err error) {
	if m.toggleReactionFn != nil {
		return m.toggleReactionFn(ctx, orgID, commentID, employeeID, emoji)
	}
	return false, nil
}

func (m *mockRepo) ListReactions(ctx context.Context, orgID, commentID, currentEmployeeID uuid.UUID) ([]tasks.CommentReactionSummary, error) {
	if m.listReactionsFn != nil {
		return m.listReactionsFn(ctx, orgID, commentID, currentEmployeeID)
	}
	return []tasks.CommentReactionSummary{}, nil
}

func (m *mockRepo) ListFieldDefinitions(ctx context.Context, orgID uuid.UUID) ([]tasks.FieldDefinition, error) {
	if m.listFieldDefinitionsFn != nil {
		return m.listFieldDefinitionsFn(ctx, orgID)
	}
	return []tasks.FieldDefinition{}, nil
}

func (m *mockRepo) GetFieldDefinition(ctx context.Context, orgID, id uuid.UUID) (*tasks.FieldDefinition, error) {
	if m.getFieldDefinitionFn != nil {
		return m.getFieldDefinitionFn(ctx, orgID, id)
	}
	return &tasks.FieldDefinition{}, nil
}

func (m *mockRepo) CreateFieldDefinition(ctx context.Context, orgID uuid.UUID, req tasks.CreateFieldDefinitionRequest) (*tasks.FieldDefinition, error) {
	if m.createFieldDefinitionFn != nil {
		return m.createFieldDefinitionFn(ctx, orgID, req)
	}
	return &tasks.FieldDefinition{}, nil
}

func (m *mockRepo) UpdateFieldDefinition(ctx context.Context, orgID, id uuid.UUID, req tasks.UpdateFieldDefinitionRequest) (*tasks.FieldDefinition, error) {
	if m.updateFieldDefinitionFn != nil {
		return m.updateFieldDefinitionFn(ctx, orgID, id, req)
	}
	return &tasks.FieldDefinition{}, nil
}

func (m *mockRepo) DeactivateFieldDefinition(ctx context.Context, orgID, id uuid.UUID) error {
	if m.deactivateFieldDefinitionFn != nil {
		return m.deactivateFieldDefinitionFn(ctx, orgID, id)
	}
	return nil
}

func (m *mockRepo) SetFieldValue(ctx context.Context, orgID, taskID, fieldID uuid.UUID, req tasks.SetFieldValueRequest, fieldType string) (*tasks.FieldValue, error) {
	if m.setFieldValueFn != nil {
		return m.setFieldValueFn(ctx, orgID, taskID, fieldID, req, fieldType)
	}
	return &tasks.FieldValue{}, nil
}

func (m *mockRepo) ClearFieldValue(ctx context.Context, orgID, taskID, fieldID uuid.UUID) error {
	if m.clearFieldValueFn != nil {
		return m.clearFieldValueFn(ctx, orgID, taskID, fieldID)
	}
	return nil
}

func (m *mockRepo) GetTaskFieldValues(ctx context.Context, orgID, taskID uuid.UUID) ([]tasks.FieldValueWithDefinition, error) {
	if m.getTaskFieldValuesFn != nil {
		return m.getTaskFieldValuesFn(ctx, orgID, taskID)
	}
	return []tasks.FieldValueWithDefinition{}, nil
}

func (m *mockRepo) BatchGetFieldValues(ctx context.Context, orgID uuid.UUID, taskIDs []uuid.UUID) (map[uuid.UUID][]tasks.FieldValueWithDefinition, error) {
	if m.batchGetFieldValuesFn != nil {
		return m.batchGetFieldValuesFn(ctx, orgID, taskIDs)
	}
	return map[uuid.UUID][]tasks.FieldValueWithDefinition{}, nil
}

// Task Links (stub implementations)
func (m *mockRepo) CreateTaskLink(ctx context.Context, orgID, sourceTaskID, targetTaskID, createdBy uuid.UUID, linkType string) (*tasks.TaskLink, error) {
	return &tasks.TaskLink{}, nil
}

func (m *mockRepo) ListTaskLinks(ctx context.Context, orgID, taskID uuid.UUID) ([]tasks.TaskLinkWithTask, error) {
	return []tasks.TaskLinkWithTask{}, nil
}

func (m *mockRepo) DeleteTaskLink(ctx context.Context, orgID, linkID uuid.UUID) error {
	return nil
}

func (m *mockRepo) LinkExists(ctx context.Context, orgID, sourceTaskID, targetTaskID uuid.UUID, linkType string) (bool, error) {
	return false, nil
}

func (m *mockRepo) GetUniqueLabels(ctx context.Context, orgID uuid.UUID) ([]string, error) {
	return []string{}, nil
}

// Subtasks / Hierarchy (stub implementations)
func (m *mockRepo) ListSubtasks(ctx context.Context, orgID, parentTaskID uuid.UUID) ([]tasks.TaskWithDetails, error) {
	return []tasks.TaskWithDetails{}, nil
}

func (m *mockRepo) GetSubtaskCounts(ctx context.Context, orgID, parentTaskID uuid.UUID) (*tasks.SubtaskCounts, error) {
	return &tasks.SubtaskCounts{}, nil
}

func (m *mockRepo) ChangeTaskParent(ctx context.Context, orgID, taskID uuid.UUID, newParentID *uuid.UUID, newHierarchyLevel int) error {
	return nil
}

func (m *mockRepo) ReorderSubtasks(ctx context.Context, orgID, parentTaskID uuid.UUID, subtaskIDs []uuid.UUID) error {
	return nil
}

func (m *mockRepo) GetTaskHierarchyPath(ctx context.Context, orgID, taskID uuid.UUID) ([]uuid.UUID, error) {
	return []uuid.UUID{}, nil
}

// ── Mock ProLicenseChecker ──────────────────────────────────────────────────

type mockProLicenseChecker struct {
	hasActiveLicense bool
	err              error
}

func (m *mockProLicenseChecker) HasActiveProLicense(ctx context.Context, orgID uuid.UUID) (bool, error) {
	return m.hasActiveLicense, m.err
}

// ── Service Tests ────────────────────────────────────────────────────────────

func TestService_CreateTaskList_ProTierEnforcement(t *testing.T) {
	ctx := context.Background()
	orgID := uuid.New()

	tests := []struct {
		name            string
		hasProLicense   bool
		licenseCheckErr error
		wantErr         bool
		wantErrCode     string
	}{
		{
			name:          "allows creation with Pro license",
			hasProLicense: true,
			wantErr:       false,
		},
		{
			name:          "blocks creation without Pro license",
			hasProLicense: false,
			wantErr:       true,
			wantErrCode:   apperr.CodeForbidden,
		},
		{
			name:            "returns error if license check fails",
			hasProLicense:   false,
			licenseCheckErr: errors.New("database error"),
			wantErr:         true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			repo := &mockRepo{
				createTaskListFn: func(ctx context.Context, orgID uuid.UUID, req tasks.CreateListRequest) (*tasks.TaskList, error) {
					return &tasks.TaskList{ID: uuid.New(), Name: req.Name}, nil
				},
				countTaskListsFn: func(ctx context.Context, orgID uuid.UUID) (int, error) {
					return 3, nil
				},
			}

			proChecker := &mockProLicenseChecker{
				hasActiveLicense: tt.hasProLicense,
				err:              tt.licenseCheckErr,
			}

			svc := tasks.NewService(repo, tasks.WithProLicenseChecker(proChecker), tasks.WithLogger(zerolog.Nop()))

			req := tasks.CreateListRequest{Name: "Custom List"}
			_, err := svc.CreateTaskList(ctx, orgID, req)

			if (err != nil) != tt.wantErr {
				t.Errorf("CreateTaskList() error = %v, wantErr %v", err, tt.wantErr)
				return
			}

			if tt.wantErr && tt.wantErrCode != "" {
				if appErr, ok := err.(*apperr.AppError); ok {
					if appErr.Code != tt.wantErrCode {
						t.Errorf("error code = %s, want %s", appErr.Code, tt.wantErrCode)
					}
				}
			}
		})
	}
}

func TestService_CreateTaskList_MaxListsEnforcement(t *testing.T) {
	ctx := context.Background()
	orgID := uuid.New()

	repo := &mockRepo{
		countTaskListsFn: func(ctx context.Context, orgID uuid.UUID) (int, error) {
			return 20, nil // At max limit
		},
	}

	proChecker := &mockProLicenseChecker{hasActiveLicense: true}
	svc := tasks.NewService(repo, tasks.WithProLicenseChecker(proChecker), tasks.WithLogger(zerolog.Nop()))

	req := tasks.CreateListRequest{Name: "Too Many"}
	_, err := svc.CreateTaskList(ctx, orgID, req)

	if err == nil {
		t.Error("CreateTaskList() expected error for max lists exceeded, got nil")
	}
}

func TestService_UpdateTaskList_ProTierEnforcement(t *testing.T) {
	ctx := context.Background()
	orgID := uuid.New()
	listID := uuid.New()

	repo := &mockRepo{
		getTaskListFn: func(ctx context.Context, orgID, id uuid.UUID) (*tasks.TaskList, error) {
			return &tasks.TaskList{ID: id, Name: "Old Name"}, nil
		},
		updateTaskListFn: func(ctx context.Context, orgID, id uuid.UUID, req tasks.UpdateListRequest) (*tasks.TaskList, error) {
			return &tasks.TaskList{ID: id}, nil
		},
	}

	proChecker := &mockProLicenseChecker{hasActiveLicense: false}
	svc := tasks.NewService(repo, tasks.WithProLicenseChecker(proChecker), tasks.WithLogger(zerolog.Nop()))

	newName := "New Name"
	req := tasks.UpdateListRequest{Name: &newName}
	_, err := svc.UpdateTaskList(ctx, orgID, listID, req)

	if err == nil {
		t.Error("UpdateTaskList() expected Pro tier error, got nil")
	}

	if appErr, ok := err.(*apperr.AppError); ok {
		if appErr.Code != apperr.CodeForbidden {
			t.Errorf("error code = %s, want %s", appErr.Code, apperr.CodeForbidden)
		}
	}
}

func TestService_DeactivateTaskList_CannotDeleteLast(t *testing.T) {
	ctx := context.Background()
	orgID := uuid.New()
	listID := uuid.New()

	repo := &mockRepo{
		countTaskListsFn: func(ctx context.Context, orgID uuid.UUID) (int, error) {
			return 1, nil // Only 1 list remaining
		},
	}

	proChecker := &mockProLicenseChecker{hasActiveLicense: true}
	svc := tasks.NewService(repo, tasks.WithProLicenseChecker(proChecker), tasks.WithLogger(zerolog.Nop()))

	req := tasks.DeleteListRequest{}
	err := svc.DeactivateTaskList(ctx, orgID, listID, req)

	if err == nil {
		t.Error("DeactivateTaskList() expected error for last list deletion, got nil")
	}
}

func TestService_DeactivateTaskList_RequiresMoveTasksTo(t *testing.T) {
	ctx := context.Background()
	orgID := uuid.New()
	listID := uuid.New()

	repo := &mockRepo{
		countTaskListsFn: func(ctx context.Context, orgID uuid.UUID) (int, error) {
			return 3, nil
		},
		countTasksInListFn: func(ctx context.Context, orgID, listID uuid.UUID) (int, error) {
			return 5, nil // List has 5 tasks
		},
	}

	proChecker := &mockProLicenseChecker{hasActiveLicense: true}
	svc := tasks.NewService(repo, tasks.WithProLicenseChecker(proChecker), tasks.WithLogger(zerolog.Nop()))

	req := tasks.DeleteListRequest{} // No move_tasks_to specified
	err := svc.DeactivateTaskList(ctx, orgID, listID, req)

	if err == nil {
		t.Error("DeactivateTaskList() expected error for tasks without migration target, got nil")
	}
}

func TestService_DeactivateTaskList_MigratesTasks(t *testing.T) {
	ctx := context.Background()
	orgID := uuid.New()
	listID := uuid.New()
	targetListID := uuid.New()

	var tasksMovedFrom, tasksMovedTo uuid.UUID

	repo := &mockRepo{
		countTaskListsFn: func(ctx context.Context, orgID uuid.UUID) (int, error) {
			return 3, nil
		},
		countTasksInListFn: func(ctx context.Context, orgID, listID uuid.UUID) (int, error) {
			return 5, nil
		},
		getTaskListFn: func(ctx context.Context, orgID, id uuid.UUID) (*tasks.TaskList, error) {
			return &tasks.TaskList{ID: id, Name: "List", OrganisationID: orgID}, nil
		},
		moveTasksToListFn: func(ctx context.Context, orgID, fromListID, toListID uuid.UUID) error {
			tasksMovedFrom = fromListID
			tasksMovedTo = toListID
			return nil
		},
		deactivateTaskListFn: func(ctx context.Context, orgID, id uuid.UUID) error {
			return nil
		},
	}

	proChecker := &mockProLicenseChecker{hasActiveLicense: true}
	svc := tasks.NewService(repo, tasks.WithProLicenseChecker(proChecker), tasks.WithLogger(zerolog.Nop()))

	req := tasks.DeleteListRequest{MoveTasksTo: &targetListID}
	err := svc.DeactivateTaskList(ctx, orgID, listID, req)

	if err != nil {
		t.Errorf("DeactivateTaskList() unexpected error: %v", err)
	}

	if tasksMovedFrom != listID {
		t.Errorf("tasks moved from %v, want %v", tasksMovedFrom, listID)
	}

	if tasksMovedTo != targetListID {
		t.Errorf("tasks moved to %v, want %v", tasksMovedTo, targetListID)
	}
}

func TestService_ReorderTaskLists_ProTierEnforcement(t *testing.T) {
	ctx := context.Background()
	orgID := uuid.New()

	listIDs := []uuid.UUID{uuid.New(), uuid.New(), uuid.New()}

	repo := &mockRepo{
		getTaskListFn: func(ctx context.Context, orgID, id uuid.UUID) (*tasks.TaskList, error) {
			return &tasks.TaskList{ID: id, OrganisationID: orgID}, nil
		},
		reorderTaskListsFn: func(ctx context.Context, orgID uuid.UUID, listIDs []uuid.UUID) error {
			return nil
		},
	}

	proChecker := &mockProLicenseChecker{hasActiveLicense: false}
	svc := tasks.NewService(repo, tasks.WithProLicenseChecker(proChecker), tasks.WithLogger(zerolog.Nop()))

	req := tasks.ReorderListsRequest{ListIDs: listIDs}
	err := svc.ReorderTaskLists(ctx, orgID, req)

	if err == nil {
		t.Error("ReorderTaskLists() expected Pro tier error, got nil")
	}
}

func TestService_ReorderTaskLists_ValidatesAllListsBelongToOrg(t *testing.T) {
	ctx := context.Background()
	orgID := uuid.New()

	listIDs := []uuid.UUID{uuid.New(), uuid.New()}

	repo := &mockRepo{
		getTaskListFn: func(ctx context.Context, orgID, id uuid.UUID) (*tasks.TaskList, error) {
			// Second list not found (simulates cross-org access - real DB query filters by org_id)
			if id == listIDs[1] {
				return nil, tasks.ErrTaskListNotFound()
			}
			return &tasks.TaskList{ID: id, OrganisationID: orgID}, nil
		},
	}

	proChecker := &mockProLicenseChecker{hasActiveLicense: true}
	svc := tasks.NewService(repo, tasks.WithProLicenseChecker(proChecker), tasks.WithLogger(zerolog.Nop()))

	req := tasks.ReorderListsRequest{ListIDs: listIDs}
	err := svc.ReorderTaskLists(ctx, orgID, req)

	// Should fail when trying to get the second list (not found for this org)
	if err == nil {
		t.Error("ReorderTaskLists() expected error for cross-org list access, got nil")
	}
}
