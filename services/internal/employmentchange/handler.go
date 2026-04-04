package employmentchange

import (
	"context"
	"fmt"
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/workived/services/pkg/apperr"
)

// ServiceInterface defines the interface for employment change operations.
type ServiceInterface interface {
	GetByEmployee(ctx context.Context, orgID, employeeID uuid.UUID, filters ListFilters) ([]EmploymentChange, error)
	List(ctx context.Context, orgID uuid.UUID, filters ListFilters) ([]EmploymentChange, error)
}

type Handler struct {
	repo Repository
}

func NewHandler(repo Repository) *Handler {
	return &Handler{repo: repo}
}

func (h *Handler) RegisterRoutes(rg *gin.RouterGroup) {
	history := rg.Group("/employment-history")
	history.GET("", h.List)
	history.GET("/employee/:id", h.GetByEmployee)
}

func (h *Handler) List(c *gin.Context) {
	orgID, _ := c.Get("org_id")
	orgUUID := orgID.(uuid.UUID)

	// Security: Only owner/admin/hr_admin/super_admin can access employment history
	role, _ := c.Get("role")
	roleStr, _ := role.(string)
	if roleStr != "owner" && roleStr != "admin" && roleStr != "hr_admin" && roleStr != "super_admin" {
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
	if employeeIDStr := c.Query("employee_id"); employeeIDStr != "" {
		if employeeID, err := uuid.Parse(employeeIDStr); err == nil {
			filters.EmployeeID = &employeeID
		}
	}
	if changeTypeStr := c.Query("change_type"); changeTypeStr != "" {
		changeType := ChangeType(changeTypeStr)
		filters.ChangeType = &changeType
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

	changes, err := h.repo.List(c.Request.Context(), orgUUID, filters)
	if err != nil {
		_ = c.Error(err)
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"data": changes,
		"meta": gin.H{
			"limit":  filters.Limit,
			"offset": filters.Offset,
		},
	})
}

func (h *Handler) GetByEmployee(c *gin.Context) {
	orgID, _ := c.Get("org_id")
	orgUUID := orgID.(uuid.UUID)

	// Security: Only owner/admin/hr_admin can access employment history
	role, exists := c.Get("role")
	if !exists {
		c.JSON(http.StatusForbidden, gin.H{"error": "role not found in context"})
		return
	}
	roleStr, ok := role.(string)
	if !ok {
		c.JSON(http.StatusForbidden, gin.H{"error": "invalid role type", "role_type": fmt.Sprintf("%T", role)})
		return
	}
	// DEBUG: Log the role for troubleshooting
	c.Writer.Header().Add("X-Debug-Role", roleStr)
	if roleStr != "owner" && roleStr != "admin" && roleStr != "hr_admin" && roleStr != "super_admin" {
		c.JSON(http.StatusForbidden, gin.H{"error": "insufficient permissions", "role": roleStr, "required": "owner/admin/hr_admin/super_admin"})
		return
	}

	employeeIDStr := c.Param("id")

	employeeID, err := uuid.Parse(employeeIDStr)
	if err != nil {
		_ = c.Error(apperr.New(apperr.CodeValidation, "invalid employee_id"))
		return
	}

	var filters ListFilters
	filters.Limit = 100
	if limitStr := c.Query("limit"); limitStr != "" {
		if limit, err := parseInt(limitStr); err == nil {
			filters.Limit = limit
		}
	}
	if changeTypeStr := c.Query("change_type"); changeTypeStr != "" {
		changeType := ChangeType(changeTypeStr)
		filters.ChangeType = &changeType
	}

	changes, err := h.repo.GetByEmployee(c.Request.Context(), orgUUID, employeeID, filters)
	if err != nil {
		_ = c.Error(err)
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"data": changes,
	})
}

func parseInt(s string) (int, error) {
	var val int
	_, err := fmt.Sscanf(s, "%d", &val)
	return val, err
}
