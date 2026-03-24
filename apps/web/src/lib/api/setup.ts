import { apiClient } from './client'
import type {
  ApiResponse,
  SetupStatus,
  SetupTemplatesResponse,
  CompleteSetupRequest,
  CompleteSetupResponse,
} from '@/types/api'

/**
 * Get the current setup wizard status for the organization
 */
export async function getSetupStatus(): Promise<SetupStatus> {
  const { data } = await apiClient.get<ApiResponse<SetupStatus>>('/api/v1/setup/status')
  if (!data?.data) {
    throw new Error('Invalid response format from setup status endpoint')
  }
  return data.data
}

/**
 * Get all available templates (work schedules, leave policies, claim categories)
 * for the organization's country
 */
export async function getSetupTemplates(): Promise<SetupTemplatesResponse> {
  const { data } = await apiClient.get<ApiResponse<SetupTemplatesResponse>>('/api/v1/setup/templates')
  if (!data?.data) {
    throw new Error('Invalid response format from setup templates endpoint')
  }
  return data.data
}

/**
 * Complete the setup wizard by creating work schedule, policies, categories,
 * and optionally inviting team members
 */
export async function completeSetup(
  request: CompleteSetupRequest,
): Promise<CompleteSetupResponse> {
  const { data } = await apiClient.post<ApiResponse<CompleteSetupResponse>>(
    '/api/v1/setup/complete',
    request,
  )
  if (!data?.data) {
    throw new Error('Invalid response format from setup complete endpoint')
  }
  return data.data
}

/**
 * Skip the setup wizard (user can complete it later)
 */
export async function skipSetup(): Promise<void> {
  await apiClient.post('/api/v1/setup/skip')
}
