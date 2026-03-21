package tasks_test

import (
	"bytes"
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/rs/zerolog"
	"github.com/workived/services/internal/platform/middleware"
	"github.com/workived/services/internal/tasks"
)

func init() {
	gin.SetMode(gin.TestMode)
}

// ── Test IDs ─────────────────────────────────────────────────────────────────

var (
	testOrgID     = uuid.MustParse("00000000-0000-0000-0000-000000000001")
	testUserID    = uuid.MustParse("00000000-0000-0000-0000-000000000002")
	testEmpID     = uuid.MustParse("00000000-0000-0000-0000-000000000003")
	testListID    = uuid.MustParse("00000000-0000-0000-0000-000000000004")
	testTaskID    = uuid.MustParse("00000000-0000-0000-0000-000000000005")
	testCommentID = uuid.MustParse("00000000-0000-0000-0000-000000000006")
)

// ── Helpers ──────────────────────────────────────────────────────────────────

var defaultEmpLookup = tasks.EmployeeLookupFunc(func(_ context.Context, _, _ uuid.UUID) (uuid.UUID, error) {
	return testEmpID, nil
})

func newRouter(svc tasks.ServiceInterface) *gin.Engine {
	return newRouterWithLookup(svc, defaultEmpLookup)
}

func newRouterWithLookup(svc tasks.ServiceInterface, lookup tasks.EmployeeLookupFunc) *gin.Engine {
	r := gin.New()
	r.Use(func(c *gin.Context) {
		c.Set("org_id", testOrgID)
		c.Set("user_id", testUserID)
		c.Set("role", middleware.RoleAdmin)
		c.Next()
	})
	h := tasks.NewHandler(svc, lookup, zerolog.Nop())
	h.RegisterRoutes(r.Group("/api/v1"))
	return r
}

func jsonBody(t *testing.T, v any) *bytes.Buffer {
	t.Helper()
	b, _ := json.Marshal(v)
	return bytes.NewBuffer(b)
}

func assertStatus(t *testing.T, w *httptest.ResponseRecorder, want int) {
	t.Helper()
	if w.Code != want {
		t.Errorf("status = %d, want %d; body: %s", w.Code, want, w.Body.String())
	}
}

func assertHasDataKey(t *testing.T, w *httptest.ResponseRecorder) {
	t.Helper()
	var body map[string]json.RawMessage
	if err := json.Unmarshal(w.Body.Bytes(), &body); err != nil {
		t.Fatalf("failed to unmarshal body: %v", err)
	}
	if _, ok := body["data"]; !ok {
		t.Errorf("response body missing \"data\" key; got: %s", w.Body.String())
	}
}

// ── Fake Service ─────────────────────────────────────────────────────────────

