import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { attendanceApi } from '@/lib/api/attendance'

export const attendanceKeys = {
  all: ['attendance'] as const,
  today: (empId: string) => [...attendanceKeys.all, 'today', empId] as const,
  daily: (date: string) => [...attendanceKeys.all, 'daily', date] as const,
  monthly: (year: number, month: number) => [...attendanceKeys.all, 'monthly', year, month] as const,
  employeeMonthly: (empId: string, year: number, month: number) =>
    [...attendanceKeys.all, 'employee-monthly', empId, year, month] as const,
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
    mutationFn: (data: { employee_id: string; note?: string }) =>
      attendanceApi.clockIn(data).then((r) => r.data.data),
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: attendanceKeys.today(vars.employee_id) })
      qc.invalidateQueries({ queryKey: attendanceKeys.all })
    },
  })
}

export function useClockOut() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: { employee_id: string; note?: string }) =>
      attendanceApi.clockOut(data).then((r) => r.data.data),
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: attendanceKeys.today(vars.employee_id) })
      qc.invalidateQueries({ queryKey: attendanceKeys.all })
    },
  })
}
