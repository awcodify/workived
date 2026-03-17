package middleware

import (
	"context"
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/workived/services/pkg/apperr"
)

// OrgMember is the minimum representation the tenant middleware needs.
type OrgMember struct {
	OrgID    uuid.UUID
	UserID   uuid.UUID
	Role     string
	IsActive bool
	OrgPlan  string
	OrgTimezone string
	PlanEmployeeLimit *int
}

// OrgRepository is satisfied by the organisation repository.
type OrgRepository interface {
	GetMember(ctx context.Context, orgID, userID uuid.UUID) (*OrgMember, error)
}

const orgMemberKey = "org_member"

func Tenant(orgRepo OrgRepository) gin.HandlerFunc {
	return func(c *gin.Context) {
		userID := UserIDFromCtx(c)
		orgID := OrgIDFromCtx(c)

		if orgID == uuid.Nil {
			c.AbortWithStatusJSON(http.StatusForbidden, apperr.Response(apperr.Forbidden()))
			return
		}

		member, err := orgRepo.GetMember(c.Request.Context(), orgID, userID)
		if err != nil || !member.IsActive {
			c.AbortWithStatusJSON(http.StatusForbidden, apperr.Response(apperr.Forbidden()))
			return
		}

		// Override context values with validated data from the database.
		c.Set(orgIDKey, member.OrgID)
		c.Set("role", member.Role)
		c.Set(orgMemberKey, member)
		c.Next()
	}
}

// OrgMemberFromCtx returns the validated org member attached by TenantMiddleware.
func OrgMemberFromCtx(c *gin.Context) *OrgMember {
	v, _ := c.Get(orgMemberKey)
	m, _ := v.(*OrgMember)
	return m
}
