package middleware_test

import (
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/gin-gonic/gin"
	"github.com/workived/services/internal/platform/middleware"
)

func init() {
	gin.SetMode(gin.TestMode)
}

// ── HasPermission ────────────────────────────────────────────────────────────

func TestHasPermission(t *testing.T) {
	tests := []struct {
		name       string
		role       string
		permission string
		want       bool
	}{
		// Owner — wildcard
		{"owner has everything", middleware.RoleOwner, middleware.PermEmployeeRead, true},
		{"owner has self.read", middleware.RoleOwner, middleware.PermSelfRead, true},
		{"owner has salary.read", middleware.RoleOwner, middleware.PermSalaryRead, true},
		{"owner has arbitrary permission", middleware.RoleOwner, "anything.at.all", true},

		// Admin — explicit permissions
		{"admin can read employees", middleware.RoleAdmin, middleware.PermEmployeeRead, true},
		{"admin can write employees", middleware.RoleAdmin, middleware.PermEmployeeWrite, true},
		{"admin can deactivate employees", middleware.RoleAdmin, middleware.PermEmployeeDeactivate, true},
		{"admin can manage invitations", middleware.RoleAdmin, middleware.PermInvitationWrite, true},
		{"admin can read salary", middleware.RoleAdmin, middleware.PermSalaryRead, true},
		{"admin can read org", middleware.RoleAdmin, middleware.PermOrgRead, true},
		{"admin can manage org settings", middleware.RoleAdmin, middleware.PermOrgSettings, true},

		// Member — limited
		{"member can read self", middleware.RoleMember, middleware.PermSelfRead, true},
		{"member can write self", middleware.RoleMember, middleware.PermSelfWrite, true},
		{"member can read employees", middleware.RoleMember, middleware.PermEmployeeRead, true},
		{"member can read departments", middleware.RoleMember, middleware.PermDepartmentRead, true},
		{"member can clock in", middleware.RoleMember, middleware.PermSelfAttendance, true},
		{"member cannot write employees", middleware.RoleMember, middleware.PermEmployeeWrite, false},
		{"member cannot deactivate employees", middleware.RoleMember, middleware.PermEmployeeDeactivate, false},
		{"member cannot manage invitations", middleware.RoleMember, middleware.PermInvitationWrite, false},
		{"member cannot read salary", middleware.RoleMember, middleware.PermSalaryRead, false},
		{"member cannot manage org settings", middleware.RoleMember, middleware.PermOrgSettings, false},
		{"member cannot read reports", middleware.RoleMember, middleware.PermReportsRead, false},
		{"member cannot write attendance", middleware.RoleMember, middleware.PermAttendanceWrite, false},

		// HR Admin (Pro)
		{"hr_admin can read employees", middleware.RoleHRAdmin, middleware.PermEmployeeRead, true},
		{"hr_admin can write employees", middleware.RoleHRAdmin, middleware.PermEmployeeWrite, true},
		{"hr_admin can read attendance", middleware.RoleHRAdmin, middleware.PermAttendanceRead, true},
		{"hr_admin can approve leave", middleware.RoleHRAdmin, middleware.PermLeaveApprove, true},
		{"hr_admin cannot read salary", middleware.RoleHRAdmin, middleware.PermSalaryRead, false},
		{"hr_admin cannot manage org settings", middleware.RoleHRAdmin, middleware.PermOrgSettings, false},

		// Manager (Pro)
		{"manager can read team", middleware.RoleManager, middleware.PermTeamRead, true},
		{"manager can approve team leave", middleware.RoleManager, middleware.PermTeamLeaveApprove, true},
		{"manager can read employees", middleware.RoleManager, middleware.PermEmployeeRead, true},
		{"manager cannot write employees", middleware.RoleManager, middleware.PermEmployeeWrite, false},
		{"manager cannot read salary", middleware.RoleManager, middleware.PermSalaryRead, false},
		{"manager cannot approve claims globally", middleware.RoleManager, middleware.PermClaimsApprove, false},

		// Finance (Pro)
		{"finance can read salary", middleware.RoleFinance, middleware.PermSalaryRead, true},
		{"finance can read claims", middleware.RoleFinance, middleware.PermClaimsRead, true},
		{"finance can read reports", middleware.RoleFinance, middleware.PermReportsRead, true},
		{"finance cannot write employees", middleware.RoleFinance, middleware.PermEmployeeWrite, false},
		{"finance cannot approve leave", middleware.RoleFinance, middleware.PermLeaveApprove, false},

		// Unknown role
		{"unknown role has nothing", "janitor", middleware.PermEmployeeRead, false},
		{"empty role has nothing", "", middleware.PermSelfRead, false},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got := middleware.HasPermission(tt.role, tt.permission)
			if got != tt.want {
				t.Errorf("HasPermission(%q, %q) = %v, want %v", tt.role, tt.permission, got, tt.want)
			}
		})
	}
}

