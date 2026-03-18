import { apiClient } from './client'
import type { ApiResponse } from '@/types/api'

export interface Organisation {
  id: string
  name: string
  slug: string
  country_code: string
  timezone: string
  currency_code: string
  work_days: number[]
  plan: 'free' | 'pro' | 'enterprise'
  plan_employee_limit?: number
  is_active: boolean
}

export const organisationsApi = {
  getMine: () =>
    apiClient.get<ApiResponse<Organisation>>('/api/v1/organisations/me'),
}
