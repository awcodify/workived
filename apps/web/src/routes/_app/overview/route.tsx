import { createFileRoute, Link } from '@tanstack/react-router'
import { useState, useEffect, useMemo } from 'react'
import { useAuthStore } from '@/lib/stores/auth'
import { useOrganisation } from '@/lib/hooks/useOrganisation'
import { useEmployees, useMyEmployee } from '@/lib/hooks/useEmployees'
import { useDailyReport, useClockIn, useClockOut } from '@/lib/hooks/useAttendance'
import { todayISO, formatDate } from '@/lib/utils/date'
import { moduleBackgrounds, typography } from '@/design/tokens'
import { Avatar } from '@/components/workived/layout/Avatar'
import {
  ArrowRight,
  Clock,
  Users,
  CalendarDays,
  LogIn,
  CheckCircle,
  AlertTriangle,
} from 'lucide-react'

export const Route = createFileRoute('/_app/overview')({
  component: OverviewPage,
})

// ── Hooks ───────────────────────────────────────────────────────

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

function useElapsedTime(clockInAt: string | undefined) {
  const [elapsed, setElapsed] = useState('')
  useEffect(() => {
    if (!clockInAt) { setElapsed(''); return }
    const update = () => {
      const diff = Date.now() - new Date(clockInAt).getTime()
      if (diff < 0) { setElapsed('00:00:00'); return }
      const h = Math.floor(diff / 3600000)
      const m = Math.floor((diff % 3600000) / 60000)
      const s = Math.floor((diff % 60000) / 1000)
      setElapsed(`${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`)
    }
    update()
    const id = setInterval(update, 1000)
    return () => clearInterval(id)
  }, [clockInAt])
  return elapsed
}

