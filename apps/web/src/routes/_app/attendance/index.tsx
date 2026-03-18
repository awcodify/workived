import { createFileRoute } from '@tanstack/react-router'
import { useState } from 'react'
import { useOrganisation } from '@/lib/hooks/useOrganisation'
import { useDailyReport } from '@/lib/hooks/useAttendance'
import { todayISO, formatDate } from '@/lib/utils/date'
import { Avatar } from '@/components/workived/layout/Avatar'
import { StatusSquare } from '@/components/workived/layout/StatusSquare'
import { QuickClock } from '@/components/workived/attendance/QuickClock'
import { moduleBackgrounds } from '@/design/tokens'
import { LogIn, LogOut } from 'lucide-react'

export const Route = createFileRoute('/_app/attendance/')({
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

      {isToday && <QuickClock />}

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

