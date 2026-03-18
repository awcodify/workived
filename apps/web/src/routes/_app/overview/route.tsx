import { createFileRoute, Link } from '@tanstack/react-router'
import { useState, useEffect } from 'react'
import { useAuthStore } from '@/lib/stores/auth'
import { useOrganisation } from '@/lib/hooks/useOrganisation'
import { useEmployees, useMyEmployee } from '@/lib/hooks/useEmployees'
import { useDailyReport } from '@/lib/hooks/useAttendance'
import { todayISO, formatDate } from '@/lib/utils/date'
import { moduleBackgrounds, typography } from '@/design/tokens'
import { Avatar } from '@/components/workived/layout/Avatar'
import { QuickClock } from '@/components/workived/attendance/QuickClock'
import { ArrowRight, Clock, Users, CalendarDays, LogIn } from 'lucide-react'

export const Route = createFileRoute('/_app/overview')({
  component: OverviewPage,
})

function useGreeting() {
  const hour = new Date().getHours()
  if (hour < 12) return 'Good morning,'
  if (hour < 17) return 'Good afternoon,'
  return 'Good evening,'
}

function useLiveClock(tz: string) {
  const [time, setTime] = useState(() => formatTime(tz))
  useEffect(() => {
    const id = setInterval(() => setTime(formatTime(tz)), 1000)
    return () => clearInterval(id)
  }, [tz])
  return time
}

function formatTime(tz: string) {
  return new Intl.DateTimeFormat('en', {
    timeZone: tz,
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }).format(new Date())
}

function formatDateLabel(tz: string) {
  const now = new Date()
  const day = new Intl.DateTimeFormat('en', { timeZone: tz, weekday: 'long' }).format(now).toUpperCase()
  const date = new Intl.DateTimeFormat('en', { timeZone: tz, day: 'numeric', month: 'long', year: 'numeric' }).format(now).toUpperCase()
  return `${day} \u00B7 ${date}`
}

