import { useState } from 'react'
import { useMyEmployee } from '@/lib/hooks/useEmployees'
import { useOrganisation } from '@/lib/hooks/useOrganisation'
import { useDailyReport, useClockIn, useClockOut } from '@/lib/hooks/useAttendance'
import { todayISO, formatDate } from '@/lib/utils/date'
import { Clock, LogIn, LogOut } from 'lucide-react'

interface QuickClockProps {
  /** 'light' for green/cream pages, 'dark' for dark overview page */
  variant?: 'light' | 'dark'
}

export function QuickClock({ variant = 'light' }: QuickClockProps) {
  const { data: org } = useOrganisation()
  const tz = org?.timezone ?? 'UTC'
  const today = todayISO(tz)

  const { data: myEmployee, isLoading: empLoading } = useMyEmployee()
  const { data: dailyEntries } = useDailyReport(today)

  const clockIn = useClockIn()
  const clockOut = useClockOut()

  const [note, setNote] = useState('')

  // Find the current user's entry in today's daily report
  const myEntry = dailyEntries?.find((e) => e.employee_id === myEmployee?.id)
  const hasClockedIn = !!myEntry?.clock_in_at
  const hasClockedOut = !!myEntry?.clock_out_at

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
    return (
      <div className={cardClass(variant)}>
        <div className="flex items-center gap-2 mb-2">
          <Clock size={16} className={iconClass(variant)} />
          <span className={titleClass(variant)}>Quick Clock</span>
        </div>
        <p className={mutedClass(variant)}>
          No employee record linked to your account.
        </p>
      </div>
    )
  }

  return (
    <div className={cardClass(variant)}>
      <div className="flex items-center gap-2 mb-3">
        <Clock size={16} className={iconClass(variant)} />
        <span className={titleClass(variant)}>Quick Clock</span>
      </div>

      {/* Status display */}
      {hasClockedOut && myEntry?.clock_in_at && myEntry?.clock_out_at ? (
        /* Show calculated hours when done for the day */
        <div className="mb-3">
          <p className={`text-xs mb-1.5 ${variant === 'dark' ? 'text-white/40' : 'text-ink-400'}`}>
            Done for today
          </p>
          {(() => {
            const clockIn = new Date(myEntry.clock_in_at)
            const clockOut = new Date(myEntry.clock_out_at)
            const diffMs = clockOut.getTime() - clockIn.getTime()
            const hours = Math.floor(diffMs / (1000 * 60 * 60))
            const minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60))
            
            return (
              <div className={`p-3 rounded-lg ${variant === 'dark' ? 'bg-ok/10 border border-ok/20' : 'bg-ok/5 border border-ok/20'}`}>
                <p className={`text-xs mb-1 ${variant === 'dark' ? 'text-white/50' : 'text-ink-500'}`}>
                  You worked
                </p>
                <p className={`text-2xl font-bold ${variant === 'dark' ? 'text-ok' : 'text-ok-text'}`} style={{ fontFamily: 'monospace', letterSpacing: '-0.02em' }}>
                  {hours}h {minutes}m
                </p>
                <p className={`text-xs mt-1 ${variant === 'dark' ? 'text-white/30' : 'text-ink-400'}`} style={{ fontFamily: 'monospace' }}>
                  {formatDate(myEntry.clock_in_at, tz, 'time')} – {formatDate(myEntry.clock_out_at, tz, 'time')}
                </p>
              </div>
            )
          })()}
        </div>
      ) : hasClockedIn && myEntry?.clock_in_at ? (
        <p className={`text-xs mb-2 ${variant === 'dark' ? 'text-white/50' : 'text-ink-500'}`}>
          <LogIn size={12} className="inline mr-1" />
          Clocked in at {formatDate(myEntry.clock_in_at, tz, 'time')}
          {myEntry.status === 'late' && <span className="text-warn ml-1">(Late)</span>}
        </p>
      ) : null}

      {/* Action */}
      {!hasClockedOut && (
        <>
          <input
            type="text"
            placeholder="Note (optional)"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            className={inputClass(variant)}
          />
          {!hasClockedIn ? (
            <button
              onClick={handleClockIn}
              disabled={clockIn.isPending}
              className="w-full bg-ok text-white font-semibold text-sm py-2 rounded-lg hover:bg-ok-text transition-colors disabled:opacity-50"
            >
              {clockIn.isPending ? 'Clocking in...' : 'Clock In'}
            </button>
          ) : (
            <button
              onClick={handleClockOut}
              disabled={clockOut.isPending}
              className="w-full bg-warn text-white font-semibold text-sm py-2 rounded-lg hover:bg-warn-text transition-colors disabled:opacity-50"
            >
              {clockOut.isPending ? 'Clocking out...' : 'Clock Out'}
            </button>
          )}
        </>
      )}
    </div>
  )
}

// ── Style helpers per variant ────────────────────────────────────────────────

function cardClass(v: 'light' | 'dark') {
  return v === 'dark'
    ? 'bg-white/6 border border-white/10 rounded-xl p-4 mb-4'
    : 'bg-white rounded-xl border border-ink-100 p-4 mb-4'
}

function iconClass(v: 'light' | 'dark') {
  return v === 'dark' ? 'text-white/50' : 'text-ink-500'
}

function titleClass(v: 'light' | 'dark') {
  return v === 'dark'
    ? 'text-sm font-semibold text-white/80'
    : 'text-sm font-semibold text-ink-900'
}

function mutedClass(v: 'light' | 'dark') {
  return v === 'dark' ? 'text-xs text-white/30' : 'text-xs text-ink-300'
}

function inputClass(v: 'light' | 'dark') {
  return v === 'dark'
    ? 'w-full text-sm border border-white/10 bg-white/5 text-white rounded-lg px-3 py-1.5 mb-2 placeholder:text-white/30'
    : 'w-full text-sm border border-ink-150 rounded-lg px-3 py-1.5 mb-2'
}
