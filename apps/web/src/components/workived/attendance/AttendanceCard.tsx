import { useState, useEffect, useMemo } from 'react'
import { useMyEmployee } from '@/lib/hooks/useEmployees'
import { useOrganisation } from '@/lib/hooks/useOrganisation'
import { useMyWeek, useClockIn, useClockOut } from '@/lib/hooks/useAttendance'
import { todayISO, formatDate, getMondayOfWeek } from '@/lib/utils/date'
import { colors, typography } from '@/design/tokens'
import { Clock, LogIn, LogOut, Timer } from 'lucide-react'

interface AttendanceCardProps {
  /** Visual variant: 'dark' for dark pages (overview), 'light' for light pages (attendance) */
  variant?: 'dark' | 'light'
  /** Custom className for the card wrapper */
  className?: string
  /** Custom styles for the card wrapper */
  style?: React.CSSProperties
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

/**
 * Attendance Card - Shared component for clock in/out functionality
 * Used in both Overview page and Attendance page
 */
export function AttendanceCard({ variant = 'dark', className = '', style = {} }: AttendanceCardProps) {
  const { data: org } = useOrganisation()
  const tz = org?.timezone ?? 'UTC'
  const today = todayISO(tz)
  const weekStart = useMemo(() => getMondayOfWeek(tz, 0), [tz])

  const { data: myEmployee } = useMyEmployee()
  const { data: myWeek } = useMyWeek(weekStart)

  const clockIn = useClockIn()
  const clockOut = useClockOut()
  const [note, setNote] = useState('')

  const clock = useLiveClock(tz)

  // Extract today's attendance from week data
  const todayEntry = useMemo(() => {
    if (!myWeek?.days) return null
    return myWeek.days.find((d) => d.date === today)
  }, [myWeek, today])

  const hasClockedIn = !!todayEntry?.clock_in_at
  const hasClockedOut = !!todayEntry?.clock_out_at
  const elapsed = useElapsedTime(hasClockedIn && !hasClockedOut ? todayEntry?.clock_in_at : undefined)

  const handleClockIn = () => {
    clockIn.mutate({ note: note || undefined }, { onSuccess: () => setNote('') })
  }
  
  const handleClockOut = () => {
    clockOut.mutate({ note: note || undefined }, { onSuccess: () => setNote('') })
  }

  // Variant-specific styling
  const cardStyles = variant === 'light' ? {
    border: '1px solid rgba(139,92,246,0.2)',
    background: 'linear-gradient(135deg, rgba(139,92,246,0.85) 0%, rgba(124,58,237,0.90) 100%)',
    boxShadow: '0 4px 24px 0 rgba(139,92,246,0.25), 0 0 0 1px rgba(255,255,255,0.1) inset',
  } : {
    border: '1px solid rgba(255,255,255,0.08)',
    background: 'rgba(74, 63, 191, 0.50)',
    boxShadow: '0 2px 16px 0 rgba(0,0,0,0.15), 0 0 0 1px rgba(255,255,255,0.05) inset',
  }

  return (
    <div
      className={className}
      style={{
        borderRadius: 18,
        backdropFilter: 'blur(12px)',
        WebkitBackdropFilter: 'blur(12px)',
        color: colors.ink0,
        position: 'relative',
        overflow: 'hidden',
        ...cardStyles,
        ...style,
      }}
    >
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '18px 28px 0 28px' }}>
        <Timer size={20} style={{ color: variant === 'light' ? colors.ink0 : colors.accentMid, flexShrink: 0 }} />
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
            ? todayEntry?.status === 'overtime'
              ? "You're working overtime"
              : "You're clocked in"
            : 'Clock in to start your day'}
        </h3>
      </div>

      {/* Content */}
      <div style={{ marginTop: 20, display: 'flex', flexDirection: 'column', padding: '0 28px 28px 28px' }}>
        <div style={{ flex: 1 }}>
          {!myEmployee ? (
            <p style={{ fontSize: 15, color: 'rgba(255,255,255,0.35)' }}>
              No employee record linked to your account.
            </p>
          ) : hasClockedOut ? (
            todayEntry?.clock_in_at && todayEntry?.clock_out_at && (() => {
              const inTime = new Date(todayEntry.clock_in_at)
              const outTime = new Date(todayEntry.clock_out_at)
              const diffMs = outTime.getTime() - inTime.getTime()
              const hours = Math.floor(diffMs / (1000 * 60 * 60))
              const minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60))
              return (
                <>
                  <p style={{ 
                    fontSize: typography.tiny.size, 
                    color: 'rgba(255,255,255,0.5)', 
                    textTransform: 'uppercase', 
                    letterSpacing: '0.08em', 
                    fontWeight: Number(typography.tiny.weight), 
                    marginBottom: 10 
                  }}>
                    You worked today
                  </p>
                  <p style={{ 
                    fontFamily: typography.fontMono, 
                    fontSize: 48, 
                    fontWeight: 800, 
                    color: colors.ink0, 
                    letterSpacing: '-0.02em', 
                    lineHeight: 1, 
                    marginBottom: 18 
                  }}>
                    {hours}h {minutes}m
                  </p>
                  <div className="flex items-center gap-5">
                    <div className="flex items-center gap-2">
                      <div style={{ 
                        display: 'flex', 
                        alignItems: 'center', 
                        justifyContent: 'center', 
                        width: 28, 
                        height: 28, 
                        borderRadius: 8, 
                        background: colors.okDim 
                      }}>
                        <LogIn size={14} style={{ color: colors.ok }} />
                      </div>
                      <div>
                        <p style={{ 
                          fontSize: 10, 
                          color: 'rgba(255,255,255,0.4)', 
                          fontWeight: 600, 
                          textTransform: 'uppercase', 
                          letterSpacing: '0.05em' 
                        }}>
                          Clock In
                        </p>
                        <p style={{ 
                          fontFamily: typography.fontMono, 
                          fontSize: 15, 
                          fontWeight: 700, 
                          color: 'rgba(255,255,255,0.85)' 
                        }}>
                          {formatDate(todayEntry.clock_in_at, tz, 'time')}
                        </p>
                      </div>
                    </div>
                    <div style={{ width: 1, height: 28, background: 'rgba(255,255,255,0.1)' }} />
                    <div className="flex items-center gap-2">
                      <div style={{ 
                        display: 'flex', 
                        alignItems: 'center', 
                        justifyContent: 'center', 
                        width: 28, 
                        height: 28, 
                        borderRadius: 8, 
                        background: colors.warnDim 
                      }}>
                        <LogOut size={14} style={{ color: colors.warn }} />
                      </div>
                      <div>
                        <p style={{ 
                          fontSize: 10, 
                          color: 'rgba(255,255,255,0.4)', 
                          fontWeight: 600, 
                          textTransform: 'uppercase', 
                          letterSpacing: '0.05em' 
                        }}>
                          Clock Out
                        </p>
                        <p style={{ 
                          fontFamily: typography.fontMono, 
                          fontSize: 15, 
                          fontWeight: 700, 
                          color: 'rgba(255,255,255,0.85)' 
                        }}>
                          {formatDate(todayEntry.clock_out_at, tz, 'time')}
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
                <p style={{ 
                  fontSize: typography.tiny.size, 
                  color: colors.ink0, 
                  textTransform: 'uppercase', 
                  letterSpacing: '0.08em', 
                  fontWeight: Number(typography.tiny.weight) 
                }}>
                  Working hours
                </p>
                {todayEntry?.status === 'late' && (
                  <span style={{ 
                    padding: '2px 7px', 
                    borderRadius: 5, 
                    fontSize: 10, 
                    fontWeight: 700, 
                    background: `${colors.warn}18`, 
                    color: colors.warn, 
                    letterSpacing: '0.03em' 
                  }}>
                    Late
                  </span>
                )}
              </div>
              <p style={{ 
                fontFamily: typography.fontMono, 
                fontSize: 56, 
                fontWeight: 800, 
                color: colors.ink0, 
                letterSpacing: '-0.03em', 
                lineHeight: 1, 
                marginBottom: 18 
              }}>
                {elapsed}
              </p>
              <div className="flex items-center gap-2 mb-6">
                <div style={{ 
                  display: 'flex', 
                  alignItems: 'center', 
                  justifyContent: 'center', 
                  width: 22, 
                  height: 22, 
                  borderRadius: 6, 
                  background: colors.okDim 
                }}>
                  <LogIn size={11} style={{ color: colors.ok }} />
                </div>
                <p style={{ fontSize: 13, color: colors.ink0 }}>
                  Clocked in at{' '}
                  <span style={{ fontFamily: typography.fontMono, fontWeight: 700, color: colors.ink0 }}>
                    {todayEntry?.clock_in_at ? formatDate(todayEntry.clock_in_at, tz, 'time') : ''}
                  </span>
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
                  <div style={{ 
                    display: 'flex', 
                    alignItems: 'center', 
                    justifyContent: 'center', 
                    width: 28, 
                    height: 28, 
                    borderRadius: 8, 
                    background: variant === 'light' ? 'rgba(255,255,255,0.2)' : colors.okDim 
                  }}>
                    <Clock size={15} style={{ color: variant === 'light' ? colors.ink0 : colors.ok }} />
                  </div>
                  <p style={{ 
                    fontSize: typography.tiny.size, 
                    color: variant === 'light' ? 'rgba(255,255,255,0.9)' : colors.ok, 
                    textTransform: 'uppercase', 
                    letterSpacing: '0.08em', 
                    fontWeight: 700 
                  }}>
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
                  <span style={{ 
                    fontSize: 22, 
                    fontWeight: 700, 
                    color: 'rgba(255,255,255,0.35)', 
                    letterSpacing: '0.04em' 
                  }}>
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
  )
}
