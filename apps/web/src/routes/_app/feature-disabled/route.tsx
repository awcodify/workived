import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/_app/feature-disabled')({
  component: RouteComponent,
})

function RouteComponent() {
  return <div>Hello "/_app/feature-disabled"!</div>
}
