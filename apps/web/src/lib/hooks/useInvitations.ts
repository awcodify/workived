import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { organisationsApi } from '@/lib/api/organisations'
import type { InviteMemberRequest } from '@/types/api'
import { useAuthStore } from '@/lib/stores/auth'

export const invitationKeys = {
  list: ['invitations'] as const,
  unlinkedMembers: ['unlinked-members'] as const,
}

export function useInvitations() {
  const isAuthenticated = useAuthStore((s) => !!s.accessToken)

  return useQuery({
    queryKey: invitationKeys.list,
    queryFn: () => organisationsApi.listInvitations().then((r) => r.data.data),
    enabled: isAuthenticated,
  })
}

export function useInviteMember() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (data: InviteMemberRequest) =>
      organisationsApi.invite(data).then((r) => r.data.data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: invitationKeys.list })
    },
  })
}

export function useRevokeInvitation() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => organisationsApi.revokeInvitation(id).then((r) => r.data.data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: invitationKeys.list })
    },
  })
}

export function useUnlinkedMembers() {
  const isAuthenticated = useAuthStore((s) => !!s.accessToken)

  return useQuery({
    queryKey: invitationKeys.unlinkedMembers,
    queryFn: () => organisationsApi.listUnlinkedMembers().then((r) => r.data.data),
    enabled: isAuthenticated,
  })
}