type fakeService struct {
	listTaskListsFn        func(ctx context.Context, orgID uuid.UUID) ([]tasks.TaskList, error)
	createTaskListFn       func(ctx context.Context, orgID uuid.UUID, req tasks.CreateListRequest, actorUserID ...uuid.UUID) (*tasks.TaskList, error)
	updateTaskListFn       func(ctx context.Context, orgID, id uuid.UUID, req tasks.UpdateListRequest, actorUserID ...uuid.UUID) (*tasks.TaskList, error)
	deactivateTaskListFn   func(ctx context.Context, orgID, id uuid.UUID, actorUserID ...uuid.UUID) error
	ensureDefaultListsFn   func(ctx context.Context, orgID uuid.UUID) error
	listTasksFn            func(ctx context.Context, orgID uuid.UUID, filters tasks.TaskFilters) ([]tasks.TaskWithDetails, error)
	getTaskFn              func(ctx context.Context, orgID, id uuid.UUID) (*tasks.TaskWithDetails, error)
	getTaskByApprovalFn    func(ctx context.Context, approvalType string, approvalID uuid.UUID) (*tasks.TaskWithDetails, error)
	createTaskFn           func(ctx context.Context, orgID, createdBy uuid.UUID, req tasks.CreateTaskRequest, actorUserID ...uuid.UUID) (*tasks.Task, error)
	updateTaskFn           func(ctx context.Context, orgID, id uuid.UUID, req tasks.UpdateTaskRequest, actorUserID ...uuid.UUID) (*tasks.Task, error)
	moveTaskFn             func(ctx context.Context, orgID, taskID uuid.UUID, req tasks.MoveTaskRequest, actorUserID ...uuid.UUID) (*tasks.Task, error)
	toggleTaskCompletionFn func(ctx context.Context, orgID, taskID uuid.UUID, actorUserID ...uuid.UUID) (*tasks.Task, error)
	deleteTaskFn           func(ctx context.Context, orgID, id uuid.UUID, actorUserID ...uuid.UUID) error
	createApprovalTaskFn   func(ctx context.Context, orgID uuid.UUID, approvalType string, approvalID uuid.UUID, title, description string, assigneeID uuid.UUID, dueDate *string) error
	completeApprovalTaskFn func(ctx context.Context, approvalType string, approvalID uuid.UUID) error
	deleteApprovalTaskFn   func(ctx context.Context, approvalType string, approvalID uuid.UUID) error
	listCommentsFn         func(ctx context.Context, orgID, taskID uuid.UUID) ([]tasks.TaskCommentWithAuthor, error)
	createCommentFn        func(ctx context.Context, orgID, taskID, authorID uuid.UUID, parentID *uuid.UUID, body, contentType string, actorUserID ...uuid.UUID) (*tasks.TaskComment, error)
	deleteCommentFn        func(ctx context.Context, orgID, commentID, authorID uuid.UUID, actorUserID ...uuid.UUID) error
	toggleReactionFn       func(ctx context.Context, orgID, commentID, employeeID uuid.UUID, emoji string, actorUserID ...uuid.UUID) (bool, error)
	listReactionsFn        func(ctx context.Context, orgID, commentID, currentEmployeeID uuid.UUID) ([]tasks.CommentReactionSummary, error)
}

func (f *fakeService) ListTaskLists(ctx context.Context, orgID uuid.UUID) ([]tasks.TaskList, error) {
	if f.listTaskListsFn != nil {
		return f.listTaskListsFn(ctx, orgID)
	}
	return []tasks.TaskList{}, nil
}

func (f *fakeService) CreateTaskList(ctx context.Context, orgID uuid.UUID, req tasks.CreateListRequest, actorUserID ...uuid.UUID) (*tasks.TaskList, error) {
	if f.createTaskListFn != nil {
		return f.createTaskListFn(ctx, orgID, req, actorUserID...)
	}
	return &tasks.TaskList{ID: testListID, Name: req.Name}, nil
}

func (f *fakeService) UpdateTaskList(ctx context.Context, orgID, id uuid.UUID, req tasks.UpdateListRequest, actorUserID ...uuid.UUID) (*tasks.TaskList, error) {
	if f.updateTaskListFn != nil {
		return f.updateTaskListFn(ctx, orgID, id, req, actorUserID...)
	}
	return &tasks.TaskList{ID: id}, nil
}

func (f *fakeService) DeactivateTaskList(ctx context.Context, orgID, id uuid.UUID, actorUserID ...uuid.UUID) error {
	if f.deactivateTaskListFn != nil {
		return f.deactivateTaskListFn(ctx, orgID, id, actorUserID...)
	}
	return nil
}

func (f *fakeService) EnsureDefaultLists(ctx context.Context, orgID uuid.UUID) error {
	if f.ensureDefaultListsFn != nil {
		return f.ensureDefaultListsFn(ctx, orgID)
	}
	return nil
}

