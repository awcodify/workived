import { createFileRoute, Outlet, redirect } from '@tanstack/react-router'
import { useAuthStore } from '@/lib/stores/auth'
import { authApi } from '@/lib/api/auth'

export const Route = createFileRoute('/_auth')({
  beforeLoad: async ({ location }) => {
    const { accessToken } = useAuthStore.getState()
    
    // Public routes (no auth needed)
    const publicRoutes = ['/login', '/register', '/invite', '/forgot-password', '/reset-password']
    if (publicRoutes.includes(location.pathname)) {
      return
    }

    // Routes that only need login (not verification)
    const loginOnlyRoutes = ['/verify-email-required']
    if (loginOnlyRoutes.includes(location.pathname)) {
      if (!accessToken) {
        throw redirect({ to: '/login', search: { redirect: undefined } })
      }
      return
    }

    // All other _auth routes (setup-org, etc): need logged in + verified
    if (!accessToken) {
      throw redirect({ to: '/login', search: { redirect: undefined } })
    }

    // Fetch fresh verification status from backend (never trust cached state)
    try {
      const { data } = await authApi.checkVerificationStatus()
      if (!data.data.is_verified) {
        throw redirect({ to: '/verify-email-required' })
      }
    } catch (err: any) {
      // Handle specific error types
      if (err?.response?.status === 403 || err?.response?.status === 401) {
        // User exists but needs verification
        throw redirect({ to: '/verify-email-required' })
      }
      // Network error or 5xx - backend is down
      if (!err?.response || err?.response?.status >= 500) {
        throw redirect({ to: '/service-unavailable' })
      }
      // Other errors - let them propagate
      throw err
    }
  },
  component: AuthLayout,
})

function AuthLayout() {
  return (
    <div className="min-h-screen flex">
      <Outlet />
    </div>
  )
}
