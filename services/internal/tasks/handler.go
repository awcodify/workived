package tasks

import (
	"context"
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/rs/zerolog"
	"github.com/workived/services/internal/platform/middleware"
	"github.com/workived/services/pkg/apperr"
	"github.com/workived/services/pkg/paginate"
)

type EmployeeLookupFunc func(ctx context.Context, orgID, userID uuid.UUID) (uuid.UUID, error)

type Handler struct {
	service   ServiceInterface
	empLookup EmployeeLookupFunc
	log       zerolog.Logger
}

func NewHandler(service ServiceInterface, empLookup EmployeeLookupFunc, log zerolog.Logger) *Handler {
	return &Handler{
		service:   service,
		empLookup: empLookup,
		log:       log,
	}
}

// RegisterRoutes registers all task-related routes
func (h *Handler) RegisterRoutes(rg *gin.RouterGroup) {
	tasks := rg.Group("/tasks")

	// Task Lists
	tasks.GET("/lists", middleware.Require(middleware.PermTasksRead), h.ListTaskLists)
	tasks.POST("/lists", middleware.Require(middleware.PermTasksWrite), h.CreateTaskList)
	tasks.PUT("/lists/:id", middleware.Require(middleware.PermTasksWrite), h.UpdateTaskList)
	tasks.DELETE("/lists/:id", middleware.Require(middleware.PermTasksWrite), h.DeactivateTaskList)

	// Tasks
	tasks.GET("", middleware.Require(middleware.PermTasksRead), h.ListTasks)
	tasks.POST("", middleware.Require(middleware.PermTasksRead), h.CreateTask)
	tasks.GET("/:id", middleware.Require(middleware.PermTasksRead), h.GetTask)
	tasks.PUT("/:id", middleware.Require(middleware.PermTasksRead), h.UpdateTask)
	tasks.PUT("/:id/move", middleware.Require(middleware.PermTasksRead), h.MoveTask)
	tasks.PUT("/:id/complete", middleware.Require(middleware.PermTasksRead), h.ToggleTaskCompletion)
	tasks.DELETE("/:id", middleware.Require(middleware.PermTasksWrite), h.DeleteTask)

	// Comments
	tasks.GET("/:id/comments", middleware.Require(middleware.PermTasksRead), h.ListComments)
	tasks.POST("/:id/comments", middleware.Require(middleware.PermTasksRead), h.CreateComment)
	tasks.DELETE("/:id/comments/:cid", middleware.Require(middleware.PermTasksRead), h.DeleteComment)
}

// logAndRespondError logs error with context and responds with proper HTTP status
func (h *Handler) logAndRespondError(c *gin.Context, err error, msg string, fields map[string]string) {
	event := h.log.Error().Err(err)
	for k, v := range fields {
		event = event.Str(k, v)
	}
	event.Msg(msg)
	c.JSON(apperr.HTTPStatus(err), apperr.Response(err))
}

// ── Task Lists ───────────────────────────────────────────────────────────────

func (h *Handler) ListTaskLists(c *gin.Context) {
	orgID := middleware.OrgIDFromCtx(c)

	lists, err := h.service.ListTaskLists(c.Request.Context(), orgID)
	if err != nil {
		h.logAndRespondError(c, err, "failed to list task lists", map[string]string{"org_id": orgID.String()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"data": lists})
}

func (h *Handler) CreateTaskList(c *gin.Context) {
	orgID := middleware.OrgIDFromCtx(c)
	userID := middleware.UserIDFromCtx(c)

	var req CreateListRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, apperr.ValidationError(err))
		return
	}

	list, err := h.service.CreateTaskList(c.Request.Context(), orgID, req, userID)
	if err != nil {
		h.logAndRespondError(c, err, "failed to create task list", map[string]string{"org_id": orgID.String()})
		return
	}

	c.JSON(http.StatusCreated, gin.H{"data": list})
}

