import { createFileRoute, Link } from '@tanstack/react-router'
import { useState, useEffect, useMemo } from 'react'
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

// ── Announcements / Quotes ─────────────────────────────────────
// TODO: Replace with backend API — GET /api/v1/announcements/active
// The backend should return org-specific announcements or a quote of the day.
// For now, we pick a random quote per page load.

const PLACEHOLDER_QUOTES = [
  { text: 'Great things in business are never done by one person. They\'re done by a team of people.', author: 'Steve Jobs' },
  { text: 'Coming together is a beginning, staying together is progress, and working together is success.', author: 'Henry Ford' },
  { text: 'Alone we can do so little; together we can do so much.', author: 'Helen Keller' },
  { text: 'Talent wins games, but teamwork and intelligence win championships.', author: 'Michael Jordan' },
  { text: 'If everyone is moving forward together, then success takes care of itself.', author: 'Henry Ford' },
  { text: 'The strength of the team is each individual member. The strength of each member is the team.', author: 'Phil Jackson' },
  { text: 'None of us is as smart as all of us.', author: 'Ken Blanchard' },
  { text: 'It is literally true that you can succeed best and quickest by helping others to succeed.', author: 'Napoleon Hill' },
]

// TODO: Replace with real assigned tasks from backend API
const PLACEHOLDER_TASKS = [
  { id: '1', title: 'Review Q1 budget proposal', project: 'Finance', priority: 'high' as const, tracking: true },
  { id: '2', title: 'Update employee handbook', project: 'HR Operations', priority: 'medium' as const, tracking: false },
  { id: '3', title: 'Prepare onboarding docs for new hire', project: 'Recruitment', priority: 'low' as const, tracking: false },
]

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

  // TODO: Replace with real data from GET /api/v1/attendance/daily?date=...&include=work_mode,leave
  // Enrich entries with simulated WFH/WFO and on-leave status
  const enrichedEntries = useMemo(() => {
    if (!daily) return []
    return daily.map((e) => {
      // Simulate: ~30% of present/late are WFH, rest WFO
      const hash = e.employee_id.charCodeAt(0) + e.employee_id.charCodeAt(e.employee_id.length - 1)
      const isActive = e.status === 'present' || e.status === 'late'
      const workMode: 'wfh' | 'wfo' | null = isActive ? (hash % 3 === 0 ? 'wfh' : 'wfo') : null
      // Simulate: ~40% of absent employees are "on leave"
      const onLeave = e.status === 'absent' && hash % 5 < 2
      return { ...e, workMode, onLeave }
    })
  }, [daily])

  const onLeaveCount = enrichedEntries.filter((e) => e.onLeave).length
  const wfhCount = enrichedEntries.filter((e) => e.workMode === 'wfh').length
  const wfoCount = enrichedEntries.filter((e) => e.workMode === 'wfo').length
  const trueAbsent = absent - onLeaveCount

  const fullName = user?.full_name ?? myEmployee?.full_name
  const firstName = fullName?.split(' ')[0] ?? 'there'

  const greeting = useGreeting()
  const clock = useLiveClock(tz)

  // TODO: Replace with useAnnouncements() hook fetching from backend
  const dailyQuote = useMemo(
    () => PLACEHOLDER_QUOTES[Math.floor(Math.random() * PLACEHOLDER_QUOTES.length)]!,
    [],
  )

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
  const allEntries = enrichedEntries

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

      {/* Announcement / Quote of the day */}
      {/* TODO: Replace with announcement data from backend */}
      <div
        className="mt-6"
        style={{
          padding: '20px 24px',
          background: 'linear-gradient(135deg, rgba(155,143,247,0.10) 0%, rgba(155,143,247,0.04) 100%)',
          border: '1px solid rgba(155,143,247,0.15)',
          borderRadius: 16,
        }}
      >
        <p style={{ fontSize: 11, color: 'rgba(155,143,247,0.7)', textTransform: 'uppercase', letterSpacing: '0.1em', fontWeight: 700 }}>
          {org?.name ?? 'Your Company'} · Quote of the Day
        </p>
        <p
          style={{
            fontSize: 16,
            fontWeight: 600,
            color: 'rgba(255,255,255,0.7)',
            lineHeight: 1.5,
            marginTop: 8,
            fontStyle: 'italic',
          }}
        >
          "{dailyQuote.text}"
        </p>
        <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.3)', marginTop: 6 }}>
          — {dailyQuote.author}
        </p>
      </div>

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
              
              {/* Calculated hours worked */}
              {myEntry?.clock_in_at && myEntry?.clock_out_at && (() => {
                const clockIn = new Date(myEntry.clock_in_at)
                const clockOut = new Date(myEntry.clock_out_at)
                const diffMs = clockOut.getTime() - clockIn.getTime()
                const hours = Math.floor(diffMs / (1000 * 60 * 60))
                const minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60))
                
                return (
                  <div 
                    className="mt-6"
                    style={{
                      padding: '20px 24px',
                      background: 'linear-gradient(135deg, rgba(18,160,92,0.12) 0%, rgba(18,160,92,0.06) 100%)',
                      border: '2px solid rgba(18,160,92,0.2)',
                      borderRadius: 16,
                    }}
                  >
                    <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)', textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 600 }}>
                      You worked today
                    </p>
                    <div className="flex items-baseline gap-3 mt-2">
                      <p 
                        style={{ 
                          fontFamily: typography.fontMono, 
                          fontSize: 48, 
                          fontWeight: 800, 
                          color: '#12A05C',
                          letterSpacing: '-0.02em',
                          lineHeight: 1,
                        }}
                      >
                        {hours}h {minutes}m
                      </p>
                      <p style={{ fontFamily: typography.fontMono, fontSize: 14, color: 'rgba(255,255,255,0.35)' }}>
                        {formatDate(myEntry.clock_in_at, tz, 'time')} – {formatDate(myEntry.clock_out_at, tz, 'time')}
                      </p>
                    </div>
                  </div>
                )
              })()}
              
              {/* Work schedule info */}
              <div className="mt-4 grid grid-cols-2 gap-3">
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

          {/* TODO: Replace with real tasks from GET /api/v1/tasks?assigned_to=me&status=in_progress */}
          {myEmployee && (
            <div className="mt-6">
              <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 600, marginBottom: 10 }}>
                Assigned to you
              </p>
              <div className="flex flex-col gap-2">
                {PLACEHOLDER_TASKS.map((task) => (
                  <div
                    key={task.id}
                    className="flex items-center gap-3 py-3 px-4"
                    style={{
                      background: 'rgba(255,255,255,0.03)',
                      border: '1px solid rgba(255,255,255,0.06)',
                      borderRadius: 10,
                    }}
                  >
                    <div
                      style={{
                        width: 8,
                        height: 8,
                        borderRadius: '50%',
                        background: task.priority === 'high' ? '#D44040' : task.priority === 'medium' ? '#C97B2A' : '#9B8FF7',
                        flexShrink: 0,
                      }}
                    />
                    <div className="flex-1 min-w-0">
                      <p style={{ fontSize: 14, color: 'rgba(255,255,255,0.8)', fontWeight: 500 }}>{task.title}</p>
                      <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.3)', marginTop: 2 }}>{task.project}</p>
                    </div>
                    <button
                      className="flex-shrink-0 font-semibold transition-opacity"
                      style={{
                        padding: '6px 14px',
                        borderRadius: 8,
                        fontSize: 12,
                        background: task.tracking ? 'rgba(201,123,42,0.15)' : 'rgba(18,160,92,0.15)',
                        color: task.tracking ? '#C97B2A' : '#12A05C',
                        border: `1px solid ${task.tracking ? 'rgba(201,123,42,0.25)' : 'rgba(18,160,92,0.25)'}`,
                      }}
                    >
                      {task.tracking ? '■ Stop' : '▶ Start'}
                    </button>
                  </div>
                ))}
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
              {/* Charts + Team column */}
              <div className="mt-6 flex gap-4" style={{ alignItems: 'stretch' }}>
                {/* Charts grid */}
                <div className="flex-1 grid grid-cols-2 gap-4">
                  {/* Attendance Chart */}
                  <div style={{ 
                    background: 'rgba(255,255,255,0.04)', 
                    border: '1px solid rgba(255,255,255,0.1)',
                    borderRadius: 14,
                    padding: '18px 20px',
                  }}>
                    <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.45)', textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 600, marginBottom: 12 }}>
                      Attendance
                    </p>
                    <DonutChart
                      size={150}
                      segments={[
                        { label: 'Present', value: present, color: '#12A05C' },
                        { label: 'Late', value: late, color: '#C97B2A' },
                        { label: 'On Leave', value: onLeaveCount, color: '#9B8FF7' },
                        { label: 'Absent', value: trueAbsent, color: '#D44040' },
                      ]}
                      total={totalEmployees}
                      centerLabel="Total"
                    />
                  </div>

                  {/* Work Mode Chart */}
                  <div style={{ 
                    background: 'rgba(255,255,255,0.04)', 
                    border: '1px solid rgba(255,255,255,0.1)',
                    borderRadius: 14,
                    padding: '18px 20px',
                  }}>
                    <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.45)', textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 600, marginBottom: 12 }}>
                      Work Mode
                    </p>
                    <DonutChart
                      size={150}
                      segments={[
                        { label: 'WFO', value: wfoCount, color: '#12A05C' },
                        { label: 'WFH', value: wfhCount, color: '#9B8FF7' },
                      ]}
                      total={wfoCount + wfhCount}
                      centerLabel="Active"
                    />
                  </div>
                </div>

                {/* Top 5 Avatars — vertical column */}
                <div style={{
                  background: 'rgba(255,255,255,0.04)',
                  border: '1px solid rgba(255,255,255,0.1)',
                  borderRadius: 14,
                  padding: '14px 10px',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: 6,
                  minWidth: 56,
                }}>
                  <p style={{ fontSize: 9, color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 600, marginBottom: 2 }}>
                    Team
                  </p>
                  {(() => {
                    const active = allEntries.filter((e) => e.status === 'present' || e.status === 'late')
                    const inactive = allEntries.filter((e) => e.status === 'absent')
                    const displayed = [...active, ...inactive].slice(0, 5)
                    const remaining = allEntries.length - displayed.length

                    return (
                      <>
                        {displayed.map((e) => {
                          const isAbsent = e.status === 'absent'
                          const isLate = e.status === 'late'
                          const statusColor = e.onLeave ? '#9B8FF7' : isAbsent ? '#D44040' : isLate ? '#C97B2A' : '#12A05C'
                          const employee = employees?.data?.find(emp => emp.id === e.employee_id)
                          const jobTitle = employee?.job_title || 'Team Member'
                          const statusLabel = e.onLeave ? 'On Leave' : isAbsent ? 'Absent' : isLate ? 'Late' : 'On time'

                          return (
                            <div key={e.employee_id} className="group relative flex justify-center">
                              <div className="relative" style={{ opacity: isAbsent && !e.onLeave ? 0.35 : e.onLeave ? 0.5 : 1 }}>
                                <Avatar name={e.employee_name} id={e.employee_id} size={36} />
                                <div
                                  className="absolute"
                                  style={{
                                    bottom: 0,
                                    right: 0,
                                    width: 8,
                                    height: 8,
                                    borderRadius: '50%',
                                    background: statusColor,
                                    border: '2px solid #141419',
                                  }}
                                />
                              </div>
                              {/* Hover card */}
                              <div
                                className="absolute pointer-events-none transition-all duration-200 z-10"
                                style={{
                                  right: '100%',
                                  top: '50%',
                                  marginRight: 8,
                                  opacity: 0,
                                  transform: 'translateY(-50%) translateX(4px)',
                                }}
                                ref={(el) => {
                                  if (el) {
                                    const parent = el.parentElement
                                    parent?.addEventListener('mouseenter', () => {
                                      el.style.opacity = '1'
                                      el.style.transform = 'translateY(-50%) translateX(0)'
                                    })
                                    parent?.addEventListener('mouseleave', () => {
                                      el.style.opacity = '0'
                                      el.style.transform = 'translateY(-50%) translateX(4px)'
                                    })
                                  }
                                }}
                              >
                                <div
                                  className="whitespace-nowrap"
                                  style={{
                                    padding: '8px 12px',
                                    background: 'rgba(20,20,25,0.98)',
                                    border: '1px solid rgba(255,255,255,0.12)',
                                    borderRadius: 8,
                                    boxShadow: '0 8px 24px rgba(0,0,0,0.4)',
                                  }}
                                >
                                  <p style={{ fontSize: 12, fontWeight: 600, color: 'rgba(255,255,255,0.9)' }}>{e.employee_name}</p>
                                  <p style={{ fontSize: 10, color: 'rgba(255,255,255,0.4)', marginTop: 1 }}>{jobTitle}</p>
                                  <div className="flex items-center gap-1.5 mt-1.5">
                                    <div style={{ width: 5, height: 5, borderRadius: '50%', background: statusColor }} />
                                    <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.5)' }}>
                                      {statusLabel}{e.clock_in_at && !isAbsent && ` · ${formatDate(e.clock_in_at, tz, 'time')}`}
                                    </span>
                                  </div>
                                  {e.workMode && (
                                    <div className="mt-1.5" style={{
                                      display: 'inline-block',
                                      padding: '2px 6px',
                                      borderRadius: 4,
                                      fontSize: 9,
                                      fontWeight: 700,
                                      letterSpacing: '0.05em',
                                      background: e.workMode === 'wfh' ? 'rgba(155,143,247,0.15)' : 'rgba(18,160,92,0.15)',
                                      color: e.workMode === 'wfh' ? '#9B8FF7' : '#12A05C',
                                    }}>
                                      {e.workMode === 'wfh' ? '🏠 WFH' : '🏢 WFO'}
                                    </div>
                                  )}
                                </div>
                              </div>
                            </div>
                          )
                        })}
                        {remaining > 0 && (
                          <Link
                            to="/attendance"
                            className="flex justify-center items-center transition-opacity"
                            style={{
                              width: 36,
                              height: 36,
                              borderRadius: '50%',
                              background: 'rgba(255,255,255,0.06)',
                              fontSize: 12,
                              fontWeight: 700,
                              color: 'rgba(255,255,255,0.4)',
                            }}
                          >
                            +{remaining}
                          </Link>
                        )}
                      </>
                    )
                  })()}
                </div>
              </div>


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

