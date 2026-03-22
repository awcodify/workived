import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { AxiosError } from 'axios'
import { toast } from 'sonner'
import { useMemo } from 'react'
import { attendanceApi } from '@/lib/api/attendance'
import { useAttendanceRole } from './useAttendanceRole'

interface ApiErrorResponse {
  error?: { message?: string }
}

export const attendanceKeys = {
  all: ['attendance'] as const,
  today: (empId: string) => [...attendanceKeys.all, 'today', empId] as const,
  daily: (date: string) => [...attendanceKeys.all, 'daily', date] as const,
  monthly: (year: number, month: number) => [...attendanceKeys.all, 'monthly', year, month] as const,
  employeeMonthly: (empId: string, year: number, month: number) =>
    [...attendanceKeys.all, 'employee-monthly', empId, year, month] as const,
  myWeek: (startDate: string) => [...attendanceKeys.all, 'my-week', startDate] as const,
  teamWeek: (startDate: string) => [...attendanceKeys.all, 'team-week', startDate] as const,
  mySummary: (year: number, month: number) => [...attendanceKeys.all, 'my-summary', year, month] as const,
  teamSummary: (year: number, month: number) => [...attendanceKeys.all, 'team-summary', year, month] as const,
}

export function useAttendanceToday(employeeId: string) {
  return useQuery({
    queryKey: attendanceKeys.today(employeeId),
    queryFn: () => attendanceApi.getToday(employeeId).then((r) => r.data.data),
    enabled: !!employeeId,
    retry: false,
  })
}

export function useDailyReport(date: string) {
  return useQuery({
    queryKey: attendanceKeys.daily(date),
    queryFn: () => attendanceApi.dailyReport(date).then((r) => r.data.data),
    enabled: !!date,
  })
}

export function useMonthlyReport(year: number, month: number) {
  return useQuery({
    queryKey: attendanceKeys.monthly(year, month),
    queryFn: () => attendanceApi.monthlyReport(year, month).then((r) => r.data.data),
    enabled: year > 0 && month > 0,
  })
}

export function useClockIn() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: { note?: string }) =>
      attendanceApi.clockIn(data).then((r) => r.data.data),
    onSuccess: (data) => {
      // Immediately refetch all attendance queries
      qc.invalidateQueries({ queryKey: attendanceKeys.all })
      qc.refetchQueries({ queryKey: attendanceKeys.all })
      
      const time = new Date(data.clock_in_at).toLocaleTimeString('en', {
        hour: '2-digit',
        minute: '2-digit',
      })
      toast.success(`Clocked in at ${time}`, {
        description: data.is_late ? 'Marked as late' : 'On time',
      })
    },
    onError: (error: AxiosError<ApiErrorResponse>) => {
      const message = error.response?.data?.error?.message ?? 'Failed to clock in'
      toast.error('Clock in failed', { description: message })
    },
  })
}

export function useClockOut() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: { note?: string }) =>
      attendanceApi.clockOut(data).then((r) => r.data.data),
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: attendanceKeys.all })
      
      // Calculate hours worked today
      let hoursWorked = '0h 0m'
      if (data.clock_in_at && data.clock_out_at) {
        const clockIn = new Date(data.clock_in_at)
        const clockOut = new Date(data.clock_out_at)
        const diffMs = clockOut.getTime() - clockIn.getTime()
        const hours = Math.floor(diffMs / (1000 * 60 * 60))
        const minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60))
        hoursWorked = `${hours}h ${minutes}m`
      }
      
      toast.success('All done today', {
        description: `You worked ${hoursWorked} today`,
      })
    },
    onError: (error: AxiosError<ApiErrorResponse>) => {
      const message = error.response?.data?.error?.message ?? 'Failed to clock out'
      toast.error('Clock out failed', { description: message })
    },
  })
}

// ── Week calendar hooks (Sprint 12) ──────────────────────────────────────────

