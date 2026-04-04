package audit

import (
	"context"
	"fmt"
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/workived/services/pkg/apperr"
)

type QuerierService interface {
	List(ctx context.Context, orgID uuid.UUID, filters ListFilters) ([]AuditLog, error)
	GetByResource(ctx context.Context, orgID uuid.UUID, resourceType string, resourceID uuid.UUID, filters ListFilters) ([]AuditLog, error)
}

type Handler struct {
	querier QuerierService
}

func NewHandler(querier QuerierService) *Handler {
	return &Handler{querier: querier}
}

func (h *Handler) RegisterRoutes(rg *gin.RouterGroup) {
	audit := rg.Group("/audit-logs")
	audit.GET("", h.List)
	audit.GET("/resource/:type/:id", h.GetByResource)
}

func (h *Handler) List(c *gin.Context) {
	orgID, _ := c.Get("org_id")
	orgUUID := orgID.(uuid.UUID)
	role, _ := c.Get("role")
	roleStr, _ := role.(string)
	if roleStr != "owner" && roleStr != "admin" && roleStr != "super_admin" {
		c.JSON(http.StatusForbidden, gin.H{"error": "insufficient permissions"})
		return
	}

	var filters ListFilters
	filters.Limit = 50
	if limitStr := c.Query("limit"); limitStr != "" {
		if limit, err := parseInt(limitStr); err == nil {
			filters.Limit = limit
		}
	}
	if offsetStr := c.Query("offset"); offsetStr != "" {
		if offset, err := parseInt(offsetStr); err == nil {
			filters.Offset = offset
		}
	}
	if resourceType := c.Query("resource_type"); resourceType != "" {
		filters.ResourceType = &resourceType
	}
	if resourceIDStr := c.Query("resource_id"); resourceIDStr != "" {
		if resourceID, err := uuid.Parse(resourceIDStr); err == nil {
			filters.ResourceID = &resourceID
		}
	}
	if actorIDStr := c.Query("actor_user_id"); actorIDStr != "" {
		if actorID, err := uuid.Parse(actorIDStr); err == nil {
			filters.ActorUserID = &actorID
		}
	}
	if action := c.Query("action"); action != "" {
		filters.Action = &action
	}
	if startDateStr := c.Query("start_date"); startDateStr != "" {
		if startDate, err := time.Parse(time.RFC3339, startDateStr); err == nil {
			filters.StartDate = &startDate
		}
	}
	if endDateStr := c.Query("end_date"); endDateStr != "" {
		if endDate, err := time.Parse(time.RFC3339, endDateStr); err == nil {
			filters.EndDate = &endDate
		}
	}

	logs, err := h.querier.List(c.Request.Context(), orgUUID, filters)
	if err != nil {
		_ = c.Error(err)
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"data": logs,
		"meta": gin.H{
			"limit":  filters.Limit,
			"offset": filters.Offset,
		},
	})
}

func (h *Handler) GetByResource(c *gin.Context) {
	orgID, _ := c.Get("org_id")
	orgUUID := orgID.(uuid.UUID)
	role, _ := c.Get("role")
	roleStr, _ := role.(string)
	if roleStr != "owner" && roleStr != "admin" && roleStr != "super_admin" {
		c.JSON(http.StatusForbidden, gin.H{"error": "insufficient permissions"})
		return
	}

	resourceType := c.Param("type")
	resourceIDStr := c.Param("id")

	resourceID, err := uuid.Parse(resourceIDStr)
	if err != nil {
		_ = c.Error(apperr.New(apperr.CodeValidation, "invalid resource_id"))
		return
	}

	var filters ListFilters
	filters.Limit = 50
	if limitStr := c.Query("limit"); limitStr != "" {
		if limit, err := parseInt(limitStr); err == nil {
			filters.Limit = limit
		}
	}

	logs, err := h.querier.GetByResource(c.Request.Context(), orgUUID, resourceType, resourceID, filters)
	if err != nil {
		_ = c.Error(err)
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"data": logs,
	})
}

func parseInt(s string) (int, error) {
	var val int
	_, err := fmt.Sscanf(s, "%d", &val)
	return val, err
}
