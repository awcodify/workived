import { useQuery } from '@tanstack/react-query'
import { auditApi } from '@/lib/api/audit'
import type { AuditLogFilters } from '@/types/api'

export const auditKeys = {
  all: ['audit-logs'] as const,
  lists: () => [...auditKeys.all, 'list'] as const,
  list: (filters?: AuditLogFilters) => [...auditKeys.lists(), filters] as const,
  resource: (type: string, id: string) => [...auditKeys.all, 'resource', type, id] as const,
}

export function useAuditLogs(filters?: AuditLogFilters) {
  return useQuery({
    queryKey: auditKeys.list(filters),
    queryFn: () => auditApi.list(filters).then((r) => r.data),
  })
}

export function useAuditLogsByResource(resourceType: string, resourceId: string) {
  return useQuery({
    queryKey: auditKeys.resource(resourceType, resourceId),
    queryFn: () => auditApi.getByResource(resourceType, resourceId).then((r) => r.data.data),
    enabled: !!resourceType && !!resourceId,
  })
}
