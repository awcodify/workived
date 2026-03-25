import { createFileRoute, Outlet, redirect, useMatches } from '@tanstack/react-router'
import { useAuthStore } from '@/lib/stores/auth'
import { Dock } from '@/components/workived/dock/Dock'
import { LoadingBar } from '@/components/workived/shared/LoadingBar'
import { getSetupStatus } from '@/lib/api/setup'

export const Route = createFileRoute('/_app')({
  beforeLoad: async ({ location }) => {
    const { accessToken } = useAuthStore.getState()
    if (!accessToken) {
      throw redirect({ to: '/login', search: { redirect: undefined } })
    }

    // Setup wizard guard: redirect to /setup if setup is needed and not skipped
    // Allow access to /setup itself to avoid infinite redirect
    if (location.pathname !== '/setup') {
      const setupStatus = await getSetupStatus()
      if (setupStatus.needs_setup && !setupStatus.skipped) {
        throw redirect({ to: '/setup' })
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

  return (
    <div className="min-h-screen">
      <LoadingBar />
      <Outlet />
      {!isSetupPage && <Dock />}
    </div>
  )
}
