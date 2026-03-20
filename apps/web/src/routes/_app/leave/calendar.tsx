import { createFileRoute, redirect } from '@tanstack/react-router'

// Redirect old /leave/calendar to the new top-level /calendar route
export const Route = createFileRoute('/_app/leave/calendar')({
  beforeLoad: () => {
    throw redirect({ to: '/calendar' })
  },
})
