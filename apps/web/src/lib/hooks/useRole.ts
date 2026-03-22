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

// leave.write permission: owner, admin, hr_admin, member, manager, finance
// Members/managers/finance can view team approvals if they have direct reports
export function useCanManageLeave(): boolean {
  const role = useRole()
  const hasSubordinate = useHasSubordinate()
  
  // Admin roles: always true (org-wide access)
  if (role === 'owner' || role === 'admin' || role === 'hr_admin' || role === 'super_admin') {
    return true
  }
  
  // Approval roles: true only if has subordinates (team-level access)
  if (role === 'member' || role === 'manager' || role === 'finance') {
    return hasSubordinate
  }
  
  return false
}

// claims.write permission: owner, admin, hr_admin, member, manager, finance
// Members/managers/finance can view team approvals if they have direct reports
export function useCanManageClaims(): boolean {
  const role = useRole()
  const hasSubordinate = useHasSubordinate()
  
  // Admin roles: always true (org-wide access)
  if (role === 'owner' || role === 'admin' || role === 'hr_admin' || role === 'super_admin') {
    return true
  }
  
  // Approval roles: true only if has subordinates (team-level access)
  if (role === 'member' || role === 'manager' || role === 'finance') {
    return hasSubordinate
  }
  
  return false
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
