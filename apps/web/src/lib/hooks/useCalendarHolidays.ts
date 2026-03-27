import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { calendarApi } from '@/lib/api/calendar'
import type { CreateCustomHolidayInput } from '@/types/api'

const calendarKeys = {
  all: ['calendar'] as const,
  holidays: (startDate: string, endDate: string) =>
    [...calendarKeys.all, 'holidays', startDate, endDate] as const,
  customHolidays: () => [...calendarKeys.all, 'custom-holidays'] as const,
}

export function useCalendarHolidays(startDate: string, endDate: string) {
  return useQuery({
    queryKey: calendarKeys.holidays(startDate, endDate),
    queryFn: () => calendarApi.listHolidays(startDate, endDate).then((r) => r.data.data),
    staleTime: 30 * 60 * 1000,
    enabled: !!startDate && !!endDate,
  })
}

export function useCustomHolidays() {
  return useQuery({
    queryKey: calendarKeys.customHolidays(),
    queryFn: () => calendarApi.listCustomHolidays().then((r) => r.data.data),
    staleTime: 10 * 60 * 1000,
  })
}

export function useCreateCustomHoliday() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (data: CreateCustomHolidayInput) =>
      calendarApi.createCustomHoliday(data).then((r) => r.data.data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: calendarKeys.all })
    },
  })
}

export function useDeleteCustomHoliday() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => calendarApi.deleteCustomHoliday(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: calendarKeys.all })
    },
  })
}
