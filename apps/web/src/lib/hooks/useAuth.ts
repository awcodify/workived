import { useMutation } from '@tanstack/react-query'
import { useRouter } from '@tanstack/react-router'
import { useAuthStore } from '@/lib/stores/auth'

/**
 * useLogout — Hook to log out the current user
 * 
 * Clears local auth state and redirects to login.
 */
export function useLogout() {
  const router = useRouter()
  const logout = useAuthStore((s) => s.logout)

  return useMutation({
    mutationFn: async () => {
      await logout()
    },
    onSuccess: () => {
      // Redirect to login page
      router.navigate({ to: '/login' })
    },
  })
}
