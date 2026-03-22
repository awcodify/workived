package middleware

import (
	"net/http"
	"strings"

	"github.com/gin-gonic/gin"
	"github.com/workived/services/pkg/apperr"
)

// ── Role constants ───────────────────────────────────────────────────────────

const (
	// Free-tier roles
	RoleOwner  = "owner"
	RoleAdmin  = "admin"
	RoleMember = "member"

	// Pro-tier roles
	RoleHRAdmin = "hr_admin"
	RoleManager = "manager"
	RoleFinance = "finance"

	// Internal role (Workived team only)
	RoleSuperAdmin = "super_admin"
)

// ProRoles are roles that require a Pro (or higher) plan.
var ProRoles = map[string]bool{
	RoleHRAdmin: true,
	RoleManager: true,
	RoleFinance: true,
}

// IsProRole returns true if the role requires a Pro plan.
func IsProRole(role string) bool {
	return ProRoles[role]
}

// ── Permission definitions ───────────────────────────────────────────────────
//
// Format: "{resource}.{action}" or "{scope}.{resource}.{action}"
// Wildcard: "*" = full access, "employee.*" = all employee actions.

// Permission constants — use these instead of raw strings to avoid typos.
const (
	PermAll = "*"

	PermEmployeeRead       = "employee.read"
	PermEmployeeWrite      = "employee.write"
	PermEmployeeDeactivate = "employee.deactivate"

	PermAttendanceRead  = "attendance.read"
	PermAttendanceWrite = "attendance.write"

	PermLeaveRead    = "leave.read"
	PermLeaveWrite   = "leave.write"
	PermLeaveApprove = "leave.approve"

	PermClaimsRead    = "claims.read"
	PermClaimsWrite   = "claims.write"
	PermClaimsApprove = "claims.approve"

	PermDepartmentRead  = "department.read"
	PermDepartmentWrite = "department.write"

	PermOrgRead     = "org.read"
	PermOrgSettings = "org.settings"

	PermInvitationWrite = "invitation.write"

	PermReportsRead = "reports.read"
	PermSalaryRead  = "salary.read"

	PermTasksRead  = "tasks.read"
	PermTasksWrite = "tasks.write"

	// Self-scoped — resource-level check enforced in service layer.
	PermSelfRead       = "self.read"
	PermSelfWrite      = "self.write"
	PermSelfAttendance = "self.attendance"
	PermSelfLeave      = "self.leave"
	PermSelfClaims     = "self.claims"

	// Team-scoped — resource-level check enforced in service layer (Pro).
	PermTeamRead           = "team.read"
	PermTeamAttendanceRead = "team.attendance.read"
	PermTeamLeaveApprove   = "team.leave.approve"
	PermTeamClaimsApprove  = "team.claims.approve"
)

// RolePermissions maps each role to its allowed permissions.
// The permission check is done in-memory — zero DB queries.
var RolePermissions = map[string][]string{
	// ── Free-tier ──
	RoleOwner: {PermAll},
	RoleAdmin: {
		PermEmployeeRead, PermEmployeeWrite, PermEmployeeDeactivate,
		PermAttendanceRead, PermAttendanceWrite,
		PermLeaveRead, PermLeaveWrite, PermLeaveApprove,
		PermClaimsRead, PermClaimsWrite, PermClaimsApprove,
		PermDepartmentRead, PermDepartmentWrite,
		PermOrgRead, PermOrgSettings,
		PermInvitationWrite,
		PermReportsRead,
		PermSalaryRead,
		PermTasksRead, PermTasksWrite,
		PermSelfRead, PermSelfWrite, PermSelfAttendance, PermSelfLeave, PermSelfClaims,
	},
	RoleMember: {
		PermSelfRead, PermSelfWrite,
		PermSelfAttendance,
		PermSelfLeave,
		PermSelfClaims,
		PermEmployeeRead,
		PermDepartmentRead,
		PermOrgRead,
		PermLeaveRead, PermLeaveWrite, // Need read to view policies, write to see team requests
		PermClaimsRead, PermClaimsWrite, // Need read to view categories, write to see team claims
		PermTasksRead, // Collaborative task management
	},

	// ── Pro-tier ──
	RoleHRAdmin: {
		PermEmployeeRead, PermEmployeeWrite, PermEmployeeDeactivate,
		PermAttendanceRead, PermAttendanceWrite,
		PermLeaveRead, PermLeaveWrite, PermLeaveApprove,
		PermDepartmentRead, PermDepartmentWrite,
		PermOrgRead,
		PermInvitationWrite,
		PermReportsRead,
		PermTasksRead, PermTasksWrite,
		PermSelfRead, PermSelfWrite, PermSelfAttendance, PermSelfLeave, PermSelfClaims,
	},
	RoleManager: {
		PermSelfRead, PermSelfWrite,
		PermSelfAttendance, PermSelfLeave, PermSelfClaims,
		PermTeamRead,
		PermTeamAttendanceRead,
		PermTeamLeaveApprove,
		PermTeamClaimsApprove,
		PermEmployeeRead,
		PermDepartmentRead,
		PermOrgRead,
		PermLeaveRead,  // Need to view policies to create own leave requests
		PermClaimsRead, // Need to view categories to create own claims
		PermTasksRead,  // Collaborative task management
	},
	RoleFinance: {
		PermSelfRead, PermSelfWrite,
		PermSelfAttendance, PermSelfLeave, PermSelfClaims,
		PermEmployeeRead,
		PermSalaryRead,
		PermClaimsRead, // Already has claims read for reports
		PermReportsRead,
		PermOrgRead,
		PermLeaveRead, // Need to view policies to create own leave requests
		PermTasksRead, // Collaborative task management
	},

	// ── Internal (Workived team) ──
	RoleSuperAdmin: {PermAll}, // Full system access for Workived team
}

