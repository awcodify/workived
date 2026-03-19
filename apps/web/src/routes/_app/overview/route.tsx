import { createFileRoute, Link } from '@tanstack/react-router'
import { useState, useEffect, useMemo } from 'react'
import { useAuthStore } from '@/lib/stores/auth'
import { useOrganisation } from '@/lib/hooks/useOrganisation'
import { useEmployees, useMyEmployee } from '@/lib/hooks/useEmployees'
import { useDailyReport, useMonthlyReport, useClockIn, useClockOut } from '@/lib/hooks/useAttendance'
import { todayISO, formatDate } from '@/lib/utils/date'
import { moduleBackgrounds, colors, typography } from '@/design/tokens'
import { Avatar } from '@/components/workived/layout/Avatar'
import { LogIn, LogOut, Clock, Timer, Users, CalendarDays, TrendingUp, Building2, ChevronRight } from 'lucide-react'

export const Route = createFileRoute('/_app/overview')({
  component: OverviewPage,
})
// TODO: move it to admin config.
// ── Quotes ──────────────────────────────────────────────────────

const QUOTES = [
  { text: 'The only way to do great work is to love what you do.', author: 'Steve Jobs' },
  { text: 'Success is not final, failure is not fatal: it is the courage to continue that counts.', author: 'Winston Churchill' },
  { text: 'Done is better than perfect.', author: 'Sheryl Sandberg' },
  { text: 'Move fast and break things. Unless you are breaking stuff, you are not moving fast enough.', author: 'Mark Zuckerberg' },
  { text: 'The best time to plant a tree was 20 years ago. The second best time is now.', author: 'Chinese Proverb' },
  { text: 'It always seems impossible until it is done.', author: 'Nelson Mandela' },
  { text: 'Stay hungry, stay foolish.', author: 'Steve Jobs' },
  { text: 'Talent wins games, but teamwork and intelligence win championships.', author: 'Michael Jordan' },
  { text: 'If you want to go fast, go alone. If you want to go far, go together.', author: 'African Proverb' },
  { text: 'Work hard in silence, let your success be your noise.', author: 'Frank Ocean' },
  { text: 'The secret of getting ahead is getting started.', author: 'Mark Twain' },
  { text: 'What you do today can improve all your tomorrows.', author: 'Ralph Marston' },
]

function useDailyQuote() {
  const [index] = useState(() => Math.floor(Math.random() * QUOTES.length))
  return QUOTES[index]
}

// ── Hooks ───────────────────────────────────────────────────────

function useGreeting() {
  const hour = new Date().getHours()
  if (hour < 12) return 'Good morning,'
  if (hour < 17) return 'Good afternoon,'
  return 'Good evening,'
}

function useLiveClock(tz: string) {
  const [clock, setClock] = useState(() => formatTime(tz))
  useEffect(() => {
    const id = setInterval(() => setClock(formatTime(tz)), 1000)
    return () => clearInterval(id)
  }, [tz])
  return clock
}

