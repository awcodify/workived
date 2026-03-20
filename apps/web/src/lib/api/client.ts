import axios from 'axios'
import { useAuthStore } from '@/lib/stores/auth'

export const apiClient = axios.create({
  baseURL: import.meta.env.VITE_API_URL ?? '',
  withCredentials: true, // Send httpOnly cookies (refresh_token)
})

apiClient.interceptors.request.use((config) => {
  const token = useAuthStore.getState().accessToken
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

let isRefreshing = false

apiClient.interceptors.response.use(
  (res) => res,
  async (error) => {
    const originalRequest = error.config
    
    // Don't retry if already retried or if it's a login/refresh request
    if (
      error.response?.status === 401 &&
      !originalRequest._retry &&
      !originalRequest.url?.includes('/auth/login') &&
      !originalRequest.url?.includes('/auth/refresh') &&
      !isRefreshing
    ) {
      originalRequest._retry = true
      isRefreshing = true
      
      try {
        const refreshed = await useAuthStore.getState().refresh()
        isRefreshing = false
        
        if (refreshed) {
          // Refresh succeeded - retry original request with new token
          return apiClient(originalRequest)
        } else {
          // Refresh failed - redirect to login
          window.location.href = '/login'
          return Promise.reject(error)
        }
      } catch (refreshError) {
        isRefreshing = false
        useAuthStore.getState().logout()
        window.location.href = '/login'
        return Promise.reject(error)
      }
    }
    
    return Promise.reject(error)
  },
)
