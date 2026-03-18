import { apiClient } from './client'
import type {
  Employee,
  CreateEmployeeInput,
  UpdateEmployeeInput,
  ListParams,
  CursorMeta,
  ApiResponse,
} from '@/types/api'

// Employee list response: {"data": Employee[], "meta": {next_cursor, has_more, limit}}
interface EmployeeListResponse {
  data: Employee[]
  meta: CursorMeta
}

export const employeesApi = {
  list: (params?: ListParams) =>
    apiClient.get<EmployeeListResponse>('/api/v1/employees', { params }),

  me: () =>
    apiClient.get<ApiResponse<Employee>>('/api/v1/employees/me'),

  get: (id: string) =>
    apiClient.get<ApiResponse<Employee>>(`/api/v1/employees/${id}`),

  create: (data: CreateEmployeeInput) =>
    apiClient.post<ApiResponse<Employee>>('/api/v1/employees', data),

  update: (id: string, data: UpdateEmployeeInput) =>
    apiClient.put<ApiResponse<Employee>>(`/api/v1/employees/${id}`, data),
}
