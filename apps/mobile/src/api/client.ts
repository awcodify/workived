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
  ClaimWithDetails,
  EmployeeProfile,
  DirectReport,
  ClaimCategory,
  SubmitClaimRequest,
  ClaimResponse,
  ClaimBalanceWithCategory,
  PresignResponse,
  LocationAnalytics,
} from '@/types/api'

// TODO: Replace with your actual backend URL
const API_BASE_URL = __DEV__ 
  ? 'http://10.11.1.60:8080/api/v1' 
  : 'https://my.workived.com/api/v1'

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
    const response = await this.client.post<ApiResponse<AttendanceRecord>>('/attendance/clock-in', {
      note: data.note,
      latitude: data.latitude,
      longitude: data.longitude,
      photo_url: data.photo,
    })
    return response.data
  }

  async clockOut(data: { note?: string; photo?: string; latitude?: number; longitude?: number }): Promise<ApiResponse<AttendanceRecord>> {
    const response = await this.client.post<ApiResponse<AttendanceRecord>>('/attendance/clock-out', {
      note: data.note,
      latitude: data.latitude,
      longitude: data.longitude,
      photo_url: data.photo,
    })
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

  async getClaimCategories(): Promise<ApiResponse<ClaimCategory[]>> {
    const response = await this.client.get<ApiResponse<ClaimCategory[]>>('/claims/categories')
    return response.data
  }

  async submitClaim(data: SubmitClaimRequest): Promise<ApiResponse<ClaimResponse>> {
    // Create FormData for multipart upload (receipt photo)
    const formData = new FormData()
    formData.append('category_id', data.category_id)
    formData.append('amount', data.amount.toString())
    formData.append('currency_code', data.currency_code)
    formData.append('description', data.description)
    formData.append('claim_date', data.claim_date)
    
    if (data.receipt) {
      formData.append('receipt', data.receipt)
    }

    const response = await this.client.post<ApiResponse<ClaimResponse>>('/claims', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    })
    return response.data
  }

  async getMyClaims(): Promise<ApiResponse<ClaimWithDetails[]>> {
    const response = await this.client.get<ApiResponse<ClaimWithDetails[]>>('/claims/me')
    return response.data
  }

  async getClaimBalances(): Promise<ApiResponse<ClaimBalanceWithCategory[]>> {
    const response = await this.client.get<ApiResponse<ClaimBalanceWithCategory[]>>('/claims/balances/me')
    return response.data
  }

  // Employee Profile
  async getMyProfile(): Promise<ApiResponse<EmployeeProfile>> {
    const response = await this.client.get<ApiResponse<EmployeeProfile>>('/employees/me')
    return response.data
  }

  async getDirectReports(employeeId: string): Promise<ApiResponse<DirectReport[]>> {
    const response = await this.client.get<ApiResponse<DirectReport[]>>(`/employees/${employeeId}/directs`)
    return response.data
  }

  // Location Analytics
  async getLocationAnalytics(period: 'this_week' | 'this_month'): Promise<ApiResponse<LocationAnalytics>> {
    const response = await this.client.get<ApiResponse<LocationAnalytics>>('/attendance/analytics/locations', {
      params: { period },
    })
    return response.data
  }

  // Uploads
  async presignUpload(purpose: 'clock_in' | 'clock_out', contentType: 'image/jpeg' | 'image/png' = 'image/jpeg'): Promise<PresignResponse> {
    const response = await this.client.post<{ data: PresignResponse }>('/uploads/presign', {
      purpose,
      content_type: contentType,
    })
    return response.data.data
  }

  /**
   * Uploads a photo from a local URI to S3 via presigned URL.
   * Returns the S3 key to be sent with the clock-in/out request.
   *
   * Uses XMLHttpRequest to read the local file:// URI as a blob —
   * React Native's fetch() cannot read local file paths.
   */
  async uploadPhoto(localUri: string, purpose: 'clock_in' | 'clock_out'): Promise<string> {
    const { upload_url, key } = await this.presignUpload(purpose)

    const photoBlob = await new Promise<Blob>((resolve, reject) => {
      const xhr = new XMLHttpRequest()
      xhr.onload = () => resolve(xhr.response as Blob)
      xhr.onerror = () => reject(new Error('Failed to read photo from local URI'))
      xhr.responseType = 'blob'
      xhr.open('GET', localUri)
      xhr.send(null)
    })

    await fetch(upload_url, {
      method: 'PUT',
      headers: { 'Content-Type': 'image/jpeg' },
      body: photoBlob,
    })

    return key
  }
}

export const apiClient = new ApiClient()
