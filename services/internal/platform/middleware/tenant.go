package middleware

import (
	"context"
	"fmt"
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/workived/services/pkg/apperr"
	"github.com/workived/services/pkg/cache"
)

// OrgMember is the minimum representation the tenant middleware needs.
type OrgMember struct {
	OrgID             uuid.UUID  `json:"org_id"`
	UserID            uuid.UUID  `json:"user_id"`
	Role              string     `json:"role"`
	EmployeeID        *uuid.UUID `json:"employee_id,omitempty"` // nullable — not every member is an employee
	IsActive          bool       `json:"is_active"`
	OrgPlan           string     `json:"org_plan"`
	OrgTimezone       string     `json:"org_timezone"`
	PlanEmployeeLimit *int       `json:"plan_employee_limit,omitempty"`
}

// OrgRepository is satisfied by the organisation repository.
type OrgRepository interface {
	GetMember(ctx context.Context, orgID, userID uuid.UUID) (*OrgMember, error)
}

const (
	orgMemberKey      = "org_member"
	tenantCacheTTL    = 2 * time.Minute
	tenantCacheModule = "tenant"
)

// tenantMemberKey builds cache key: "org:{orgID}:tenant:{userID}".
func tenantMemberKey(orgID, userID uuid.UUID) string {
	return fmt.Sprintf("org:%s:%s:%s", orgID, tenantCacheModule, userID)
}

func Tenant(orgRepo OrgRepository) gin.HandlerFunc {
	return TenantWithCache(orgRepo, nil)
}

// TenantWithCache is the tenant middleware with optional Redis caching.
// When cacheStore is non-nil, GetMember results are cached for 2 minutes.
func TenantWithCache(orgRepo OrgRepository, cacheStore *cache.Store) gin.HandlerFunc {
	return func(c *gin.Context) {
		userID := UserIDFromCtx(c)
		orgID := OrgIDFromCtx(c)

		if orgID == uuid.Nil {
			c.AbortWithStatusJSON(http.StatusForbidden, apperr.Response(apperr.Forbidden()))
			return
		}

		var member *OrgMember

		// Try cache first
		if cacheStore != nil {
			key := tenantMemberKey(orgID, userID)
			if v, ok := cache.Get[OrgMember](c.Request.Context(), cacheStore, key); ok {
				member = &v
			}
		}

		// Cache miss — hit DB
		if member == nil {
			var err error
			member, err = orgRepo.GetMember(c.Request.Context(), orgID, userID)
			if err != nil || !member.IsActive {
				c.AbortWithStatusJSON(http.StatusForbidden, apperr.Response(apperr.Forbidden()))
				return
			}
			// Store in cache
			if cacheStore != nil {
				cache.Set(c.Request.Context(), cacheStore, tenantMemberKey(orgID, userID), *member, tenantCacheTTL)
			}
		} else if !member.IsActive {
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

// InvalidateTenantCache removes the cached member for a specific user.
// Call this when membership changes (role update, deactivation, etc.).
func InvalidateTenantCache(cacheStore *cache.Store, ctx context.Context, orgID, userID uuid.UUID) {
	if cacheStore != nil {
		cacheStore.Delete(ctx, tenantMemberKey(orgID, userID))
	}
}

// InvalidateTenantCacheForOrg removes all cached tenant data for an org.
func InvalidateTenantCacheForOrg(cacheStore *cache.Store, ctx context.Context, orgID uuid.UUID) {
	if cacheStore != nil {
		cacheStore.DeletePattern(ctx, fmt.Sprintf("org:%s:%s:*", orgID, tenantCacheModule))
	}
}

// OrgMemberFromCtx returns the validated org member attached by TenantMiddleware.
func OrgMemberFromCtx(c *gin.Context) *OrgMember {
	v, _ := c.Get(orgMemberKey)
	m, _ := v.(*OrgMember)
	return m
}

// EmployeeIDFromCtx returns the employee ID linked to the current member, or uuid.Nil.
func EmployeeIDFromCtx(c *gin.Context) uuid.UUID {
	m := OrgMemberFromCtx(c)
	if m != nil && m.EmployeeID != nil {
		return *m.EmployeeID
	}
	return uuid.Nil
}
