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
  ApiResponse,
  CursorMeta,
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

  listRequests: (params?: { status?: string; year?: number }) =>
    apiClient.get<RequestListResponse>('/api/v1/leave/requests', {
      params,
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
  getCalendar: (year: number, month: number) =>
    apiClient.get<CalendarResponse>('/api/v1/leave/calendar', {
      params: { year, month },
    }),
}