function formatTime(tz: string) {
  const now = new Date()
  const time = new Intl.DateTimeFormat('en', {
    timeZone: tz,
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: true,
  }).format(now)
  // Split into time and period (e.g. "06:23:10 PM")
  const parts = time.match(/^(.+?)\s*(AM|PM)$/i)
  if (parts) return { time: parts[1]!.trim(), period: parts[2]!.toUpperCase() }
  return { time, period: '' }
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

  // Use only real attendance data, no simulation
  const enrichedEntries = useMemo(() => {
    if (!daily) return []
    return daily.map((e) => ({ ...e }))
  }, [daily])

  const onLeaveCount = enrichedEntries.filter((e) => e.onLeave).length
  const trueAbsent = absent - onLeaveCount

  const fullName = user?.full_name ?? myEmployee?.full_name
  const firstName = fullName?.split(' ')[0] ?? 'there'

  const greeting = useGreeting()
  const clock = useLiveClock(tz)

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

  // Team pulse data — merge employees with daily report
  const teamMembers = useMemo(() => {
    const empList = employees?.data ?? []
    return empList.map((emp) => {
      const entry = enrichedEntries.find((e) => e.employee_id === emp.id)
      return { ...emp, attendance: entry ?? null }
    })
  }, [employees?.data, enrichedEntries])

  return (
    <div
      className="min-h-screen px-6 py-6 md:px-11 md:py-8 pb-24"
      style={{ background: moduleBackgrounds.overview }}
    >
      {/* Header: Greeting left, Date/clock right */}
      <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-6">
        <div>
          {/* Greeting */}
          <h1
            className="mt-2"
            style={{
              fontSize: typography.display.size,
              fontWeight: typography.display.weight,
              letterSpacing: typography.display.tracking,
              lineHeight: typography.display.lineHeight,
              color: colors.ink0,
            }}
          >
            {greeting}
            <br />
            <span style={{ color: colors.accentMid }}>{firstName}</span>
          </h1>
        </div>

        {/* Date and live clock on right */}
        <div className="md:text-right" style={{ minWidth: 220 }}>
          <div className="flex items-center justify-end gap-4 mt-4" style={{ minHeight: 38 }}>
            <p
              className="uppercase"
              style={{
                fontSize: 15,
                fontWeight: 600,
                color: 'rgba(255,255,255,0.32)',
                letterSpacing: '0.10em',
                lineHeight: 1.2,
              }}
            >
              {formatDateLabel(tz)}
            </p>
            <span style={{ width: 1, height: 22, background: 'rgba(255,255,255,0.10)', borderRadius: 2 }} />
            <div className="flex items-baseline gap-2">
              <p
                style={{
                  fontFamily: typography.fontMono,
                  fontSize: 22,
                  fontWeight: 700,
                  color: 'rgba(255,255,255,0.6)',
                  letterSpacing: '-0.02em',
                  lineHeight: 1,
                }}
              >
                {clock.time}
              </p>
              <span
                style={{
                  fontSize: 13,
                  fontWeight: 700,
                  color: 'rgba(255,255,255,0.3)',
                  letterSpacing: '0.04em',
                }}
              >
                {clock.period}
              </span>
            </div>
          </div>
        </div>
      </div>
      {/* ── Main Content (responsive 3 columns, flex grid, with border) ──────────────────────────── */}
      <div
        className="dashboard-columns"
        style={{ display: 'flex', gap: 32, marginTop: 40 }}
      >
        {/* Left: My Attendance Card */}
        <div className="dashboard-col" style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', border: '1px solid rgba(255,255,255,0.10)', borderRadius: 14 }}>
          <h3
            style={{
              fontSize: typography.h2.size,
              fontWeight: typography.h2.weight,
              color: hasClockedOut ? colors.ok : hasClockedIn ? colors.ok : 'rgba(255,255,255,0.7)',
              letterSpacing: typography.h2.tracking,
              lineHeight: typography.h2.lineHeight,
              marginBottom: 0,
              padding: '18px 28px 0 28px',
            }}
          >
            {hasClockedOut
              ? "You've completed your work today"
              : hasClockedIn
              ? "You're clocked in"
              : 'Clock in to start your day'}
          </h3>
          <div style={{ marginTop: 20, display: 'flex', flexDirection: 'column', padding: '0 28px 28px 28px' }}>
            <div style={{ flex: 1 }}>
              {!myEmployee ? (
                <p style={{ fontSize: 15, color: 'rgba(255,255,255,0.35)' }}>
                  No employee record linked to your account.
                </p>
              ) : hasClockedOut ? (
                myEntry?.clock_in_at && myEntry?.clock_out_at && (() => {
                  const inTime = new Date(myEntry.clock_in_at)
                  const outTime = new Date(myEntry.clock_out_at)
                  const diffMs = outTime.getTime() - inTime.getTime()
                  const hours = Math.floor(diffMs / (1000 * 60 * 60))
                  const minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60))
                  return (
                    <>
                      <p style={{ fontSize: typography.tiny.size, color: 'rgba(255,255,255,0.5)', textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: Number(typography.tiny.weight), marginBottom: 10 }}>
                        You worked today
                      </p>
                      <p style={{ fontFamily: typography.fontMono, fontSize: 48, fontWeight: 800, color: colors.ok, letterSpacing: '-0.02em', lineHeight: 1, marginBottom: 18 }}>
                        {hours}h {minutes}m
                      </p>
                      <div className="flex items-center gap-5">
                        <div className="flex items-center gap-2">
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 28, height: 28, borderRadius: 8, background: 'rgba(18,160,92,0.15)' }}>
                            <LogIn size={14} style={{ color: colors.ok }} />
                          </div>
                          <div>
                            <p style={{ fontSize: 10, color: 'rgba(255,255,255,0.4)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Clock In</p>
                            <p style={{ fontFamily: typography.fontMono, fontSize: 15, fontWeight: 700, color: 'rgba(255,255,255,0.85)' }}>
                              {formatDate(myEntry.clock_in_at, tz, 'time')}
                            </p>
                          </div>
                        </div>
                        <div style={{ width: 1, height: 28, background: 'rgba(255,255,255,0.1)' }} />
                        <div className="flex items-center gap-2">
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 28, height: 28, borderRadius: 8, background: 'rgba(201,123,42,0.15)' }}>
                            <LogOut size={14} style={{ color: colors.warn }} />
                          </div>
                          <div>
                            <p style={{ fontSize: 10, color: 'rgba(255,255,255,0.4)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Clock Out</p>
                            <p style={{ fontFamily: typography.fontMono, fontSize: 15, fontWeight: 700, color: 'rgba(255,255,255,0.85)' }}>
                              {formatDate(myEntry.clock_out_at, tz, 'time')}
                            </p>
                          </div>
                        </div>
                      </div>
                    </>
                  )
                })()
              ) : hasClockedIn ? (
                <>
                  <div className="flex items-center gap-2" style={{ marginBottom: 10 }}>
                    <Timer size={16} style={{ color: colors.ok }} />
                    <p style={{ fontSize: typography.tiny.size, color: 'rgba(255,255,255,0.45)', textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: Number(typography.tiny.weight) }}>
                      Working hours
                    </p>
                    {myEntry?.status === 'late' && (
                      <span style={{ padding: '2px 7px', borderRadius: 5, fontSize: 10, fontWeight: 700, background: `${colors.warn}18`, color: colors.warn, letterSpacing: '0.03em' }}>Late</span>
                    )}
                  </div>
                  <p style={{ fontFamily: typography.fontMono, fontSize: 56, fontWeight: 800, color: colors.ink0, letterSpacing: '-0.03em', lineHeight: 1, marginBottom: 18 }}>
                    {elapsed}
                  </p>
                  <div className="flex items-center gap-2 mb-6">
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 22, height: 22, borderRadius: 6, background: 'rgba(18,160,92,0.15)' }}>
                      <LogIn size={11} style={{ color: colors.ok }} />
                    </div>
                    <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.4)' }}>
                      Clocked in at <span style={{ fontFamily: typography.fontMono, fontWeight: 700, color: 'rgba(255,255,255,0.7)' }}>{myEntry?.clock_in_at ? formatDate(myEntry.clock_in_at, tz, 'time') : ''}</span>
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      placeholder="Note (optional)"
                      aria-label="Clock out note"
                      value={note}
                      onChange={(e) => setNote(e.target.value)}
                      className="flex-1 text-sm px-4 py-3 focus:outline-none"
                      style={{
                        background: 'rgba(255,255,255,0.04)',
                        border: '1px solid rgba(255,255,255,0.1)',
                        borderRadius: 12,
                        color: colors.ink0,
                      }}
                    />
                    <button
                      onClick={handleClockOut}
                      disabled={clockOut.isPending}
                      className="font-bold px-6 py-3 transition-all disabled:opacity-50"
                      style={{
                        background: colors.warn,
                        color: colors.ink0,
                        borderRadius: 12,
                        fontSize: 15,
                        letterSpacing: '-0.01em',
                      }}
                    >
                      {clockOut.isPending ? 'Clocking out...' : 'Clock Out'}
                    </button>
                  </div>
                </>
              ) : (
                <>
                  <div style={{ marginTop: 10 }}>
                    <div className="flex items-center gap-2" style={{ marginBottom: 20 }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 28, height: 28, borderRadius: 8, background: 'rgba(18,160,92,0.15)' }}>
                        <Clock size={15} style={{ color: colors.ok }} />
                      </div>
                      <p style={{ fontSize: typography.tiny.size, color: colors.ok, textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 700 }}>
                        Attendance Clock
                      </p>
                    </div>
                    <div className="flex items-baseline gap-3">
                      <p
                        style={{
                          fontFamily: typography.fontMono,
                          fontSize: 64,
                          fontWeight: 800,
                          color: colors.ink0,
                          letterSpacing: '-0.03em',
                          lineHeight: 1,
                        }}
                      >
                        {clock.time}
                      </p>
                      <span style={{ fontSize: 22, fontWeight: 700, color: 'rgba(255,255,255,0.35)', letterSpacing: '0.04em' }}>
                        {clock.period}
                      </span>
                    </div>
                    <p style={{ fontSize: 16, color: 'rgba(255,255,255,0.5)', marginTop: 14, fontWeight: 500 }}>
                      Ready to start your day?
                    </p>
                    <div className="flex gap-2 mt-6">
                      <input
                        type="text"
                        placeholder="Note (optional)"
                        aria-label="Clock in note"
                        value={note}
                        onChange={(e) => setNote(e.target.value)}
                        className="flex-1 text-sm px-4 py-3 focus:outline-none"
                        style={{
                          background: 'rgba(255,255,255,0.06)',
                          border: '1px solid rgba(255,255,255,0.12)',
                          borderRadius: 12,
                          color: colors.ink0,
                        }}
                      />
                      <button
                        onClick={handleClockIn}
                        disabled={clockIn.isPending}
                        className="font-bold px-6 py-3 transition-all disabled:opacity-50"
                        style={{
                          background: colors.ok,
                          color: colors.ink0,
                          borderRadius: 12,
                          fontSize: 15,
                          letterSpacing: '-0.01em',
                        }}
                      >
                        {clockIn.isPending ? 'Clocking in...' : 'Clock In'}
                      </button>
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Middle: Attendance Graph */}
        <div className="dashboard-col" style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', border: '1px solid rgba(255,255,255,0.10)', borderRadius: 14 }}>
          <h3 style={{ fontSize: typography.h2.size, fontWeight: typography.h2.weight, color: 'rgba(255,255,255,0.7)', letterSpacing: typography.h2.tracking, lineHeight: typography.h2.lineHeight, marginBottom: 0, padding: '18px 28px 0 28px' }}>
            Team attendance
          </h3>
          <div style={{ marginTop: 20, padding: '0 28px 28px 28px' }}>
            <AttendanceCard
              present={present}
              late={late}
              onLeaveCount={onLeaveCount}
              trueAbsent={trueAbsent}
              totalEmployees={totalEmployees}
              noBackground // Add prop to AttendanceCard to disable its internal background
            />
          </div>
        </div>

        {/* Right: Team Member List */}
        <div className="dashboard-col" style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', border: '1px solid rgba(255,255,255,0.10)', borderRadius: 14 }}>
          <h3 style={{ fontSize: typography.h2.size, fontWeight: typography.h2.weight, color: 'rgba(255,255,255,0.7)', letterSpacing: typography.h2.tracking, lineHeight: typography.h2.lineHeight, marginBottom: 0, padding: '18px 28px 0 28px' }}>
            Your team today
          </h3>
          <div style={{ marginTop: 20, display: 'flex', flexDirection: 'column', padding: '0 28px 28px 28px' }}>
            <div style={{ flex: 1 }}>
              {teamMembers.slice(0, 8).map((m) => {
                const att = m.attendance
                const isPresent = att?.status === 'present' || att?.status === 'late'
                const isLate = att?.status === 'late'
                const isOnLeave = att?.onLeave
                const isAbsent = att?.status === 'absent' && !isOnLeave
                const noRecord = !att

                const statusColor = isOnLeave ? colors.accentMid : isAbsent ? colors.err : isLate ? colors.warn : isPresent ? colors.ok : 'rgba(255,255,255,0.15)'
                const statusLabel = isOnLeave ? 'On Leave' : isAbsent ? 'Absent' : isLate ? 'Late' : isPresent ? 'On time' : 'Not clocked in'

                return (
                  <div
                    key={m.id}
                    className="flex items-center gap-3 px-4 py-3"
                    style={{ borderColor: 'rgba(255,255,255,0.05)', opacity: isAbsent || noRecord ? 0.55 : 1 }}
                  >
                    <div className="relative flex-shrink-0">
                      <Avatar name={m.full_name} id={m.id} size={34} />
                      <div
                        className="absolute"
                        style={{
                          bottom: -1, right: -1,
                          width: 9, height: 9,
                          borderRadius: '50%',
                          background: statusColor,
                          border: '2px solid #141419',
                        }}
                      />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="truncate" style={{ fontSize: 13, fontWeight: 600, color: 'rgba(255,255,255,0.85)' }}>
                        {m.full_name}
                      </p>
                      <p className="truncate" style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)', marginTop: 1 }}>
                        {m.job_title || m.employment_type.replace('_', ' ')}
                      </p>
                    </div>
                    <div className="flex-shrink-0 flex items-center gap-2">
                      {att?.clock_in_at && isPresent && (
                        <span style={{ fontFamily: typography.fontMono, fontSize: 11, color: 'rgba(255,255,255,0.4)' }}>
                          {formatDate(att.clock_in_at, tz, 'time')}
                        </span>
                      )}
                      <span
                        style={{
                          padding: '3px 8px',
                          borderRadius: 6,
                          fontSize: 10,
                          fontWeight: 700,
                          letterSpacing: '0.03em',
                          background: `${statusColor}18`,
                          color: statusColor,
                        }}
                      >
                        {statusLabel}
                      </span>
                    </div>
                  </div>
                )
              })}
              {totalEmployees > 8 && (
                <Link
                  to="/attendance"
                  className="flex justify-center text-sm font-semibold mt-3 transition-opacity hover:opacity-100"
                  style={{ color: 'rgba(255,255,255,0.35)' }}
                >
                  +{totalEmployees - 8} more →
                </Link>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Responsive styles for dashboard columns */}
      <style>{`
        @media (max-width: 900px) {
          .dashboard-columns {
            flex-direction: column !important;
            gap: 0 !important;
          }
          .dashboard-col {
            width: 100% !important;
            margin-bottom: 32px;
          }
        }
      `}</style>
    </div>
  )
}

