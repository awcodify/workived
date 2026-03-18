import { createFileRoute, redirect } from '@tanstack/react-router'
import { useAuthStore } from '@/lib/stores/auth'

export const Route = createFileRoute('/')({
  beforeLoad: () => {
    const { accessToken } = useAuthStore.getState()
    if (accessToken) {
      throw redirect({ to: '/overview' })
    } else {
      throw redirect({ to: '/login' })
    }
  },
})
