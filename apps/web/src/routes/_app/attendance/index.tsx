import { createFileRoute } from '@tanstack/react-router'
import { useState, useEffect } from 'react'
import { useOrganisation } from '@/lib/hooks/useOrganisation'
import { useDailyReport } from '@/lib/hooks/useAttendance'
import { todayISO, formatDate } from '@/lib/utils/date'
import { Avatar } from '@/components/workived/layout/Avatar'
import { StatusSquare } from '@/components/workived/layout/StatusSquare'
import { QuickClock } from '@/components/workived/attendance/QuickClock'
import { moduleBackgrounds, typography } from '@/design/tokens'
import { Clock } from 'lucide-react'

export const Route = createFileRoute('/_app/attendance/')({
  component: AttendancePage,
})

function useLiveClock(tz: string) {
  const [time, setTime] = useState(() => formatClock(tz))
  useEffect(() => {
    const id = setInterval(() => setTime(formatClock(tz)), 1000)
    return () => clearInterval(id)
  }, [tz])
  return time
}

function formatClock(tz: string) {
  return new Intl.DateTimeFormat('en', {
    timeZone: tz,
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }).format(new Date())
}

function AttendancePage() {
  const { data: org } = useOrganisation()
  const tz = org?.timezone ?? 'UTC'
  const [date, setDate] = useState(() => todayISO(tz))

  const { data: entries, isLoading } = useDailyReport(date)
  const isToday = date === todayISO(tz)
  const clock = useLiveClock(tz)

  const present = entries?.filter((e) => e.status === 'present').length ?? 0
  const late = entries?.filter((e) => e.status === 'late').length ?? 0
  const absent = entries?.filter((e) => e.status === 'absent').length ?? 0

  const dateLabel = isToday
    ? new Intl.DateTimeFormat('en', { timeZone: tz, weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }).format(new Date())
    : date

  return (
    <div
      className="min-h-screen px-6 py-8 md:px-11 md:py-10 pb-28"
      style={{ background: moduleBackgrounds.attendance }}
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1
            className="font-extrabold"
            style={{ fontSize: 44, letterSpacing: '-0.05em', color: '#0A2E1A', lineHeight: 1 }}
          >
            Attendance
          </h1>
          <p className="mt-2" style={{ fontSize: 14, color: '#4A7A5A' }}>
            {dateLabel}
          </p>
        </div>
        <input
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          className="text-sm px-3 py-2 focus:outline-none focus:ring-2"
          style={{
            background: '#FFFFFF',
            border: '1px solid rgba(10,46,26,0.08)',
            borderRadius: 10,
            color: '#0A2E1A',
          }}
        />
      </div>

      {/* Hero clock block */}
      <div
        className="flex items-center gap-0"
        style={{
          background: '#0A2E1A',
          borderRadius: 20,
          padding: '30px 34px',
        }}
      >
        {/* Live time */}
        <div className="flex-shrink-0">
          <p
            style={{
              fontFamily: typography.fontMono,
              fontSize: 56,
              fontWeight: 800,
              color: '#FFFFFF',
              lineHeight: 1,
              letterSpacing: '-0.02em',
            }}
          >
            {isToday ? clock : '--:--:--'}
          </p>
          {!isToday && (
            <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)', marginTop: 4 }}>
              Viewing past date
            </p>
          )}
        </div>

        {/* Separator */}
        <div
          className="mx-6 md:mx-8 flex-shrink-0"
          style={{ width: 1, height: 64, background: 'rgba(255,255,255,0.12)' }}
        />

        {/* Stats */}
        <div className="flex items-center gap-6 md:gap-8">
          <HeroStat value={present} label="CLOCKED IN" color="#12A05C" />
          <HeroStat value={late} label="LATE" color="#C97B2A" />
          <HeroStat value={absent} label="ABSENT" color="#D44040" />
        </div>
      </div>

      {/* Quick Clock (only today) */}
      {isToday && (
        <div className="mt-4">
          <QuickClock />
        </div>
      )}

      {/* Column headers */}
      {!isLoading && entries && entries.length > 0 && (
        <div
          className="flex items-center gap-4 px-5 mt-6 mb-2 uppercase"
          style={{
            fontSize: 10,
            fontWeight: 700,
            color: '#4A7A5A',
            letterSpacing: '0.08em',
          }}
        >
          <span style={{ width: 32 }} />
          <span className="flex-1">Employee</span>
          <span className="hidden md:block" style={{ width: 80 }}>Clock in</span>
          <span className="hidden md:block" style={{ width: 80 }}>Clock out</span>
          <span style={{ width: 80, textAlign: 'right' }}>Status</span>
        </div>
      )}

      {/* Attendance rows */}
      {isLoading ? (
        <AttendanceSkeleton />
      ) : !entries || entries.length === 0 ? (
        <AttendanceEmptyState />
      ) : (
        <div className="flex flex-col gap-[3px]">
          {entries.map((entry) => (
            <div
              key={entry.employee_id}
              className="flex items-center gap-4 transition-colors duration-150"
              style={{
                background: '#FFFFFF',
                borderRadius: 12,
                padding: '14px 20px',
              }}
              onMouseEnter={(e) => { e.currentTarget.style.background = '#F0FAF4' }}
              onMouseLeave={(e) => { e.currentTarget.style.background = '#FFFFFF' }}
            >
              <Avatar name={entry.employee_name} id={entry.employee_id} size={32} />

              <div className="flex-1 min-w-0">
                <p
                  className="font-semibold truncate"
                  style={{ fontSize: 13, color: '#0A2E1A' }}
                >
                  {entry.employee_name}
                </p>
                {/* Mobile: show times below name */}
                <div className="flex items-center gap-3 md:hidden mt-0.5">
                  {entry.clock_in_at && (
                    <span style={{ fontFamily: typography.fontMono, fontSize: 11, color: '#4A7A5A' }}>
                      {formatDate(entry.clock_in_at, tz, 'time')}
                    </span>
                  )}
                  {entry.clock_out_at && (
                    <span style={{ fontFamily: typography.fontMono, fontSize: 11, color: '#4A7A5A' }}>
                      — {formatDate(entry.clock_out_at, tz, 'time')}
                    </span>
                  )}
                </div>
              </div>

              {/* Desktop: times in columns */}
              <span
                className="hidden md:block"
                style={{ width: 80, fontFamily: typography.fontMono, fontSize: 13, color: '#4A7A5A' }}
              >
                {entry.clock_in_at ? formatDate(entry.clock_in_at, tz, 'time') : '—'}
              </span>
              <span
                className="hidden md:block"
                style={{ width: 80, fontFamily: typography.fontMono, fontSize: 13, color: '#4A7A5A' }}
              >
                {entry.clock_out_at ? formatDate(entry.clock_out_at, tz, 'time') : '—'}
              </span>

              <div style={{ width: 80, display: 'flex', justifyContent: 'flex-end' }}>
                <StatusSquare status={entry.status} />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ── Subcomponents ──────────────────────────────────────────────

function HeroStat({ value, label, color }: { value: number; label: string; color: string }) {
  return (
    <div>
      <p style={{ fontSize: 30, fontWeight: 800, color, lineHeight: 1 }}>{value}</p>
      <p
        className="uppercase mt-1"
        style={{ fontSize: 11, fontWeight: 600, color: 'rgba(255,255,255,0.35)', letterSpacing: '0.06em' }}
      >
        {label}
      </p>
    </div>
  )
}

function AttendanceSkeleton() {
  return (
    <div className="flex flex-col gap-[3px] mt-6">
      {Array.from({ length: 8 }).map((_, i) => (
        <div
          key={i}
          className="flex items-center gap-4 animate-pulse"
          style={{ background: '#FFFFFF', borderRadius: 12, padding: '14px 20px' }}
        >
          <div className="rounded-[9px] flex-shrink-0" style={{ width: 32, height: 32, background: 'rgba(10,46,26,0.06)' }} />
          <div className="flex-1">
            <div className="rounded-md" style={{ width: 120, height: 13, background: 'rgba(10,46,26,0.06)' }} />
          </div>
          <div className="rounded-md hidden md:block" style={{ width: 50, height: 13, background: 'rgba(10,46,26,0.04)' }} />
          <div className="rounded-md hidden md:block" style={{ width: 50, height: 13, background: 'rgba(10,46,26,0.04)' }} />
          <div className="flex items-center gap-1.5" style={{ width: 80, justifyContent: 'flex-end' }}>
            <div className="rounded-sm" style={{ width: 7, height: 7, background: 'rgba(10,46,26,0.06)' }} />
            <div className="rounded-sm" style={{ width: 36, height: 12, background: 'rgba(10,46,26,0.04)' }} />
          </div>
        </div>
      ))}
    </div>
  )
}

function AttendanceEmptyState() {
  return (
    <div className="flex flex-col items-center justify-center py-16 gap-3">
      <div
        className="grid place-items-center"
        style={{ width: 48, height: 48, borderRadius: 14, background: '#D0EDD9' }}
      >
        <Clock size={22} style={{ color: '#0A6E35' }} />
      </div>
      <p className="font-bold" style={{ fontSize: 15, color: '#0A2E1A' }}>
        No clock-ins yet today
      </p>
      <p style={{ fontSize: 13, color: '#4A7A5A' }}>
        Records appear here as employees check in.
      </p>
    </div>
  )
}
