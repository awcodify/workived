import { useAuthStore } from '@/lib/stores/auth'
import { parseJwtRole } from '@/lib/utils/jwt'

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