func (f *fakeService) ListTasks(ctx context.Context, orgID uuid.UUID, filters tasks.TaskFilters) ([]tasks.TaskWithDetails, error) {
	if f.listTasksFn != nil {
		return f.listTasksFn(ctx, orgID, filters)
	}
	return []tasks.TaskWithDetails{}, nil
}

func (f *fakeService) GetTask(ctx context.Context, orgID, id uuid.UUID) (*tasks.TaskWithDetails, error) {
	if f.getTaskFn != nil {
		return f.getTaskFn(ctx, orgID, id)
	}
	return &tasks.TaskWithDetails{
		Task:        tasks.Task{ID: id, Title: "Test Task"},
		CreatorName: "Test Creator",
		ListName:    "To Do",
	}, nil
}

func (f *fakeService) CreateTask(ctx context.Context, orgID, createdBy uuid.UUID, req tasks.CreateTaskRequest, actorUserID ...uuid.UUID) (*tasks.Task, error) {
	if f.createTaskFn != nil {
		return f.createTaskFn(ctx, orgID, createdBy, req, actorUserID...)
	}
	return &tasks.Task{ID: testTaskID, Title: req.Title}, nil
}

func (f *fakeService) UpdateTask(ctx context.Context, orgID, id uuid.UUID, req tasks.UpdateTaskRequest, actorUserID ...uuid.UUID) (*tasks.Task, error) {
	if f.updateTaskFn != nil {
		return f.updateTaskFn(ctx, orgID, id, req, actorUserID...)
	}
	return &tasks.Task{ID: id}, nil
}

func (f *fakeService) MoveTask(ctx context.Context, orgID, taskID uuid.UUID, req tasks.MoveTaskRequest, actorUserID ...uuid.UUID) (*tasks.Task, error) {
	if f.moveTaskFn != nil {
		return f.moveTaskFn(ctx, orgID, taskID, req, actorUserID...)
	}
	return &tasks.Task{ID: taskID, TaskListID: req.TaskListID, Position: req.Position}, nil
}

func (f *fakeService) ToggleTaskCompletion(ctx context.Context, orgID, taskID uuid.UUID, actorUserID ...uuid.UUID) (*tasks.Task, error) {
	if f.toggleTaskCompletionFn != nil {
		return f.toggleTaskCompletionFn(ctx, orgID, taskID, actorUserID...)
	}
	now := time.Now()
	return &tasks.Task{ID: taskID, CompletedAt: &now}, nil
}

func (f *fakeService) DeleteTask(ctx context.Context, orgID, id uuid.UUID, actorUserID ...uuid.UUID) error {
	if f.deleteTaskFn != nil {
		return f.deleteTaskFn(ctx, orgID, id, actorUserID...)
	}
	return nil
}

func (f *fakeService) CreateApprovalTask(ctx context.Context, orgID uuid.UUID, approvalType string, approvalID uuid.UUID, title, description string, assigneeID uuid.UUID, dueDate *string) error {
	if f.createApprovalTaskFn != nil {
		return f.createApprovalTaskFn(ctx, orgID, approvalType, approvalID, title, description, assigneeID, dueDate)
	}
	return nil
}

func (f *fakeService) CompleteApprovalTask(ctx context.Context, approvalType string, approvalID uuid.UUID) error {
	if f.completeApprovalTaskFn != nil {
		return f.completeApprovalTaskFn(ctx, approvalType, approvalID)
	}
	return nil
}

func (f *fakeService) DeleteApprovalTask(ctx context.Context, approvalType string, approvalID uuid.UUID) error {
	if f.deleteApprovalTaskFn != nil {
		return f.deleteApprovalTaskFn(ctx, approvalType, approvalID)
	}
	return nil
}

func (f *fakeService) ListComments(ctx context.Context, orgID, taskID uuid.UUID) ([]tasks.TaskCommentWithAuthor, error) {
	if f.listCommentsFn != nil {
		return f.listCommentsFn(ctx, orgID, taskID)
	}
	return []tasks.TaskCommentWithAuthor{}, nil
}

