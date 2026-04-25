import { createFileRoute, Outlet, redirect, useMatches, isRedirect } from '@tanstack/react-router'
import { useEffect } from 'react'
import { useAuthStore } from '@/lib/stores/auth'
import { authApi } from '@/lib/api/auth'
import { Dock } from '@/components/workived/dock/Dock'
import { LoadingBar } from '@/components/workived/shared/LoadingBar'
import { UpgradeModal } from '@/components/workived/shared/UpgradeModal'
import { TourOverlay } from '@/components/workived/tour/TourOverlay'
import { useTourStore } from '@/lib/stores/tour'
import { getSetupStatus } from '@/lib/api/setup'
import { isAxiosError } from 'axios'

export const Route = createFileRoute('/_app')({
  beforeLoad: async ({ location }) => {
    const { accessToken } = useAuthStore.getState()
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

    // Setup wizard guard: redirect to /setup if setup is needed and not skipped
    // Allow access to /setup itself to avoid infinite redirect
    if (location.pathname !== '/setup') {
      try {
        const setupStatus = await getSetupStatus()
        if (setupStatus.needs_setup && !setupStatus.skipped) {
          throw redirect({ to: '/setup' })
        }
      } catch (err: any) {
        // Re-throw TanStack Router redirects (from the setup check above)
        if (isRedirect(err)) throw err
        
        // If user has no org (403 from tenant middleware), send to setup-org
        // where they can accept invitations or create a workspace
        if (err.response?.status === 403) {
          throw redirect({ to: '/setup-org' })
        }
        
        // Network error or 5xx - backend is down
        if (err.response?.status >= 500) {
          throw redirect({ to: '/service-unavailable' })
        }
        
        // For other errors (network failures, etc), also go to service-unavailable
        if (!err.response) {
          throw redirect({ to: '/service-unavailable' })
        }
        
        throw err
      }
    }
  },
  component: AppLayout,
})

function AppLayout() {
  const matches = useMatches()
  const isSetupPage = matches.some(match =>
    match.pathname.startsWith('/setup')
  )
  const pathname = matches[matches.length - 1]?.pathname ?? '/'

  // Auto-trigger tour for first-time users on overview page
  const { hasCompleted, isActive, startTour } = useTourStore()
  useEffect(() => {
    if (!hasCompleted && !isActive && pathname === '/overview' && !isSetupPage) {
      const timer = setTimeout(startTour, 800)
      return () => clearTimeout(timer)
    }
  }, [hasCompleted, isActive, pathname, isSetupPage, startTour])

  return (
    <div className="min-h-screen">
      <LoadingBar />
      <UpgradeModal />
      <Outlet />
      {!isSetupPage && (
        <>
          <Dock />
          <TourOverlay />
        </>
      )}
    </div>
  )
}
