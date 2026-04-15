import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { dashboardApi } from '@/lib/api/dashboard'
import type { QueryConfig } from '@/types/api'

// ── Query keys ────────────────────────────────────────────────────────────────

export const dashboardKeys = {
  all: ['dashboards'] as const,
  lists: () => [...dashboardKeys.all, 'list'] as const,
  widgets: (dashboardId: string) => [...dashboardKeys.all, dashboardId, 'widgets'] as const,
  query: (config: QueryConfig) => [...dashboardKeys.all, 'query', config] as const,
}

// ── Dashboard hooks ───────────────────────────────────────────────────────────

export function useDashboards() {
  return useQuery({
    queryKey: dashboardKeys.lists(),
    queryFn: () => dashboardApi.listDashboards().then((r) => r.data.data ?? []),
    staleTime: 2 * 60 * 1000,
  })
}

export function useCreateDashboard() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: { name: string; is_default?: boolean }) =>
      dashboardApi.createDashboard(data).then((r) => r.data.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: dashboardKeys.lists() })
    },
  })
}

export function useUpdateDashboard() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, ...data }: { id: string; name: string; is_default?: boolean }) =>
      dashboardApi.updateDashboard(id, data).then((r) => r.data.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: dashboardKeys.lists() })
    },
  })
}

export function useDeleteDashboard() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => dashboardApi.deleteDashboard(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: dashboardKeys.lists() })
    },
  })
}

// ── Widget hooks ──────────────────────────────────────────────────────────────

export function useWidgets(dashboardId: string) {
  return useQuery({
    queryKey: dashboardKeys.widgets(dashboardId),
    queryFn: () => dashboardApi.listWidgets(dashboardId).then((r) => r.data.data ?? []),
    enabled: !!dashboardId,
    staleTime: 60 * 1000,
  })
}

export function useCreateWidget() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ dashboardId, ...data }: Parameters<typeof dashboardApi.createWidget>[1] & { dashboardId: string }) =>
      dashboardApi.createWidget(dashboardId, data).then((r) => r.data.data),
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: dashboardKeys.widgets(vars.dashboardId) })
    },
  })
}

export function useUpdateWidget() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({
      dashboardId,
      widgetId,
      ...data
    }: Parameters<typeof dashboardApi.updateWidget>[2] & { dashboardId: string; widgetId: string }) =>
      dashboardApi.updateWidget(dashboardId, widgetId, data).then((r) => r.data.data),
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: dashboardKeys.widgets(vars.dashboardId) })
    },
  })
}

export function useDeleteWidget() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ dashboardId, widgetId }: { dashboardId: string; widgetId: string }) =>
      dashboardApi.deleteWidget(dashboardId, widgetId),
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: dashboardKeys.widgets(vars.dashboardId) })
    },
  })
}

// ── Query execution hook ──────────────────────────────────────────────────────

export function useExecuteQuery(config: QueryConfig, enabled = true) {
  return useQuery({
    queryKey: dashboardKeys.query(config),
    queryFn: () => dashboardApi.executeQuery(config).then((r) => r.data.data),
    enabled: enabled && !!config.source,
    staleTime: 5 * 60 * 1000, // matches backend 5 min cache
    retry: false,
  })
}
