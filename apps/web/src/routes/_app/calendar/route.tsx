import { createFileRoute, Outlet } from '@tanstack/react-router'

export const Route = createFileRoute('/_app/calendar')({
  component: CalendarLayout,
})

function CalendarLayout() {
  return <Outlet />
}
