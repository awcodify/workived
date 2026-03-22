import { createFileRoute, Link } from '@tanstack/react-router'
import { useState, useEffect, useMemo } from 'react'
import { useAuthStore } from '@/lib/stores/auth'
import { useOrganisation } from '@/lib/hooks/useOrganisation'
import { useEmployees, useMyEmployee } from '@/lib/hooks/useEmployees'
import { useTodayAttendance } from '@/lib/hooks/useAttendance'
import { useMyBalances, useCalendar, useHolidays, useLeaveNotificationCount } from '@/lib/hooks/useLeave'
import { useMyClaimBalances, useClaimNotificationCount } from '@/lib/hooks/useClaims'
import { useCanManageLeave, useCanManageClaims } from '@/lib/hooks/useRole'
import { todayISO, formatDate, getMondayOfWeek } from '@/lib/utils/date'
import { formatMoney } from '@/lib/utils/money'
import { useModuleTheme, useModuleBackground, colors, typography } from '@/design/tokens'
import { Avatar } from '@/components/workived/layout/Avatar'
import { AttendanceCard } from '@/components/workived/attendance/AttendanceCard'
import { Users, CalendarDays, Receipt, AlertCircle, ChevronRight } from 'lucide-react'

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

// ── Page ────────────────────────────────────────────────────────

