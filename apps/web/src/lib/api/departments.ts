import { apiClient } from './client'
import type { ApiResponse, Department } from '@/types/api'

export interface CreateDepartmentInput {
  name: string
  parent_id?: string
}

export interface UpdateDepartmentInput {
  name?: string
  parent_id?: string
}

export const departmentsApi = {
  list: () =>
    apiClient.get<ApiResponse<Department[]>>('/api/v1/departments'),

  create: (data: CreateDepartmentInput) =>
    apiClient.post<ApiResponse<Department>>('/api/v1/departments', data),

  update: (id: string, data: UpdateDepartmentInput) =>
    apiClient.put<ApiResponse<Department>>(`/api/v1/departments/${id}`, data),

  delete: (id: string) =>
    apiClient.delete<ApiResponse<{ message: string }>>(`/api/v1/departments/${id}`),
}
