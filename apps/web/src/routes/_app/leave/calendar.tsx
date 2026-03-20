import { createFileRoute } from '@tanstack/react-router'
import { useState, useMemo } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { useCalendar, useHolidays } from '@/lib/hooks/useLeave'
import { useOrganisation } from '@/lib/hooks/useOrganisation'
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

  const { data: org } = useOrganisation()
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

  // Map country codes to names
  const countryNames: Record<string, string> = {
    ID: 'Indonesia',
    AE: 'UAE',
    MY: 'Malaysia',
    SG: 'Singapore',
  }

  const backendCountry = holidays?.[0]?.country_code ?? ''
  const backendCountryName = backendCountry ? countryNames[backendCountry] || backendCountry : ''

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
        <div>
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
          {backendCountryName && (
            <div className="flex items-center gap-2 mt-1">
              <p
                style={{
                  fontSize: typography.body.size,
                  color: t.textMuted,
                }}
              >
                Public holidays: {backendCountryName} ({backendCountry})
              </p>
              {org && backendCountry !== org.country_code && (
                <span
                  style={{
                    fontSize: 11,
                    color: '#E85757',
                    background: 'rgba(232,87,87,0.1)',
                    padding: '2px 8px',
                    borderRadius: 4,
                    fontWeight: 600,
                  }}
                >
                  ⚠ Org: {org.country_code}
                </span>
              )}
            </div>
          )}
        </div>
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
  holidays: Array<{ country_code: string; date: string; name: string }>
}

function LeaveCalendar({ year, month, entries, holidays }: LeaveCalendarProps) {
  const [activeTooltip, setActiveTooltip] = useState<string | null>(null)

  // Build calendar grid
  const firstDay = new Date(year, month - 1, 1)
  const lastDay = new Date(year, month, 0)
  const daysInMonth = lastDay.getDate()
  const startDayOfWeek = firstDay.getDay() // 0 = Sunday

  // Create map of holiday dates to holiday info for quick lookup
  // Group holidays by date since multiple holidays can fall on same date
  const holidayMap = new Map<string, Array<{ name: string; country: string }>>()
  holidays.forEach((h) => {
    const existing = holidayMap.get(h.date) || []
    const countryName = { ID: 'Indonesia', AE: 'UAE', MY: 'Malaysia', SG: 'Singapore' }[h.country_code] || h.country_code
    holidayMap.set(h.date, [...existing, { name: h.name, country: countryName }])
  })

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
        overflow: 'visible',
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
      <div className="grid grid-cols-7 gap-2" style={{ overflow: 'visible' }}>
        {weeks.map((week, weekIdx) => (
          <>
            {week.map((day, dayIdx) => {
              if (day === null) {
                return <div key={`empty-${weekIdx}-${dayIdx}`} />
              }

              const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
              const dayEntries = entriesByDate.get(dateStr) ?? []
              const isToday = dateStr === todayStr
              const holidayInfo = holidayMap.get(dateStr)
              const isHoliday = !!(holidayInfo && holidayInfo.length > 0)
              const isActive = activeTooltip === dateStr
              const hasInfo = isHoliday || dayEntries.length > 0

              return (
                <div
                  key={dateStr}
                  className="min-h-[100px] p-2 transition-colors relative cursor-pointer"
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
                    overflow: 'visible',
                  }}
                  onClick={(e) => {
                    e.stopPropagation()
                    if (hasInfo) {
                      setActiveTooltip(isActive ? null : dateStr)
                    }
                  }}
                  title={hasInfo ? "Click for details" : ""}
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
                    {isHoliday && holidayInfo && (
                      <div className="space-y-1">
                        {holidayInfo.map((holiday, idx) => (
                          <div
                            key={idx}
                            className="text-xs px-1.5 py-0.5 truncate pointer-events-none"
                            style={{
                              background: 'rgba(232,87,87,0.1)',
                              color: '#E85757',
                              borderRadius: 4,
                              fontSize: 10,
                              fontWeight: 600,
                            }}
                          >
                            {holiday.name}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                  {dayEntries.length > 0 && (
                    <div className="space-y-1">
                      {dayEntries.slice(0, 2).map((entry, idx) => (
                        <div
                          key={idx}
                          className="text-xs px-1.5 py-1 truncate pointer-events-none"
                          style={{
                            background: getPolicyColor(entry.policy_name),
                            color: '#FFFFFF',
                            borderRadius: 4,
                            fontSize: 11,
                          }}
                        >
                          {entry.employee_name}
                        </div>
                      ))}
                      {dayEntries.length > 2 && (
                        <div
                          className="text-xs px-1.5 py-1 pointer-events-none"
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
                  
                  {/* Tooltip showing all info for this date */}
                  {isActive && (
                    <>
                      <div
                        className="fixed inset-0"
                        style={{ zIndex: 9998 }}
                        onClick={(e) => {
                          e.stopPropagation()
                          setActiveTooltip(null)
                        }}
                      />
                      <div
                        className="absolute left-0 bottom-full mb-2 px-4 py-3 shadow-2xl"
                        style={{
                          background: '#1F2937',
                          color: '#FFFFFF',
                          borderRadius: 8,
                          fontSize: 12,
                          zIndex: 9999,
                          minWidth: '250px',
                          maxWidth: '300px',
                        }}
                        onClick={(e) => e.stopPropagation()}
                      >
                        <div className="font-bold mb-2" style={{ fontSize: 13 }}>
                          {new Date(dateStr).toLocaleDateString('en-US', { 
                            weekday: 'long', 
                            year: 'numeric', 
                            month: 'long', 
                            day: 'numeric' 
                          })}
                        </div>
                        
                        {holidayInfo && holidayInfo.length > 0 && (
                          <div className="mb-3">
                            <div className="text-xs font-semibold mb-1.5" style={{ color: '#FCA5A5' }}>
                              🎉 Public Holidays
                            </div>
                            {holidayInfo.map((holiday, idx) => (
                              <div key={idx} className="ml-2 mb-1" style={{ fontSize: 11 }}>
                                • {holiday.name}
                                <span style={{ opacity: 0.7 }}> ({holiday.country})</span>
                              </div>
                            ))}
                          </div>
                        )}
                        
                        {dayEntries.length > 0 && (
                          <div>
                            <div className="text-xs font-semibold mb-1.5" style={{ color: '#A5B4FC' }}>
                              🏖️ On Leave ({dayEntries.length})
                            </div>
                            {dayEntries.map((entry, idx) => (
                              <div key={idx} className="ml-2 mb-1" style={{ fontSize: 11 }}>
                                • {entry.employee_name}
                                <span style={{ opacity: 0.7 }}> - {entry.policy_name}</span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </>
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