function OverviewPage() {
  const user = useAuthStore((s) => s.user)
  const { data: myEmployee } = useMyEmployee()
  const { data: org, isLoading: orgLoading } = useOrganisation()
  const tz = org?.timezone ?? 'UTC'
  const today = todayISO(tz)

  const { data: employees, isLoading: empLoading } = useEmployees({ limit: 100 })
  const { data: daily, isLoading: dailyLoading } = useDailyReport(today)

  const totalEmployees = employees?.data?.length ?? 0
  const present = daily?.filter((e) => e.status === 'present').length ?? 0
  const late = daily?.filter((e) => e.status === 'late').length ?? 0
  const absent = daily?.filter((e) => e.status === 'absent').length ?? 0

  const fullName = user?.full_name ?? myEmployee?.full_name
  const firstName = fullName?.split(' ')[0] ?? 'there'

  const greeting = useGreeting()
  const clock = useLiveClock(tz)

  const arrivals = (daily ?? []).filter((e) => e.status === 'present' || e.status === 'late')
  const absentees = (daily ?? []).filter((e) => e.status === 'absent')

  const isLoading = orgLoading || empLoading || dailyLoading

  return (
    <div
      className="min-h-screen px-6 py-8 md:px-11 md:py-10"
      style={{ background: moduleBackgrounds.overview }}
    >
      {/* Date label */}
      <p
        className="uppercase"
        style={{
          fontSize: 11,
          fontWeight: 600,
          color: 'rgba(255,255,255,0.3)',
          letterSpacing: '0.12em',
          lineHeight: 1.4,
        }}
      >
        {formatDateLabel(tz)}
      </p>

      {/* Greeting */}
      <h1
        className="mt-3"
        style={{
          fontSize: 44,
          fontWeight: 800,
          letterSpacing: '-0.05em',
          lineHeight: 1,
          color: '#FFFFFF',
        }}
      >
        {greeting}
        <br />
        <span style={{ color: '#9B8FF7' }}>{firstName}</span>
      </h1>

      {/* Live clock */}
      <p
        className="mt-2"
        style={{
          fontFamily: typography.fontMono,
          fontSize: 13,
          color: 'rgba(255,255,255,0.22)',
        }}
      >
        {clock}
      </p>

      {/* Metrics strip */}
      {isLoading ? (
        <MetricsStripSkeleton />
      ) : (
        <div className="flex mt-8 overflow-hidden" style={{ borderRadius: 16 }}>
          <MetricCell label="EMPLOYEES" value={totalEmployees} color="#9B8FF7" position="first" />
          <MetricCell label="PRESENT" value={present} color="#12A05C" position="middle" />
          <MetricCell label="LATE" value={late} color="#C97B2A" position="middle" />
          <MetricCell label="ABSENT" value={absent} color="#D44040" position="last" />
        </div>
      )}

      {/* Quick Clock */}
      <div className="mt-8">
        <QuickClock variant="dark" />
      </div>

      {/* Activity feed — Today's attendance */}
      <div className="mt-4">
        <SectionLabel icon={<Clock size={14} />} label="TODAY'S ATTENDANCE">
          <Link
            to="/attendance"
            className="text-xs flex items-center gap-1 transition-colors"
            style={{ color: 'rgba(255,255,255,0.4)' }}
            onMouseEnter={(e) => { e.currentTarget.style.color = 'rgba(255,255,255,0.7)' }}
            onMouseLeave={(e) => { e.currentTarget.style.color = 'rgba(255,255,255,0.4)' }}
          >
            View all <ArrowRight size={12} />
          </Link>
        </SectionLabel>

        {isLoading ? (
          <ActivitySkeleton />
        ) : arrivals.length > 0 ? (
          <div>
            {arrivals.slice(0, 5).map((e, i) => (
              <div key={e.employee_id}>
                <div className="flex items-center gap-3 px-4 py-3">
                  <div
                    className="grid place-items-center flex-shrink-0"
                    style={{
                      width: 36,
                      height: 36,
                      borderRadius: 10,
                      background: e.status === 'late' ? 'rgba(201,123,42,0.15)' : 'rgba(18,160,92,0.15)',
                    }}
                  >
                    <LogIn size={16} style={{ color: e.status === 'late' ? '#C97B2A' : '#12A05C' }} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.6)' }}>
                      <span className="font-semibold text-white">{e.employee_name}</span>{' '}
                      clocked in
                      {e.status === 'late' && <span style={{ color: '#C97B2A' }}> (late)</span>}
                    </p>
                  </div>
                  {e.clock_in_at && (
                    <span
                      style={{
                        fontFamily: typography.fontMono,
                        fontSize: 11,
                        color: 'rgba(255,255,255,0.2)',
                      }}
                    >
                      {formatDate(e.clock_in_at, tz, 'time')}
                    </span>
                  )}
                </div>
                {i < Math.min(arrivals.length, 5) - 1 && (
                  <div className="mx-4" style={{ height: 1, background: 'rgba(255,255,255,0.05)' }} />
                )}
              </div>
            ))}
          </div>
        ) : (
          <div
            className="text-center py-8"
            style={{
              background: 'rgba(255,255,255,0.03)',
              borderRadius: 14,
              border: '1px solid rgba(255,255,255,0.06)',
            }}
          >
            <div
              className="grid place-items-center mx-auto mb-3"
              style={{ width: 48, height: 48, borderRadius: 14, background: 'rgba(255,255,255,0.06)' }}
            >
              <Clock size={22} style={{ color: 'rgba(255,255,255,0.3)' }} />
            </div>
            <p className="font-bold" style={{ fontSize: 15, color: 'rgba(255,255,255,0.6)' }}>
              No clock-ins yet today
            </p>
            <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.25)' }}>
              Records appear here as employees check in.
            </p>
          </div>
        )}

        {/* Absent list */}
        {absentees.length > 0 && (
          <div
            className="mt-3 px-4 py-3"
            style={{
              background: 'rgba(255,255,255,0.03)',
              borderRadius: 14,
              border: '1px solid rgba(255,255,255,0.06)',
            }}
          >
            <p
              className="uppercase mb-2"
              style={{
                fontSize: 10,
                fontWeight: 700,
                color: 'rgba(255,255,255,0.25)',
                letterSpacing: '0.1em',
              }}
            >
              Not clocked in
            </p>
            <div className="flex flex-wrap gap-2">
              {absentees.slice(0, 8).map((e) => (
                <div
                  key={e.employee_id}
                  className="flex items-center gap-1.5 px-2.5 py-1"
                  style={{ background: 'rgba(255,255,255,0.04)', borderRadius: 8 }}
                >
                  <Avatar name={e.employee_name} id={e.employee_id} size={18} />
                  <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.5)' }}>
                    {e.employee_name.split(' ')[0]}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Quick actions + upcoming */}
      <div className="grid md:grid-cols-2 gap-4 mt-8">
        <div>
          <SectionLabel icon={null} label="QUICK ACTIONS" />
          <div className="space-y-[3px]">
            <QuickAction to="/people" icon={<Users size={18} />} iconColor="#8F86F0" label="Manage employees" />
            <QuickAction to="/attendance/monthly" icon={<CalendarDays size={18} />} iconColor="#12A05C" label="Monthly attendance report" />
          </div>
        </div>

        <div>
          <SectionLabel icon={null} label="COMING UP" />
          <div className="space-y-[3px]">
            {[
              { label: 'Team standup', time: '09:30 AM', color: '#6357E8' },
              { label: 'Siti \u2014 Annual leave', time: 'Mar 20\u201321', color: '#C97B2A' },
              { label: 'Adi \u2014 Probation review', time: 'Mar 25', color: '#12A05C' },
            ].map((evt, i) => (
              <div
                key={i}
                className="flex items-center gap-3 px-4 py-3"
                style={{
                  background: 'rgba(255,255,255,0.03)',
                  borderRadius: 12,
                }}
              >
                <div
                  className="flex-shrink-0"
                  style={{ width: 7, height: 7, borderRadius: 2, background: evt.color }}
                />
                <div className="flex-1 min-w-0">
                  <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.6)' }} className="truncate">
                    {evt.label}
                  </p>
                  <p
                    style={{
                      fontFamily: typography.fontMono,
                      fontSize: 11,
                      color: 'rgba(255,255,255,0.2)',
                    }}
                  >
                    {evt.time}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Subcomponents ──────────────────────────────────────────────

function MetricCell({
  label,
  value,
  color,
  position,
}: {
  label: string
  value: number
  color: string
  position: 'first' | 'middle' | 'last'
}) {
  return (
    <div
      className="flex-1"
      style={{
        padding: '26px 24px',
        background: 'rgba(255,255,255,0.03)',
        border: '1px solid rgba(255,255,255,0.06)',
        marginLeft: position === 'first' ? 0 : -1,
      }}
    >
      <p style={{ fontSize: 46, fontWeight: 800, color, lineHeight: 1, letterSpacing: '-0.03em' }}>
        {value}
      </p>
      <p
        className="uppercase mt-2"
        style={{
          fontSize: 11,
          fontWeight: 600,
          color: 'rgba(255,255,255,0.3)',
          letterSpacing: '0.06em',
        }}
      >
        {label}
      </p>
    </div>
  )
}

function MetricsStripSkeleton() {
  return (
    <div className="flex mt-8 overflow-hidden animate-pulse" style={{ borderRadius: 16 }}>
      {Array.from({ length: 4 }).map((_, i) => (
        <div
          key={i}
          className="flex-1"
          style={{
            padding: '26px 24px',
            background: 'rgba(255,255,255,0.03)',
            border: '1px solid rgba(255,255,255,0.06)',
            marginLeft: i === 0 ? 0 : -1,
          }}
        >
          <div className="rounded-md" style={{ width: 48, height: 40, background: 'rgba(255,255,255,0.06)' }} />
          <div className="rounded-sm mt-3" style={{ width: 64, height: 12, background: 'rgba(255,255,255,0.04)' }} />
        </div>
      ))}
    </div>
  )
}

function ActivitySkeleton() {
  return (
    <div className="animate-pulse">
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="flex items-center gap-3 px-4 py-3">
          <div className="rounded-[10px]" style={{ width: 36, height: 36, background: 'rgba(255,255,255,0.06)' }} />
          <div className="flex-1">
            <div className="rounded-md" style={{ width: '60%', height: 13, background: 'rgba(255,255,255,0.06)' }} />
          </div>
          <div className="rounded-sm" style={{ width: 48, height: 11, background: 'rgba(255,255,255,0.04)' }} />
        </div>
      ))}
    </div>
  )
}

function SectionLabel({
  icon,
  label,
  children,
}: {
  icon: React.ReactNode
  label: string
  children?: React.ReactNode
}) {
  return (
    <div className="flex items-center justify-between mb-3">
      <span
        className="flex items-center gap-2 uppercase"
        style={{
          fontSize: 11,
          fontWeight: 700,
          color: 'rgba(255,255,255,0.25)',
          letterSpacing: '0.1em',
        }}
      >
        {icon}
        {label}
      </span>
      {children}
    </div>
  )
}

function QuickAction({
  to,
  icon,
  iconColor,
  label,
}: {
  to: string
  icon: React.ReactNode
  iconColor: string
  label: string
}) {
  return (
    <Link
      to={to}
      className="flex items-center gap-3 px-4 py-3 transition-colors"
      style={{ background: 'rgba(255,255,255,0.03)', borderRadius: 12 }}
      onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.07)' }}
      onMouseLeave={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.03)' }}
    >
      <span style={{ color: iconColor }}>{icon}</span>
      <span style={{ fontSize: 13, color: 'rgba(255,255,255,0.6)' }} className="flex-1">
        {label}
      </span>
      <ArrowRight size={14} style={{ color: 'rgba(255,255,255,0.2)' }} />
    </Link>
  )
}
