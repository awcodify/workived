import { createFileRoute, Outlet } from '@tanstack/react-router'

export const Route = createFileRoute('/_app/people')({
  component: PeopleLayout,
})

function PeopleLayout() {
  return <Outlet />
}
