import { apiClient } from './client'
import type {
  ScorecardConfig,
  ConfigUpdateInput,
  Scorecard,
  TeamScorecard,
  CompanySummary,
} from '@/types/api'

interface ConfigResponse {
  config: ScorecardConfig
}

interface ScorecardResponse {
  scorecard: Scorecard
}

interface TeamScorecardResponse {
  team_scorecard: TeamScorecard
}

interface SummaryResponse {
  summary: CompanySummary
}

export const reportsApi = {
  getConfig: () =>
    apiClient.get<ConfigResponse>('/api/v1/reports/config'),

  updateConfig: (data: ConfigUpdateInput) =>
    apiClient.put<ConfigResponse>('/api/v1/reports/config', data),

  getMyScorecard: (period: string) =>
    apiClient.get<ScorecardResponse>('/api/v1/reports/scorecard/me', { params: { period } }),

  getEmployeeScorecard: (employeeId: string, period: string) =>
    apiClient.get<ScorecardResponse>(`/api/v1/reports/scorecard/${employeeId}`, { params: { period } }),

  getTeamScorecard: (period: string) =>
    apiClient.get<TeamScorecardResponse>('/api/v1/reports/scorecard/team', { params: { period } }),

  getCompanySummary: (period: string) =>
    apiClient.get<SummaryResponse>('/api/v1/reports/summary', { params: { period } }),
}
