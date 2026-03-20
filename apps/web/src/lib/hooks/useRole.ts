import { useAuthStore } from '@/lib/stores/auth'
import { parseJwtRole, parseJwtOrgId } from '@/lib/utils/jwt'

// Returns the current user's role from the JWT access token.
// Returns null if unauthenticated or the token is unreadable.
export function useRole(): string | null {
  const accessToken = useAuthStore((s) => s.accessToken)
  return parseJwtRole(accessToken)
}

// org.settings permission: owner, admin
export function useCanEditOrgSettings(): boolean {
  const role = useRole()
  return role === 'owner' || role === 'admin'
}

// invitation.write permission: owner, admin, hr_admin
export function useCanInvite(): boolean {
  const role = useRole()
  return role === 'owner' || role === 'admin' || role === 'hr_admin'
}

// leave.write permission: owner, admin, hr_admin
export function useCanManageLeave(): boolean {
  const role = useRole()
  return role === 'owner' || role === 'admin' || role === 'hr_admin' || role === 'super_admin'
}

// claims.write permission: owner, admin, hr_admin
export function useCanManageClaims(): boolean {
  const role = useRole()
  return role === 'owner' || role === 'admin' || role === 'hr_admin' || role === 'super_admin'
}

// Returns true if the JWT contains a non-empty org_id claim.
// False means the user is authenticated but has not yet created or joined an organisation.
export function useHasOrg(): boolean {
  const accessToken = useAuthStore((s) => s.accessToken)
  return parseJwtOrgId(accessToken) !== null
}
