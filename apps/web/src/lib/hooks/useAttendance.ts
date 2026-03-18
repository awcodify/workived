import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
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
    mutationFn: (data: { note?: string }) =>
      attendanceApi.clockIn(data).then((r) => r.data.data),
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: attendanceKeys.all })
      const time = new Date(data.clock_in_at).toLocaleTimeString('en', {
        hour: '2-digit',
        minute: '2-digit',
      })
      toast.success(`Clocked in at ${time}`, {
        description: data.is_late ? 'Marked as late' : 'On time',
      })
    },
    onError: (error: any) => {
      const message = error?.response?.data?.error?.message || 'Failed to clock in'
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
    onError: (error: any) => {
      const message = error?.response?.data?.error?.message || 'Failed to clock out'
      toast.error('Clock out failed', { description: message })
    },
  })
}