// ── Page ────────────────────────────────────────────────────────

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

  const isLoading = orgLoading || empLoading || dailyLoading

  // My clock-in state
  const myEntry = daily?.find((e) => e.employee_id === myEmployee?.id)
  const hasClockedIn = !!myEntry?.clock_in_at
  const hasClockedOut = !!myEntry?.clock_out_at
  const elapsed = useElapsedTime(hasClockedIn && !hasClockedOut ? myEntry?.clock_in_at : undefined)

  const clockIn = useClockIn()
  const clockOut = useClockOut()
  const [note, setNote] = useState('')

  const handleClockIn = () => {
    clockIn.mutate({ note: note || undefined }, { onSuccess: () => setNote('') })
  }
  const handleClockOut = () => {
    clockOut.mutate({ note: note || undefined }, { onSuccess: () => setNote('') })
  }

  // Team pulse data
  const allEntries = daily ?? []
  const needsAttention = useMemo(() => {
    const items: { icon: React.ReactNode; iconBg: string; text: string }[] = []
    if (absent > 0) {
      items.push({
        icon: <AlertTriangle size={16} style={{ color: '#D44040' }} />,
        iconBg: 'rgba(212,64,64,0.15)',
        text: `${absent} employee${absent !== 1 ? 's' : ''} haven't clocked in yet`,
      })
    }
    if (late > 0) {
      items.push({
        icon: <Clock size={16} style={{ color: '#C97B2A' }} />,
        iconBg: 'rgba(201,123,42,0.15)',
        text: `${late} employee${late !== 1 ? 's' : ''} clocked in late today`,
      })
    }
    return items
  }, [absent, late])

  return (
    <div
      className="min-h-screen px-6 py-8 md:px-11 md:py-10 pb-28"
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

      {/* ── Your Day + Team Pulse ─────────────────────────────── */}
      <div className="grid md:grid-cols-2 gap-3 mt-8">
        {/* Your Day */}
        <div
          className="p-5"
          style={{
            background: 'rgba(255,255,255,0.04)',
            borderRadius: 16,
            border: '1px solid rgba(255,255,255,0.06)',
          }}
        >
          <SectionLabel icon={null} label="YOUR DAY" />

          {!myEmployee ? (
            <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.3)' }}>
              No employee record linked to your account.
            </p>
          ) : hasClockedOut ? (
            /* Done for the day */
            <div className="flex flex-col items-center py-4 gap-2">
              <CheckCircle size={28} style={{ color: '#12A05C' }} />
              <p className="font-semibold" style={{ fontSize: 14, color: 'rgba(255,255,255,0.7)' }}>
                Done for today
              </p>
              {myEntry?.clock_in_at && myEntry?.clock_out_at && (
                <p style={{ fontFamily: typography.fontMono, fontSize: 12, color: 'rgba(255,255,255,0.25)' }}>
                  {formatDate(myEntry.clock_in_at, tz, 'time')} — {formatDate(myEntry.clock_out_at, tz, 'time')}
                </p>
              )}
            </div>
          ) : hasClockedIn ? (
            /* Clocked in — show elapsed timer */
            <>
              <p
                className="text-center"
                style={{
                  fontFamily: typography.fontMono,
                  fontSize: 40,
                  fontWeight: 800,
                  color: '#FFFFFF',
                  letterSpacing: '-0.02em',
                  lineHeight: 1,
                  marginTop: 8,
                }}
              >
                {elapsed}
              </p>
              <p className="text-center mt-1.5" style={{ fontSize: 12, color: 'rgba(255,255,255,0.35)' }}>
                Working since {myEntry?.clock_in_at ? formatDate(myEntry.clock_in_at, tz, 'time') : ''}
                {myEntry?.status === 'late' && <span style={{ color: '#C97B2A' }}> (late)</span>}
              </p>
              <div className="mt-4 flex gap-2">
                <input
                  type="text"
                  placeholder="Note (optional)"
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  className="flex-1 text-sm px-3 py-2 focus:outline-none"
                  style={{
                    background: 'rgba(255,255,255,0.05)',
                    border: '1px solid rgba(255,255,255,0.1)',
                    borderRadius: 10,
                    color: '#FFFFFF',
                  }}
                />
                <button
                  onClick={handleClockOut}
                  disabled={clockOut.isPending}
                  className="text-sm font-semibold px-4 py-2 transition-colors disabled:opacity-50"
                  style={{ background: '#C97B2A', color: '#FFFFFF', borderRadius: 10 }}
                >
                  {clockOut.isPending ? 'Clocking out...' : 'Clock Out'}
                </button>
              </div>
            </>
          ) : (
            /* Not clocked in yet */
            <>
              <div className="flex flex-col items-center py-3 gap-1">
                <LogIn size={24} style={{ color: 'rgba(255,255,255,0.3)' }} />
                <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.4)' }}>
                  You haven't clocked in yet
                </p>
              </div>
              <div className="flex gap-2 mt-2">
                <input
                  type="text"
                  placeholder="Note (optional)"
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  className="flex-1 text-sm px-3 py-2 focus:outline-none"
                  style={{
                    background: 'rgba(255,255,255,0.05)',
                    border: '1px solid rgba(255,255,255,0.1)',
                    borderRadius: 10,
                    color: '#FFFFFF',
                  }}
                />
                <button
                  onClick={handleClockIn}
                  disabled={clockIn.isPending}
                  className="text-sm font-semibold px-4 py-2 transition-colors disabled:opacity-50"
                  style={{ background: '#12A05C', color: '#FFFFFF', borderRadius: 10 }}
                >
                  {clockIn.isPending ? 'Clocking in...' : 'Clock In'}
                </button>
              </div>
            </>
          )}
        </div>

        {/* Team Pulse */}
        <div
          className="p-5"
          style={{
            background: 'rgba(255,255,255,0.04)',
            borderRadius: 16,
            border: '1px solid rgba(255,255,255,0.06)',
          }}
        >
          <SectionLabel icon={null} label="TEAM PULSE">
            <Link
              to="/attendance"
              className="text-xs flex items-center gap-1 transition-colors"
              style={{ color: 'rgba(255,255,255,0.4)' }}
              onMouseEnter={(e) => { e.currentTarget.style.color = 'rgba(255,255,255,0.7)' }}
              onMouseLeave={(e) => { e.currentTarget.style.color = 'rgba(255,255,255,0.4)' }}
            >
              Details <ArrowRight size={12} />
            </Link>
          </SectionLabel>

          {isLoading ? (
            <TeamPulseSkeleton />
          ) : allEntries.length === 0 ? (
            <div className="flex flex-col items-center py-4 gap-2">
              <Users size={24} style={{ color: 'rgba(255,255,255,0.2)' }} />
              <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.3)' }}>
                No attendance data yet
              </p>
            </div>
          ) : (
            <>
              {/* Avatar grid */}
              <div className="flex flex-wrap gap-2">
                {allEntries.map((e) => {
                  const isAbsent = e.status === 'absent'
                  const borderColor =
                    e.status === 'late' ? '#C97B2A' :
                    e.status === 'present' ? '#12A05C' : 'transparent'
                  return (
                    <div
                      key={e.employee_id}
                      className="relative"
                      style={{ opacity: isAbsent ? 0.35 : 1 }}
                      title={`${e.employee_name} — ${e.status}`}
                    >
                      <Avatar name={e.employee_name} id={e.employee_id} size={28} />
                      {!isAbsent && (
                        <div
                          className="absolute -bottom-0.5 left-1/2 -translate-x-1/2"
                          style={{
                            width: 12,
                            height: 2,
                            borderRadius: 1,
                            background: borderColor,
                          }}
                        />
                      )}
                    </div>
                  )
                })}
              </div>

              {/* Summary counts */}
              <div className="flex items-center gap-4 mt-4">
                <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.5)' }}>
                  <span style={{ color: '#12A05C', fontWeight: 600 }}>{present}</span> present
                </span>
                {late > 0 && (
                  <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.5)' }}>
                    <span style={{ color: '#C97B2A', fontWeight: 600 }}>{late}</span> late
                  </span>
                )}
                {absent > 0 && (
                  <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.5)' }}>
                    <span style={{ color: 'rgba(255,255,255,0.35)', fontWeight: 600 }}>{absent}</span> not in
                  </span>
                )}
              </div>
            </>
          )}
        </div>
      </div>

      {/* ── Needs Attention ──────────────────────────────────── */}
      {needsAttention.length > 0 && (
        <div className="mt-3">
          <div className="flex flex-col gap-[3px]">
            {needsAttention.map((item, i) => (
              <div
                key={i}
                className="flex items-center gap-3 px-4 py-3"
                style={{
                  background: 'rgba(255,255,255,0.03)',
                  borderRadius: 12,
                  border: '1px solid rgba(255,255,255,0.06)',
                }}
              >
                <div
                  className="grid place-items-center flex-shrink-0"
                  style={{ width: 36, height: 36, borderRadius: 10, background: item.iconBg }}
                >
                  {item.icon}
                </div>
                <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.6)' }}>{item.text}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* All clear state */}
      {!isLoading && needsAttention.length === 0 && allEntries.length > 0 && (
        <div
          className="mt-3 flex items-center gap-3 px-4 py-3"
          style={{
            background: 'rgba(18,160,92,0.06)',
            borderRadius: 12,
            border: '1px solid rgba(18,160,92,0.1)',
          }}
        >
          <CheckCircle size={18} style={{ color: '#12A05C' }} />
          <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.5)' }}>
            All clear — nothing needs your attention
          </p>
        </div>
      )}

      {/* ── Quick Actions (horizontal) ───────────────────────── */}
      <div className="flex gap-3 mt-8">
        <QuickAction to="/people" icon={<Users size={18} />} iconColor="#8F86F0" label="People" />
        <QuickAction to="/attendance" icon={<Clock size={18} />} iconColor="#12A05C" label="Attendance" />
        <QuickAction to="/attendance/monthly" icon={<CalendarDays size={18} />} iconColor="#C97B2A" label="Monthly" />
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

function TeamPulseSkeleton() {
  return (
    <div className="animate-pulse">
      <div className="flex flex-wrap gap-2">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="rounded-[9px]" style={{ width: 28, height: 28, background: 'rgba(255,255,255,0.06)' }} />
        ))}
      </div>
      <div className="flex gap-4 mt-4">
        <div className="rounded-sm" style={{ width: 60, height: 12, background: 'rgba(255,255,255,0.04)' }} />
        <div className="rounded-sm" style={{ width: 40, height: 12, background: 'rgba(255,255,255,0.04)' }} />
      </div>
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
      className="flex-1 flex flex-col items-center gap-2 py-4 transition-colors"
      style={{
        background: 'rgba(255,255,255,0.03)',
        borderRadius: 14,
        border: '1px solid rgba(255,255,255,0.06)',
      }}
      onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.07)' }}
      onMouseLeave={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.03)' }}
    >
      <span style={{ color: iconColor }}>{icon}</span>
      <span style={{ fontSize: 12, fontWeight: 500, color: 'rgba(255,255,255,0.5)' }}>
        {label}
      </span>
    </Link>
  )
}
