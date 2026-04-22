import { createFileRoute, redirect } from '@tanstack/react-router'
import { useAuthStore } from '@/lib/stores/auth'

export const Route = createFileRoute('/')({
  beforeLoad: () => {
    // Check for OAuth access token in URL fragment (from Google OAuth redirect)
    if (typeof window !== 'undefined' && window.location.hash) {
      const params = new URLSearchParams(window.location.hash.substring(1))
      const accessToken = params.get('access_token')
      const isExisting = params.get('existing') === 'true'
      
      if (accessToken) {
        // TODO: We need user info - for now just store token
        // In production, you'd fetch user info from /api/v1/auth/me
        useAuthStore.getState().setAuth({
          access_token: accessToken,
          user: null as any, // Temporary - should fetch user info
        })

        // Redirect to overview and remove token from URL
        window.history.replaceState({}, '', '/')

        if (isExisting) {
          throw redirect({ to: '/welcome-back' })
        }
        throw redirect({ to: '/overview' })
      }
    }

    const { accessToken } = useAuthStore.getState()
    if (accessToken) {
      throw redirect({ to: '/overview' })
    } else {
      throw redirect({ to: '/login', search: { redirect: undefined } })
    }
  },
})
