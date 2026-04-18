import { apiClient } from './client'
import type {
  Announcement,
  CreateAnnouncementRequest,
  UpdateAnnouncementRequest,
  ApiResponse,
} from '@/types/api'

export const announcementsApi = {
  list: () =>
    apiClient.get<ApiResponse<Announcement[]>>('/api/v1/announcements'),

  listAdmin: () =>
    apiClient.get<ApiResponse<Announcement[]>>('/api/v1/announcements/admin'),

  unreadCount: () =>
    apiClient.get<ApiResponse<{ count: number }>>('/api/v1/announcements/unread-count'),

  create: (data: CreateAnnouncementRequest) =>
    apiClient.post<ApiResponse<Announcement>>('/api/v1/announcements', data),

  update: (id: string, data: UpdateAnnouncementRequest) =>
    apiClient.put<ApiResponse<Announcement>>(`/api/v1/announcements/${id}`, data),

  delete: (id: string) =>
    apiClient.delete(`/api/v1/announcements/${id}`),

  publish: (id: string) =>
    apiClient.patch<ApiResponse<Announcement>>(`/api/v1/announcements/${id}/publish`),

  pin: (id: string) =>
    apiClient.patch<ApiResponse<Announcement>>(`/api/v1/announcements/${id}/pin`),

  unpin: (id: string) =>
    apiClient.patch<ApiResponse<Announcement>>(`/api/v1/announcements/${id}/unpin`),

  markRead: (id: string) =>
    apiClient.post(`/api/v1/announcements/${id}/read`),
}
