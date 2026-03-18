import { apiClient } from './client'
import type { LoginRequest, LoginResponse, RefreshResponse, ApiResponse } from '@/types/api'

export const authApi = {
  login: (data: LoginRequest) =>
    apiClient.post<ApiResponse<LoginResponse>>('/api/v1/auth/login', data),

  // Refresh token is sent via httpOnly cookie automatically
  refresh: () =>
    apiClient.post<ApiResponse<RefreshResponse>>('/api/v1/auth/refresh'),

  // Logout — invalidates refresh token
  logout: () =>
    apiClient.post<ApiResponse<null>>('/api/v1/auth/logout'),
}
