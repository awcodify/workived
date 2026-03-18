import { createFileRoute, Outlet, redirect } from '@tanstack/react-router'
import { useAuthStore } from '@/lib/stores/auth'
import { Dock } from '@/components/workived/dock/Dock'

export const Route = createFileRoute('/_app')({
  beforeLoad: () => {
    const { accessToken } = useAuthStore.getState()
    if (!accessToken) {
      throw redirect({ to: '/login' })
    }
  },
  component: AppLayout,
})

function AppLayout() {
  return (
    <div className="min-h-screen">
      <Outlet />
      <Dock />
    </div>
  )
}