// ── IsProRole ────────────────────────────────────────────────────────────────

func TestIsProRole(t *testing.T) {
	tests := []struct {
		role string
		want bool
	}{
		{middleware.RoleOwner, false},
		{middleware.RoleAdmin, false},
		{middleware.RoleMember, false},
		{middleware.RoleHRAdmin, true},
		{middleware.RoleManager, true},
		{middleware.RoleFinance, true},
		{"unknown", false},
	}

	for _, tt := range tests {
		t.Run(tt.role, func(t *testing.T) {
			if got := middleware.IsProRole(tt.role); got != tt.want {
				t.Errorf("IsProRole(%q) = %v, want %v", tt.role, got, tt.want)
			}
		})
	}
}

// ── Require middleware ───────────────────────────────────────────────────────

func TestRequireMiddleware(t *testing.T) {
	tests := []struct {
		name       string
		role       string
		permission string
		wantStatus int
	}{
		{"owner passes any check", middleware.RoleOwner, middleware.PermEmployeeWrite, http.StatusOK},
		{"admin passes employee.read", middleware.RoleAdmin, middleware.PermEmployeeRead, http.StatusOK},
		{"member blocked from employee.write", middleware.RoleMember, middleware.PermEmployeeWrite, http.StatusForbidden},
		{"member passes self.read", middleware.RoleMember, middleware.PermSelfRead, http.StatusOK},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			w := httptest.NewRecorder()
			c, r := gin.CreateTestContext(w)

			r.Use(func(c *gin.Context) {
				c.Set("role", tt.role)
				c.Next()
			})
			r.Use(middleware.Require(tt.permission))
			r.GET("/test", func(c *gin.Context) {
				c.Status(http.StatusOK)
			})

			c.Request = httptest.NewRequest(http.MethodGet, "/test", nil)
			r.ServeHTTP(w, c.Request)

			if w.Code != tt.wantStatus {
				t.Errorf("got status %d, want %d", w.Code, tt.wantStatus)
			}
		})
	}
}

// ── RequireAny middleware ────────────────────────────────────────────────────

func TestRequireAnyMiddleware(t *testing.T) {
	tests := []struct {
		name        string
		role        string
		permissions []string
		wantStatus  int
	}{
		{
			"member passes with self.read OR employee.read",
			middleware.RoleMember,
			[]string{middleware.PermEmployeeWrite, middleware.PermSelfRead},
			http.StatusOK,
		},
		{
			"member blocked when neither matches",
			middleware.RoleMember,
			[]string{middleware.PermEmployeeWrite, middleware.PermSalaryRead},
			http.StatusForbidden,
		},
		{
			"admin passes on first match",
			middleware.RoleAdmin,
			[]string{middleware.PermEmployeeRead, middleware.PermSelfRead},
			http.StatusOK,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			w := httptest.NewRecorder()
			c, r := gin.CreateTestContext(w)

			r.Use(func(c *gin.Context) {
				c.Set("role", tt.role)
				c.Next()
			})
			r.Use(middleware.RequireAny(tt.permissions...))
			r.GET("/test", func(c *gin.Context) {
				c.Status(http.StatusOK)
			})

			c.Request = httptest.NewRequest(http.MethodGet, "/test", nil)
			r.ServeHTTP(w, c.Request)

			if w.Code != tt.wantStatus {
				t.Errorf("got status %d, want %d", w.Code, tt.wantStatus)
			}
		})
	}
}

// ── RequireRole (legacy) ─────────────────────────────────────────────────────

func TestRequireRole(t *testing.T) {
	tests := []struct {
		name    string
		role    string
		allowed []string
		wantErr bool
	}{
		{"owner in allowed list", middleware.RoleOwner, []string{middleware.RoleOwner, middleware.RoleAdmin}, false},
		{"member not in allowed list", middleware.RoleMember, []string{middleware.RoleOwner, middleware.RoleAdmin}, true},
		{"empty allowed list", middleware.RoleOwner, nil, true},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			err := middleware.RequireRole(tt.role, tt.allowed...)
			if (err != nil) != tt.wantErr {
				t.Errorf("RequireRole(%q, %v) error = %v, wantErr %v", tt.role, tt.allowed, err, tt.wantErr)
			}
		})
	}
}

// ── RequirePro ───────────────────────────────────────────────────────────────

func TestRequirePro(t *testing.T) {
	tests := []struct {
		plan    string
		wantErr bool
	}{
		{"free", true},
		{"pro", false},
		{"enterprise", false},
	}

	for _, tt := range tests {
		t.Run(tt.plan, func(t *testing.T) {
			err := middleware.RequirePro(tt.plan)
			if (err != nil) != tt.wantErr {
				t.Errorf("RequirePro(%q) error = %v, wantErr %v", tt.plan, err, tt.wantErr)
			}
		})
	}
}
