import { createFileRoute, Link } from '@tanstack/react-router'
import { useAuthStore } from '@/lib/stores/auth'
import { useOrganisation } from '@/lib/hooks/useOrganisation'
import { useEmployees } from '@/lib/hooks/useEmployees'
import { useDailyReport } from '@/lib/hooks/useAttendance'
import { todayISO } from '@/lib/utils/date'
import { moduleBackgrounds } from '@/design/tokens'
import { Avatar } from '@/components/workived/layout/Avatar'
import { StatusSquare } from '@/components/workived/layout/StatusSquare'
import { QuickClock } from '@/components/workived/attendance/QuickClock'
import { ArrowRight, Clock, Users, CalendarDays } from 'lucide-react'

export const Route = createFileRoute('/_app/overview')({
  component: OverviewPage,
})

function OverviewPage() {
  const user = useAuthStore((s) => s.user)
  const { data: org } = useOrganisation()
  const tz = org?.timezone ?? 'UTC'
  const today = todayISO(tz)

  const { data: employees } = useEmployees({ limit: 100 })
  const { data: daily } = useDailyReport(today)

  const totalEmployees = employees?.data?.length ?? 0
  const present = daily?.filter((e) => e.status === 'present').length ?? 0
  const late = daily?.filter((e) => e.status === 'late').length ?? 0
  const absent = daily?.filter((e) => e.status === 'absent').length ?? 0

  const firstName = user?.full_name?.split(' ')[0] ?? 'there'

  // Recent arrivals (who clocked in today)
  const arrivals = (daily ?? []).filter((e) => e.status === 'present' || e.status === 'late')
  // Who's absent
  const absentees = (daily ?? []).filter((e) => e.status === 'absent')

  // Dummy upcoming events
  const upcomingEvents = [
    { label: 'Team standup', time: '09:30 AM', type: 'meeting' },
    { label: 'Siti — Annual leave', time: 'Mar 20–21', type: 'leave' },
    { label: 'Adi — Probation review', time: 'Mar 25', type: 'review' },
  ]

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

      {/* Stat cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-8">
        <StatCard label="Employees" value={totalEmployees} color="#6357E8" />
        <StatCard label="Present" value={present} color="#12A05C" />
        <StatCard label="Late" value={late} color="#C97B2A" />
        <StatCard label="Absent" value={absent} color="#D44040" />
      </div>

      {/* Quick Clock */}
      <div className="mt-8">
        <QuickClock variant="dark" />
      </div>

      {/* Today's attendance */}
      <div className="mt-4">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-bold text-white/80 flex items-center gap-2">
            <Clock size={14} />
            Today&apos;s attendance
          </h2>
          <Link
            to="/attendance"
            className="text-xs text-white/40 hover:text-white/70 flex items-center gap-1"
          >
            View all <ArrowRight size={12} />
          </Link>
        </div>

        {arrivals.length > 0 ? (
          <div className="space-y-1.5">
            {arrivals.slice(0, 5).map((e) => (
              <div key={e.employee_id} className="flex items-center gap-3 bg-white/6 rounded-xl px-4 py-2.5">
                <Avatar name={e.employee_name} id={e.employee_id} size={28} />
                <span className="text-sm text-white/80 flex-1 truncate">{e.employee_name}</span>
                <StatusSquare status={e.status} />
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-white/30 bg-white/5 rounded-xl px-4 py-6 text-center">
            No one has clocked in yet today
          </p>
        )}

        {absentees.length > 0 && (
          <div className="mt-3 bg-white/5 rounded-xl px-4 py-3">
            <p className="text-xs text-white/40 mb-2">Not clocked in</p>
            <div className="flex flex-wrap gap-2">
              {absentees.slice(0, 8).map((e) => (
                <div key={e.employee_id} className="flex items-center gap-1.5 bg-white/6 rounded-lg px-2.5 py-1">
                  <Avatar name={e.employee_name} id={e.employee_id} size={18} />
                  <span className="text-xs text-white/60">{e.employee_name.split(' ')[0]}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Quick links + upcoming */}
      <div className="grid md:grid-cols-2 gap-4 mt-8">
        {/* Quick actions */}
        <div>
          <h2 className="text-sm font-bold text-white/80 mb-3">Quick actions</h2>
          <div className="space-y-2">
            <Link
              to="/people"
              className="flex items-center gap-3 bg-white/6 hover:bg-white/10 rounded-xl px-4 py-3 transition-colors"
            >
              <Users size={18} className="text-accent-mid" />
              <span className="text-sm text-white/80">Manage employees</span>
              <ArrowRight size={14} className="text-white/30 ml-auto" />
            </Link>
            <Link
              to="/attendance/monthly"
              className="flex items-center gap-3 bg-white/6 hover:bg-white/10 rounded-xl px-4 py-3 transition-colors"
            >
              <CalendarDays size={18} className="text-ok" />
              <span className="text-sm text-white/80">Monthly attendance report</span>
              <ArrowRight size={14} className="text-white/30 ml-auto" />
            </Link>
          </div>
        </div>

        {/* Upcoming events (dummy) */}
        <div>
          <h2 className="text-sm font-bold text-white/80 mb-3">Coming up</h2>
          <div className="space-y-2">
            {upcomingEvents.map((evt, i) => (
              <div key={i} className="flex items-center gap-3 bg-white/6 rounded-xl px-4 py-3">
                <div
                  className="w-1.5 h-1.5 rounded-full flex-shrink-0"
                  style={{
                    background:
                      evt.type === 'meeting' ? '#6357E8' :
                      evt.type === 'leave' ? '#C97B2A' : '#12A05C',
                  }}
                />
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-white/80 truncate">{evt.label}</p>
                  <p className="text-xs text-white/40">{evt.time}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
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
