import { apiClient } from './client'
import type {
  AttendanceRecord,
  AttendanceCorrection,
  SubmitCorrectionRequest,
  DailyEntry,
  MonthlySummary,
  WeekCalendar,
  TeamWeekEntry,
  WorkScheduleListItem,
  WorkScheduleInput,
  ApiResponse,
} from '@/types/api'

export const attendanceApi = {
  clockIn: (data: { note?: string }) =>
    apiClient.post<ApiResponse<AttendanceRecord>>('/api/v1/attendance/clock-in', data),

  clockOut: (data: { note?: string }) =>
    apiClient.post<ApiResponse<AttendanceRecord>>('/api/v1/attendance/clock-out', data),

  getToday: (employeeId: string) =>
    apiClient.get<ApiResponse<AttendanceRecord>>(`/api/v1/attendance/today/${employeeId}`),

  dailyReport: (date: string) =>
    apiClient.get<ApiResponse<DailyEntry[]>>('/api/v1/attendance/daily', { params: { date } }),

  monthlyReport: (year: number, month: number) =>
    apiClient.get<ApiResponse<MonthlySummary[]>>('/api/v1/attendance/monthly', { params: { year, month } }),

  employeeMonthly: (employeeId: string, year: number, month: number) =>
    apiClient.get<ApiResponse<MonthlySummary>>(`/api/v1/attendance/monthly/${employeeId}`, { params: { year, month } }),

  // Week calendar endpoints (Sprint 12)
  getMyWeek: (startDate: string) =>
    apiClient.get<ApiResponse<WeekCalendar>>('/api/v1/attendance/my/week', { params: { start_date: startDate } }),

  getTeamWeek: (startDate: string) =>
    apiClient.get<ApiResponse<TeamWeekEntry[]>>('/api/v1/attendance/team/week', { params: { start_date: startDate } }),

  getAllWeek: (startDate: string) =>
    apiClient.get<ApiResponse<TeamWeekEntry[]>>('/api/v1/attendance/all/week', { params: { start_date: startDate } }),

  getMySummary: (year: number, month: number) =>
    apiClient.get<ApiResponse<MonthlySummary>>('/api/v1/attendance/my/summary', { params: { year, month } }),

  getTeamSummary: (year: number, month: number) =>
    apiClient.get<ApiResponse<MonthlySummary[]>>('/api/v1/attendance/team/summary', { params: { year, month } }),

  listWorkSchedules: () =>
    apiClient.get<ApiResponse<WorkScheduleListItem[]>>('/api/v1/attendance/work-schedules'),

  createWorkSchedule: (data: WorkScheduleInput) =>
    apiClient.post<ApiResponse<WorkScheduleListItem>>('/api/v1/attendance/work-schedules', data),

  updateWorkSchedule: (id: string, data: WorkScheduleInput) =>
    apiClient.put<ApiResponse<WorkScheduleListItem>>(`/api/v1/attendance/work-schedules/${id}`, data),

  deactivateWorkSchedule: (id: string) =>
    apiClient.patch(`/api/v1/attendance/work-schedules/${id}/deactivate`),

  countEmployeesBySchedule: (id: string) =>
    apiClient.get<ApiResponse<{ count: number }>>(`/api/v1/attendance/work-schedules/${id}/employees-count`),

  getLocationAnalytics: (period: 'this_week' | 'this_month') =>
    apiClient.get<ApiResponse<import('@/types/api').LocationAnalytics>>('/api/v1/attendance/analytics/locations', { params: { period } }),

  // Corrections
  submitCorrection: (data: SubmitCorrectionRequest) =>
    apiClient.post<ApiResponse<AttendanceCorrection>>('/api/v1/attendance/corrections', data),

  listCorrections: (status?: string) =>
    apiClient.get<ApiResponse<AttendanceCorrection[]>>('/api/v1/attendance/corrections', { params: status ? { status } : undefined }),

  approveCorrection: (id: string) =>
    apiClient.patch<ApiResponse<AttendanceCorrection>>(`/api/v1/attendance/corrections/${id}/approve`),

  rejectCorrection: (id: string, rejection_reason?: string) =>
    apiClient.patch<ApiResponse<AttendanceCorrection>>(`/api/v1/attendance/corrections/${id}/reject`, { rejection_reason }),
}
