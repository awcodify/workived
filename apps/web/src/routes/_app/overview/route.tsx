import { createFileRoute } from '@tanstack/react-router'
import { useAuthStore } from '@/lib/stores/auth'
import { useOrganisation } from '@/lib/hooks/useOrganisation'
import { useEmployees } from '@/lib/hooks/useEmployees'
import { useDailyReport } from '@/lib/hooks/useAttendance'
import { todayISO } from '@/lib/utils/date'
import { moduleBackgrounds } from '@/design/tokens'

export const Route = createFileRoute('/_app/overview')({
  component: OverviewPage,
})

function OverviewPage() {
  const user = useAuthStore((s) => s.user)
  const { data: org } = useOrganisation()
  const tz = org?.timezone ?? 'UTC'
  const today = todayISO(tz)

  const { data: employees } = useEmployees({ per_page: 1 })
  const { data: daily } = useDailyReport(today)

  const totalEmployees = employees?.meta?.total ?? 0
  const present = daily?.filter((e) => e.status === 'present').length ?? 0
  const late = daily?.filter((e) => e.status === 'late').length ?? 0
  const absent = daily?.filter((e) => e.status === 'absent').length ?? 0

  const firstName = user?.full_name?.split(' ')[0] ?? 'there'

  return (
    <div
      className="min-h-screen px-6 py-8 md:px-11 md:py-10"
      style={{ background: moduleBackgrounds.overview }}
    >
      <h1 className="text-3xl md:text-4xl font-extrabold tracking-tighter text-white">
        Good morning,
        <br />
        {firstName}
      </h1>
      <p className="text-sm text-white/50 mt-2">
        {org?.name ?? 'Your organisation'}
      </p>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-8">
        <StatCard label="Employees" value={totalEmployees} color="#6357E8" />
        <StatCard label="Present" value={present} color="#12A05C" />
        <StatCard label="Late" value={late} color="#C97B2A" />
        <StatCard label="Absent" value={absent} color="#D44040" />
      </div>
    </div>
  )
}

function StatCard({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="bg-white/8 border border-white/10 rounded-xl p-4">
      <p className="text-2xl font-extrabold tracking-tight text-white">{value}</p>
      <p className="text-xs font-medium mt-1" style={{ color }}>
        {label}
      </p>
    </div>
  )
}
