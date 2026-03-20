import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { employeesApi } from '@/lib/api/employees'
import type { ListParams, CreateEmployeeInput, UpdateEmployeeInput } from '@/types/api'

export const employeeKeys = {
  all: ['employees'] as const,
  me: () => [...employeeKeys.all, 'me'] as const,
  lists: () => [...employeeKeys.all, 'list'] as const,
  list: (params?: ListParams) => [...employeeKeys.lists(), params] as const,
  details: () => [...employeeKeys.all, 'detail'] as const,
  detail: (id: string) => [...employeeKeys.details(), id] as const,
}

export function useMyEmployee() {
  return useQuery({
    queryKey: employeeKeys.me(),
    queryFn: () => employeesApi.me().then((r) => r.data.data),
    staleTime: 5 * 60 * 1000, // 5 min — rarely changes
    retry: false,
  })
}

export function useEmployees(params?: ListParams) {
  return useQuery({
    queryKey: employeeKeys.list(params),
    queryFn: () => employeesApi.list(params).then((r) => r.data),
  })
}

export function useEmployee(id: string) {
  return useQuery({
    queryKey: employeeKeys.detail(id),
    queryFn: () => employeesApi.get(id).then((r) => r.data.data),
    enabled: !!id,
  })
}

export function useCreateEmployee() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: CreateEmployeeInput) => employeesApi.create(data).then((r) => r.data.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: employeeKeys.lists() }),
  })
}

export function useUpdateEmployee(id: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: UpdateEmployeeInput) => employeesApi.update(id, data).then((r) => r.data.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: employeeKeys.lists() })
      qc.invalidateQueries({ queryKey: employeeKeys.detail(id) })
    },
  })
}

export function useOrgChart() {
  return useQuery({
    queryKey: ['employees', 'org-chart'],
    queryFn: () => employeesApi.orgChart().then((r) => r.data.data),
    staleTime: 5 * 60 * 1000, // 5 minutes
  })
}