// ── Permission checking ──────────────────────────────────────────────────────

// HasPermission checks if a role has the given permission.
// Supports exact match, wildcard "*", and prefix wildcard "employee.*".
func HasPermission(role, permission string) bool {
	perms, ok := RolePermissions[role]
	if !ok {
		return false
	}
	for _, p := range perms {
		if p == PermAll || p == permission {
			return true
		}
		// Prefix wildcard: "employee.*" matches "employee.read"
		if strings.HasSuffix(p, ".*") {
			prefix := strings.TrimSuffix(p, ".*")
			if strings.HasPrefix(permission, prefix+".") {
				return true
			}
		}
	}
	return false
}

// ── Gin middleware ────────────────────────────────────────────────────────────

// Require returns a Gin middleware that checks if the authenticated user's role
// has the given permission. Apply per-route.
func Require(permission string) gin.HandlerFunc {
	return func(c *gin.Context) {
		role := RoleFromCtx(c)
		if !HasPermission(role, permission) {
			c.AbortWithStatusJSON(http.StatusForbidden, apperr.Response(apperr.Forbidden()))
			return
		}
		c.Next()
	}
}

// RequireAny returns a Gin middleware that checks if the role has at least one
// of the given permissions. Useful for endpoints accessible via self OR admin scope.
func RequireAny(permissions ...string) gin.HandlerFunc {
	return func(c *gin.Context) {
		role := RoleFromCtx(c)
		for _, p := range permissions {
			if HasPermission(role, p) {
				c.Next()
				return
			}
		}
		c.AbortWithStatusJSON(http.StatusForbidden, apperr.Response(apperr.Forbidden()))
	}
}

// RequireSuperAdmin returns a Gin middleware that ensures the user has super_admin role.
// Only for Workived internal team — grants full system access.
func RequireSuperAdmin() gin.HandlerFunc {
	return func(c *gin.Context) {
		role := RoleFromCtx(c)
		if role != RoleSuperAdmin {
			c.AbortWithStatusJSON(http.StatusForbidden, apperr.Response(apperr.Forbidden()))
			return
		}
		c.Next()
	}
}

// RequireManager returns a Gin middleware that checks if the authenticated user is a manager
// (has team-scoped permissions). Used for attendance/leave team endpoints.
func RequireManager() gin.HandlerFunc {
	return func(c *gin.Context) {
		role := RoleFromCtx(c)
		hasSubordinate := HasSubordinateFromCtx(c)

		// Managers with role="manager" OR members with subordinates get team permissions
		if role == RoleManager || hasSubordinate {
			c.Next()
			return
		}

		// Also check if they have any team permission via role-based permissions
		if HasPermission(role, PermTeamRead) ||
			HasPermission(role, PermTeamAttendanceRead) ||
			HasPermission(role, PermTeamLeaveApprove) ||
			HasPermission(role, PermTeamClaimsApprove) {
			c.Next()
			return
		}

		c.AbortWithStatusJSON(http.StatusForbidden, apperr.Response(apperr.Forbidden()))
	}
}

// ── Legacy helpers (kept for backwards compatibility during migration) ────────

// RequireRole returns an error if the member's role is not in the allowed list.
func RequireRole(role string, allowed ...string) error {
	for _, a := range allowed {
		if role == a {
			return nil
		}
	}
	return apperr.Forbidden()
}

// RequirePro returns an error if the org is on the free plan.
func RequirePro(orgPlan string) error {
	if orgPlan == "free" {
		return apperr.New(apperr.CodeUpgradeRequired, "this feature requires a Workived Pro plan")
	}
	return nil
}
