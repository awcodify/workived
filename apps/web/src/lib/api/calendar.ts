import { apiClient } from './client'
import type { PublicHoliday, CreateCustomHolidayInput, ApiResponse } from '@/types/api'

interface HolidayListResponse {
  data: PublicHoliday[]
}

export const calendarApi = {
  listHolidays: (startDate: string, endDate: string) =>
    apiClient.get<HolidayListResponse>('/api/v1/calendar/holidays', {
      params: { start_date: startDate, end_date: endDate },
    }),

  listCustomHolidays: () =>
    apiClient.get<HolidayListResponse>('/api/v1/calendar/holidays/custom'),

  createCustomHoliday: (data: CreateCustomHolidayInput) =>
    apiClient.post<ApiResponse<PublicHoliday>>('/api/v1/calendar/holidays/custom', data),

  deleteCustomHoliday: (id: string) =>
    apiClient.delete(`/api/v1/calendar/holidays/custom/${id}`),
}