export function useMyWeek(startDate: string) {
  return useQuery({
    queryKey: attendanceKeys.myWeek(startDate),
    queryFn: () => attendanceApi.getMyWeek(startDate).then((r) => r.data.data),
    enabled: !!startDate,
    staleTime: 1000 * 30, // Consider data stale after 30 seconds
    refetchOnMount: 'always', // Always refetch when component mounts
  })
}

export function useTeamWeek(startDate: string, enabled: boolean = true) {
  return useQuery({
    queryKey: attendanceKeys.teamWeek(startDate),
    queryFn: () => attendanceApi.getTeamWeek(startDate).then((r) => r.data.data),
    enabled: enabled && !!startDate,
  })
}

export function useAllWeek(startDate: string, enabled: boolean = true) {
  return useQuery({
    queryKey: [...attendanceKeys.all, 'week', startDate],
    queryFn: () => attendanceApi.getAllWeek(startDate).then((r) => r.data.data),
    enabled: enabled && !!startDate,
  })
}

export function useMySummary(year: number, month: number) {
  return useQuery({
    queryKey: attendanceKeys.mySummary(year, month),
    queryFn: () => attendanceApi.getMySummary(year, month).then((r) => r.data.data),
    enabled: year > 0 && month > 0,
  })
}

export function useTeamSummary(year: number, month: number) {
  return useQuery({
    queryKey: attendanceKeys.teamSummary(year, month),
    queryFn: () => attendanceApi.getTeamSummary(year, month).then((r) => r.data.data),
    enabled: year > 0 && month > 0,
  })
}

/**
 * Role-based hook for today's attendance.
 * - Admins: See all employees' attendance for today
 * - Managers: See their team's attendance for today
 * - Employees: See empty array (use useMyWeek for own data)
 * 
 * Returns data in DailyEntry format for compatibility with Overview page.
 */
export function useTodayAttendance(weekStart: string, today: string) {
  const role = useAttendanceRole()
  
  // Conditionally call hooks based on role to avoid 403 errors
  const teamWeekQuery = useTeamWeek(weekStart, role.canViewTeam)
  const allWeekQuery = useAllWeek(weekStart, role.canViewAll)
  
  // Select the appropriate query based on role
  const activeQuery = role.canViewAll ? allWeekQuery : role.canViewTeam ? teamWeekQuery : null
  
  // Extract today's data from week entries
  const todayData = useMemo(() => {
    if (!activeQuery?.data) return []
    
    // Map TeamWeekEntry[] to DailyEntry[] format for today
    return activeQuery.data
      .map((emp: any) => {
        const dayData = emp.week?.days.find((d: any) => d.date === today)
        if (!dayData) return null
        
        // Ensure required fields are present
        if (!emp.employee_id || !emp.employee_name || !dayData.status) return null
        
        // Map week status to daily status format
        // Week: "on-time" | "late" | "absent" | "weekend" | "future" | "on_leave" | "overtime"
        // Daily: "present" | "late" | "absent" | "on_leave"
        let mappedStatus: 'present' | 'late' | 'absent' | 'on_leave'
        if (dayData.status === 'on-time') {
          mappedStatus = 'present'
        } else if (dayData.status === 'late') {
          mappedStatus = 'late'
        } else if (dayData.status === 'on_leave') {
          mappedStatus = 'on_leave'
        } else if (dayData.status === 'overtime') {
          mappedStatus = 'present' // Overtime shows as present in overview
        } else {
          // "absent", "weekend", "future" → all map to "absent"
          mappedStatus = 'absent'
        }
        
        return {
          employee_id: emp.employee_id,
          employee_name: emp.employee_name,
          status: mappedStatus,
          clock_in_at: dayData.clock_in_at ?? null,
          clock_out_at: dayData.clock_out_at ?? null,
          is_late: dayData.is_late ?? false,
          note: dayData.note ?? null,
        }
      })
      .filter((entry): entry is NonNullable<typeof entry> => entry !== null)
  }, [activeQuery?.data, today])
  
  return {
    data: todayData,
    isLoading: activeQuery?.isLoading ?? false,
    error: activeQuery?.error ?? null,
  }
}
