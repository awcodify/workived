import { useRole, useHasSubordinate } from './useRole'

export interface AttendanceRole {
  canViewOwn: boolean
  canViewTeam: boolean
  canViewAll: boolean
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
  const hasSubordinate = useHasSubordinate()

  // Admin roles can view all attendance
  const isAdmin = role === 'owner' || role === 'admin' || role === 'hr_admin' || role === 'super_admin'

  // Can view team if: role="manager" OR has subordinates (from JWT)
  const canViewTeam = role === 'manager' || hasSubordinate

  return {
    canViewOwn: true, // Everyone can view their own attendance
    canViewTeam,
    canViewAll: isAdmin,
  }
}
