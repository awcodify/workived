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
	tasks.PATCH("/lists/reorder", middleware.Require(middleware.PermTasksWrite), h.ReorderTaskLists)
	tasks.PUT("/lists/:id", middleware.Require(middleware.PermTasksWrite), h.UpdateTaskList)
	tasks.DELETE("/lists/:id", middleware.Require(middleware.PermTasksWrite), h.DeactivateTaskList)

	// Tasks
	tasks.GET("", middleware.Require(middleware.PermTasksRead), h.ListTasks)
	tasks.POST("", middleware.Require(middleware.PermTasksRead), h.CreateTask)
	tasks.GET("/labels", middleware.Require(middleware.PermTasksRead), h.GetUniqueLabels)
	tasks.GET("/:id", middleware.Require(middleware.PermTasksRead), h.GetTask)
	tasks.PUT("/:id", middleware.Require(middleware.PermTasksRead), h.UpdateTask)
	tasks.PUT("/:id/move", middleware.Require(middleware.PermTasksRead), h.MoveTask)
	tasks.PUT("/:id/complete", middleware.Require(middleware.PermTasksRead), h.ToggleTaskCompletion)
	tasks.DELETE("/:id", middleware.Require(middleware.PermTasksWrite), h.DeleteTask)

	// Comments
	tasks.GET("/:id/comments", middleware.Require(middleware.PermTasksRead), h.ListComments)
	tasks.POST("/:id/comments", middleware.Require(middleware.PermTasksRead), h.CreateComment)
	tasks.DELETE("/:id/comments/:cid", middleware.Require(middleware.PermTasksRead), h.DeleteComment)

	// Reactions
	tasks.POST("/:id/comments/:cid/reactions", middleware.Require(middleware.PermTasksRead), h.ToggleReaction)
	tasks.GET("/:id/comments/:cid/reactions", middleware.Require(middleware.PermTasksRead), h.ListReactions)

	// Field Definitions (org-level schema management — admin only)
	tasks.GET("/fields", middleware.Require(middleware.PermTasksRead), h.ListFieldDefinitions)
	tasks.POST("/fields", middleware.Require(middleware.PermTasksWrite), h.CreateFieldDefinition)
	tasks.PUT("/fields/:fid", middleware.Require(middleware.PermTasksWrite), h.UpdateFieldDefinition)
	tasks.DELETE("/fields/:fid", middleware.Require(middleware.PermTasksWrite), h.DeactivateFieldDefinition)

	// Field Values (per-task, any member can set)
	tasks.PUT("/:id/fields/:fid", middleware.Require(middleware.PermTasksRead), h.SetFieldValue)
	tasks.DELETE("/:id/fields/:fid", middleware.Require(middleware.PermTasksRead), h.ClearFieldValue)

	// Task Links
	tasks.POST("/:id/links", middleware.Require(middleware.PermTasksRead), h.CreateTaskLink)
	tasks.GET("/:id/links", middleware.Require(middleware.PermTasksRead), h.ListTaskLinks)
	tasks.DELETE("/:id/links/:lid", middleware.Require(middleware.PermTasksRead), h.DeleteTaskLink)

	// Subtasks
	tasks.POST("/:id/subtasks", middleware.Require(middleware.PermTasksRead), h.CreateSubtask)
	tasks.GET("/:id/subtasks", middleware.Require(middleware.PermTasksRead), h.ListSubtasks)
	tasks.PATCH("/:id/parent", middleware.Require(middleware.PermTasksRead), h.ChangeTaskParent)
	tasks.PATCH("/:id/subtasks/reorder", middleware.Require(middleware.PermTasksRead), h.ReorderSubtasks)
}

// logAndRespondError logs error with context and responds with proper HTTP status
func (h *Handler) logAndRespondError(c *gin.Context, err error, msg string, fields map[string]string) {
	event := h.log.Error().Err(err)
	for k, v := range fields {
		event = event.Str(k, v)
	}
	event.Msg(msg)
	apperr.Respond(c, err)
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

	// Optional: move_tasks_to can be provided as query param or request body
	var req DeleteListRequest
	// Try body first (for explicit JSON requests)
	if c.Request.ContentLength > 0 {
		if err := c.ShouldBindJSON(&req); err != nil {
			c.JSON(http.StatusBadRequest, apperr.ValidationError(err))
			return
		}
	} else {
		// Fall back to query param
		if moveToStr := c.Query("move_tasks_to"); moveToStr != "" {
			moveToID, err := uuid.Parse(moveToStr)
			if err != nil {
				c.JSON(http.StatusBadRequest, apperr.New(apperr.CodeValidation, "invalid move_tasks_to UUID"))
				return
			}
			req.MoveTasksTo = &moveToID
		}
	}

	if err := h.service.DeactivateTaskList(c.Request.Context(), orgID, id, req, userID); err != nil {
		h.logAndRespondError(c, err, "failed to deactivate task list", map[string]string{
			"org_id":  orgID.String(),
			"list_id": id.String(),
		})
		return
	}

	c.JSON(http.StatusNoContent, nil)
}

