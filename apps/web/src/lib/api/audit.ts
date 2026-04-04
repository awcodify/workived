import { apiClient } from './client'
import type { AuditLog, AuditLogFilters, ApiResponse } from '@/types/api'

interface AuditLogListResponse {
  data: AuditLog[]
  meta: {
    limit: number
    offset: number
  }
}

export const auditApi = {
  list: (filters?: AuditLogFilters) =>
    apiClient.get<AuditLogListResponse>('/api/v1/audit-logs', { params: filters }),

  getByResource: (resourceType: string, resourceId: string) =>
    apiClient.get<ApiResponse<AuditLog[]>>(`/api/v1/audit-logs/resource/${resourceType}/${resourceId}`),
}
