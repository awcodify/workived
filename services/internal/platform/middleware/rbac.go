package middleware

import (
	"github.com/workived/services/pkg/apperr"
)

const (
	RoleOwner  = "owner"
	RoleAdmin  = "admin"
	RoleMember = "member"
)

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