func (h *Handler) ReorderTaskLists(c *gin.Context) {
	orgID := middleware.OrgIDFromCtx(c)
	userID := middleware.UserIDFromCtx(c)

	var req ReorderListsRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, apperr.ValidationError(err))
		return
	}

	if err := h.service.ReorderTaskLists(c.Request.Context(), orgID, req, userID); err != nil {
		h.logAndRespondError(c, err, "failed to reorder task lists", map[string]string{
			"org_id": orgID.String(),
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "task lists reordered successfully"})
}

// ── Tasks ────────────────────────────────────────────────────────────────────

func (h *Handler) ListTasks(c *gin.Context) {
	orgID := middleware.OrgIDFromCtx(c)
	userID := middleware.UserIDFromCtx(c)

	var filters TaskFilters
	if err := c.ShouldBindQuery(&filters); err != nil {
		c.JSON(http.StatusBadRequest, apperr.ValidationError(err))
		return
	}

	// Set default limit if not provided
	if filters.Limit == 0 {
		filters.Limit = paginate.DefaultLimit
	}

	// include_completed=true → disable the 7-day archive window so all tasks are visible
	if filters.IncludeCompleted {
		filters.ArchiveDays = 0
	}

	// Role-based approval task visibility (ApprovalVisibilityID = $3):
	// - owner/admin/hr_admin: nil → see ALL approval tasks org-wide
	// - manager/member/finance: set to employee_id → see only approval tasks they are assignee or creator of
	// This is independent of AssigneeID ($13), which is only set by explicit user filter.
	role := middleware.RoleFromCtx(c)
	hasFullApprovalVisibility := role == middleware.RoleOwner || role == middleware.RoleAdmin || role == middleware.RoleHRAdmin
	if filters.ApprovalVisibilityID == nil && !hasFullApprovalVisibility {
		employeeID, err := h.empLookup(c.Request.Context(), orgID, userID)
		if err != nil {
			h.logAndRespondError(c, err, "failed to lookup employee", map[string]string{
				"org_id":  orgID.String(),
				"user_id": userID.String(),
			})
			return
		}
		empIDStr := employeeID.String()
		filters.ApprovalVisibilityID = &empIDStr
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

func (h *Handler) GetUniqueLabels(c *gin.Context) {
	orgID := middleware.OrgIDFromCtx(c)

	labels, err := h.service.GetUniqueLabels(c.Request.Context(), orgID)
	if err != nil {
		h.logAndRespondError(c, err, "failed to get unique labels", map[string]string{
			"org_id": orgID.String(),
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{"labels": labels})
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

	// Default to 'plain' if not specified
	if req.ContentType == "" {
		req.ContentType = "plain"
	}

	comment, err := h.service.CreateComment(c.Request.Context(), orgID, taskID, employeeID, req.ParentID, req.Body, req.ContentType, userID)
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

// ── Reactions ────────────────────────────────────────────────────────────────

func (h *Handler) ToggleReaction(c *gin.Context) {
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

	var req ToggleReactionRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, apperr.ValidationError(err))
		return
	}

	added, err := h.service.ToggleReaction(c.Request.Context(), orgID, commentID, employeeID, req.Emoji, userID)
	if err != nil {
		h.logAndRespondError(c, err, "failed to toggle reaction", map[string]string{
			"org_id":     orgID.String(),
			"comment_id": commentID.String(),
			"emoji":      req.Emoji,
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"data": gin.H{
			"added": added,
			"emoji": req.Emoji,
		},
	})
}

func (h *Handler) ListReactions(c *gin.Context) {
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

	reactions, err := h.service.ListReactions(c.Request.Context(), orgID, commentID, employeeID)
	if err != nil {
		h.logAndRespondError(c, err, "failed to list reactions", map[string]string{
			"org_id":     orgID.String(),
			"comment_id": commentID.String(),
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{"data": reactions})
}

// ── Field Definitions ─────────────────────────────────────────────────────────

func (h *Handler) ListFieldDefinitions(c *gin.Context) {
	orgID := middleware.OrgIDFromCtx(c)

	defs, err := h.service.ListFieldDefinitions(c.Request.Context(), orgID)
	if err != nil {
		h.logAndRespondError(c, err, "failed to list field definitions", map[string]string{"org_id": orgID.String()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"data": defs})
}

func (h *Handler) CreateFieldDefinition(c *gin.Context) {
	orgID := middleware.OrgIDFromCtx(c)
	userID := middleware.UserIDFromCtx(c)

	var req CreateFieldDefinitionRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, apperr.ValidationError(err))
		return
	}

	fd, err := h.service.CreateFieldDefinition(c.Request.Context(), orgID, req, userID)
	if err != nil {
		h.logAndRespondError(c, err, "failed to create field definition", map[string]string{"org_id": orgID.String()})
		return
	}

	c.JSON(http.StatusCreated, gin.H{"data": fd})
}

func (h *Handler) UpdateFieldDefinition(c *gin.Context) {
	orgID := middleware.OrgIDFromCtx(c)
	userID := middleware.UserIDFromCtx(c)

	id, err := uuid.Parse(c.Param("fid"))
	if err != nil {
		c.JSON(http.StatusBadRequest, apperr.ValidationError(err))
		return
	}

	var req UpdateFieldDefinitionRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, apperr.ValidationError(err))
		return
	}

	fd, err := h.service.UpdateFieldDefinition(c.Request.Context(), orgID, id, req, userID)
	if err != nil {
		h.logAndRespondError(c, err, "failed to update field definition", map[string]string{
			"org_id":   orgID.String(),
			"field_id": id.String(),
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{"data": fd})
}

func (h *Handler) DeactivateFieldDefinition(c *gin.Context) {
	orgID := middleware.OrgIDFromCtx(c)
	userID := middleware.UserIDFromCtx(c)

	id, err := uuid.Parse(c.Param("fid"))
	if err != nil {
		c.JSON(http.StatusBadRequest, apperr.ValidationError(err))
		return
	}

	if err := h.service.DeactivateFieldDefinition(c.Request.Context(), orgID, id, userID); err != nil {
		h.logAndRespondError(c, err, "failed to deactivate field definition", map[string]string{
			"org_id":   orgID.String(),
			"field_id": id.String(),
		})
		return
	}

	c.JSON(http.StatusNoContent, nil)
}

// ── Field Values ──────────────────────────────────────────────────────────────

func (h *Handler) SetFieldValue(c *gin.Context) {
	orgID := middleware.OrgIDFromCtx(c)
	userID := middleware.UserIDFromCtx(c)

	taskID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, apperr.ValidationError(err))
		return
	}
	fieldID, err := uuid.Parse(c.Param("fid"))
	if err != nil {
		c.JSON(http.StatusBadRequest, apperr.ValidationError(err))
		return
	}

	var req SetFieldValueRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, apperr.ValidationError(err))
		return
	}

	fv, err := h.service.SetFieldValue(c.Request.Context(), orgID, taskID, fieldID, req, userID)
	if err != nil {
		h.logAndRespondError(c, err, "failed to set field value", map[string]string{
			"org_id":   orgID.String(),
			"task_id":  taskID.String(),
			"field_id": fieldID.String(),
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{"data": fv})
}

func (h *Handler) ClearFieldValue(c *gin.Context) {
	orgID := middleware.OrgIDFromCtx(c)
	userID := middleware.UserIDFromCtx(c)

	taskID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, apperr.ValidationError(err))
		return
	}
	fieldID, err := uuid.Parse(c.Param("fid"))
	if err != nil {
		c.JSON(http.StatusBadRequest, apperr.ValidationError(err))
		return
	}

	if err := h.service.ClearFieldValue(c.Request.Context(), orgID, taskID, fieldID, userID); err != nil {
		h.logAndRespondError(c, err, "failed to clear field value", map[string]string{
			"org_id":   orgID.String(),
			"task_id":  taskID.String(),
			"field_id": fieldID.String(),
		})
		return
	}

	c.JSON(http.StatusNoContent, nil)
}

// ── Task Links ───────────────────────────────────────────────────────────────

func (h *Handler) CreateTaskLink(c *gin.Context) {
	orgID := middleware.OrgIDFromCtx(c)
	userID := middleware.UserIDFromCtx(c)

	taskID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, apperr.ValidationError(err))
		return
	}

	// Get employee ID from user ID
	empID, err := h.empLookup(c.Request.Context(), orgID, userID)
	if err != nil {
		h.logAndRespondError(c, err, "failed to lookup employee", map[string]string{"org_id": orgID.String(), "user_id": userID.String()})
		return
	}

	var req CreateTaskLinkRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, apperr.ValidationError(err))
		return
	}

	link, err := h.service.CreateTaskLink(c.Request.Context(), orgID, taskID, req, empID, userID)
	if err != nil {
		h.logAndRespondError(c, err, "failed to create task link", map[string]string{
			"org_id":  orgID.String(),
			"task_id": taskID.String(),
		})
		return
	}

	c.JSON(http.StatusCreated, gin.H{"data": link})
}

