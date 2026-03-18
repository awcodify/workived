import { createFileRoute } from '@tanstack/react-router'
import { useState } from 'react'
import { useMonthlyReport } from '@/lib/hooks/useAttendance'
import { Avatar } from '@/components/workived/layout/Avatar'
import { moduleBackgrounds } from '@/design/tokens'

export const Route = createFileRoute('/_app/attendance/monthly')({
  component: MonthlyReportPage,
})

function MonthlyReportPage() {
  const now = new Date()
  const [year, setYear] = useState(now.getFullYear())
  const [month, setMonth] = useState(now.getMonth() + 1)

  const { data: summaries, isLoading } = useMonthlyReport(year, month)

  const monthName = new Intl.DateTimeFormat('en', { month: 'long' }).format(new Date(year, month - 1))

  return (
    <div
      className="min-h-screen px-6 py-8 md:px-11 md:py-10"
      style={{ background: moduleBackgrounds.attendance }}
    >
      <h1 className="text-2xl font-extrabold tracking-tighter text-ink-900 mb-1">
        Monthly Report
      </h1>
      <p className="text-sm text-ink-500 mb-6">
        {monthName} {year}
      </p>

      <div className="flex items-center gap-2 mb-6">
        <select
          value={month}
          onChange={(e) => setMonth(Number(e.target.value))}
          className="text-sm border border-ink-150 rounded-lg px-3 py-1.5 bg-white"
        >
          {Array.from({ length: 12 }, (_, i) => (
            <option key={i + 1} value={i + 1}>
              {new Intl.DateTimeFormat('en', { month: 'long' }).format(new Date(2000, i))}
            </option>
          ))}
        </select>
        <input
          type="number"
          value={year}
          onChange={(e) => setYear(Number(e.target.value))}
          min={2020}
          max={2099}
          className="text-sm border border-ink-150 rounded-lg px-3 py-1.5 bg-white w-24"
        />
      </div>

      {isLoading ? (
        <p className="text-sm text-ink-500 py-8 text-center">Loading...</p>
      ) : !summaries || summaries.length === 0 ? (
        <p className="text-sm text-ink-500 py-8 text-center">No data for this period</p>
      ) : (
        <div className="bg-white rounded-xl border border-ink-100 overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-ink-100">
                <th className="text-left px-4 py-3 font-semibold text-ink-500">Employee</th>
                <th className="text-center px-3 py-3 font-semibold text-ok">Present</th>
                <th className="text-center px-3 py-3 font-semibold text-warn">Late</th>
                <th className="text-center px-3 py-3 font-semibold text-err">Absent</th>
                <th className="text-center px-3 py-3 font-semibold text-ink-500">Days</th>
              </tr>
            </thead>
            <tbody>
              {summaries.map((s) => (
                <tr key={s.employee_id} className="border-b border-ink-100 last:border-0">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <Avatar name={s.employee_name} id={s.employee_id} size={28} />
                      <span className="font-medium text-ink-900 truncate">{s.employee_name}</span>
                    </div>
                  </td>
                  <td className="text-center px-3 py-3 text-ok font-semibold">{s.present}</td>
                  <td className="text-center px-3 py-3 text-warn font-semibold">{s.late}</td>
                  <td className="text-center px-3 py-3 text-err font-semibold">{s.absent}</td>
                  <td className="text-center px-3 py-3 text-ink-500">{s.working_days}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
