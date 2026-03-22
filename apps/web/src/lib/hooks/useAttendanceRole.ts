import { useRole } from './useRole'
import { useAuthStore } from '@/lib/stores/auth'

export interface AttendanceRole {
  canViewOwn: boolean
  canViewTeam: boolean
  canViewAll: boolean
}

// Decode JWT to extract has_subordinate claim
function decodeJWT(token: string): { has_sub?: boolean } | null {
  try {
    const parts = token.split('.')
    if (parts.length !== 3) return null
    const payload = JSON.parse(atob(parts[1]))
    return payload
  } catch {
    return null
  }
}

/**
 * Determines the user's attendance viewing permissions:
 * - canViewOwn: All authenticated users (My Attendance tab)
 * - canViewTeam: Members with subordinates OR role="manager" (Team Attendance tab)
 * - canViewAll: Admins (Organization Attendance tab)
 * 
 * Used for role-based tabs in attendance page.
 */
export function useAttendanceRole(): AttendanceRole {
  const role = useRole()
  const accessToken = useAuthStore((s) => s.accessToken)

  // Admin roles can view all attendance
  const isAdmin = role === 'owner' || role === 'admin' || role === 'hr_admin' || role === 'super_admin'

  // Decode JWT to check has_subordinate flag
  let hasSubordinate = false
  if (accessToken) {
    const claims = decodeJWT(accessToken)
    hasSubordinate = claims?.has_sub === true
  }

  // Can view team if: role="manager" OR has subordinates (from JWT)
  const canViewTeam = role === 'manager' || hasSubordinate

  return {
    canViewOwn: true, // Everyone can view their own attendance
    canViewTeam,
    canViewAll: isAdmin,
  }
}
