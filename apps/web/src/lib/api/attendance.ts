import { apiClient } from './client'
import type {
  AttendanceRecord,
  DailyEntry,
  MonthlySummary,
  WeekCalendar,
  TeamWeekEntry,
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
}
