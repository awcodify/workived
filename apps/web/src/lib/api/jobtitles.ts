import { apiClient } from './client'
import type { ApiResponse } from '@/types/api'

export interface JobTitle {
  id: string
  organisation_id: string
  name: string
  is_active: boolean
  created_at: string
  updated_at: string
}

export interface CreateJobTitleInput {
  name: string
}

export interface UpdateJobTitleInput {
  name?: string
}

export const jobTitlesApi = {
  list: () =>
    apiClient.get<ApiResponse<JobTitle[]>>('/api/v1/job-titles'),

  search: (query: string) =>
    apiClient.get<ApiResponse<JobTitle[]>>('/api/v1/job-titles/search', { params: { q: query } }),

  create: (data: CreateJobTitleInput) =>
    apiClient.post<ApiResponse<JobTitle>>('/api/v1/job-titles', data),

  update: (id: string, data: UpdateJobTitleInput) =>
    apiClient.put<ApiResponse<JobTitle>>(`/api/v1/job-titles/${id}`, data),

  delete: (id: string) =>
    apiClient.delete<ApiResponse<{ message: string }>>(`/api/v1/job-titles/${id}`),
}
