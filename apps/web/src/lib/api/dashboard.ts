import { apiClient } from './client'
import type {
  Dashboard,
  Widget,
  QueryConfig,
  VizConfig,
  QueryResult,
  ApiResponse,
} from '@/types/api'

export const dashboardApi = {
  // ── Dashboards ────────────────────────────────────────────────────────────

  listDashboards: () =>
    apiClient.get<ApiResponse<Dashboard[]>>('/api/v1/dashboards'),

  createDashboard: (data: { name: string; is_default?: boolean }) =>
    apiClient.post<ApiResponse<Dashboard>>('/api/v1/dashboards', data),

  updateDashboard: (id: string, data: { name: string; is_default?: boolean }) =>
    apiClient.put<ApiResponse<Dashboard>>(`/api/v1/dashboards/${id}`, data),

  deleteDashboard: (id: string) =>
    apiClient.delete(`/api/v1/dashboards/${id}`),

  // ── Widgets ───────────────────────────────────────────────────────────────

  listWidgets: (dashboardId: string) =>
    apiClient.get<ApiResponse<Widget[]>>(`/api/v1/dashboards/${dashboardId}/widgets`),

  createWidget: (dashboardId: string, data: {
    title: string
    widget_type: string
    query_config: QueryConfig
    viz_config?: VizConfig
    position_x?: number
    position_y?: number
    width?: number
    height?: number
  }) =>
    apiClient.post<ApiResponse<Widget>>(`/api/v1/dashboards/${dashboardId}/widgets`, data),

  updateWidget: (dashboardId: string, widgetId: string, data: {
    title: string
    widget_type: string
    query_config: QueryConfig
    viz_config?: VizConfig
    position_x?: number
    position_y?: number
    width?: number
    height?: number
  }) =>
    apiClient.put<ApiResponse<Widget>>(`/api/v1/dashboards/${dashboardId}/widgets/${widgetId}`, data),

  deleteWidget: (dashboardId: string, widgetId: string) =>
    apiClient.delete(`/api/v1/dashboards/${dashboardId}/widgets/${widgetId}`),

  // ── Query ─────────────────────────────────────────────────────────────────

  executeQuery: (queryConfig: QueryConfig) =>
    apiClient.post<ApiResponse<QueryResult>>('/api/v1/dashboards/query', { query_config: queryConfig }),
}
