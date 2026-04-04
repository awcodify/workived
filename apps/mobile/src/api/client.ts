import axios, { AxiosInstance, AxiosError } from 'axios'
import * as SecureStore from 'expo-secure-store'
import type { MobileHomeData, AttendanceRecord, ApiResponse, LoginRequest, LoginResponse } from '@/types/api'

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
  async getMobileHome(): Promise<MobileHomeData> {
    const response = await this.client.get<MobileHomeData>('/mobile/home')
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
}

export const apiClient = new ApiClient()
