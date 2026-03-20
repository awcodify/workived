import { createFileRoute } from '@tanstack/react-router'
import { useState, useMemo } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { useCalendar, useHolidays } from '@/lib/hooks/useLeave'
import { moduleBackgrounds, moduleThemes, typography } from '@/design/tokens'
import type { CalendarEntry } from '@/types/api'

const t = moduleThemes.leave

export const Route = createFileRoute('/_app/leave/calendar')({
  component: CalendarPage,
})

function CalendarPage() {
  const today = new Date()
  const [year, setYear] = useState(today.getFullYear())
  const [month, setMonth] = useState(today.getMonth() + 1) // 1-indexed

  const { data: entries, isLoading } = useCalendar(year, month)

  // Calculate start and end dates for the month to fetch holidays
  const { startDate, endDate } = useMemo(() => {
    const firstDay = new Date(year, month - 1, 1)
    const lastDay = new Date(year, month, 0)
    return {
      startDate: firstDay.toISOString().split('T')[0],
      endDate: lastDay.toISOString().split('T')[0],
    }
  }, [year, month])

  const { data: holidays } = useHolidays(startDate!, endDate!)

  // Debug: log holidays data
  console.log('Holidays data:', holidays)

  const monthNames = [
    'January',
    'February',
    'March',
    'April',
    'May',
    'June',
    'July',
    'August',
    'September',
    'October',
    'November',
    'December',
  ]

  const goToPrevMonth = () => {
    if (month === 1) {
      setMonth(12)
      setYear(year - 1)
    } else {
      setMonth(month - 1)
    }
  }

  const goToNextMonth = () => {
    if (month === 12) {
      setMonth(1)
      setYear(year + 1)
    } else {
      setMonth(month + 1)
    }
  }

  const goToToday = () => {
    setYear(today.getFullYear())
    setMonth(today.getMonth() + 1)
  }

  return (
    <div
      className="min-h-screen px-6 py-8 md:px-11 md:py-10 pb-28"
      style={{ background: moduleBackgrounds.leave }}
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <h1
          className="font-extrabold"
          style={{
            fontSize: typography.display.size,
            letterSpacing: typography.display.tracking,
            color: t.text,
            lineHeight: typography.display.lineHeight,
          }}
        >
          Leave Calendar
        </h1>
      </div>

      {/* Calendar Controls */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-2">
          <button
            onClick={goToPrevMonth}
            className="p-2 transition-colors hover:opacity-70"
            style={{
              background: t.surface,
              border: `1px solid ${t.border}`,
              borderRadius: 10,
              color: t.text,
            }}
          >
            <ChevronLeft size={20} />
          </button>
          <h2
            className="font-bold min-w-[180px] text-center"
            style={{
              fontSize: typography.h2.size,
              letterSpacing: typography.h2.tracking,
              color: t.text,
            }}
          >
            {monthNames[month - 1]} {year}
          </h2>
          <button
            onClick={goToNextMonth}
            className="p-2 transition-colors hover:opacity-70"
            style={{
              background: t.surface,
              border: `1px solid ${t.border}`,
              borderRadius: 10,
              color: t.text,
            }}
          >
            <ChevronRight size={20} />
          </button>
        </div>
        <button
          onClick={goToToday}
          className="text-sm font-semibold px-4 py-2 transition-opacity hover:opacity-70"
          style={{
            background: t.accent,
            color: t.accentText,
            borderRadius: 10,
          }}
        >
          Today
        </button>
      </div>

      {/* Calendar Grid */}
      {isLoading ? (
        <CalendarSkeleton />
      ) : (
        <LeaveCalendar year={year} month={month} entries={entries ?? []} holidays={holidays ?? []} />
      )}
    </div>
  )
}

type DayEntry = {
  employee_name: string
  policy_name: string
}

type LeaveCalendarProps = {
  year: number
  month: number
  entries: CalendarEntry[]
  holidays: Array<{ date: string }>
}

function LeaveCalendar({ year, month, entries, holidays }: LeaveCalendarProps) {
  // Debug: log what we received
  console.log('LeaveCalendar received holidays:', holidays)

  // Build calendar grid
  const firstDay = new Date(year, month - 1, 1)
  const lastDay = new Date(year, month, 0)
  const daysInMonth = lastDay.getDate()
  const startDayOfWeek = firstDay.getDay() // 0 = Sunday

  // Create set of holiday dates for quick lookup
  const holidaySet = new Set(holidays.map((h) => h.date))
  console.log('Holiday set:', Array.from(holidaySet))

  // Create map of date -> entries (expand ranges)
  const entriesByDate = new Map<string, DayEntry[]>()
  
  entries.forEach((entry) => {
    const start = new Date(entry.start_date)
    const end = new Date(entry.end_date)
    
    // Loop through all dates in the range
    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
      const dateStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
      const existing = entriesByDate.get(dateStr) ?? []
      entriesByDate.set(dateStr, [
        ...existing,
        { employee_name: entry.employee_name, policy_name: entry.policy_name },
      ])
    }
  })

  // Generate calendar grid (6 weeks max)
  const weeks: (number | null)[][] = []
  let currentWeek: (number | null)[] = []

  // Fill first week with nulls for empty days
  for (let i = 0; i < startDayOfWeek; i++) {
    currentWeek.push(null)
  }

  // Fill calendar with day numbers
  for (let day = 1; day <= daysInMonth; day++) {
    currentWeek.push(day)
    if (currentWeek.length === 7) {
      weeks.push(currentWeek)
      currentWeek = []
    }
  }

  // Fill last week with nulls
  if (currentWeek.length > 0) {
    while (currentWeek.length < 7) {
      currentWeek.push(null)
    }
    weeks.push(currentWeek)
  }

  const today = new Date()
  const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`

  return (
    <div
      style={{
        background: t.surface,
        borderRadius: 16,
        border: `1px solid ${t.border}`,
        padding: 24,
      }}
    >
      {/* Day headers */}
      <div className="grid grid-cols-7 gap-2 mb-2">
        {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day) => (
          <div
            key={day}
            className="text-center font-bold py-2"
            style={{
              fontSize: typography.label.size,
              color: t.textMuted,
            }}
          >
            {day}
          </div>
        ))}
      </div>

      {/* Calendar grid */}
      <div className="grid grid-cols-7 gap-2">
        {weeks.map((week, weekIdx) => (
          <>
            {week.map((day, dayIdx) => {
              if (day === null) {
                return <div key={`empty-${weekIdx}-${dayIdx}`} />
              }

              const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
              const dayEntries = entriesByDate.get(dateStr) ?? []
              const isToday = dateStr === todayStr
              const isHoliday = holidaySet.has(dateStr)

              return (
                <div
                  key={dateStr}
                  className="min-h-[100px] p-2 transition-colors"
                  style={{
                    background: isToday 
                      ? 'rgba(99,87,232,0.05)' 
                      : isHoliday 
                      ? 'rgba(232,87,87,0.05)'
                      : t.input,
                    border: isToday
                      ? `2px solid ${t.accent}`
                      : isHoliday
                      ? '1px solid rgba(232,87,87,0.3)'
                      : `1px solid ${t.inputBorder}`,
                    borderRadius: 8,
                  }}
                >
                  <div className="flex items-center justify-between mb-1">
                    <div
                      className="font-bold"
                      style={{
                        fontSize: typography.body.size,
                        color: isToday ? t.accent : isHoliday ? '#E85757' : t.text,
                      }}
                    >
                      {day}
                    </div>
                    {isHoliday && (
                      <div
                        className="text-xs px-1.5 py-0.5"
                        style={{
                          background: 'rgba(232,87,87,0.1)',
                          color: '#E85757',
                          borderRadius: 4,
                          fontSize: 10,
                          fontWeight: 600,
                        }}
                      >
                        Holiday
                      </div>
                    )}
                  </div>
                  {dayEntries.length > 0 && (
                    <div className="space-y-1">
                      {dayEntries.slice(0, 2).map((entry, idx) => (
                        <div
                          key={idx}
                          className="text-xs px-1.5 py-1 truncate"
                          style={{
                            background: getPolicyColor(entry.policy_name),
                            color: '#FFFFFF',
                            borderRadius: 4,
                            fontSize: 11,
                          }}
                          title={`${entry.employee_name} - ${entry.policy_name}`}
                        >
                          {entry.employee_name}
                        </div>
                      ))}
                      {dayEntries.length > 2 && (
                        <div
                          className="text-xs px-1.5 py-1"
                          style={{
                            color: t.textMuted,
                            fontSize: 11,
                          }}
                        >
                          +{dayEntries.length - 2} more
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )
            })}
          </>
        ))}
      </div>

      {/* Legend */}
      {entries.length > 0 && (
        <div className="mt-6 pt-6" style={{ borderTop: `1px solid ${t.border}` }}>
          <p
            className="font-semibold mb-3"
            style={{ fontSize: typography.label.size, color: t.text }}
          >
            Leave Types
          </p>
          <div className="flex flex-wrap gap-3">
            {Array.from(new Set(entries.map((e) => e.policy_name))).map(
              (policyName) => (
                <div key={policyName} className="flex items-center gap-2">
                  <div
                    style={{
                      width: 12,
                      height: 12,
                      borderRadius: 3,
                      background: getPolicyColor(policyName),
                    }}
                  />
                  <span
                    style={{ fontSize: typography.body.size, color: t.text }}
                  >
                    {policyName}
                  </span>
                </div>
              )
            )}
          </div>
        </div>
      )}
    </div>
  )
}

function CalendarSkeleton() {
  return (
    <div
      className="animate-pulse"
      style={{
        background: t.surface,
        borderRadius: 16,
        border: `1px solid ${t.border}`,
        padding: 24,
        height: 600,
      }}
    />
  )
}

// Generate consistent color for policy name using simple hash
function getPolicyColor(name: string): string {
  const colors = [
    '#6357E8', // Purple (default accent)
    '#E85757', // Red
    '#57E88C', // Green
    '#E8C757', // Yellow
    '#5791E8', // Blue
    '#E857C7', // Pink
    '#57E8D4', // Cyan
    '#E88C57', // Orange
  ] as const

  let hash = 0
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash)
  }

  const index = Math.abs(hash) % colors.length
  return colors[index]!
}
