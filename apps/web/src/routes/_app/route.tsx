import { createFileRoute, Outlet, redirect, useMatches, isRedirect } from '@tanstack/react-router'
import { useAuthStore } from '@/lib/stores/auth'
import { Dock } from '@/components/workived/dock/Dock'
import { LoadingBar } from '@/components/workived/shared/LoadingBar'
import { PWAInstallPrompt } from '@/components/workived/pwa/PWAInstallPrompt'
import { IOSInstallBanner } from '@/components/workived/pwa/IOSInstallBanner'
import { PWAUpdatePrompt } from '@/components/workived/pwa/PWAUpdatePrompt'
import { usePWAInstall } from '@/lib/hooks/usePWA'
import { getSetupStatus } from '@/lib/api/setup'
import { isAxiosError } from 'axios'

export const Route = createFileRoute('/_app')({
  beforeLoad: async ({ location }) => {
    const { accessToken } = useAuthStore.getState()
    if (!accessToken) {
      throw redirect({ to: '/login', search: { redirect: undefined } })
    }

    // Setup wizard guard: redirect to /setup if setup is needed and not skipped
    // Allow access to /setup itself to avoid infinite redirect
    if (location.pathname !== '/setup') {
      try {
        const setupStatus = await getSetupStatus()
        if (setupStatus.needs_setup && !setupStatus.skipped) {
          throw redirect({ to: '/setup' })
        }
      } catch (err) {
        // Re-throw TanStack Router redirects (from the setup check above)
        if (isRedirect(err)) throw err
        // If user has no org (403 from tenant middleware), send to setup-org
        // where they can accept invitations or create a workspace
        if (isAxiosError(err) && err.response?.status === 403) {
          throw redirect({ to: '/setup-org' })
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

  // Initialise PWA install prompt listeners
  usePWAInstall()

  return (
    <div className="min-h-screen">
      <LoadingBar />
      <PWAUpdatePrompt />
      <Outlet />
      {!isSetupPage && (
        <>
          <Dock />
          <PWAInstallPrompt />
          <IOSInstallBanner />
        </>
      )}
    </div>
  )
}
