import { apiClient } from './client'

// ── Feature Flags (Public) ──────────────────────────────────────────────────

export const features = {
  // Get enabled features for current user's org
  getEnabled: async (): Promise<Record<string, boolean>> => {
    const res = await apiClient.get<{ data: Record<string, boolean> }>('/api/v1/features')
    return res.data.data
  },
}