function OverviewPage() {
  const t = useModuleTheme('overview')
  const bg = useModuleBackground('overview')
  
  const user = useAuthStore((s) => s.user)
  const { data: myEmployee } = useMyEmployee()
  const { data: org, isLoading: orgLoading } = useOrganisation()
  const tz = org?.timezone ?? 'UTC'
  const today = todayISO(tz)
  const weekStart = getMondayOfWeek(tz, 0)

  const { data: employees, isLoading: empLoading} = useEmployees({ limit: 100, status: 'active' })
  const { data: daily, isLoading: dailyLoading } = useTodayAttendance(weekStart, today)

  // Leave balances for current year
  const currentYear = new Date().getFullYear()
  const currentMonth = new Date().getMonth() + 1
  const { data: leaveBalances } = useMyBalances(currentYear)

  // Claims data
  const { data: claimBalances } = useMyClaimBalances(currentYear, currentMonth)

  // Calendar data — who's on leave today + upcoming holidays
  const { data: calendarEntries } = useCalendar(currentYear, currentMonth)
  const holidayDates = useMemo(() => {
    const now = new Date()
    const start = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
    const endDate = new Date(now)
    endDate.setDate(endDate.getDate() + 30)
    const end = `${endDate.getFullYear()}-${String(endDate.getMonth() + 1).padStart(2, '0')}-${String(endDate.getDate()).padStart(2, '0')}`
    return { start, end }
  }, [])
  const { data: holidays } = useHolidays(holidayDates.start, holidayDates.end)

  // Notification counts for pending approvals
  const canManageLeave = useCanManageLeave()
  const canManageClaims = useCanManageClaims()
  const { data: leaveNotifCount } = useLeaveNotificationCount()
  const { data: claimNotifCount } = useClaimNotificationCount()
  const pendingLeave = canManageLeave ? (leaveNotifCount ?? 0) : 0
  const pendingClaims = canManageClaims ? (claimNotifCount ?? 0) : 0
  const totalPending = pendingLeave + pendingClaims

  // Who's on leave today
  const todayStr = useMemo(() => {
    const now = new Date()
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
  }, [])
  const onLeaveEntries = useMemo(() => {
    if (!calendarEntries) return []
    return calendarEntries.filter((e) => e.start_date <= todayStr && e.end_date >= todayStr)
  }, [calendarEntries, todayStr])

  // Upcoming holidays (next 30 days, future only)
  const upcomingHolidays = useMemo(() => {
    if (!holidays) return []
    return holidays.filter((h) => h.date > todayStr).slice(0, 3)
  }, [holidays, todayStr])

  const totalEmployees = employees?.data?.length ?? 0
  const present = daily?.filter((e) => e.status === 'present').length ?? 0
  const late = daily?.filter((e) => e.status === 'late').length ?? 0
  const absent = daily?.filter((e) => e.status === 'absent').length ?? 0
  const onLeaveFromAttendance = daily?.filter((e) => e.status === 'on_leave').length ?? 0

  // Use only real attendance data, no simulation
  const enrichedEntries = useMemo(() => {
    if (!daily) return []
    return daily.map((e) => ({ ...e }))
  }, [daily])

  // On-leave count: use attendance status or fall back to calendar entries
  const onLeaveCount = onLeaveFromAttendance > 0 ? onLeaveFromAttendance : onLeaveEntries.length
  const trueAbsent = absent

  const fullName = user?.full_name ?? myEmployee?.full_name
  const firstName = fullName?.split(' ')[0] ?? 'there'

  const greeting = useGreeting()
  const clock = useLiveClock(tz)
  const dailyQuote = useDailyQuote()

  // Team pulse data — merge employees with daily report + leave calendar
  const teamMembers = useMemo(() => {
    const empList = employees?.data ?? []
    const leaveIds = new Set(onLeaveEntries.map((e) => e.employee_id))
    return empList.map((emp) => {
      const entry = enrichedEntries.find((e) => e.employee_id === emp.id)
      const isOnLeave = leaveIds.has(emp.id)
      return { ...emp, attendance: entry ?? null, isOnLeave }
    })
  }, [employees?.data, enrichedEntries, onLeaveEntries])

  return (
    <div
      className="min-h-screen px-6 py-6 md:px-11 md:py-8 pb-24"
      style={{ background: bg }}
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
              color: t.text,
            }}
          >
            {greeting}
            <br />
            <span style={{ color: colors.accent }}>{firstName}</span> <span aria-label="wave" role="img">👋</span>
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
                color: t.textMuted,
                letterSpacing: '0.10em',
                lineHeight: 1.2,
              }}
            >
              {formatDateLabel(tz)}
            </p>
            <span style={{ width: 1, height: 22, background: t.border, borderRadius: 2 }} />
            <div className="flex items-baseline gap-2">
              <p
                style={{
                  fontFamily: typography.fontMono,
                  fontSize: 22,
                  fontWeight: 700,
                  color: t.text,
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
                  color: t.textMuted,
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
              background: t.surface,
              borderRadius: 10,
              boxShadow: '0 1px 4px 0 rgba(0,0,0,0.04)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: 0,
              border: `1px solid ${t.border}`,
            }}
            title="No notifications"
          >
            <svg width="18" height="18" fill="none" viewBox="0 0 24 24" style={{ color: colors.accent, flexShrink: 0 }}>
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
          background: t.surface,
          borderRadius: 16,
          boxShadow: '0 2px 12px 0 rgba(0,0,0,0.06)',
          padding: '22px 40px',
          display: 'flex',
          alignItems: 'center',
          gap: 22,
          border: `1px solid ${t.border}`,
        }}
      >
        <span style={{ fontSize: 32, color: colors.accent, marginRight: 8 }}>❝</span>
        <div style={{ flex: 1 }}>
          <p style={{ fontSize: 17, color: t.text, fontWeight: 600, marginBottom: 4, lineHeight: 1.4 }}>{dailyQuote.text}</p>
          <p style={{ fontSize: 13, color: t.textMuted, fontWeight: 500, textAlign: 'right' }}>— {dailyQuote.author}</p>
        </div>
      </div>

      {/* ── Main Content: 3-Column Dashboard ──────────────────────────── */}
      <div
        className="dashboard-columns"
        style={{ display: 'flex', gap: 24, marginTop: 32 }}
      >

        {/* ═══ LEFT COLUMN: Clock In + Upcoming ═══ */}
        <div className="dashboard-col" style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 20 }}>

          {/* My Attendance Card */}
          <AttendanceCard variant="light" />

          {/* Upcoming Holidays */}
          {upcomingHolidays.length > 0 && (
            <div style={{
              border: `1px solid ${t.border}`,
              borderRadius: 18,
              boxShadow: '0 1px 8px 0 rgba(0,0,0,0.04)',
              padding: '22px 28px',
              background: t.surface,
            }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <CalendarDays size={18} style={{ color: '#F59E0B' }} />
                  <h3 style={{ fontSize: typography.h3.size, fontWeight: typography.h3.weight, color: t.text, letterSpacing: typography.h3.tracking, marginBottom: 0 }}>
                    Upcoming
                  </h3>
                </div>
                <Link
                  to="/calendar"
                  className="text-xs font-semibold transition-opacity hover:opacity-100"
                  style={{ color: t.textMuted, textDecoration: 'none' }}
                >
                  View calendar
                </Link>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {upcomingHolidays.map((h, idx) => {
                  const date = new Date(h.date + 'T00:00:00')
                  const dayName = date.toLocaleDateString('en', { weekday: 'short' })
                  const monthDay = date.toLocaleDateString('en', { month: 'short', day: 'numeric' })
                  return (
                    <div
                      key={`${h.date}-${idx}`}
                      style={{
                        display: 'flex', alignItems: 'center', gap: 14,
                        padding: '10px 14px', borderRadius: 12,
                        background: 'rgba(245, 158, 11, 0.08)',
                        border: '1px solid rgba(245, 158, 11, 0.15)',
                      }}
                    >
                      <div style={{
                        width: 44, minWidth: 44, textAlign: 'center',
                        padding: '4px 0', borderRadius: 8,
                        background: 'rgba(245, 158, 11, 0.12)',
                      }}>
                        <div style={{ fontSize: 10, fontWeight: 700, color: 'rgba(245, 158, 11, 0.7)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                          {dayName}
                        </div>
                        <div style={{ fontSize: 14, fontWeight: 800, color: '#F59E0B', letterSpacing: '-0.01em' }}>
                          {monthDay}
                        </div>
                      </div>
                      <span style={{ fontSize: 13.5, fontWeight: 600, color: t.text }}>
                        {h.name}
                      </span>
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </div>

        {/* ═══ MIDDLE COLUMN: Approvals + Leave + Claims ═══ */}
        <div className="dashboard-col" style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 20 }}>

          {/* Pending Approvals Card (managers only) */}
          {totalPending > 0 && (
            <div style={{
              border: `1px solid ${t.border}`,
              borderRadius: 18,
              boxShadow: '0 1px 8px 0 rgba(0,0,0,0.04)',
              padding: '22px 28px',
              background: t.surface,
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
                <div style={{
                  width: 32, height: 32, borderRadius: 10,
                  background: colors.errDim,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  <AlertCircle size={17} style={{ color: colors.err }} />
                </div>
                <h3 style={{ fontSize: typography.h3.size, fontWeight: typography.h3.weight, color: t.text, letterSpacing: typography.h3.tracking, marginBottom: 0 }}>
                  Pending Approvals
                </h3>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {pendingLeave > 0 && (
                  <Link
                    to="/leave"
                    style={{
                      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                      padding: '12px 16px', borderRadius: 12,
                      background: t.surfaceHover,
                      textDecoration: 'none',
                      transition: 'background 0.15s',
                      border: `1px solid ${t.border}`,
                    }}
                    onMouseEnter={(e) => { e.currentTarget.style.background = t.surface }}
                    onMouseLeave={(e) => { e.currentTarget.style.background = t.surfaceHover }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <CalendarDays size={16} style={{ color: colors.accent }} />
                      <span style={{ fontSize: 14, fontWeight: 600, color: t.text }}>
                        {pendingLeave} leave request{pendingLeave > 1 ? 's' : ''}
                      </span>
                    </div>
                    <ChevronRight size={16} style={{ color: t.textMuted }} />
                  </Link>
                )}
                {pendingClaims > 0 && (
                  <Link
                    to="/claims"
                    style={{
                      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                      padding: '12px 16px', borderRadius: 12,
                      background: t.surfaceHover,
                      textDecoration: 'none',
                      transition: 'background 0.15s',
                      border: `1px solid ${t.border}`,
                    }}
                    onMouseEnter={(e) => { e.currentTarget.style.background = t.surface }}
                    onMouseLeave={(e) => { e.currentTarget.style.background = t.surfaceHover }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <Receipt size={16} style={{ color: colors.ok }} />
                      <span style={{ fontSize: 14, fontWeight: 600, color: t.text }}>
                        {pendingClaims} claim{pendingClaims > 1 ? 's' : ''} to review
                      </span>
                    </div>
                    <ChevronRight size={16} style={{ color: t.textMuted }} />
                  </Link>
                )}
              </div>
            </div>
          )}

          {/* Annual Leave Balance Card */}
          {leaveBalances && leaveBalances.length > 0 && (() => {
            const annualLeave = leaveBalances.find(b => 
              b.policy_name.toLowerCase().includes('annual') || 
              b.policy_name.toLowerCase().includes('vacation')
            )
            
            if (!annualLeave) return null
            
            const available = annualLeave.entitled_days + annualLeave.carried_over_days - annualLeave.used_days - annualLeave.pending_days
            const total = annualLeave.entitled_days + annualLeave.carried_over_days
            const availablePercentage = total > 0 ? (available / total) * 100 : 0
            const pendingPercentage = total > 0 ? (annualLeave.pending_days / total) * 100 : 0
            
            return (
              <div style={{
                border: `1px solid ${t.border}`,
                borderRadius: 18,
                background: t.surface,
                backdropFilter: 'blur(12px)',
                WebkitBackdropFilter: 'blur(12px)',
                boxShadow: '0 1px 8px 0 rgba(0,0,0,0.04)',
                padding: '28px',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <CalendarDays size={18} style={{ color: colors.accent }} />
                    <h3 style={{ fontSize: typography.h2.size, fontWeight: typography.h2.weight, color: t.text, letterSpacing: typography.h2.tracking, marginBottom: 0 }}>
                      Annual Leave ({currentYear})
                    </h3>
                  </div>
                  <Link
                    to="/leave"
                    className="text-xs font-semibold transition-opacity hover:opacity-100"
                    style={{ color: t.textMuted, textDecoration: 'none' }}
                  >
                    View all
                  </Link>
                </div>
                
                {/* Available Days */}
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 14 }}>
                  <span style={{ 
                    fontFamily: typography.fontMono, 
                    fontSize: 44, 
                    fontWeight: 800, 
                    color: available > 0 ? colors.ok : t.textMuted,
                    letterSpacing: '-0.02em',
                    lineHeight: 1,
                  }}>
                    {available === 999 ? '∞' : available.toFixed(1)}
                  </span>
                  <span style={{ fontSize: 15, color: t.textMuted, fontWeight: 600 }}>
                    {available === 999 ? 'days' : `/ ${total} days`}
                  </span>
                </div>
                
                {/* Progress Bar */}
                <div style={{ marginBottom: 12 }}>
                  <div style={{ 
                    height: 8, 
                    background: colors.ink100,
                    borderRadius: 4,
                    overflow: 'hidden',
                    position: 'relative',
                  }}>
                    <div style={{
                      position: 'absolute',
                      left: 0,
                      top: 0,
                      bottom: 0,
                      width: `${Math.min(availablePercentage, 100)}%`,
                      background: 'rgba(18, 160, 92, 0.9)',
                      borderTopLeftRadius: 4,
                      borderBottomLeftRadius: 4,
                      transition: 'width 0.3s ease',
                    }} />
                    {pendingPercentage > 0 && (
                      <div style={{
                        position: 'absolute',
                        left: `${availablePercentage}%`,
                        top: 0,
                        bottom: 0,
                        width: `${Math.min(pendingPercentage, 100 - availablePercentage)}%`,
                        background: `repeating-linear-gradient(
                          45deg,
                          rgba(201, 123, 42, 0.7),
                          rgba(201, 123, 42, 0.7) 3px,
                          rgba(201, 123, 42, 0.4) 3px,
                          rgba(201, 123, 42, 0.4) 6px
                        )`,
                        transition: 'width 0.3s ease, left 0.3s ease',
                      }} />
                    )}
                  </div>
                </div>
                
                {/* Stats */}
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12.5 }}>
                  <div>
                    <span style={{ color: t.textMuted, fontWeight: 500 }}>Entitled: </span>
                    <span style={{ color: t.text, fontWeight: 700 }}>{annualLeave.entitled_days === 999 ? '∞' : annualLeave.entitled_days}</span>
                  </div>
                  <div>
                    <span style={{ color: t.textMuted, fontWeight: 500 }}>Used: </span>
                    <span style={{ color: t.text, fontWeight: 700 }}>{annualLeave.used_days}</span>
                  </div>
                  {annualLeave.pending_days > 0 && (
                    <div>
                      <span style={{ color: t.textMuted, fontWeight: 500 }}>Pending: </span>
                      <span style={{ color: colors.warn, fontWeight: 700 }}>{annualLeave.pending_days}</span>
                    </div>
                  )}
                </div>
              </div>
            )
          })()}

          {/* Claims Budget Card */}
          {claimBalances && claimBalances.length > 0 && (() => {
            const totalSpent = claimBalances.reduce((sum, b) => sum + b.total_spent, 0)
            const totalLimit = claimBalances.reduce((sum, b) => sum + (b.monthly_limit ?? 0), 0)
            const currency = claimBalances[0]?.currency_code ?? 'IDR'
            const usagePercent = totalLimit > 0 ? Math.min((totalSpent / totalLimit) * 100, 100) : 0
            const remaining = totalLimit - totalSpent

            return (
              <div style={{
                border: `1px solid ${t.border}`,
                borderRadius: 18,
                background: colors.okDim,
                backdropFilter: 'blur(12px)',
                WebkitBackdropFilter: 'blur(12px)',
                boxShadow: '0 1px 8px 0 rgba(0,0,0,0.04)',
                padding: '24px 28px',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <Receipt size={18} style={{ color: colors.ok }} />
                    <h3 style={{ fontSize: typography.h3.size, fontWeight: typography.h3.weight, color: t.text, letterSpacing: typography.h3.tracking, marginBottom: 0 }}>
                      Claims Budget
                    </h3>
                  </div>
                  <Link
                    to="/claims"
                    className="text-xs font-semibold transition-opacity hover:opacity-100"
                    style={{ color: t.textMuted, textDecoration: 'none' }}
                  >
                    View all
                  </Link>
                </div>

                {/* Compact amount display */}
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, marginBottom: 12 }}>
                  <span style={{
                    fontFamily: typography.fontMono,
                    fontSize: 28,
                    fontWeight: 800,
                    color: remaining > 0 ? colors.ok : colors.err,
                    letterSpacing: '-0.02em',
                    lineHeight: 1,
                  }}>
                    {formatMoney(remaining > 0 ? remaining : 0, currency)}
                  </span>
                  <span style={{ fontSize: 13, color: t.textMuted, fontWeight: 500 }}>
                    remaining
                  </span>
                </div>

                {/* Progress bar */}
                <div style={{ height: 6, background: colors.ink100, borderRadius: 3, overflow: 'hidden', marginBottom: 10 }}>
                  <div style={{
                    width: `${usagePercent}%`,
                    height: '100%',
                    borderRadius: 3,
                    background: usagePercent > 80 ? colors.warn : colors.ok,
                    transition: 'width 0.3s ease',
                  }} />
                </div>

                {/* Spent vs limit */}
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11.5 }}>
                  <span style={{ color: t.textMuted, fontWeight: 500 }}>
                    Spent: <span style={{ color: t.text, fontWeight: 700 }}>{formatMoney(totalSpent, currency)}</span>
                  </span>
                  {totalLimit > 0 && (
                    <span style={{ color: t.textMuted, fontWeight: 500 }}>
                      Limit: <span style={{ color: t.text, fontWeight: 700 }}>{formatMoney(totalLimit, currency)}</span>
                    </span>
                  )}
                </div>
              </div>
            )
          })()}
        </div>

        {/* ═══ RIGHT COLUMN: Team Pulse ═══ */}
        <div className="dashboard-col" style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 20 }}>
          <TeamPulseCard
            teamMembers={teamMembers}
            present={present}
            late={late}
            onLeaveCount={onLeaveCount}
            trueAbsent={trueAbsent}
            totalEmployees={totalEmployees}
            onLeaveEntries={onLeaveEntries}
          />
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

type TeamMember = {
  id: string
  full_name: string
  job_title?: string
  employment_type: string
  isOnLeave: boolean
  attendance: {
    employee_id: string
    employee_name: string
    status: 'present' | 'late' | 'absent' | 'on_leave'
    clock_in_at?: string
    clock_out_at?: string
    note?: string
  } | null
}

function getStatusCategory(m: TeamMember): string {
  const att = m.attendance
  if (m.isOnLeave || att?.status === 'on_leave') return 'On Leave'
  if (att?.status === 'late') return 'Late'
  if (att?.status === 'present') return 'On Time'
  if (att?.status === 'absent') return 'Absent'
  // No attendance record yet = not clocked in
  return 'Not Clocked In'
}

function TeamPulseCard({ teamMembers, present, late, onLeaveCount, trueAbsent, totalEmployees, onLeaveEntries }: {
  teamMembers: TeamMember[]
  present: number
  late: number
  onLeaveCount: number
  trueAbsent: number
  totalEmployees: number
  onLeaveEntries: { employee_id: string; policy_name: string }[]
}) {
  const t = useModuleTheme('overview')
  const [hovered, setHovered] = useState<string | null>(null)
  const pending = Math.max(0, totalEmployees - present - late - trueAbsent - onLeaveCount)

  const segments = [
    { label: 'On Time', value: present, color: colors.ok },
    { label: 'Late', value: late, color: colors.warn },
    { label: 'On Leave', value: onLeaveCount, color: colors.accent },
    { label: 'Absent', value: trueAbsent, color: colors.err },
    { label: 'Pending', value: pending, color: colors.ink150, legendColor: t.textMuted },
  ]

  return (
    <div style={{
      border: `1px solid ${t.border}`,
      borderRadius: 18,
      boxShadow: '0 1px 8px 0 rgba(0,0,0,0.04)',
      background: t.surface,
    }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '18px 24px 0 24px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <Users size={20} style={{ color: colors.accent, flexShrink: 0 }} />
          <h3 style={{ fontSize: typography.h2.size, fontWeight: typography.h2.weight, color: t.text, letterSpacing: typography.h2.tracking, lineHeight: typography.h2.lineHeight, marginBottom: 0 }}>
            Team pulse
          </h3>
        </div>
        <Link
          to="/attendance"
          className="text-xs font-semibold transition-opacity hover:opacity-100"
          style={{ color: t.textMuted, textDecoration: 'none' }}
        >
          View all
        </Link>
      </div>

      {/* Chart + Legend row */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 20, padding: '16px 24px 0 24px' }}>
        <DonutChart
          size={110}
          segments={segments.map(s => ({ label: s.label, value: s.value, color: s.color }))}
          total={totalEmployees}
          centerLabel="Total"
          hovered={hovered}
          onHover={setHovered}
          showPercent
        />
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, flex: 1 }}>
          {segments.map((s) => {
            return (
              <div
                key={s.label}
                className="flex items-center gap-2 cursor-pointer"
                style={{
                  opacity: hovered && hovered !== s.label ? 0.35 : 1,
                  transition: 'opacity 0.15s',
                  padding: '3px 6px',
                  borderRadius: 6,
                  background: hovered === s.label ? t.surfaceHover : 'transparent',
                }}
                onMouseEnter={() => setHovered(s.label)}
                onMouseLeave={() => setHovered(null)}
              >
                <div style={{ width: 7, height: 7, borderRadius: '50%', background: s.legendColor ?? s.color, flexShrink: 0 }} />
                <span style={{ fontSize: 12, color: t.textMuted, fontWeight: 500, flex: 1 }}>{s.label}</span>
                <span style={{ fontFamily: typography.fontMono, fontSize: 13, fontWeight: 700, color: s.value > 0 ? (s.legendColor ?? s.color) : t.textMuted }}>
                  {s.value}
                </span>
              </div>
            )
          })}
        </div>
      </div>

      {/* Divider */}
      <div style={{ margin: '14px 24px 0 24px', borderTop: `1px solid ${t.border}` }} />

      {/* Team member list — highlight on hover, no filtering */}
      <div style={{ padding: '12px 24px 20px 24px' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          {teamMembers.slice(0, 8).map((m) => {
            const category = getStatusCategory(m)
            const seg = segments.find((s) => s.label === category)
            const statusColor = seg?.legendColor ?? seg?.color ?? colors.ink300
            const att = m.attendance
            const isPresent = att?.status === 'present' || att?.status === 'late'
            const isMatch = !hovered || category === hovered
            const leaveEntry = m.isOnLeave ? onLeaveEntries.find((e) => e.employee_id === m.id) : null

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
                      <span style={{ fontWeight: 600 }}>Status:</span> <span style={{ color: statusColor, fontWeight: 700 }}>{category}</span>
                    </div>
                    {leaveEntry && (
                      <div style={{ fontSize: 12.5, color: '#e0e0e0', marginBottom: 2 }}>
                        <span style={{ fontWeight: 600 }}>Leave:</span> <span style={{ color: colors.accent, fontWeight: 600 }}>{leaveEntry.policy_name}</span>
                      </div>
                    )}
                    <div style={{ fontSize: 12.5, color: '#e0e0e0' }}>
                      <span style={{ fontWeight: 600 }}>Working hours:</span> {isPresent && att?.clock_in_at ? workedHours : '—'}
                    </div>
                  </>
                }
              >
                <div
                  style={{
                    display: 'flex', alignItems: 'center',
                    padding: '7px 10px', borderRadius: 10,
                    background: isMatch && hovered ? t.surfaceHover : t.surface,
                    opacity: isMatch ? 1 : 0.25,
                    borderLeft: isMatch && hovered ? `2px solid ${statusColor}` : '2px solid transparent',
                    transition: 'opacity 0.18s, background 0.18s, border-color 0.18s',
                    cursor: 'default',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 1, minWidth: 0 }}>
                    <Avatar name={m.full_name} id={m.id} size={24} />
                    <span className="truncate" style={{ fontSize: 13, fontWeight: 600, color: t.text }}>
                      {m.full_name}
                    </span>
                  </div>
                  {isPresent && att?.clock_in_at && (
                    <span style={{ fontFamily: typography.fontMono, fontSize: 11, color: t.textMuted, fontWeight: 600, marginRight: 8 }}>
                      {workedHours}
                    </span>
                  )}
                  <span style={{
                    display: 'inline-flex', alignItems: 'center', gap: 4,
                    padding: '2px 8px', borderRadius: 999,
                    fontSize: 10.5, fontWeight: 700,
                    background: `${statusColor}15`,
                    color: statusColor,
                    border: `1px solid ${statusColor}22`,
                  }}>
                    <span style={{ width: 5, height: 5, borderRadius: '50%', background: statusColor }} />
                    {category}
                  </span>
                </div>
              </TeamTooltip>
            )
          })}
        </div>
        {totalEmployees > 8 && (
          <Link
            to="/attendance"
            className="text-xs font-semibold transition-opacity hover:opacity-100"
            style={{ color: t.textMuted, textDecoration: 'none', textAlign: 'center', display: 'block', marginTop: 8 }}
          >
            +{totalEmployees - 8} more
          </Link>
        )}
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
  const t = useModuleTheme('overview')
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
          <circle cx={center} cy={center} r={radius} fill="none" stroke={colors.ink100} strokeWidth={strokeWidth} />
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
              <p style={{ fontSize: 10, color: t.textMuted, marginTop: 3, fontWeight: 600 }}>
                {hoveredSeg.label}
              </p>
            </>
          ) : (
            <>
              <p style={{ fontSize: size * 0.17, fontWeight: 800, color: t.text, lineHeight: 1, fontFamily: typography.fontMono }}>
                {total}
              </p>
              <p style={{ fontSize: 10, color: t.textMuted, marginTop: 3, textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600 }}>
                {centerLabel}
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