func (f *fakeService) CreateComment(ctx context.Context, orgID, taskID, authorID uuid.UUID, parentID *uuid.UUID, body, contentType string, actorUserID ...uuid.UUID) (*tasks.TaskComment, error) {
	if f.createCommentFn != nil {
		return f.createCommentFn(ctx, orgID, taskID, authorID, parentID, body, contentType, actorUserID...)
	}
	return &tasks.TaskComment{ID: testCommentID, Body: body, ContentType: contentType}, nil
}

func (f *fakeService) DeleteComment(ctx context.Context, orgID, commentID, authorID uuid.UUID, actorUserID ...uuid.UUID) error {
	if f.deleteCommentFn != nil {
		return f.deleteCommentFn(ctx, orgID, commentID, authorID, actorUserID...)
	}
	return nil
}

func (f *fakeService) ToggleReaction(ctx context.Context, orgID, commentID, employeeID uuid.UUID, emoji string, actorUserID ...uuid.UUID) (bool, error) {
	if f.toggleReactionFn != nil {
		return f.toggleReactionFn(ctx, orgID, commentID, employeeID, emoji, actorUserID...)
	}
	return true, nil
}

func (f *fakeService) ListReactions(ctx context.Context, orgID, commentID, currentEmployeeID uuid.UUID) ([]tasks.CommentReactionSummary, error) {
	if f.listReactionsFn != nil {
		return f.listReactionsFn(ctx, orgID, commentID, currentEmployeeID)
	}
	return []tasks.CommentReactionSummary{}, nil
}

// ── Task Lists Tests ─────────────────────────────────────────────────────────

func TestListTaskLists(t *testing.T) {
	svc := &fakeService{
		listTaskListsFn: func(_ context.Context, orgID uuid.UUID) ([]tasks.TaskList, error) {
			return []tasks.TaskList{
				{ID: testListID, Name: "To Do", Position: 0},
			}, nil
		},
	}
	r := newRouter(svc)
	w := httptest.NewRecorder()
	req, _ := http.NewRequest(http.MethodGet, "/api/v1/tasks/lists", nil)
	r.ServeHTTP(w, req)
	assertStatus(t, w, http.StatusOK)
	assertHasDataKey(t, w)
}

func TestCreateTaskList(t *testing.T) {
	svc := &fakeService{}
	r := newRouter(svc)
	w := httptest.NewRecorder()
	req, _ := http.NewRequest(http.MethodPost, "/api/v1/tasks/lists", jsonBody(t, map[string]string{
		"name": "New List",
	}))
	req.Header.Set("Content-Type", "application/json")
	r.ServeHTTP(w, req)
	assertStatus(t, w, http.StatusCreated)
	assertHasDataKey(t, w)
}

func TestUpdateTaskList(t *testing.T) {
	svc := &fakeService{}
	r := newRouter(svc)
	w := httptest.NewRecorder()
	newName := "Updated List"
	req, _ := http.NewRequest(http.MethodPut, "/api/v1/tasks/lists/"+testListID.String(), jsonBody(t, map[string]string{
		"name": newName,
	}))
	req.Header.Set("Content-Type", "application/json")
	r.ServeHTTP(w, req)
	assertStatus(t, w, http.StatusOK)
	assertHasDataKey(t, w)
}

func TestDeactivateTaskList(t *testing.T) {
	svc := &fakeService{}
	r := newRouter(svc)
	w := httptest.NewRecorder()
	req, _ := http.NewRequest(http.MethodDelete, "/api/v1/tasks/lists/"+testListID.String(), nil)
	r.ServeHTTP(w, req)
	assertStatus(t, w, http.StatusNoContent)
}

// ── Tasks Tests ──────────────────────────────────────────────────────────────