func (h *Handler) ListTaskLinks(c *gin.Context) {
	orgID := middleware.OrgIDFromCtx(c)

	taskID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, apperr.ValidationError(err))
		return
	}

	links, err := h.service.ListTaskLinks(c.Request.Context(), orgID, taskID)
	if err != nil {
		h.logAndRespondError(c, err, "failed to list task links", map[string]string{
			"org_id":  orgID.String(),
			"task_id": taskID.String(),
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{"data": links})
}

func (h *Handler) DeleteTaskLink(c *gin.Context) {
	orgID := middleware.OrgIDFromCtx(c)
	userID := middleware.UserIDFromCtx(c)

	taskID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, apperr.ValidationError(err))
		return
	}

	linkID, err := uuid.Parse(c.Param("lid"))
	if err != nil {
		c.JSON(http.StatusBadRequest, apperr.ValidationError(err))
		return
	}

	if err := h.service.DeleteTaskLink(c.Request.Context(), orgID, linkID, userID); err != nil {
		h.logAndRespondError(c, err, "failed to delete task link", map[string]string{
			"org_id":  orgID.String(),
			"task_id": taskID.String(),
			"link_id": linkID.String(),
		})
		return
	}

	c.JSON(http.StatusNoContent, nil)
}

// ── Subtasks / Hierarchy ─────────────────────────────────────────────────────