func (h *Handler) UpdateTaskList(c *gin.Context) {
	orgID := middleware.OrgIDFromCtx(c)
	userID := middleware.UserIDFromCtx(c)

	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, apperr.ValidationError(err))
		return
	}

	var req UpdateListRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, apperr.ValidationError(err))
		return
	}

	list, err := h.service.UpdateTaskList(c.Request.Context(), orgID, id, req, userID)
	if err != nil {
		h.logAndRespondError(c, err, "failed to update task list", map[string]string{
			"org_id":  orgID.String(),
			"list_id": id.String(),
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{"data": list})
}

func (h *Handler) DeactivateTaskList(c *gin.Context) {
	orgID := middleware.OrgIDFromCtx(c)
	userID := middleware.UserIDFromCtx(c)

	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, apperr.ValidationError(err))
		return
	}

	if err := h.service.DeactivateTaskList(c.Request.Context(), orgID, id, userID); err != nil {
		h.logAndRespondError(c, err, "failed to deactivate task list", map[string]string{
			"org_id":  orgID.String(),
			"list_id": id.String(),
		})
		return
	}

	c.JSON(http.StatusNoContent, nil)
}

// ── Tasks ────────────────────────────────────────────────────────────────────

func (h *Handler) ListTasks(c *gin.Context) {
	orgID := middleware.OrgIDFromCtx(c)

	var filters TaskFilters
	if err := c.ShouldBindQuery(&filters); err != nil {
		c.JSON(http.StatusBadRequest, apperr.ValidationError(err))
		return
	}

	// Set default limit if not provided
	if filters.Limit == 0 {
		filters.Limit = paginate.DefaultLimit
	}

	tasks, err := h.service.ListTasks(c.Request.Context(), orgID, filters)
	if err != nil {
		h.logAndRespondError(c, err, "failed to list tasks", map[string]string{"org_id": orgID.String()})
		return
	}

	// Calculate pagination metadata
	limit := paginate.ClampLimit(filters.Limit)
	hasMore := len(tasks) > limit
	if hasMore {
		tasks = tasks[:limit]
	}

	var nextCursor string
	if hasMore && len(tasks) > 0 {
		last := tasks[len(tasks)-1]
		nextCursor = paginate.Encode(paginate.Cursor{
			Value: last.CreatedAt.Format("2006-01-02T15:04:05Z07:00"),
			ID:    last.ID.String(),
		})
	}

	c.JSON(http.StatusOK, gin.H{
		"data": tasks,
		"meta": gin.H{
			"next_cursor": nextCursor,
			"has_more":    hasMore,
			"limit":       limit,
		},
	})
}

func (h *Handler) GetTask(c *gin.Context) {
	orgID := middleware.OrgIDFromCtx(c)

	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, apperr.ValidationError(err))
		return
	}

	task, err := h.service.GetTask(c.Request.Context(), orgID, id)
	if err != nil {
		h.logAndRespondError(c, err, "failed to get task", map[string]string{
			"org_id":  orgID.String(),
			"task_id": id.String(),
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{"data": task})
}

func (h *Handler) CreateTask(c *gin.Context) {
	orgID := middleware.OrgIDFromCtx(c)
	userID := middleware.UserIDFromCtx(c)

	// Resolve user to employee
	employeeID, err := h.empLookup(c.Request.Context(), orgID, userID)
	if err != nil {
		h.logAndRespondError(c, err, "failed to resolve employee", map[string]string{
			"org_id":  orgID.String(),
			"user_id": userID.String(),
		})
		return
	}

	var req CreateTaskRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, apperr.ValidationError(err))
		return
	}

	task, err := h.service.CreateTask(c.Request.Context(), orgID, employeeID, req, userID)
	if err != nil {
		h.logAndRespondError(c, err, "failed to create task", map[string]string{
			"org_id":      orgID.String(),
			"employee_id": employeeID.String(),
		})
		return
	}

	c.JSON(http.StatusCreated, gin.H{"data": task})
}

