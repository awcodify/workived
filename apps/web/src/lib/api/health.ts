import { apiClient } from './client'

export interface HealthStatus {
  status: string
}

/**
 * Check backend connectivity via /api/v1/health.
 */
export async function getHealthStatus(): Promise<HealthStatus> {
  const { data } = await apiClient.get<HealthStatus>('/api/health', {
    timeout: 2000,
  })
  return data
}
