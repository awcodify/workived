import { createFileRoute } from '@tanstack/react-router'
import { useState } from 'react'
import { useOrganisation } from '@/lib/hooks/useOrganisation'
import { useDailyReport, useClockIn, useClockOut, useAttendanceToday } from '@/lib/hooks/useAttendance'
import { todayISO, formatDate } from '@/lib/utils/date'
import { Avatar } from '@/components/workived/layout/Avatar'
import { StatusSquare } from '@/components/workived/layout/StatusSquare'
import { moduleBackgrounds } from '@/design/tokens'
import { Clock, LogIn, LogOut } from 'lucide-react'
import { useAuthStore } from '@/lib/stores/auth'

export const Route = createFileRoute('/_app/attendance')({
  component: AttendancePage,
})

function AttendancePage() {
  const { data: org } = useOrganisation()
  const tz = org?.timezone ?? 'UTC'
  const [date, setDate] = useState(() => todayISO(tz))

  const { data: entries, isLoading } = useDailyReport(date)

  const isToday = date === todayISO(tz)

  const present = entries?.filter((e) => e.status === 'present').length ?? 0
  const late = entries?.filter((e) => e.status === 'late').length ?? 0
  const absent = entries?.filter((e) => e.status === 'absent').length ?? 0

  return (
    <div
      className="min-h-screen px-6 py-8 md:px-11 md:py-10"
      style={{ background: moduleBackgrounds.attendance }}
    >
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tighter text-ink-900">
            Attendance
          </h1>
          <p className="text-sm text-ink-500 mt-0.5">
            {isToday ? 'Today' : date} — {present} present, {late} late, {absent} absent
          </p>
        </div>
        <input
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          className="text-sm border border-ink-150 rounded-lg px-3 py-1.5 bg-white"
        />
      </div>

      {isToday && <ClockInOutCard tz={tz} />}

      {isLoading ? (
        <p className="text-sm text-ink-500 py-8 text-center">Loading...</p>
      ) : !entries || entries.length === 0 ? (
        <p className="text-sm text-ink-500 py-8 text-center">No attendance data for this date</p>
      ) : (
        <div className="space-y-2 mt-4">
          {entries.map((entry) => (
            <div
              key={entry.employee_id}
              className="flex items-center gap-3 bg-white rounded-xl px-4 py-3 border border-ink-100"
            >
              <Avatar name={entry.employee_name} id={entry.employee_id} size={36} />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-ink-900 truncate">{entry.employee_name}</p>
                <div className="flex items-center gap-3 text-xs text-ink-500 mt-0.5">
                  {entry.clock_in_at && (
                    <span className="flex items-center gap-1">
                      <LogIn size={12} />
                      {formatDate(entry.clock_in_at, tz, 'time')}
                    </span>
                  )}
                  {entry.clock_out_at && (
                    <span className="flex items-center gap-1">
                      <LogOut size={12} />
                      {formatDate(entry.clock_out_at, tz, 'time')}
                    </span>
                  )}
                </div>
              </div>
              <StatusSquare status={entry.status} />
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function ClockInOutCard({ tz }: { tz: string }) {
  const user = useAuthStore((s) => s.user)
  const employeeId = user?.id ?? ''

  const { data: todayRecord, isLoading } = useAttendanceToday(employeeId)
  const clockIn = useClockIn()
  const clockOut = useClockOut()

  const [note, setNote] = useState('')

  const hasClockedIn = !!todayRecord?.clock_in_at
  const hasClockedOut = !!todayRecord?.clock_out_at

  const handleClockIn = () => {
    clockIn.mutate({ employee_id: employeeId, note: note || undefined })
    setNote('')
  }

  const handleClockOut = () => {
    clockOut.mutate({ employee_id: employeeId, note: note || undefined })
    setNote('')
  }

  if (isLoading) return null

  return (
    <div className="bg-white rounded-xl border border-ink-100 p-4 mb-4">
      <div className="flex items-center gap-2 mb-3">
        <Clock size={16} className="text-ink-500" />
        <span className="text-sm font-semibold text-ink-900">Quick Clock</span>
      </div>

      {hasClockedIn && todayRecord?.clock_in_at && (
        <p className="text-xs text-ink-500 mb-2">
          Clocked in at {formatDate(todayRecord.clock_in_at, tz, 'time')}
          {todayRecord.is_late && <span className="text-warn ml-1">(Late)</span>}
        </p>
      )}

      {hasClockedOut && todayRecord?.clock_out_at && (
        <p className="text-xs text-ok-text mb-2">
          Clocked out at {formatDate(todayRecord.clock_out_at, tz, 'time')}
        </p>
      )}

      {!hasClockedOut && (
        <>
          <input
            type="text"
            placeholder="Note (optional)"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            className="w-full text-sm border border-ink-150 rounded-lg px-3 py-1.5 mb-2"
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
