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
    if (error.response?.status === 401 && !isRefreshing) {
      isRefreshing = true
      try {
        await useAuthStore.getState().refresh()
        isRefreshing = false
        return apiClient(error.config)
      } catch {
        isRefreshing = false
        useAuthStore.getState().logout()
        window.location.href = '/login'
        return Promise.reject(error)
      }
    }
    return Promise.reject(error)
  },
)