func TestListTasks(t *testing.T) {
	svc := &fakeService{
		listTasksFn: func(_ context.Context, orgID uuid.UUID, filters tasks.TaskFilters) ([]tasks.TaskWithDetails, error) {
			return []tasks.TaskWithDetails{
				{
					Task:        tasks.Task{ID: testTaskID, Title: "Test Task"},
					CreatorName: "John Doe",
					ListName:    "To Do",
				},
			}, nil
		},
	}
	r := newRouter(svc)
	w := httptest.NewRecorder()
	req, _ := http.NewRequest(http.MethodGet, "/api/v1/tasks", nil)
	r.ServeHTTP(w, req)
	assertStatus(t, w, http.StatusOK)
	assertHasDataKey(t, w)
}

func TestCreateTask(t *testing.T) {
	svc := &fakeService{}
	r := newRouter(svc)
	w := httptest.NewRecorder()
	req, _ := http.NewRequest(http.MethodPost, "/api/v1/tasks", jsonBody(t, map[string]any{
		"task_list_id": testListID.String(),
		"title":        "New Task",
		"priority":     "high",
	}))
	req.Header.Set("Content-Type", "application/json")
	r.ServeHTTP(w, req)
	assertStatus(t, w, http.StatusCreated)
	assertHasDataKey(t, w)
}

func TestGetTask(t *testing.T) {
	svc := &fakeService{}
	r := newRouter(svc)
	w := httptest.NewRecorder()
	req, _ := http.NewRequest(http.MethodGet, "/api/v1/tasks/"+testTaskID.String(), nil)
	r.ServeHTTP(w, req)
	assertStatus(t, w, http.StatusOK)
	assertHasDataKey(t, w)
}

func TestUpdateTask(t *testing.T) {
	svc := &fakeService{}
	r := newRouter(svc)
	w := httptest.NewRecorder()
	newTitle := "Updated Task"
	req, _ := http.NewRequest(http.MethodPut, "/api/v1/tasks/"+testTaskID.String(), jsonBody(t, map[string]string{
		"title": newTitle,
	}))
	req.Header.Set("Content-Type", "application/json")
	r.ServeHTTP(w, req)
	assertStatus(t, w, http.StatusOK)
	assertHasDataKey(t, w)
}

func TestMoveTask(t *testing.T) {
	svc := &fakeService{}
	r := newRouter(svc)
	w := httptest.NewRecorder()
	req, _ := http.NewRequest(http.MethodPut, "/api/v1/tasks/"+testTaskID.String()+"/move", jsonBody(t, map[string]any{
		"task_list_id": testListID.String(),
		"position":     1000,
	}))
	req.Header.Set("Content-Type", "application/json")
	r.ServeHTTP(w, req)
	assertStatus(t, w, http.StatusOK)
	assertHasDataKey(t, w)
}

func TestToggleTaskCompletion(t *testing.T) {
	svc := &fakeService{}
	r := newRouter(svc)
	w := httptest.NewRecorder()
	req, _ := http.NewRequest(http.MethodPut, "/api/v1/tasks/"+testTaskID.String()+"/complete", nil)
	r.ServeHTTP(w, req)
	assertStatus(t, w, http.StatusOK)
	assertHasDataKey(t, w)
}

func TestDeleteTask(t *testing.T) {
	svc := &fakeService{}
	r := newRouter(svc)
	w := httptest.NewRecorder()
	req, _ := http.NewRequest(http.MethodDelete, "/api/v1/tasks/"+testTaskID.String(), nil)
	r.ServeHTTP(w, req)
	assertStatus(t, w, http.StatusNoContent)
}

// ── Comments Tests ───────────────────────────────────────────────────────────

