import { createFileRoute, redirect } from '@tanstack/react-router'

export const Route = createFileRoute('/_app/reports/')({
  loader: () => {
    throw redirect({ to: '/reports/dashboards' })
  },
  component: () => null,
})
