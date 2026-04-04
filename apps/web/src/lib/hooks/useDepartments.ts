import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { departmentsApi, type CreateDepartmentInput, type UpdateDepartmentInput } from '@/lib/api/departments'
import type { Department } from '@/types/api'

export const departmentKeys = {
  all: ['departments'] as const,
  lists: () => [...departmentKeys.all, 'list'] as const,
  list: () => [...departmentKeys.lists()] as const,
}

export function useDepartments() {
  return useQuery({
    queryKey: departmentKeys.list(),
    queryFn: () => departmentsApi.list().then((r) => r.data.data),
    staleTime: 5 * 60 * 1000, // 5 min
  })
}

export function useCreateDepartment() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: CreateDepartmentInput) => departmentsApi.create(data).then((r) => r.data.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: departmentKeys.lists() }),
  })
}

export function useUpdateDepartment(id: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: UpdateDepartmentInput) => departmentsApi.update(id, data).then((r) => r.data.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: departmentKeys.lists() }),
  })
}

export function useDeleteDepartment() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => departmentsApi.delete(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: departmentKeys.lists() }),
  })
}