func (h *Handler) CreateSubtask(c *gin.Context) {
	orgID := middleware.OrgIDFromCtx(c)
	userID := middleware.UserIDFromCtx(c)

	parentTaskID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, apperr.ValidationError(err))
		return
	}

	// Get employee ID from user ID
	empID, err := h.empLookup(c.Request.Context(), orgID, userID)
	if err != nil {
		h.logAndRespondError(c, err, "failed to lookup employee", map[string]string{"org_id": orgID.String(), "user_id": userID.String()})
		return
	}

	var req CreateSubtaskRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, apperr.ValidationError(err))
		return
	}

	task, err := h.service.CreateSubtask(c.Request.Context(), orgID, parentTaskID, empID, req, userID)
	if err != nil {
		h.logAndRespondError(c, err, "failed to create subtask", map[string]string{
			"org_id":         orgID.String(),
			"parent_task_id": parentTaskID.String(),
		})
		return
	}

	c.JSON(http.StatusCreated, gin.H{"data": task})
}

func (h *Handler) ListSubtasks(c *gin.Context) {
	orgID := middleware.OrgIDFromCtx(c)

	parentTaskID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, apperr.ValidationError(err))
		return
	}

	subtasks, err := h.service.ListSubtasks(c.Request.Context(), orgID, parentTaskID)
	if err != nil {
		h.logAndRespondError(c, err, "failed to list subtasks", map[string]string{
			"org_id":         orgID.String(),
			"parent_task_id": parentTaskID.String(),
		})
		return
	}

	// Also get subtask counts for the parent
	counts, err := h.service.GetSubtaskCounts(c.Request.Context(), orgID, parentTaskID)
	if err != nil {
		h.log.Warn().Err(err).Msg("failed to get subtask counts")
	}

	c.JSON(http.StatusOK, gin.H{
		"data":   subtasks,
		"counts": counts,
	})
}

func (h *Handler) ChangeTaskParent(c *gin.Context) {
	orgID := middleware.OrgIDFromCtx(c)
	userID := middleware.UserIDFromCtx(c)

	taskID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, apperr.ValidationError(err))
		return
	}

	var req ChangeParentRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, apperr.ValidationError(err))
		return
	}

	if err := h.service.ChangeTaskParent(c.Request.Context(), orgID, taskID, req, userID); err != nil {
		h.logAndRespondError(c, err, "failed to change task parent", map[string]string{
			"org_id":  orgID.String(),
			"task_id": taskID.String(),
		})
		return
	}

	c.JSON(http.StatusNoContent, nil)
}

func (h *Handler) ReorderSubtasks(c *gin.Context) {
	orgID := middleware.OrgIDFromCtx(c)
	userID := middleware.UserIDFromCtx(c)

	parentTaskID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, apperr.ValidationError(err))
		return
	}

	var req ReorderSubtasksRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, apperr.ValidationError(err))
		return
	}

	if err := h.service.ReorderSubtasks(c.Request.Context(), orgID, parentTaskID, req, userID); err != nil {
		h.logAndRespondError(c, err, "failed to reorder subtasks", map[string]string{
			"org_id":         orgID.String(),
			"parent_task_id": parentTaskID.String(),
		})
		return
	}

	c.JSON(http.StatusNoContent, nil)
}
