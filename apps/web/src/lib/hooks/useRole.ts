import { useAuthStore } from '@/lib/stores/auth'
import { parseJwtRole, parseJwtOrgId, parseJwtHasSubordinate } from '@/lib/utils/jwt'

// Returns the current user's role from the JWT access token.
// Returns null if unauthenticated or the token is unreadable.
export function useRole(): string | null {
  const accessToken = useAuthStore((s) => s.accessToken)
  return parseJwtRole(accessToken)
}

// Returns whether the authenticated member has subordinates (direct reports).
// Used for team-level permissions (leave/claims/attendance approvals).
export function useHasSubordinate(): boolean {
  const accessToken = useAuthStore((s) => s.accessToken)
  return parseJwtHasSubordinate(accessToken)
}

// org.settings permission: owner, admin, super_admin
export function useCanEditOrgSettings(): boolean {
  const role = useRole()
  return role === 'owner' || role === 'admin' || role === 'super_admin'
}

// invitation.write permission: owner, admin, hr_admin, super_admin
export function useCanInvite(): boolean {
  const role = useRole()
  return role === 'owner' || role === 'admin' || role === 'hr_admin' || role === 'super_admin'
}

// leave.write permission: owner, admin, hr_admin, manager always; member/finance if has subordinates
export function useCanManageLeave(): boolean {
  const role = useRole()
  const hasSubordinate = useHasSubordinate()

  // Admin roles: always true (org-wide access)
  if (role === 'owner' || role === 'admin' || role === 'hr_admin' || role === 'super_admin') {
    return true
  }

  // Manager role always has PermTeamLeaveApprove regardless of has_subordinate JWT claim
  if (role === 'manager') {
    return true
  }

  // Member/finance: only if they have direct reports (has_subordinate in JWT)
  if (role === 'member' || role === 'finance') {
    return hasSubordinate
  }

  return false
}

// claims.write permission: owner, admin, hr_admin, manager always; member/finance if has subordinates
export function useCanManageClaims(): boolean {
  const role = useRole()
  const hasSubordinate = useHasSubordinate()

  // Admin roles: always true (org-wide access)
  if (role === 'owner' || role === 'admin' || role === 'hr_admin' || role === 'super_admin') {
    return true
  }

  // Manager role always has PermTeamClaimsApprove regardless of has_subordinate JWT claim
  if (role === 'manager') {
    return true
  }

  // Member/finance: only if they have direct reports (has_subordinate in JWT)
  if (role === 'member' || role === 'finance') {
    return hasSubordinate
  }

  return false
}

// claims.pay permission: owner, admin, hr_admin, finance, super_admin.
// Matches the server-side role check in claims/handler.go MarkAsPaid.
// manager and member can approve claims but cannot disburse payments.
export function useCanPayClaims(): boolean {
  const role = useRole()
  return (
    role === 'owner' ||
    role === 'admin' ||
    role === 'hr_admin' ||
    role === 'finance' ||
    role === 'super_admin'
  )
}

// employee.write permission: owner, admin, hr_admin
export function useCanManageEmployees(): boolean {
  const role = useRole()
  return role === 'owner' || role === 'admin' || role === 'hr_admin' || role === 'super_admin'
}

// Returns true if the JWT contains a non-empty org_id claim.
// False means the user is authenticated but has not yet created or joined an organisation.
export function useHasOrg(): boolean {
  const accessToken = useAuthStore((s) => s.accessToken)
  return parseJwtOrgId(accessToken) !== null
}