// ── Subcomponents ──────────────────────────────────────────────

function AttendanceCard({ present, late, onLeaveCount, trueAbsent, totalEmployees }: {
  present: number; late: number; onLeaveCount: number; trueAbsent: number; totalEmployees: number
}) {
  const [hovered, setHovered] = useState<string | null>(null)
  const pending = Math.max(0, totalEmployees - present - late - trueAbsent - onLeaveCount)

  const segments = [
    { label: 'On Time', value: present, color: colors.ok },
    { label: 'Late', value: late, color: colors.warn },
    { label: 'On Leave', value: onLeaveCount, color: colors.accentMid },
    { label: 'Absent', value: trueAbsent, color: colors.err },
    { label: 'Pending', value: pending, color: 'rgba(255,255,255,0.07)', legendColor: 'rgba(255,255,255,0.2)' },
  ]

  return (
    <div>
      <div className="flex flex-col items-center">
        <DonutChart
          size={130}
          segments={segments.map(s => ({ label: s.label, value: s.value, color: s.color }))}
          total={totalEmployees}
          centerLabel="Total"
          hovered={hovered}
          onHover={setHovered}
        />
        <div className="flex flex-col gap-2.5 mt-4 w-full">
          {segments.map((s) => (
            <div
              key={s.label}
              className="flex items-center gap-2 cursor-pointer"
              style={{ opacity: hovered && hovered !== s.label ? 0.4 : 1, transition: 'opacity 0.15s' }}
              onMouseEnter={() => setHovered(s.label)}
              onMouseLeave={() => setHovered(null)}
            >
              <div style={{ width: 7, height: 7, borderRadius: '50%', background: s.legendColor ?? s.color, flexShrink: 0 }} />
              <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.5)', fontWeight: 500, width: 64 }}>{s.label}</span>
              <span style={{ fontFamily: typography.fontMono, fontSize: 13, fontWeight: 700, color: s.value > 0 ? (s.legendColor ?? s.color) : 'rgba(255,255,255,0.2)', width: 22, textAlign: 'right' }}>
                {s.value}
              </span>
              <div style={{ width: 48, height: 4, borderRadius: 2, background: 'rgba(255,255,255,0.05)', flexShrink: 0, flex: 1 }}>
                <div style={{
                  width: `${totalEmployees > 0 ? (s.value / totalEmployees) * 100 : 0}%`,
                  height: '100%',
                  borderRadius: 2,
                  background: s.legendColor ?? s.color,
                  transition: 'width 0.5s ease',
                }} />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

interface DonutSegment {
  label: string
  value: number
  color: string
}

function DonutChart({ size, segments, total, centerLabel, hovered, onHover }: {
  size: number
  segments: DonutSegment[]
  total: number
  centerLabel: string
  hovered?: string | null
  onHover?: (label: string | null) => void
}) {
  const [localHovered, setLocalHovered] = useState<string | null>(null)
  const activeHover = hovered !== undefined ? hovered : localHovered
  const setActiveHover = onHover ?? setLocalHovered
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

  const hoveredSeg = activeHover ? segments.find((s) => s.label === activeHover) : null

  return (
    <div className="flex flex-col items-center">
      {/* Chart */}
      <div className="relative" style={{ width: size, height: size }}>
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ transform: 'rotate(-90deg)' }} aria-label={`Donut chart: ${segments.map(s => `${s.label} ${s.value}`).join(', ')}`}>
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
                strokeWidth={activeHover === seg.label ? strokeWidth + 4 : strokeWidth}
                strokeDasharray={`${length} ${circumference}`}
                strokeDashoffset={-offset}
                strokeLinecap="round"
                style={{
                  transition: 'stroke-dasharray 0.5s ease, stroke-dashoffset 0.5s ease, stroke-width 0.15s ease',
                  cursor: 'pointer',
                  filter: activeHover && activeHover !== seg.label ? 'opacity(0.4)' : 'none',
                }}
                onMouseEnter={() => setActiveHover(seg.label)}
                onMouseLeave={() => setActiveHover(null)}
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
    </div>
  )
}