func TestListComments(t *testing.T) {
	svc := &fakeService{
		listCommentsFn: func(_ context.Context, orgID, taskID uuid.UUID) ([]tasks.TaskCommentWithAuthor, error) {
			return []tasks.TaskCommentWithAuthor{
				{
					TaskComment: tasks.TaskComment{ID: testCommentID, Body: "Test comment"},
					AuthorName:  "John Doe",
				},
			}, nil
		},
	}
	r := newRouter(svc)
	w := httptest.NewRecorder()
	req, _ := http.NewRequest(http.MethodGet, "/api/v1/tasks/"+testTaskID.String()+"/comments", nil)
	r.ServeHTTP(w, req)
	assertStatus(t, w, http.StatusOK)
	assertHasDataKey(t, w)
}

func TestCreateComment(t *testing.T) {
	svc := &fakeService{}
	r := newRouter(svc)
	w := httptest.NewRecorder()
	req, _ := http.NewRequest(http.MethodPost, "/api/v1/tasks/"+testTaskID.String()+"/comments", jsonBody(t, map[string]string{
		"body": "Test comment",
	}))
	req.Header.Set("Content-Type", "application/json")
	r.ServeHTTP(w, req)
	assertStatus(t, w, http.StatusCreated)
	assertHasDataKey(t, w)
}

func TestDeleteComment(t *testing.T) {
	svc := &fakeService{}
	r := newRouter(svc)
	w := httptest.NewRecorder()
	req, _ := http.NewRequest(http.MethodDelete, "/api/v1/tasks/"+testTaskID.String()+"/comments/"+testCommentID.String(), nil)
	r.ServeHTTP(w, req)
	assertStatus(t, w, http.StatusNoContent)
}

// ── Nested Comments Tests ────────────────────────────────────────────────────

func TestCreateNestedComment(t *testing.T) {
	parentID := testCommentID
	svc := &fakeService{
		createCommentFn: func(_ context.Context, orgID, taskID, authorID uuid.UUID, pID *uuid.UUID, body, contentType string, _ ...uuid.UUID) (*tasks.TaskComment, error) {
			if pID == nil || *pID != parentID {
				t.Errorf("expected parent_id = %s, got %v", parentID, pID)
			}
			return &tasks.TaskComment{
				ID:       uuid.New(),
				ParentID: pID,
				Body:     body,
			}, nil
		},
	}
	r := newRouter(svc)
	w := httptest.NewRecorder()
	req, _ := http.NewRequest(http.MethodPost, "/api/v1/tasks/"+testTaskID.String()+"/comments", jsonBody(t, map[string]any{
		"body":      "Nested reply",
		"parent_id": parentID.String(),
	}))
	req.Header.Set("Content-Type", "application/json")
	r.ServeHTTP(w, req)
	assertStatus(t, w, http.StatusCreated)
	assertHasDataKey(t, w)
}

func TestCreateMarkdownComment(t *testing.T) {
	svc := &fakeService{
		createCommentFn: func(_ context.Context, orgID, taskID, authorID uuid.UUID, pID *uuid.UUID, body, contentType string, _ ...uuid.UUID) (*tasks.TaskComment, error) {
			if contentType != "markdown" {
				t.Errorf("expected content_type = markdown, got %s", contentType)
			}
			return &tasks.TaskComment{
				ID:          uuid.New(),
				Body:        body,
				ContentType: contentType,
			}, nil
		},
	}
	r := newRouter(svc)
	w := httptest.NewRecorder()
	req, _ := http.NewRequest(http.MethodPost, "/api/v1/tasks/"+testTaskID.String()+"/comments", jsonBody(t, map[string]any{
		"body":         "**Bold** text",
		"content_type": "markdown",
	}))
	req.Header.Set("Content-Type", "application/json")
	r.ServeHTTP(w, req)
	assertStatus(t, w, http.StatusCreated)
	assertHasDataKey(t, w)
}

