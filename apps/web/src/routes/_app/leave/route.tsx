import { createFileRoute, Outlet } from '@tanstack/react-router'

export const Route = createFileRoute('/_app/leave')({
  component: LeaveLayout,
})

function LeaveLayout() {
  return <Outlet />
}
