import { createFileRoute, Outlet } from '@tanstack/react-router'

export const Route = createFileRoute('/_app/attendance')({
  component: AttendanceLayout,
})

function AttendanceLayout() {
  return <Outlet />
}