func TestListCommentsWithReplies(t *testing.T) {
	parentComment := tasks.TaskCommentWithAuthor{
		TaskComment: tasks.TaskComment{
			ID:   testCommentID,
			Body: "Parent comment",
		},
		AuthorName: "John Doe",
		Replies: []tasks.TaskCommentWithAuthor{
			{
				TaskComment: tasks.TaskComment{
					ID:       uuid.New(),
					ParentID: &testCommentID,
					Body:     "Nested reply",
				},
				AuthorName: "Jane Doe",
			},
		},
	}

	svc := &fakeService{
		listCommentsFn: func(_ context.Context, orgID, taskID uuid.UUID) ([]tasks.TaskCommentWithAuthor, error) {
			return []tasks.TaskCommentWithAuthor{parentComment}, nil
		},
	}
	r := newRouter(svc)
	w := httptest.NewRecorder()
	req, _ := http.NewRequest(http.MethodGet, "/api/v1/tasks/"+testTaskID.String()+"/comments", nil)
	r.ServeHTTP(w, req)
	assertStatus(t, w, http.StatusOK)
	assertHasDataKey(t, w)

	var resp map[string][]tasks.TaskCommentWithAuthor
	if err := json.Unmarshal(w.Body.Bytes(), &resp); err != nil {
		t.Fatalf("failed to unmarshal response: %v", err)
	}
	if len(resp["data"]) == 0 {
		t.Fatal("expected comments in response")
	}
	if len(resp["data"][0].Replies) != 1 {
		t.Errorf("expected 1 reply, got %d", len(resp["data"][0].Replies))
	}
}

// ── Reactions Tests ──────────────────────────────────────────────────────────

func TestToggleReaction(t *testing.T) {
	emoji := "👍"
	svc := &fakeService{
		toggleReactionFn: func(_ context.Context, orgID, commentID, employeeID uuid.UUID, e string, _ ...uuid.UUID) (bool, error) {
			if e != emoji {
				t.Errorf("expected emoji = %s, got %s", emoji, e)
			}
			return true, nil // added
		},
	}
	r := newRouter(svc)
	w := httptest.NewRecorder()
	req, _ := http.NewRequest(http.MethodPost, "/api/v1/tasks/"+testTaskID.String()+"/comments/"+testCommentID.String()+"/reactions", jsonBody(t, map[string]string{
		"emoji": emoji,
	}))
	req.Header.Set("Content-Type", "application/json")
	r.ServeHTTP(w, req)
	assertStatus(t, w, http.StatusOK)
	assertHasDataKey(t, w)

	var resp map[string]map[string]any
	if err := json.Unmarshal(w.Body.Bytes(), &resp); err != nil {
		t.Fatalf("failed to unmarshal response: %v", err)
	}
	if !resp["data"]["added"].(bool) {
		t.Error("expected added = true")
	}
}

func TestListReactions(t *testing.T) {
	svc := &fakeService{
		listReactionsFn: func(_ context.Context, orgID, commentID, currentEmployeeID uuid.UUID) ([]tasks.CommentReactionSummary, error) {
			return []tasks.CommentReactionSummary{
				{Emoji: "👍", Count: 3, UserReacted: true},
				{Emoji: "❤️", Count: 1, UserReacted: false},
			}, nil
		},
	}
	r := newRouter(svc)
	w := httptest.NewRecorder()
	req, _ := http.NewRequest(http.MethodGet, "/api/v1/tasks/"+testTaskID.String()+"/comments/"+testCommentID.String()+"/reactions", nil)
	r.ServeHTTP(w, req)
	assertStatus(t, w, http.StatusOK)
	assertHasDataKey(t, w)

	var resp map[string][]tasks.CommentReactionSummary
	if err := json.Unmarshal(w.Body.Bytes(), &resp); err != nil {
		t.Fatalf("failed to unmarshal response: %v", err)
	}
	if len(resp["data"]) != 2 {
		t.Errorf("expected 2 reactions, got %d", len(resp["data"]))
	}
	if resp["data"][0].Count != 3 {
		t.Errorf("expected first reaction count = 3, got %d", resp["data"][0].Count)
	}
}
