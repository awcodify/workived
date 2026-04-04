import axios, { AxiosInstance, AxiosError } from 'axios'
import * as SecureStore from 'expo-secure-store'
import type { 
  MobileHomeData, 
  AttendanceRecord, 
  ApiResponse, 
  LoginRequest, 
  LoginResponse,
  LeavePolicy,
  LeaveRequest,
  LeaveRequestResponse,
  LeaveRequestWithDetails,
  ClaimWithDetails
} from '@/types/api'

// TODO: Replace with your actual backend URL
const API_BASE_URL = __DEV__ 
  ? 'http://192.168.1.109:8080/api/v1' 
  : 'https://api.workived.com/api/v1'

class ApiClient {
  private client: AxiosInstance

  constructor() {
    this.client = axios.create({
      baseURL: API_BASE_URL,
      timeout: 10000,
      headers: {
        'Content-Type': 'application/json',
      },
    })

    // Request interceptor: Add auth token
    this.client.interceptors.request.use(
      async (config) => {
        const token = await SecureStore.getItemAsync('access_token')
        if (token) {
          config.headers.Authorization = `Bearer ${token}`
        }
        return config
      },
      (error) => Promise.reject(error)
    )

    // Response interceptor: Handle errors
    this.client.interceptors.response.use(
      (response) => response,
      async (error: AxiosError) => {
        if (error.response?.status === 401) {
          // Token expired, clear storage
          await SecureStore.deleteItemAsync('access_token')
          await SecureStore.deleteItemAsync('refresh_token')
          // TODO: Navigate to login screen
        }
        return Promise.reject(error)
      }
    )
  }

  // Auth
  async login(data: LoginRequest): Promise<LoginResponse> {
    const response = await this.client.post<{ data: LoginResponse }>('/auth/login', data)
    // Backend wraps response in { data: ... }
    return response.data.data
  }

  async logout(): Promise<void> {
    await this.client.post('/auth/logout')
    await SecureStore.deleteItemAsync('access_token')
    await SecureStore.deleteItemAsync('refresh_token')
  }

  // Mobile Home
  async getMobileHome(weekOffset: number = 0): Promise<MobileHomeData> {
    const response = await this.client.get<MobileHomeData>('/mobile/home', {
      params: { week_offset: weekOffset },
    })
    return response.data
  }

  // Attendance
  async clockIn(data: { note?: string; photo?: string; latitude?: number; longitude?: number }): Promise<ApiResponse<AttendanceRecord>> {
    const response = await this.client.post<ApiResponse<AttendanceRecord>>('/attendance/clock-in', data)
    return response.data
  }

  async clockOut(data: { note?: string; photo?: string; latitude?: number; longitude?: number }): Promise<ApiResponse<AttendanceRecord>> {
    const response = await this.client.post<ApiResponse<AttendanceRecord>>('/attendance/clock-out', data)
    return response.data
  }

  async getToday(employeeId: string): Promise<ApiResponse<AttendanceRecord>> {
    const response = await this.client.get<ApiResponse<AttendanceRecord>>(`/attendance/today/${employeeId}`)
    return response.data
  }

  // Leave
  async getLeavePolicies(): Promise<ApiResponse<LeavePolicy[]>> {
    const response = await this.client.get<ApiResponse<LeavePolicy[]>>('/leave/policies')
    return response.data
  }

  async applyLeave(data: LeaveRequest): Promise<ApiResponse<LeaveRequestResponse>> {
    const response = await this.client.post<ApiResponse<LeaveRequestResponse>>('/leave/requests', data)
    return response.data
  }

  async getMyLeaveRequests(): Promise<ApiResponse<LeaveRequestWithDetails[]>> {
    const response = await this.client.get<ApiResponse<LeaveRequestWithDetails[]>>('/leave/requests/me')
    return response.data
  }

  async getPendingApprovals(): Promise<ApiResponse<LeaveRequestWithDetails[]>> {
    const response = await this.client.get<ApiResponse<LeaveRequestWithDetails[]>>('/leave/requests?status=pending')
    return response.data
  }

  async approveLeaveRequest(requestId: string): Promise<ApiResponse<LeaveRequestWithDetails>> {
    const response = await this.client.post<ApiResponse<LeaveRequestWithDetails>>(`/leave/requests/${requestId}/approve`)
    return response.data
  }

  async rejectLeaveRequest(requestId: string, note?: string): Promise<ApiResponse<LeaveRequestWithDetails>> {
    const response = await this.client.post<ApiResponse<LeaveRequestWithDetails>>(`/leave/requests/${requestId}/reject`, { note })
    return response.data
  }

  async getApprovalCount(): Promise<{ count: number }> {
    const response = await this.client.get<{ count: number }>('/leave/notifications/count')
    return response.data
  }

  // Claims
  async getPendingClaims(): Promise<ApiResponse<ClaimWithDetails[]>> {
    const response = await this.client.get<ApiResponse<ClaimWithDetails[]>>('/claims?status=pending')
    return response.data
  }

  async approveClaim(claimId: string): Promise<ApiResponse<ClaimWithDetails>> {
    const response = await this.client.post<ApiResponse<ClaimWithDetails>>(`/claims/${claimId}/approve`)
    return response.data
  }

  async rejectClaim(claimId: string, note?: string): Promise<ApiResponse<ClaimWithDetails>> {
    const response = await this.client.post<ApiResponse<ClaimWithDetails>>(`/claims/${claimId}/reject`, { review_note: note })
    return response.data
  }
}

export const apiClient = new ApiClient()
