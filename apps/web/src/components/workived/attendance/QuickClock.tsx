import { useState, useEffect } from 'react'
import { useMyEmployee } from '@/lib/hooks/useEmployees'
import { useOrganisation } from '@/lib/hooks/useOrganisation'
import { useDailyReport, useClockIn, useClockOut } from '@/lib/hooks/useAttendance'
import { todayISO, formatDate } from '@/lib/utils/date'
import { Clock, LogIn, LogOut, CheckCircle2, Timer } from 'lucide-react'

interface QuickClockProps {
  /** Layout mode: 'sidebar' = compact cards, 'inline' = full width with note input */
  layout?: 'sidebar' | 'inline'
  /** Visual variant: 'light' for purple/green theme, 'dark' for dark glassmorphic theme */
  variant?: 'light' | 'dark'
  /** Optional custom styling for container */
  className?: string
  /** Optional custom styles */
  style?: React.CSSProperties
}

/**
 * Unified QuickClock component for both Attendance sidebar and Overview page.
 * - **Sidebar mode**: Compact cards without note input (Attendance page)
 * - **Inline mode**: Full width with note input field (Overview page)
 * - **Light variant**: Purple/green gradients (Attendance)
 * - **Dark variant**: Dark glassmorphic design (Overview)
 */
export function QuickClock({ 
  layout = 'sidebar', 
  variant = 'light',
  className = '',
  style = {},
}: QuickClockProps) {
  const { data: org } = useOrganisation()
  const tz = org?.timezone ?? 'UTC'
  const today = todayISO(tz)

  const { data: myEmployee, isLoading: empLoading } = useMyEmployee()
  const { data: dailyEntries } = useDailyReport(today)

  const clockIn = useClockIn()
  const clockOut = useClockOut()

  const [note, setNote] = useState('')
  const [workingTime, setWorkingTime] = useState('00:00:00')

  // Find the current user's entry in today's daily report
  const myEntry = dailyEntries?.find((e) => e.employee_id === myEmployee?.id)
  const hasClockedIn = !!myEntry?.clock_in_at
  const hasClockedOut = !!myEntry?.clock_out_at

  // Live timer when clocked in
  useEffect(() => {
    if (!hasClockedIn || hasClockedOut || !myEntry?.clock_in_at) return

    const updateTimer = () => {
      const clockIn = new Date(myEntry.clock_in_at)
      const now = new Date()
      const diffMs = now.getTime() - clockIn.getTime()
      
      const hours = Math.floor(diffMs / (1000 * 60 * 60))
      const minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60))
      const seconds = Math.floor((diffMs % (1000 * 60)) / 1000)
      
      const hh = String(hours).padStart(2, '0')
      const mm = String(minutes).padStart(2, '0')
      const ss = String(seconds).padStart(2, '0')
      
      setWorkingTime(`${hh}:${mm}:${ss}`)
    }

    updateTimer()
    const interval = setInterval(updateTimer, 1000)
    return () => clearInterval(interval)
  }, [hasClockedIn, hasClockedOut, myEntry?.clock_in_at])

  const handleClockIn = () => {
    clockIn.mutate(
      { note: note || undefined },
      { onSuccess: () => setNote('') },
    )
  }

  const handleClockOut = () => {
    clockOut.mutate(
      { note: note || undefined },
      { onSuccess: () => setNote('') },
    )
  }

  if (empLoading) return null

  // User has no employee record — cannot clock in
  if (!myEmployee) {
    return null
  }

  // ── Sidebar Layout (Compact) ────────────────────────────────────────
  if (layout === 'sidebar') {
    return (
      <div className={`space-y-3 ${className}`} style={style}>
        {!hasClockedIn ? (
          <>
            {/* Welcome card */}
            <div 
              className="py-5 px-5"
              style={{
                background: variant === 'dark' 
                  ? 'rgba(74, 63, 191, 0.30)'
                  : 'linear-gradient(135deg, #FAF5FF 0%, #F3E8FF 100%)',
                borderRadius: 12,
                border: `1px solid ${variant === 'dark' ? 'rgba(255,255,255,0.08)' : '#E9D5FF'}`,
              }}
            >
              <div className="text-center space-y-3">
                <Clock size={32} style={{ color: variant === 'dark' ? 'rgba(255,255,255,0.6)' : '#8B5CF6', margin: '0 auto' }} />
                <div>
                  <div 
                    className="text-xs font-bold uppercase tracking-wider mb-1" 
                    style={{ color: variant === 'dark' ? 'rgba(255,255,255,0.5)' : '#9333EA' }}
                  >
                    {formatDate(new Date().toISOString(), tz, 'dayname')}, {formatDate(new Date().toISOString(), tz, 'date-short')}
                  </div>
                  <div 
                    className="font-mono font-black tabular-nums"
                    style={{
                      fontSize: 28,
                      color: variant === 'dark' ? 'rgba(255,255,255,0.9)' : '#7C3AED',
                      letterSpacing: '-0.02em',
                    }}
                  >
                    {formatDate(new Date().toISOString(), tz, 'time')}
                  </div>
                </div>
                <p 
                  className="text-xs font-medium" 
                  style={{ color: variant === 'dark' ? 'rgba(255,255,255,0.5)' : '#7C3AED' }}
                >
                  Ready to start your day?
                </p>
              </div>
            </div>

            <button
              onClick={handleClockIn}
              disabled={clockIn.isPending}
              className="group w-full relative overflow-hidden transition-all hover:scale-[1.01] active:scale-[0.99] disabled:opacity-50 disabled:hover:scale-100"
              style={{
                background: 'linear-gradient(135deg, #8B5CF6 0%, #7C3AED 100%)',
                borderRadius: 12,
                boxShadow: '0 2px 8px rgba(139,92,246,0.25)',
              }}
            >
              <div className="flex items-center justify-center gap-2.5 px-5 py-4">
                <LogIn size={18} style={{ color: '#FFFFFF' }} />
                <span className="font-bold text-sm" style={{ color: '#FFFFFF' }}>
                  {clockIn.isPending ? 'Clocking in...' : 'Clock In'}
                </span>
              </div>
            </button>
          </>
        ) : !hasClockedOut ? (
          <>
            {/* Working timer */}
            <div 
              className="py-6 px-5 relative"
              style={{
                background: 'linear-gradient(135deg, #F0FDF4 0%, #ECFDF5 100%)',
                borderRadius: 12,
                border: '2px solid #10B981',
              }}
            >
              <div className="text-center space-y-3">
                <div className="flex items-center justify-center gap-2">
                  <div 
                    className="w-2 h-2 rounded-full animate-pulse"
                    style={{ background: '#10B981', boxShadow: '0 0 8px rgba(16,185,129,0.6)' }}
                  />
                  <span
                    className="text-[10px] font-bold uppercase tracking-wider"
                    style={{ color: '#059669' }}
                  >
                    Active Now
                  </span>
                </div>
                
                <div>
                  <div className="text-xs font-medium mb-1" style={{ color: '#059669' }}>
                    Working Hours
                  </div>
                  <div
                    className="font-mono font-black tabular-nums"
                    style={{
                      fontSize: 36,
                      color: '#10B981',
                      letterSpacing: '-0.02em',
                    }}
                  >
                    {workingTime}
                  </div>
                </div>

                {myEntry?.clock_in_at && (
                  <div className="pt-2 border-t" style={{ borderColor: '#D1FAE5' }}>
                    <div className="text-[10px] font-medium mb-0.5" style={{ color: '#6B7280' }}>
                      Clocked in at
                    </div>
                    <div className="text-xs font-bold" style={{ color: '#059669' }}>
                      {formatDate(myEntry.clock_in_at, tz, 'time')}
                    </div>
                  </div>
                )}
              </div>
            </div>
            
            {/* Clock out button */}
            <button
              onClick={handleClockOut}
              disabled={clockOut.isPending}
              className="w-full flex items-center justify-center gap-2.5 px-5 py-4 font-bold text-sm transition-all hover:opacity-90 disabled:opacity-50"
              style={{
                background: '#F3F4F6',
                color: '#374151',
                border: '1px solid #E5E7EB',
                borderRadius: 12,
              }}
            >
              <LogOut size={18} style={{ color: '#6B7280' }} />
              <span>{clockOut.isPending ? 'Clocking out...' : 'Clock Out'}</span>
            </button>
          </>
        ) : (
          <div 
            className="flex flex-col items-center gap-3 px-5 py-5" 
            style={{ 
              background: 'linear-gradient(135deg, #F0FDF4 0%, #ECFDF5 100%)',
              borderRadius: 12,
              border: '1px solid #D1FAE5',
            }}
          >
            <CheckCircle2 size={28} style={{ color: '#10B981' }} />
            <span className="text-sm font-bold text-center" style={{ color: '#059669' }}>Completed for today</span>
          </div>
        )}
      </div>
    )
  }

  // ── Inline Layout (Full width with note input) ─────────────────────
  const isDark = variant === 'dark'
  const colors = {
    text: isDark ? 'rgba(255,255,255,0.9)' : '#0F0E13',
    textMuted: isDark ? 'rgba(255,255,255,0.5)' : '#6B7280',
    ok: isDark ? '#12A05C' : '#10B981',
    warn: isDark ? '#C97B2A' : '#F59E0B',
    bg: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.02)',
    border: isDark ? 'rgba(255,255,255,0.1)' : '#E5E7EB',
    buttonBg: isDark ? '#C97B2A' : '#F59E0B',
  }

  return (
    <div className={className} style={style}>
      {!hasClockedIn ? (
        <div style={{ marginTop: 10, padding: '0 28px 28px 28px' }}>
          <div className="flex items-center gap-2" style={{ marginBottom: 20 }}>
            <div 
              style={{ 
                display: 'flex', 
                alignItems: 'center', 
                justifyContent: 'center', 
                width: 28, 
                height: 28, 
                borderRadius: 8, 
                background: isDark ? 'rgba(18,160,92,0.15)' : 'rgba(139,92,246,0.15)' 
              }}
            >
              <Clock size={15} style={{ color: isDark ? colors.ok : '#8B5CF6' }} />
            </div>
            <p 
              style={{ 
                fontSize: 11, 
                color: isDark ? colors.ok : '#8B5CF6', 
                textTransform: 'uppercase', 
                letterSpacing: '0.08em', 
                fontWeight: 700 
              }}
            >
              Attendance Clock
            </p>
          </div>
          
          <div className="flex items-baseline gap-3">
            <p
              style={{
                fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
                fontSize: 64,
                fontWeight: 800,
                color: colors.text,
                letterSpacing: '-0.03em',
                lineHeight: 1,
              }}
            >
              {formatDate(new Date().toISOString(), tz, 'time').split(' ')[0]}
            </p>
            <span style={{ fontSize: 22, fontWeight: 700, color: colors.textMuted, letterSpacing: '0.04em' }}>
              {formatDate(new Date().toISOString(), tz, 'time').split(' ')[1]}
            </span>
          </div>
          
          <p style={{ fontSize: 16, color: colors.textMuted, marginTop: 14, fontWeight: 500 }}>
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
                background: colors.bg,
                border: `1px solid ${colors.border}`,
                borderRadius: 12,
                color: colors.text,
              }}
            />
            <button
              onClick={handleClockIn}
              disabled={clockIn.isPending}
              className="font-bold px-6 py-3 transition-all disabled:opacity-50"
              style={{
                background: 'linear-gradient(135deg, #8B5CF6 0%, #7C3AED 100%)',
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
      ) : !hasClockedOut ? (
        <div style={{ padding: '0 28px 28px 28px' }}>
          <div className="flex items-center gap-2" style={{ marginBottom: 10 }}>
            <Timer size={16} style={{ color: colors.text }} />
            <p 
              style={{ 
                fontSize: 11, 
                color: colors.text, 
                textTransform: 'uppercase', 
                letterSpacing: '0.08em', 
                fontWeight: 600 
              }}
            >
              Working hours
            </p>
            {myEntry?.status === 'late' && (
              <span 
                style={{ 
                  padding: '2px 7px', 
                  borderRadius: 5, 
                  fontSize: 10, 
                  fontWeight: 700, 
                  background: `${colors.warn}18`, 
                  color: colors.warn, 
                  letterSpacing: '0.03em' 
                }}
              >
                Late
              </span>
            )}
          </div>
          
          <p 
            style={{ 
              fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace', 
              fontSize: 56, 
              fontWeight: 800, 
              color: colors.text, 
              letterSpacing: '-0.03em', 
              lineHeight: 1, 
              marginBottom: 18 
            }}
          >
            {workingTime}
          </p>
          
          <div className="flex items-center gap-2 mb-6">
            <div 
              style={{ 
                display: 'flex', 
                alignItems: 'center', 
                justifyContent: 'center', 
                width: 22, 
                height: 22, 
                borderRadius: 6, 
                background: isDark ? 'rgba(18,160,92,0.15)' : 'rgba(16,185,129,0.15)' 
              }}
            >
              <LogIn size={11} style={{ color: colors.ok }} />
            </div>
            <p style={{ fontSize: 13, color: colors.text }}>
              Clocked in at{' '}
              <span 
                style={{ 
                  fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace', 
                  fontWeight: 700, 
                  color: colors.text 
                }}
              >
                {myEntry?.clock_in_at ? formatDate(myEntry.clock_in_at, tz, 'time') : ''}
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
                background: colors.bg,
                border: `1px solid ${colors.border}`,
                borderRadius: 12,
                color: colors.text,
              }}
            />
            <button
              onClick={handleClockOut}
              disabled={clockOut.isPending}
              className="font-bold px-6 py-3 transition-all disabled:opacity-50"
              style={{
                background: colors.buttonBg,
                color: isDark ? colors.text : '#FFFFFF',
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
        myEntry?.clock_in_at && myEntry?.clock_out_at && (() => {
          const inTime = new Date(myEntry.clock_in_at)
          const outTime = new Date(myEntry.clock_out_at)
          const diffMs = outTime.getTime() - inTime.getTime()
          const hours = Math.floor(diffMs / (1000 * 60 * 60))
          const minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60))
          
          return (
            <div style={{ padding: '0 28px 28px 28px' }}>
              <p 
                style={{ 
                  fontSize: 11, 
                  color: colors.textMuted, 
                  textTransform: 'uppercase', 
                  letterSpacing: '0.08em', 
                  fontWeight: 600, 
                  marginBottom: 10 
                }}
              >
                You worked today
              </p>
              <p 
                style={{ 
                  fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace', 
                  fontSize: 48, 
                  fontWeight: 800, 
                  color: colors.ok, 
                  letterSpacing: '-0.02em', 
                  lineHeight: 1, 
                  marginBottom: 18 
                }}
              >
                {hours}h {minutes}m
              </p>
              <div className="flex items-center gap-5">
                <div className="flex items-center gap-2">
                  <div 
                    style={{ 
                      display: 'flex', 
                      alignItems: 'center', 
                      justifyContent: 'center', 
                      width: 28, 
                      height: 28, 
                      borderRadius: 8, 
                      background: isDark ? 'rgba(18,160,92,0.15)' : 'rgba(16,185,129,0.15)' 
                    }}
                  >
                    <LogIn size={14} style={{ color: colors.ok }} />
                  </div>
                  <div>
                    <p 
                      style={{ 
                        fontSize: 10, 
                        color: colors.textMuted, 
                        fontWeight: 600, 
                        textTransform: 'uppercase', 
                        letterSpacing: '0.05em' 
                      }}
                    >
                      Clock In
                    </p>
                    <p 
                      style={{ 
                        fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace', 
                        fontSize: 15, 
                        fontWeight: 700, 
                        color: colors.text 
                      }}
                    >
                      {formatDate(myEntry.clock_in_at, tz, 'time')}
                    </p>
                  </div>
                </div>
                <div style={{ width: 1, height: 28, background: colors.border }} />
                <div className="flex items-center gap-2">
                  <div 
                    style={{ 
                      display: 'flex', 
                      alignItems: 'center', 
                      justifyContent: 'center', 
                      width: 28, 
                      height: 28, 
                      borderRadius: 8, 
                      background: isDark ? 'rgba(201,123,42,0.15)' : 'rgba(245,158,11,0.15)' 
                    }}
                  >
                    <LogOut size={14} style={{ color: colors.warn }} />
                  </div>
                  <div>
                    <p 
                      style={{ 
                        fontSize: 10, 
                        color: colors.textMuted, 
                        fontWeight: 600, 
                        textTransform: 'uppercase', 
                        letterSpacing: '0.05em' 
                      }}
                    >
                      Clock Out
                    </p>
                    <p 
                      style={{ 
                        fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace', 
                        fontSize: 15, 
                        fontWeight: 700, 
                        color: colors.text 
                      }}
                    >
                      {formatDate(myEntry.clock_out_at, tz, 'time')}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )
        })()
      )}
    </div>
  )
}