interface DonutSegment {
  label: string
  value: number
  color: string
}

function DonutChart({ size, segments, total, centerLabel }: {
  size: number
  segments: DonutSegment[]
  total: number
  centerLabel: string
}) {
  const [hovered, setHovered] = useState<string | null>(null)
  const center = size / 2
  const radius = size * 0.38
  const strokeWidth = size * 0.12
  const circumference = 2 * Math.PI * radius
  const safeTotal = total || 1

  // Build offsets
  const arcs: { seg: DonutSegment; length: number; offset: number }[] = []
  let cumOffset = 0
  for (const seg of segments) {
    const length = circumference * (seg.value / safeTotal)
    arcs.push({ seg, length, offset: cumOffset })
    cumOffset += length
  }

  const hoveredSeg = hovered ? segments.find((s) => s.label === hovered) : null

  return (
    <div className="flex flex-col items-center">
      {/* Chart */}
      <div className="relative" style={{ width: size, height: size }}>
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ transform: 'rotate(-90deg)' }}>
          {/* Background ring */}
          <circle cx={center} cy={center} r={radius} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth={strokeWidth} />
          {/* Segments */}
          {arcs.map(({ seg, length, offset }) =>
            length > 0 ? (
              <circle
                key={seg.label}
                cx={center}
                cy={center}
                r={radius}
                fill="none"
                stroke={seg.color}
                strokeWidth={hovered === seg.label ? strokeWidth + 4 : strokeWidth}
                strokeDasharray={`${length} ${circumference}`}
                strokeDashoffset={-offset}
                strokeLinecap="round"
                style={{
                  transition: 'stroke-dasharray 0.5s ease, stroke-dashoffset 0.5s ease, stroke-width 0.15s ease',
                  cursor: 'pointer',
                  filter: hovered && hovered !== seg.label ? 'opacity(0.4)' : 'none',
                }}
                onMouseEnter={() => setHovered(seg.label)}
                onMouseLeave={() => setHovered(null)}
              />
            ) : null,
          )}
        </svg>
        {/* Center text */}
        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
          {hoveredSeg ? (
            <>
              <p style={{ fontSize: size * 0.17, fontWeight: 800, color: hoveredSeg.color, lineHeight: 1, fontFamily: typography.fontMono }}>
                {hoveredSeg.value}
              </p>
              <p style={{ fontSize: 10, color: 'rgba(255,255,255,0.5)', marginTop: 3, fontWeight: 600 }}>
                {hoveredSeg.label}
              </p>
            </>
          ) : (
            <>
              <p style={{ fontSize: size * 0.17, fontWeight: 800, color: 'rgba(255,255,255,0.9)', lineHeight: 1, fontFamily: typography.fontMono }}>
                {total}
              </p>
              <p style={{ fontSize: 10, color: 'rgba(255,255,255,0.4)', marginTop: 3, textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600 }}>
                {centerLabel}
              </p>
            </>
          )}
        </div>
      </div>
      {/* Legend */}
      <div className="flex flex-wrap justify-center gap-x-4 gap-y-1.5 mt-4">
        {segments.map((seg) => (
          <div
            key={seg.label}
            className="flex items-center gap-1.5 cursor-pointer"
            style={{ opacity: hovered && hovered !== seg.label ? 0.4 : 1, transition: 'opacity 0.15s' }}
            onMouseEnter={() => setHovered(seg.label)}
            onMouseLeave={() => setHovered(null)}
          >
            <div style={{ width: 7, height: 7, borderRadius: '50%', background: seg.color }} />
            <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.6)', fontWeight: 600 }}>{seg.label}</span>
            <span style={{ fontSize: 12, fontFamily: typography.fontMono, color: 'rgba(255,255,255,0.9)', fontWeight: 700 }}>{seg.value}</span>
          </div>
        ))}
      </div>
    </div>
  )
}