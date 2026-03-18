import { createFileRoute, Link } from '@tanstack/react-router'
import { useState, useEffect } from 'react'
import { useAuthStore } from '@/lib/stores/auth'
import { useOrganisation } from '@/lib/hooks/useOrganisation'
import { useEmployees, useMyEmployee } from '@/lib/hooks/useEmployees'
import { useDailyReport, useClockIn, useClockOut } from '@/lib/hooks/useAttendance'
import { todayISO, formatDate } from '@/lib/utils/date'
import { moduleBackgrounds, typography } from '@/design/tokens'
import { Avatar } from '@/components/workived/layout/Avatar'

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

  return (
    <div
      className="min-h-screen px-6 py-6 md:px-11 md:py-8 pb-24"
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
        className="mt-2"
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
        className="mt-1.5"
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
        <div className="flex mt-6 overflow-hidden" style={{ borderRadius: 16 }}>
          <MetricCell label="EMPLOYEES" value={totalEmployees} color="#9B8FF7" position="first" />
          <MetricCell label="PRESENT" value={present} color="#12A05C" position="middle" />
          <MetricCell label="LATE" value={late} color="#C97B2A" position="middle" />
          <MetricCell label="ABSENT" value={absent} color="#D44040" position="last" />
        </div>
      )}

      {/* ── Main Content (2 columns) ──────────────────────────── */}
      <div className="grid md:grid-cols-2 gap-8 mt-8">
        {/* Left: Clock In/Out */}
        <div>
          {!myEmployee ? (
            <p style={{ fontSize: 15, color: 'rgba(255,255,255,0.35)' }}>
              No employee record linked to your account.
            </p>
          ) : hasClockedOut ? (
            /* Done for the day */
            <div>
              <p style={{ fontSize: 32, fontWeight: 800, color: '#12A05C', letterSpacing: '-0.04em', lineHeight: 1 }}>
                All done for today
              </p>
              {myEntry?.clock_in_at && myEntry?.clock_out_at && (
                <p style={{ fontFamily: typography.fontMono, fontSize: 15, color: 'rgba(255,255,255,0.3)', marginTop: 8 }}>
                  {formatDate(myEntry.clock_in_at, tz, 'time')} – {formatDate(myEntry.clock_out_at, tz, 'time')}
                </p>
              )}
            </div>
          ) : hasClockedIn ? (
            /* Clocked in — show elapsed timer */
            <div>
              <p
                style={{
                  fontFamily: typography.fontMono,
                  fontSize: 56,
                  fontWeight: 800,
                  color: '#FFFFFF',
                  letterSpacing: '-0.03em',
                  lineHeight: 1,
                }}
              >
                {elapsed}
              </p>
              <p style={{ fontSize: 15, color: 'rgba(255,255,255,0.35)', marginTop: 6 }}>
                Started at {myEntry?.clock_in_at ? formatDate(myEntry.clock_in_at, tz, 'time') : ''}
                {myEntry?.status === 'late' && <span style={{ color: '#C97B2A', fontWeight: 600 }}> · Late</span>}
              </p>
              <div className="flex gap-2 mt-6">
                <input
                  type="text"
                  placeholder="Note (optional)"
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  className="flex-1 text-sm px-4 py-3 focus:outline-none"
                  style={{
                    background: 'rgba(255,255,255,0.04)',
                    border: '1px solid rgba(255,255,255,0.1)',
                    borderRadius: 12,
                    color: '#FFFFFF',
                  }}
                />
                <button
                  onClick={handleClockOut}
                  disabled={clockOut.isPending}
                  className="font-bold px-6 py-3 transition-all disabled:opacity-50"
                  style={{ 
                    background: '#C97B2A', 
                    color: '#FFFFFF', 
                    borderRadius: 12,
                    fontSize: 15,
                    letterSpacing: '-0.01em',
                  }}
                >
                  {clockOut.isPending ? 'Clocking out...' : 'Clock Out'}
                </button>
              </div>
            </div>
          ) : (
            /* Not clocked in yet */
            <div>
              <p style={{ fontSize: 32, fontWeight: 800, color: 'rgba(255,255,255,0.7)', letterSpacing: '-0.04em', lineHeight: 1 }}>
                Ready to start?
              </p>
              
              {/* Work schedule info */}
              <div className="mt-6 grid grid-cols-2 gap-3">
                <div
                  style={{
                    padding: '12px 16px',
                    background: 'rgba(155,143,247,0.08)',
                    borderRadius: 10,
                  }}
                >
                  <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600 }}>
                    Today's shift
                  </p>
                  <p style={{ fontFamily: typography.fontMono, fontSize: 18, fontWeight: 700, color: 'rgba(255,255,255,0.8)', marginTop: 4 }}>
                    09:00 - 18:00
                  </p>
                </div>
                
                <div
                  style={{
                    padding: '12px 16px',
                    background: 'rgba(18,160,92,0.08)',
                    borderRadius: 10,
                  }}
                >
                  <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600 }}>
                    This week
                  </p>
                  <p style={{ fontFamily: typography.fontMono, fontSize: 18, fontWeight: 700, color: 'rgba(255,255,255,0.8)', marginTop: 4 }}>
                    32.5 hrs
                  </p>
                </div>
              </div>

              <div className="flex gap-2 mt-4">
                <input
                  type="text"
                  placeholder="Note (optional)"
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  className="flex-1 text-sm px-4 py-3 focus:outline-none"
                  style={{
                    background: 'rgba(255,255,255,0.04)',
                    border: '1px solid rgba(255,255,255,0.1)',
                    borderRadius: 12,
                    color: '#FFFFFF',
                  }}
                />
                <button
                  onClick={handleClockIn}
                  disabled={clockIn.isPending}
                  className="font-bold px-6 py-3 transition-all disabled:opacity-50"
                  style={{ 
                    background: '#12A05C', 
                    color: '#FFFFFF', 
                    borderRadius: 12,
                    fontSize: 15,
                    letterSpacing: '-0.01em',
                  }}
                >
                  {clockIn.isPending ? 'Clocking in...' : 'Clock In'}
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Right: Team Status */}
        <div>
          <div className="flex items-end justify-between">
            <p style={{ fontSize: 24, fontWeight: 800, color: 'rgba(255,255,255,0.7)', letterSpacing: '-0.03em', lineHeight: 1 }}>
              Your team today
            </p>
            <Link
              to="/attendance"
              className="text-sm font-semibold transition-opacity"
              style={{ color: 'rgba(255,255,255,0.4)', opacity: 0.7 }}
              onMouseEnter={(e) => { e.currentTarget.style.opacity = '1' }}
              onMouseLeave={(e) => { e.currentTarget.style.opacity = '0.7' }}
            >
              View all →
            </Link>
          </div>

          {isLoading ? (
            <div className="mt-5 animate-pulse">
              <div className="flex gap-2">
                {Array.from({ length: 6 }).map((_, i) => (
                  <div key={i} className="rounded-full" style={{ width: 40, height: 40, background: 'rgba(255,255,255,0.05)' }} />
                ))}
              </div>
            </div>
          ) : allEntries.length === 0 ? (
            <p style={{ fontSize: 15, color: 'rgba(255,255,255,0.3)', marginTop: 16 }}>
              No attendance data yet
            </p>
          ) : (
            <>
              <div className="flex flex-wrap gap-3 mt-6">
                {allEntries.map((e) => {
                  const isAbsent = e.status === 'absent'
                  const isLate = e.status === 'late'
                  const statusColor = isAbsent ? '#D44040' : isLate ? '#C97B2A' : '#12A05C'
                  const statusLabel = isAbsent ? 'Absent' : isLate ? 'Late' : 'On time'
                  
                  // Find employee details for job title
                  const employee = employees?.data?.find(emp => emp.id === e.employee_id)
                  const jobTitle = employee?.job_title || 'Team Member'
                  
                  return (
                    <div
                      key={e.employee_id}
                      className="group relative cursor-pointer"
                    >
                      {/* Avatar */}
                      <div
                        className="relative transition-all duration-200"
                        style={{ 
                          opacity: isAbsent ? 0.3 : 1,
                          transform: 'scale(1)',
                        }}
                        onMouseEnter={(el) => {
                          if (!isAbsent) el.currentTarget.style.transform = 'scale(1.1)'
                        }}
                        onMouseLeave={(el) => {
                          el.currentTarget.style.transform = 'scale(1)'
                        }}
                      >
                        <Avatar name={e.employee_name} id={e.employee_id} size={48} />
                      </div>

                      {/* Hover card */}
                      <div
                        className="absolute pointer-events-none transition-all duration-200 z-10"
                        style={{
                          bottom: '100%',
                          left: '50%',
                          marginBottom: 8,
                          opacity: 0,
                          transform: 'translateX(-50%) translateY(4px)',
                        }}
                        ref={(el) => {
                          if (el) {
                            const parent = el.parentElement
                            parent?.addEventListener('mouseenter', () => {
                              el.style.opacity = '1'
                              el.style.transform = 'translateX(-50%) translateY(0)'
                            })
                            parent?.addEventListener('mouseleave', () => {
                              el.style.opacity = '0'
                              el.style.transform = 'translateX(-50%) translateY(4px)'
                            })
                          }
                        }}
                      >
                        <div
                          className="whitespace-nowrap"
                          style={{
                            padding: '10px 14px',
                            background: 'rgba(20,20,25,0.98)',
                            border: '1px solid rgba(255,255,255,0.12)',
                            borderRadius: 10,
                            boxShadow: '0 8px 24px rgba(0,0,0,0.4)',
                          }}
                        >
                          <p style={{ fontSize: 13, fontWeight: 600, color: 'rgba(255,255,255,0.9)' }}>
                            {e.employee_name}
                          </p>
                          <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', marginTop: 2 }}>
                            {jobTitle}
                          </p>
                          <div className="flex items-center gap-2 mt-2">
                            <div
                              style={{
                                width: 6,
                                height: 6,
                                borderRadius: '50%',
                                background: statusColor,
                              }}
                            />
                            <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)' }}>
                              {statusLabel}
                              {e.clock_in_at && !isAbsent && ` · ${formatDate(e.clock_in_at, tz, 'time')}`}
                            </span>
                          </div>
                        </div>
                        {/* Arrow */}
                        <div
                          className="absolute left-1/2 -translate-x-1/2"
                          style={{
                            top: '100%',
                            width: 0,
                            height: 0,
                            borderLeft: '6px solid transparent',
                            borderRight: '6px solid transparent',
                            borderTop: '6px solid rgba(20,20,25,0.98)',
                          }}
                        />
                      </div>
                    </div>
                  )
                })}
              </div>

              {/* Alerts */}
              {(late > 0 || absent > 0) && (
                <div className="mt-5 flex flex-col gap-2">
                  {absent > 0 && (
                    <p style={{ fontSize: 14, color: 'rgba(255,255,255,0.4)' }}>
                      <span style={{ color: '#D44040', fontWeight: 700 }}>⚠</span> {absent} {absent === 1 ? 'person' : 'people'} {absent === 1 ? "hasn't" : "haven't"} clocked in yet
                    </p>
                  )}
                  {late > 0 && (
                    <p style={{ fontSize: 14, color: 'rgba(255,255,255,0.4)' }}>
                      <span style={{ color: '#C97B2A', fontWeight: 700 }}>⏰</span> {late} {late === 1 ? 'person' : 'people'} clocked in late
                    </p>
                  )}
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* ── Recent Activity ──────────────────────────────────── */}
      <div className="mt-10">
        <p style={{ fontSize: 24, fontWeight: 800, color: 'rgba(255,255,255,0.7)', letterSpacing: '-0.03em', lineHeight: 1 }}>
          Recent activity
        </p>

        <div className="mt-5 flex flex-col gap-2">
          {DUMMY_ACTIVITIES.map((activity, i) => (
            <div
              key={i}
              className="flex items-center gap-4 py-3 px-4 transition-colors"
              style={{
                background: 'rgba(255,255,255,0.02)',
                borderRadius: 12,
              }}
              onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.04)' }}
              onMouseLeave={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.02)' }}
            >
              <div
                className="grid place-items-center flex-shrink-0"
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: 10,
                  background: activity.iconBg,
                }}
              >
                <span style={{ fontSize: 16 }}>{activity.icon}</span>
              </div>
              <div className="flex-1 min-w-0">
                <p style={{ fontSize: 14, color: 'rgba(255,255,255,0.8)', fontWeight: 500 }}>
                  {activity.text}
                </p>
                <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.3)', marginTop: 2 }}>
                  {activity.time}
                </p>
              </div>
              <div
                className="flex-shrink-0"
                style={{
                  padding: '4px 10px',
                  borderRadius: 6,
                  background: activity.badgeBg,
                }}
              >
                <span style={{ fontSize: 11, fontWeight: 700, color: activity.badgeColor, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  {activity.badge}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

// ── Dummy Data ──────────────────────────────────────────────────

const DUMMY_ACTIVITIES = [
  {
    icon: '✅',
    iconBg: 'rgba(18,160,92,0.1)',
    text: 'Siti Nurhaliza clocked in',
    time: '2 minutes ago',
    badge: 'On time',
    badgeBg: 'rgba(18,160,92,0.12)',
    badgeColor: '#12A05C',
  },
  {
    icon: '📝',
    iconBg: 'rgba(155,143,247,0.1)',
    text: 'Budi Santoso submitted a leave request',
    time: '15 minutes ago',
    badge: 'Leave',
    badgeBg: 'rgba(155,143,247,0.12)',
    badgeColor: '#9B8FF7',
  },
  {
    icon: '⚠️',
    iconBg: 'rgba(201,123,42,0.1)',
    text: 'Reza Pratama clocked in late',
    time: '32 minutes ago',
    badge: 'Late',
    badgeBg: 'rgba(201,123,42,0.12)',
    badgeColor: '#C97B2A',
  },
  {
    icon: '👤',
    iconBg: 'rgba(155,143,247,0.1)',
    text: 'New employee Adi Nugroho joined',
    time: '1 hour ago',
    badge: 'New',
    badgeBg: 'rgba(155,143,247,0.12)',
    badgeColor: '#9B8FF7',
  },
  {
    icon: '✅',
    iconBg: 'rgba(18,160,92,0.1)',
    text: 'Dewi Lestari clocked in',
    time: '2 hours ago',
    badge: 'On time',
    badgeBg: 'rgba(18,160,92,0.12)',
    badgeColor: '#12A05C',
  },
]

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
        padding: '20px 20px',
        background: 'rgba(255,255,255,0.03)',
        border: '1px solid rgba(255,255,255,0.06)',
        marginLeft: position === 'first' ? 0 : -1,
      }}
    >
      <p style={{ fontSize: 40, fontWeight: 800, color, lineHeight: 1, letterSpacing: '-0.03em' }}>
        {value}
      </p>
      <p
        className="uppercase mt-1.5"
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
    <div className="flex mt-6 overflow-hidden animate-pulse" style={{ borderRadius: 16 }}>
      {Array.from({ length: 4 }).map((_, i) => (
        <div
          key={i}
          className="flex-1"
          style={{
            padding: '20px 20px',
            background: 'rgba(255,255,255,0.03)',
            border: '1px solid rgba(255,255,255,0.06)',
            marginLeft: i === 0 ? 0 : -1,
          }}
        >
          <div className="rounded-md" style={{ width: 48, height: 36, background: 'rgba(255,255,255,0.06)' }} />
          <div className="rounded-sm mt-2" style={{ width: 64, height: 12, background: 'rgba(255,255,255,0.04)' }} />
        </div>
      ))}
    </div>
  )
}


