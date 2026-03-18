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

apiClient.interceptors.response.use(
  (res) => res,
  async (error) => {
    if (error.response?.status === 401 && !error.config._retry) {
      error.config._retry = true
      const refreshed = await useAuthStore.getState().refresh()
      if (refreshed) return apiClient(error.config)
    }
    return Promise.reject(error)
  },
)
