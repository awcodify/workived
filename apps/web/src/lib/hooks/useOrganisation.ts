import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { organisationsApi } from '@/lib/api/organisations'
import { useAuthStore } from '@/lib/stores/auth'
import type { UpdateOrgRequest, TransferOwnershipRequest } from '@/types/api'

export const orgKeys = {
  mine: ['organisation', 'mine'] as const,
  detail: ['organisation', 'detail'] as const,
}

export function useOrganisation() {
  const isAuthenticated = useAuthStore((s) => !!s.accessToken)

  return useQuery({
    queryKey: orgKeys.mine,
    queryFn: () => organisationsApi.getMine().then((r) => r.data.data),
    enabled: isAuthenticated,
    staleTime: 5 * 60 * 1000, // 5 min — org info rarely changes
  })
}

export function useOrgDetail() {
  const isAuthenticated = useAuthStore((s) => !!s.accessToken)

  return useQuery({
    queryKey: orgKeys.detail,
    queryFn: () => organisationsApi.getDetail().then((r) => r.data.data),
    enabled: isAuthenticated,
    staleTime: 30_000,
  })
}

export function useUpdateOrg() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (data: UpdateOrgRequest) =>
      organisationsApi.update(data).then((r) => r.data.data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: orgKeys.detail })
      queryClient.invalidateQueries({ queryKey: orgKeys.mine })
    },
  })
}

export function useTransferOwnership() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (data: TransferOwnershipRequest) =>
      organisationsApi.transferOwnership(data).then((r) => r.data.data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: orgKeys.detail })
    },
  })
}
