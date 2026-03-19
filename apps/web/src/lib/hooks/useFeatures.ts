import { useQuery } from '@tanstack/react-query'
import { features } from '@/lib/api/features'

// Hook to get enabled features for current org
export function useEnabledFeatures() {
  return useQuery({
    queryKey: ['features', 'enabled'],
    queryFn: () => features.getEnabled(),
    staleTime: 5 * 60 * 1000, // 5 minutes
  })
}
