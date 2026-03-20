import { createFileRoute, Link } from '@tanstack/react-router'
import { useState, useEffect, useMemo } from 'react'
import { useAuthStore } from '@/lib/stores/auth'
import { useOrganisation } from '@/lib/hooks/useOrganisation'
import { useEmployees, useMyEmployee } from '@/lib/hooks/useEmployees'
import { useDailyReport, useMonthlyReport, useClockIn, useClockOut } from '@/lib/hooks/useAttendance'
import { useMyBalances } from '@/lib/hooks/useLeave'
import { todayISO, formatDate } from '@/lib/utils/date'
import { moduleBackgrounds, colors, typography } from '@/design/tokens'
import { Avatar } from '@/components/workived/layout/Avatar'
import { LogIn, LogOut, Clock, Timer, Users, CalendarDays, TrendingUp, Building2, ChevronRight } from 'lucide-react'

// ── Tooltip ──────────────────────────────────────────────────────
import { useRef, useState as useTooltipState } from 'react'

function TeamTooltip({ children, content }: { children: React.ReactNode, content: React.ReactNode }) {
  const [visible, setVisible] = useTooltipState(false)
  const timeout = useRef<NodeJS.Timeout | null>(null)
  return (
    <span
      style={{ position: 'relative', display: 'block' }}
      onMouseEnter={() => { timeout.current = setTimeout(() => setVisible(true), 200) }}
      onMouseLeave={() => { if (timeout.current) clearTimeout(timeout.current); setVisible(false) }}
      onFocus={() => setVisible(true)}
      onBlur={() => setVisible(false)}
      tabIndex={0}
    >
      {children}
      {visible && (
        <span
          style={{
            position: 'absolute',
            zIndex: 100,
            left: '50%',
            bottom: '100%',
            transform: 'translateX(-50%)',
            marginBottom: 12,
            background: 'rgba(30,30,40,0.98)',
            color: '#fff',
            borderRadius: 8,
            boxShadow: '0 4px 24px 0 rgba(0,0,0,0.18)',
            padding: '13px 18px',
            fontSize: 13,
            fontWeight: 500,
            minWidth: 210,
            maxWidth: 320,
            pointerEvents: 'none',
            whiteSpace: 'pre-line',
          }}
        >
          {content}
        </span>
      )}
    </span>
  )
}

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

  const { data: employees, isLoading: empLoading} = useEmployees({ limit: 100 })
  const { data: daily, isLoading: dailyLoading } = useDailyReport(today)

  // Leave balances for current year
  const currentYear = new Date().getFullYear()
  const { data: leaveBalances } = useMyBalances(currentYear)

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
  const dailyQuote = useDailyQuote()

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
      <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-6" style={{ marginBottom: 24 }}>
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
            <span style={{ color: colors.accentMid }}>{firstName}</span> <span aria-label="wave" role="img">👋</span>
          </h1>
        </div>

        {/* Date, live clock, and notification on right */}
        <div className="flex flex-col gap-3 md:items-end md:justify-end md:flex-row md:gap-4" style={{ minWidth: 340, flex: 1 }}>
          <div className="flex items-center gap-4" style={{ minHeight: 38 }}>
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
          {/* Notification Placeholder */}
          <div
            style={{
              minWidth: 36,
              height: 36,
              background: 'rgba(255,255,255,0.10)',
              borderRadius: 10,
              boxShadow: '0 1px 4px 0 rgba(0,0,0,0.04)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: 0,
            }}
            title="No notifications"
          >
            <svg width="18" height="18" fill="none" viewBox="0 0 24 24" style={{ color: colors.accentMid, flexShrink: 0 }}>
              <path d="M18 16v-5a6 6 0 10-12 0v5a2 2 0 01-2 2h16a2 2 0 01-2-2z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
              <path d="M13.73 21a2 2 0 01-3.46 0" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </div>
        </div>
      </div>

      {/* Motivational Quote Card (moved below header) */}
      <div
        style={{
          maxWidth: 680,
          margin: '0 auto 24px auto',
          background: 'rgba(255,255,255,0.07)',
          borderRadius: 16,
          boxShadow: '0 4px 24px 0 rgba(0,0,0,0.10)',
          padding: '22px 40px',
          display: 'flex',
          alignItems: 'center',
          gap: 22,
        }}
      >
        <span style={{ fontSize: 32, color: colors.accentMid, marginRight: 8 }}>❝</span>
        <div style={{ flex: 1 }}>
          <p style={{ fontSize: 17, color: colors.ink0, fontWeight: 600, marginBottom: 4, lineHeight: 1.4 }}>{dailyQuote.text}</p>
          <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.45)', fontWeight: 500, textAlign: 'right' }}>— {dailyQuote.author}</p>
        </div>
      </div>

      {/* ── Main Content (responsive 3 columns, flex grid, with border) ──────────────────────────── */}
      <div
        className="dashboard-columns"
        style={{ display: 'flex', gap: 32, marginTop: 32 }}
      >
        {/* Left: My Attendance Card */}
        <div className="dashboard-col" style={{
          flex: 1,
          minWidth: 0,
          display: 'flex',
          flexDirection: 'column',
          border: '1px solid rgba(255,255,255,0.10)',
          borderRadius: 18,
          background: colors.accentText,
          color: colors.ink0,
          boxShadow: '0 2px 16px 0 rgba(0,0,0,0.10)',
          position: 'relative',
          overflow: 'hidden',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '18px 28px 0 28px' }}>
            <Timer size={20} style={{ color: colors.accentMid, flexShrink: 0 }} />
            <h3
              style={{
                fontSize: typography.h2.size,
                fontWeight: typography.h2.weight,
                color: colors.ink0,
                letterSpacing: typography.h2.tracking,
                lineHeight: typography.h2.lineHeight,
                marginBottom: 0,
              }}
            >
              {hasClockedOut
                ? "You've completed your work today"
                : hasClockedIn
                ? "You're clocked in"
                : 'Clock in to start your day'}
            </h3>
          </div>
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
                    <Timer size={16} style={{ color: colors.ink0 }} />
                    <p style={{ fontSize: typography.tiny.size, color: colors.ink0, textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: Number(typography.tiny.weight) }}>
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
                    <p style={{ fontSize: 13, color: colors.ink0 }}>
                      Clocked in at <span style={{ fontFamily: typography.fontMono, fontWeight: 700, color: colors.ink0 }}>{myEntry?.clock_in_at ? formatDate(myEntry.clock_in_at, tz, 'time') : ''}</span>
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
        <div className="dashboard-col" style={{
          flex: 1,
          minWidth: 0,
          display: 'flex',
          flexDirection: 'column',
          border: '1px solid rgba(255,255,255,0.10)',
          borderRadius: 18,
          boxShadow: '0 2px 16px 0 rgba(0,0,0,0.08)',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '18px 28px 0 28px', marginBottom: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <Users size={20} style={{ color: colors.accentMid, flexShrink: 0 }} />
              <h3 style={{ fontSize: typography.h2.size, fontWeight: typography.h2.weight, color: 'rgba(255,255,255,0.7)', letterSpacing: typography.h2.tracking, lineHeight: typography.h2.lineHeight, marginBottom: 0 }}>
                Team attendance
              </h3>
            </div>
            <Link
              to="/attendance"
              className="text-xs font-semibold transition-opacity hover:opacity-100"
              style={{ color: 'rgba(255,255,255,0.45)', textDecoration: 'none', marginLeft: 12 }}
            >
              View all
            </Link>
          </div>
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
        <div className="dashboard-col" style={{
          flex: 1,
          minWidth: 0,
          display: 'flex',
          flexDirection: 'column',
          border: '1px solid rgba(255,255,255,0.10)',
          borderRadius: 18,
          boxShadow: '0 2px 16px 0 rgba(0,0,0,0.08)',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '18px 28px 0 28px', marginBottom: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <Building2 size={20} style={{ color: colors.accentMid, flexShrink: 0 }} />
              <h3 style={{ fontSize: typography.h2.size, fontWeight: typography.h2.weight, color: 'rgba(255,255,255,0.7)', letterSpacing: typography.h2.tracking, lineHeight: typography.h2.lineHeight, marginBottom: 0 }}>
                Your team today
              </h3>
            </div>
            <Link
              to="/people"
              className="text-xs font-semibold transition-opacity hover:opacity-100"
              style={{ color: 'rgba(255,255,255,0.45)', textDecoration: 'none', marginLeft: 12 }}
            >
              View all
            </Link>
          </div>
          <div style={{ marginTop: 20, padding: '0 28px 28px 28px' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, width: '100%' }}>
              {teamMembers.slice(0, 8).map((m) => {
                const att = m.attendance
                const isPresent = att?.status === 'present' || att?.status === 'late'
                const isLate = att?.status === 'late'
                const isOnLeave = att?.onLeave
                const isAbsent = att?.status === 'absent' && !isOnLeave
                const noRecord = !att

                const statusColor = isOnLeave ? colors.accentMid : isAbsent ? colors.err : isLate ? colors.warn : isPresent ? colors.ok : 'rgba(255,255,255,0.15)'
                const statusLabel = isOnLeave ? 'On Leave' : isAbsent ? 'Absent' : isLate ? 'Late' : isPresent ? 'Ontime' : 'Not clocked in'

                // Calculate worked hours for present employees
                let workedHours = ''
                if (isPresent && att?.clock_in_at) {
                  const clockIn = new Date(att.clock_in_at)
                  const clockOut = att.clock_out_at ? new Date(att.clock_out_at) : new Date()
                  const diffMs = clockOut.getTime() - clockIn.getTime()
                  const hours = Math.floor(diffMs / (1000 * 60 * 60))
                  const minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60))
                  workedHours = `${hours}h ${minutes}m`
                }

                return (
                  <TeamTooltip
                    key={m.id}
                    content={
                      <>
                        <div style={{ fontWeight: 700, fontSize: 15, color: '#fff', marginBottom: 2 }}>{m.full_name}</div>
                        <div style={{ fontSize: 12.5, color: '#bdbdc7', marginBottom: 7 }}>{m.job_title || m.employment_type.replace('_', ' ')}</div>
                        <div style={{ fontSize: 12.5, color: '#e0e0e0', marginBottom: 2 }}>
                          <span style={{ fontWeight: 600 }}>Status:</span> <span style={{ color: statusColor, fontWeight: 700 }}>{statusLabel}</span>
                        </div>
                        <div style={{ fontSize: 12.5, color: '#e0e0e0' }}>
                          <span style={{ fontWeight: 600 }}>Working hours:</span> {isPresent && att?.clock_in_at ? workedHours : '—'}
                        </div>
                      </>
                    }
                  >
                    <Link
                      to="/people/$id"
                      params={{ id: m.id }}
                      className="group"
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        padding: '10px 14px',
                        borderRadius: 12,
                        background: 'rgba(255,255,255,0.045)',
                        boxShadow: '0 1px 6px 0 rgba(0,0,0,0.06)',
                        cursor: 'pointer',
                        textDecoration: 'none',
                        opacity: isAbsent || noRecord ? 0.55 : 1,
                        border: 'none',
                        transition: 'box-shadow 0.16s, background 0.16s, transform 0.16s',
                      }}
                      onMouseEnter={e => {
                        e.currentTarget.style.background = 'rgba(255,255,255,0.09)';
                        e.currentTarget.style.boxShadow = '0 3px 14px 0 rgba(0,0,0,0.13)';
                        e.currentTarget.style.transform = 'translateY(-1.5px) scale(1.012)';
                      }}
                      onMouseLeave={e => {
                        e.currentTarget.style.background = 'rgba(255,255,255,0.045)';
                        e.currentTarget.style.boxShadow = '0 1px 6px 0 rgba(0,0,0,0.06)';
                        e.currentTarget.style.transform = 'none';
                      }}
                    >
                      {/* Column 1: Avatar, name, job title */}
                      <div style={{ flex: 2, display: 'flex', alignItems: 'center', minWidth: 0 }}>
                        <div className="flex-shrink-0" style={{ marginRight: 10, width: 32, height: 32, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          <Avatar name={m.full_name} id={m.id} size={28} />
                        </div>
                        <div className="min-w-0" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                          <p className="truncate" style={{ fontSize: 14.5, fontWeight: 700, color: 'rgba(255,255,255,0.96)', letterSpacing: '-0.01em' }}>
                            {m.full_name}
                          </p>
                          <p className="truncate" style={{ fontSize: 11.5, color: 'rgba(255,255,255,0.38)', marginTop: 1, fontWeight: 500 }}>
                            {m.job_title || m.employment_type.replace('_', ' ')}
                          </p>
                        </div>
                      </div>
                      {/* Column 2: Working hours */}
                      <div style={{ flex: 1, textAlign: 'center', fontFamily: typography.fontMono, fontSize: 12.5, color: 'rgba(255,255,255,0.60)', fontWeight: 600 }}>
                        {isPresent && att?.clock_in_at ? workedHours : '—'}
                      </div>
                      {/* Column 3: Status badge */}
                      <div style={{ flex: 1, display: 'flex', justifyContent: 'flex-end' }}>
                        <span
                          style={{
                            display: 'inline-flex', alignItems: 'center',
                            padding: '3px 13px 3px 8px',
                            borderRadius: 999,
                            fontSize: 12,
                            fontWeight: 700,
                            letterSpacing: '0.02em',
                            background: 'rgba(255,255,255,0.10)',
                            color: statusColor,
                            border: `1.2px solid ${statusColor}33`,
                            boxShadow: `0 1px 2px 0 ${statusColor}11`,
                            minWidth: 60,
                            textAlign: 'center',
                          }}
                        >
                          <span style={{
                            display: 'inline-block',
                            width: 8, height: 8,
                            borderRadius: '50%',
                            background: statusColor,
                            marginRight: 7,
                            boxShadow: `0 0 0 1.5px #18181f`,
                          }} />
                          {statusLabel}
                        </span>
                      </div>
                    </Link>
                  </TeamTooltip>
                )
              })}
            </div>
            {totalEmployees > 8 && (
              <Link
                to="/attendance"
                className="flex justify-center text-sm font-semibold mt-4 transition-opacity hover:opacity-100"
                style={{ color: 'rgba(255,255,255,0.35)' }}
              >
                +{totalEmployees - 8} more →
              </Link>
            )}
          </div>
        </div>
      </div>

      {/* Leave Balance Summary */}
      {leaveBalances && leaveBalances.length > 0 && (
        <div style={{ marginTop: 32, maxWidth: 900, margin: '32px auto 0 auto' }}>
          <div 
            style={{
              border: '1px solid rgba(255,255,255,0.10)',
              borderRadius: 18,
              boxShadow: '0 2px 16px 0 rgba(0,0,0,0.08)',
              background: colors.accentText,
              padding: '28px',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <CalendarDays size={20} style={{ color: colors.accentMid, flexShrink: 0 }} />
                <h3 style={{ 
                  fontSize: typography.h2.size, 
                  fontWeight: typography.h2.weight, 
                  color: 'rgba(255,255,255,0.7)', 
                  letterSpacing: typography.h2.tracking, 
                  lineHeight: typography.h2.lineHeight, 
                  marginBottom: 0 
                }}>
                  Your leave balance ({currentYear})
                </h3>
              </div>
              <Link
                to="/leave"
                className="flex items-center gap-1 text-sm font-semibold transition-opacity hover:opacity-100"
                style={{ color: 'rgba(255,255,255,0.45)', textDecoration: 'none' }}
              >
                View details <ChevronRight size={16} />
              </Link>
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16 }}>
              {leaveBalances.map((balance) => {
                const available = balance.entitled_days + balance.carried_over_days - balance.used_days - balance.pending_days
                const totalEntitled = balance.entitled_days + balance.carried_over_days
                const usagePercent = totalEntitled > 0 ? ((balance.used_days + balance.pending_days) / totalEntitled) * 100 : 0

                return (
                  <div
                    key={balance.policy_name}
                    style={{
                      flex: '1 1 calc(33.333% - 11px)',
                      minWidth: 200,
                      background: 'rgba(255,255,255,0.05)',
                      borderRadius: 12,
                      padding: '18px 20px',
                      border: '1px solid rgba(255,255,255,0.08)',
                    }}
                  >
                    <p style={{ fontSize: 13, fontWeight: 600, color: 'rgba(255,255,255,0.5)', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                      {balance.policy_name}
                    </p>
                    <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, marginBottom: 12 }}>
                      <p style={{ fontSize: 32, fontWeight: 800, color: available > 0 ? colors.ok : 'rgba(255,255,255,0.3)', fontFamily: typography.fontMono, letterSpacing: '-0.02em', lineHeight: 1 }}>
                        {available.toFixed(1)}
                      </p>
                      <span style={{ fontSize: 14, color: 'rgba(255,255,255,0.4)', fontWeight: 600 }}>
                        / {totalEntitled.toFixed(1)} days
                      </span>
                    </div>
                    <div style={{ marginBottom: 10 }}>
                      <div style={{ width: '100%', height: 6, background: 'rgba(255,255,255,0.10)', borderRadius: 3, overflow: 'hidden' }}>
                        <div style={{ 
                          width: `${Math.min(100, usagePercent)}%`, 
                          height: '100%', 
                          background: usagePercent > 90 ? colors.err : usagePercent > 70 ? colors.warn : colors.ok,
                          transition: 'width 0.3s ease',
                        }} />
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: 16, fontSize: 12 }}>
                      <div>
                        <span style={{ color: 'rgba(255,255,255,0.4)', fontWeight: 500 }}>Used: </span>
                        <span style={{ color: colors.ink0, fontWeight: 700 }}>{balance.used_days.toFixed(1)}</span>
                      </div>
                      {balance.pending_days > 0 && (
                        <div>
                          <span style={{ color: 'rgba(255,255,255,0.4)', fontWeight: 500 }}>Pending: </span>
                          <span style={{ color: colors.warn, fontWeight: 700 }}>{balance.pending_days.toFixed(1)}</span>
                        </div>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      )}

      {/* Responsive styles for dashboard columns */}
      <style>{`
        @media (max-width: 900px) {
          .dashboard-columns {
            flex-direction: column !important;
            gap: 0 !important;
          }
          .dashboard-col {
            width: 100% !important;
            margin-bottom: 36px;
            box-shadow: 0 2px 16px 0 rgba(0,0,0,0.10) !important;
          }
        }
        @media (max-width: 600px) {
          .dashboard-columns {
            margin-top: 0 !important;
          }
          .dashboard-col {
            border-radius: 14px !important;
            padding-left: 0 !important;
            padding-right: 0 !important;
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
          showPercent
        />
        <div className="flex flex-col gap-2.5 mt-4 w-full">
          {segments.map((s) => {
            const percent = totalEmployees > 0 ? (s.value / totalEmployees) * 100 : 0
            return (
              <div
                key={s.label}
                className="flex items-center gap-2 cursor-pointer"
                style={{ opacity: hovered && hovered !== s.label ? 0.4 : 1, transition: 'opacity 0.15s' }}
                onMouseEnter={() => setHovered(s.label)}
                onMouseLeave={() => setHovered(null)}
              >
                <div style={{ width: 7, height: 7, borderRadius: '50%', background: s.legendColor ?? s.color, flexShrink: 0 }} />
                <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.5)', fontWeight: 500, width: 64 }}>{s.label}</span>
                <span style={{ fontFamily: typography.fontMono, fontSize: 13, fontWeight: 700, color: s.value > 0 ? (s.legendColor ?? s.color) : 'rgba(255,255,255,0.2)', width: 28, textAlign: 'right' }}>
                  {s.value}
                </span>
                <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.35)', fontWeight: 600, width: 32, textAlign: 'right' }}>
                  {percent.toFixed(0)}%
                </span>
                <div style={{ width: 48, height: 4, borderRadius: 2, background: 'rgba(255,255,255,0.05)', flexShrink: 0, flex: 1 }}>
                  <div style={{
                    width: `${percent}%`,
                    height: '100%',
                    borderRadius: 2,
                    background: s.legendColor ?? s.color,
                    transition: 'width 0.5s ease',
                  }} />
                </div>
              </div>
            )
          })}
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

function DonutChart({ size, segments, total, centerLabel, hovered, onHover, showPercent }: {
  size: number
  segments: DonutSegment[]
  total: number
  centerLabel: string
  hovered?: string | null
  onHover?: (label: string | null) => void
  showPercent?: boolean
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
