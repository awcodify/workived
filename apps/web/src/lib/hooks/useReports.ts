import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { AxiosError } from 'axios'
import { toast } from 'sonner'
import { reportsApi } from '@/lib/api/reports'
import type { ConfigUpdateInput } from '@/types/api'

interface ApiErrorResponse {
  error?: { message?: string }
}

export const reportsKeys = {
  all: ['reports'] as const,
  config: () => [...reportsKeys.all, 'config'] as const,
  myScorecard: (period: string) => [...reportsKeys.all, 'my-scorecard', period] as const,
  employeeScorecard: (employeeId: string, period: string) => [...reportsKeys.all, 'scorecard', employeeId, period] as const,
  teamScorecard: (period: string) => [...reportsKeys.all, 'team-scorecard', period] as const,
  summary: (period: string) => [...reportsKeys.all, 'summary', period] as const,
}

export function useScorecardConfig() {
  return useQuery({
    queryKey: reportsKeys.config(),
    queryFn: () => reportsApi.getConfig().then((r) => r.data.config),
    staleTime: 5 * 60 * 1000,
  })
}

export function useUpdateScorecardConfig() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: ConfigUpdateInput) =>
      reportsApi.updateConfig(data).then((r) => r.data.config),
    onSuccess: (config) => {
      qc.setQueryData(reportsKeys.config(), config)
      // Invalidate all scorecard data since weights changed
      qc.invalidateQueries({ queryKey: reportsKeys.all })
      toast.success('Scorecard configuration saved')
    },
    onError: (error: AxiosError<ApiErrorResponse>) => {
      const message = error.response?.data?.error?.message ?? 'Failed to save configuration'
      toast.error('Save failed', { description: message })
    },
  })
}

export function useEmployeeScorecard(employeeId: string | null, period: string) {
  return useQuery({
    queryKey: reportsKeys.employeeScorecard(employeeId ?? '', period),
    queryFn: () => reportsApi.getEmployeeScorecard(employeeId!, period).then((r) => r.data.scorecard),
    staleTime: 5 * 60 * 1000,
    enabled: !!employeeId && !!period,
  })
}

export function useMyScorecard(period: string) {
  return useQuery({
    queryKey: reportsKeys.myScorecard(period),
    queryFn: () => reportsApi.getMyScorecard(period).then((r) => r.data.scorecard),
    staleTime: 5 * 60 * 1000,
    enabled: !!period,
  })
}

export function useTeamScorecard(period: string) {
  return useQuery({
    queryKey: reportsKeys.teamScorecard(period),
    queryFn: () => reportsApi.getTeamScorecard(period).then((r) => r.data.team_scorecard),
    staleTime: 5 * 60 * 1000,
    enabled: !!period,
  })
}

export function useCompanySummary(period: string) {
  return useQuery({
    queryKey: reportsKeys.summary(period),
    queryFn: () => reportsApi.getCompanySummary(period).then((r) => r.data.summary),
    staleTime: 5 * 60 * 1000,
    enabled: !!period,
  })
}
