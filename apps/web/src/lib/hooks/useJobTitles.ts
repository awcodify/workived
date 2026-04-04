import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { jobTitlesApi, type JobTitle, type CreateJobTitleInput, type UpdateJobTitleInput } from '@/lib/api/jobtitles'

export const jobTitleKeys = {
  all: ['job-titles'] as const,
  lists: () => [...jobTitleKeys.all, 'list'] as const,
  list: () => [...jobTitleKeys.lists()] as const,
}

export function useJobTitles() {
  return useQuery({
    queryKey: jobTitleKeys.list(),
    queryFn: () => jobTitlesApi.list().then((r) => r.data.data),
    staleTime: 5 * 60 * 1000, // 5 min
  })
}

export function useSearchJobTitles(query: string) {
  return useQuery({
    queryKey: [...jobTitleKeys.all, 'search', query],
    queryFn: () => jobTitlesApi.search(query).then((r) => r.data.data),
    enabled: query.length > 0,
    staleTime: 30 * 1000, // 30 sec
  })
}

export function useCreateJobTitle() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: CreateJobTitleInput) => jobTitlesApi.create(data).then((r) => r.data.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: jobTitleKeys.lists() }),
  })
}

export function useUpdateJobTitle(id: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: UpdateJobTitleInput) => jobTitlesApi.update(id, data).then((r) => r.data.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: jobTitleKeys.lists() }),
  })
}

export function useDeleteJobTitle() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => jobTitlesApi.delete(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: jobTitleKeys.lists() }),
  })
}
