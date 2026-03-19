import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { organisationsApi } from '@/lib/api/organisations'
import type { InviteMemberRequest } from '@/types/api'
import { useAuthStore } from '@/lib/stores/auth'

export const invitationKeys = {
  list: ['invitations'] as const,
  unlinkedMembers: ['unlinked-members'] as const,
  members: ['org-members'] as const,
  mine: ['my-invitations'] as const,
}

export function useInvitations() {
  const isAuthenticated = useAuthStore((s) => !!s.accessToken)

  return useQuery({
    queryKey: invitationKeys.list,
    queryFn: () => organisationsApi.listInvitations().then((r) => r.data.data),
    enabled: isAuthenticated,
    staleTime: 30 * 1000, // 30 seconds - invitations can be accepted by others
    refetchOnWindowFocus: true, // Auto-refetch when user returns to the page
    refetchInterval: 60 * 1000, // Auto-refetch every minute while page is visible
  })
}

export function useInviteMember() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (data: InviteMemberRequest) =>
      organisationsApi.invite(data).then((r) => r.data.data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: invitationKeys.list })
      // Invalidate member list too — a new invite may change unlinked state
      queryClient.invalidateQueries({ queryKey: invitationKeys.members })
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

// Invitations addressed to the current user — used on the setup-org / onboarding page.
// Does NOT require tenant context (user may have no org yet).
export function useMyInvitations() {
  const isAuthenticated = useAuthStore((s) => !!s.accessToken)

  return useQuery({
    queryKey: invitationKeys.mine,
    queryFn: () => organisationsApi.getMyInvitations().then((r) => r.data.data),
    enabled: isAuthenticated,
    staleTime: 15_000,
  })
}

export function useMembers() {
  const isAuthenticated = useAuthStore((s) => !!s.accessToken)

  return useQuery({
    queryKey: invitationKeys.members,
    queryFn: () => organisationsApi.listMembers().then((r) => r.data.data),
    enabled: isAuthenticated,
  })
}
