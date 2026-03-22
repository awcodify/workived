import { apiClient } from './client'
import type {
  LeavePolicy,
  LeaveBalanceWithPolicy,
  LeaveRequest,
  LeaveRequestWithDetails,
  CreatePolicyInput,
  UpdatePolicyInput,
  SubmitRequestInput,
  ReviewInput,
  CalendarEntry,
  PublicHoliday,
  ApiResponse,
  CursorMeta,
  PolicyTemplate,
  ImportPoliciesResult,
} from '@/types/api'

// ── Response Types ───────────────────────────────────────────
interface PolicyListResponse {
  data: LeavePolicy[]
  meta?: CursorMeta
}

interface BalanceListResponse {
  data: LeaveBalanceWithPolicy[]
  meta?: CursorMeta
}

interface RequestListResponse {
  data: LeaveRequestWithDetails[]
  meta?: CursorMeta
}

interface CalendarResponse {
  data: CalendarEntry[]
}

interface HolidayListResponse {
  data: PublicHoliday[]
}

// ── API Client ───────────────────────────────────────────────
export const leaveApi = {
  // ── Policies ───────────────────────────────────────────────
  listPolicies: () =>
    apiClient.get<PolicyListResponse>('/api/v1/leave/policies'),

  createPolicy: (data: CreatePolicyInput) =>
    apiClient.post<ApiResponse<LeavePolicy>>('/api/v1/leave/policies', data),

  updatePolicy: (id: string, data: UpdatePolicyInput) =>
    apiClient.put<ApiResponse<LeavePolicy>>(`/api/v1/leave/policies/${id}`, data),

  deactivatePolicy: (id: string) =>
    apiClient.delete(`/api/v1/leave/policies/${id}`),

  // ── Balances ───────────────────────────────────────────────
  listBalances: (year?: number) =>
    apiClient.get<BalanceListResponse>('/api/v1/leave/balances', {
      params: year ? { year } : undefined,
    }),

  myBalances: (year?: number) =>
    apiClient.get<BalanceListResponse>('/api/v1/leave/balances/me', {
      params: year ? { year } : undefined,
    }),

  // ── Requests ───────────────────────────────────────────────
  submitRequest: (data: SubmitRequestInput) =>
    apiClient.post<ApiResponse<LeaveRequest>>('/api/v1/leave/requests', data),

  getRequest: (id: string) =>
    apiClient.get<ApiResponse<LeaveRequestWithDetails>>(`/api/v1/leave/requests/${id}`),

  listRequests: (params?: { status?: string; year?: number }) =>
    apiClient.get<RequestListResponse>('/api/v1/leave/requests', {
      params,
    }),

  // Get on-leave employees for a specific date
  getOnLeaveByDate: (date: string) =>
    apiClient.get<RequestListResponse>('/api/v1/leave/requests', {
      params: { status: 'approved', date },
    }),

  myRequests: () =>
    apiClient.get<RequestListResponse>('/api/v1/leave/requests/me'),

  approveRequest: (id: string, data?: ReviewInput) =>
    apiClient.post<ApiResponse<LeaveRequest>>(
      `/api/v1/leave/requests/${id}/approve`,
      data || {},
    ),

  rejectRequest: (id: string, data: ReviewInput) =>
    apiClient.post<ApiResponse<LeaveRequest>>(
      `/api/v1/leave/requests/${id}/reject`,
      data,
    ),

  cancelRequest: (id: string) =>
    apiClient.post<ApiResponse<LeaveRequest>>(
      `/api/v1/leave/requests/${id}/cancel`,
    ),

  // ── Calendar ───────────────────────────────────────────────

  listHolidays: (startDate: string, endDate: string) =>
    apiClient.get<HolidayListResponse>('/api/v1/leave/holidays', {
      params: { start_date: startDate, end_date: endDate },
    }),
  getCalendar: (year: number, month: number) =>
    apiClient.get<CalendarResponse>('/api/v1/leave/calendar', {
      params: { year, month },
    }),

  // ── Notifications ──────────────────────────────────────────
  getNotificationCount: () =>
    apiClient.get<ApiResponse<{ count: number }>>('/api/v1/leave/notifications/count'),

  // ── Templates ──────────────────────────────────────────────
  listTemplates: (countryCode?: string) =>
    apiClient.get<ApiResponse<PolicyTemplate[]>>('/api/v1/leave/templates', {
      params: countryCode ? { country_code: countryCode } : undefined,
    }),

  importPolicies: (templateIds: string[]) =>
    apiClient.post<ApiResponse<ImportPoliciesResult>>(
      '/api/v1/leave/policies/import',
      { template_ids: templateIds },
    ),
}
