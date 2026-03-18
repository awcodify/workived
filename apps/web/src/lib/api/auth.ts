import { apiClient } from './client'
import type {
  LoginRequest,
  LoginResponse,
  RegisterRequest,
  RefreshResponse,
  ApiResponse,
  User,
} from '@/types/api'

export const authApi = {
  register: (data: RegisterRequest) =>
    apiClient.post<ApiResponse<User>>('/api/v1/auth/register', data),

  login: (data: LoginRequest) =>
    apiClient.post<ApiResponse<LoginResponse>>('/api/v1/auth/login', data),

  // Refresh token is sent via httpOnly cookie automatically
  refresh: () =>
    apiClient.post<ApiResponse<RefreshResponse>>('/api/v1/auth/refresh'),

  // Logout — invalidates refresh token
  logout: () =>
    apiClient.post<ApiResponse<null>>('/api/v1/auth/logout'),
}
