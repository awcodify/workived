import { useQuery } from '@tanstack/react-query'
import { organisationsApi } from '@/lib/api/organisations'
import { useAuthStore } from '@/lib/stores/auth'

export const orgKeys = {
  mine: ['organisation', 'mine'] as const,
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
