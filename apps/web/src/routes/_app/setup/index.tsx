import { createFileRoute } from '@tanstack/react-router'
import { SetupWizard } from '@/components/workived/setup/SetupWizard'
import { colors } from '@/design/tokens'

export const Route = createFileRoute('/_app/setup/')({
  component: SetupPage,
})

function SetupPage() {
  return (
    <div className="flex min-h-screen items-center justify-center" style={{ background: colors.ink50 }}>
      <div className="w-full max-w-4xl px-6 py-12">
        <SetupWizard />
      </div>
    </div>
  )
}