func (h *Handler) UpdateTask(c *gin.Context) {
	orgID := middleware.OrgIDFromCtx(c)
	userID := middleware.UserIDFromCtx(c)

	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, apperr.ValidationError(err))
		return
	}

	var req UpdateTaskRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, apperr.ValidationError(err))
		return
	}

	task, err := h.service.UpdateTask(c.Request.Context(), orgID, id, req, userID)
	if err != nil {
		h.logAndRespondError(c, err, "failed to update task", map[string]string{
			"org_id":  orgID.String(),
			"task_id": id.String(),
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{"data": task})
}

func (h *Handler) MoveTask(c *gin.Context) {
	orgID := middleware.OrgIDFromCtx(c)
	userID := middleware.UserIDFromCtx(c)

	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, apperr.ValidationError(err))
		return
	}

	var req MoveTaskRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, apperr.ValidationError(err))
		return
	}

	task, err := h.service.MoveTask(c.Request.Context(), orgID, id, req, userID)
	if err != nil {
		h.logAndRespondError(c, err, "failed to move task", map[string]string{
			"org_id":  orgID.String(),
			"task_id": id.String(),
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{"data": task})
}

func (h *Handler) ToggleTaskCompletion(c *gin.Context) {
	orgID := middleware.OrgIDFromCtx(c)
	userID := middleware.UserIDFromCtx(c)

	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, apperr.ValidationError(err))
		return
	}

	task, err := h.service.ToggleTaskCompletion(c.Request.Context(), orgID, id, userID)
	if err != nil {
		h.logAndRespondError(c, err, "failed to toggle task completion", map[string]string{
			"org_id":  orgID.String(),
			"task_id": id.String(),
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{"data": task})
}

func (h *Handler) DeleteTask(c *gin.Context) {
	orgID := middleware.OrgIDFromCtx(c)
	userID := middleware.UserIDFromCtx(c)

	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, apperr.ValidationError(err))
		return
	}

	if err := h.service.DeleteTask(c.Request.Context(), orgID, id, userID); err != nil {
		h.logAndRespondError(c, err, "failed to delete task", map[string]string{
			"org_id":  orgID.String(),
			"task_id": id.String(),
		})
		return
	}

	c.JSON(http.StatusNoContent, nil)
}

// ── Comments ─────────────────────────────────────────────────────────────────

func (h *Handler) ListComments(c *gin.Context) {
	orgID := middleware.OrgIDFromCtx(c)

	taskID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, apperr.ValidationError(err))
		return
	}

	comments, err := h.service.ListComments(c.Request.Context(), orgID, taskID)
	if err != nil {
		h.logAndRespondError(c, err, "failed to list comments", map[string]string{
			"org_id":  orgID.String(),
			"task_id": taskID.String(),
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{"data": comments})
}

func (h *Handler) CreateComment(c *gin.Context) {
	orgID := middleware.OrgIDFromCtx(c)
	userID := middleware.UserIDFromCtx(c)

	taskID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, apperr.ValidationError(err))
		return
	}

	// Resolve user to employee
	employeeID, err := h.empLookup(c.Request.Context(), orgID, userID)
	if err != nil {
		h.logAndRespondError(c, err, "failed to resolve employee", map[string]string{
			"org_id":  orgID.String(),
			"user_id": userID.String(),
		})
		return
	}

	var req CreateCommentRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, apperr.ValidationError(err))
		return
	}

	comment, err := h.service.CreateComment(c.Request.Context(), orgID, taskID, employeeID, req.Body, userID)
	if err != nil {
		h.logAndRespondError(c, err, "failed to create comment", map[string]string{
			"org_id":      orgID.String(),
			"task_id":     taskID.String(),
			"employee_id": employeeID.String(),
		})
		return
	}

	c.JSON(http.StatusCreated, gin.H{"data": comment})
}

func (h *Handler) DeleteComment(c *gin.Context) {
	orgID := middleware.OrgIDFromCtx(c)
	userID := middleware.UserIDFromCtx(c)

	commentID, err := uuid.Parse(c.Param("cid"))
	if err != nil {
		c.JSON(http.StatusBadRequest, apperr.ValidationError(err))
		return
	}

	// Resolve user to employee
	employeeID, err := h.empLookup(c.Request.Context(), orgID, userID)
	if err != nil {
		h.logAndRespondError(c, err, "failed to resolve employee", map[string]string{
			"org_id":  orgID.String(),
			"user_id": userID.String(),
		})
		return
	}

	if err := h.service.DeleteComment(c.Request.Context(), orgID, commentID, employeeID, userID); err != nil {
		h.logAndRespondError(c, err, "failed to delete comment", map[string]string{
			"org_id":     orgID.String(),
			"comment_id": commentID.String(),
		})
		return
	}

	c.JSON(http.StatusNoContent, nil)
}
