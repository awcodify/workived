import { createFileRoute } from '@tanstack/react-router'
import { useState, useMemo } from 'react'
import { DateTime } from '@/components/workived/shared/DateTime'
import { NotificationBell } from '@/components/workived/shared/NotificationBell'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { useCalendar, useHolidays } from '@/lib/hooks/useLeave'
import { useOrganisation } from '@/lib/hooks/useOrganisation'
import { moduleBackgrounds, moduleThemes, typography, colors } from '@/design/tokens'
import type { CalendarEntry } from '@/types/api'

const t = moduleThemes.calendar

export const Route = createFileRoute('/_app/calendar')({
  component: CalendarPage,
})

// ── Constants ────────────────────────────────────────────────

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
]

const DAY_HEADERS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

const COUNTRY_NAMES: Record<string, string> = {
  ID: 'Indonesia',
  AE: 'UAE',
  MY: 'Malaysia',
  SG: 'Singapore',
}

// ── Policy Colors ────────────────────────────────────────────

const POLICY_COLORS = [
  '#D97706', // Amber (primary accent)
  '#E85757', // Red
  '#12A05C', // Green
  '#6357E8', // Purple
  '#5791E8', // Blue
  '#E857C7', // Pink
  '#0D9488', // Teal
  '#E88C57', // Orange
] as const

function getPolicyColor(name: string): string {
  let hash = 0
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash)
  }
  return POLICY_COLORS[Math.abs(hash) % POLICY_COLORS.length]!
}

// ── Main Component ───────────────────────────────────────────

function CalendarPage() {
  const today = new Date()
  const [year, setYear] = useState(today.getFullYear())
  const [month, setMonth] = useState(today.getMonth() + 1)

  const { data: org } = useOrganisation()
  const { data: entries, isLoading } = useCalendar(year, month)

  const { startDate, endDate } = useMemo(() => {
    const firstDay = new Date(year, month - 1, 1)
    const lastDay = new Date(year, month, 0)
    return {
      startDate: firstDay.toISOString().split('T')[0],
      endDate: lastDay.toISOString().split('T')[0],
    }
  }, [year, month])

  const { data: holidays } = useHolidays(startDate!, endDate!)

  const backendCountry = holidays?.[0]?.country_code ?? ''
  const backendCountryName = backendCountry ? COUNTRY_NAMES[backendCountry] || backendCountry : ''

  const goToPrevMonth = () => {
    if (month === 1) { setMonth(12); setYear(year - 1) }
    else setMonth(month - 1)
  }

  const goToNextMonth = () => {
    if (month === 12) { setMonth(1); setYear(year + 1) }
    else setMonth(month + 1)
  }

  const goToToday = () => {
    setYear(today.getFullYear())
    setMonth(today.getMonth() + 1)
  }

  // Count people on leave today
  const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`
  const onLeaveToday = useMemo(() => {
    if (!entries) return 0
    return entries.filter((e) => e.start_date <= todayStr && e.end_date >= todayStr).length
  }, [entries, todayStr])

  return (
    <div
      className="min-h-screen px-6 py-8 md:px-11 md:py-10"
      style={{ background: moduleBackgrounds.calendar, paddingBottom: '160px' }}
    >
      {/* Header */}
      <div className="mb-6">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
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
              Calendar
            </h1>
            <div className="flex flex-wrap items-center gap-3 mt-1">
              {onLeaveToday > 0 && (
                <span
                  className="text-sm font-semibold px-2.5 py-0.5"
                  style={{
                    background: 'rgba(217,119,6,0.10)',
                    color: t.accent,
                    borderRadius: 6,
                  }}
                >
                  {onLeaveToday} on leave today
                </span>
              )}
              {backendCountryName && (
                <p className="text-sm" style={{ color: t.textMuted }}>
                  Holidays: {backendCountryName}
                  {org && backendCountry !== org.country_code && (
                    <span
                      className="ml-2 text-xs font-semibold px-1.5 py-0.5"
                      style={{
                        background: 'rgba(232,87,87,0.1)',
                        color: '#E85757',
                        borderRadius: 4,
                      }}
                    >
                      Org: {org.country_code}
                    </span>
                  )}
                </p>
              )}
            </div>
          </div>
          
          <div className="flex items-center gap-4">
            <DateTime 
              textColor={t.text}
              textMutedColor={t.textMuted}
              borderColor={t.border}
            />
            <NotificationBell
              surfaceColor={t.surface}
              borderColor={t.border}
              accentColor={colors.accent}
              textColor={t.text}
              textMutedColor={t.textMuted}
            />
          </div>
        </div>
      </div>
      
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 sm:gap-0 mb-6">
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
            className="font-bold flex-1 sm:min-w-[180px] text-center"
            style={{
              fontSize: typography.h2.size,
              letterSpacing: typography.h2.tracking,
              color: t.text,
            }}
          >
            {MONTH_NAMES[month - 1]} {year}
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
      <div className="-mx-6 md:mx-0">
        {isLoading ? (
          <CalendarSkeleton />
        ) : (
          <CalendarGrid year={year} month={month} entries={entries ?? []} holidays={holidays ?? []} />
        )}
      </div>
    </div>
  )
}

// ── Types ────────────────────────────────────────────────────

type DayEntry = {
  employee_name: string
  policy_name: string
}

type CalendarGridProps = {
  year: number
  month: number
  entries: CalendarEntry[]
  holidays: Array<{ country_code: string; date: string; name: string }>
}

// ── Calendar Grid ────────────────────────────────────────────

function CalendarGrid({ year, month, entries, holidays }: CalendarGridProps) {
  const [activeTooltip, setActiveTooltip] = useState<string | null>(null)

  const firstDay = new Date(year, month - 1, 1)
  const daysInMonth = new Date(year, month, 0).getDate()
  const startDayOfWeek = firstDay.getDay()

  // Holiday lookup map
  const holidayMap = useMemo(() => {
    const map = new Map<string, Array<{ name: string; country: string }>>()
    holidays.forEach((h) => {
      const existing = map.get(h.date) || []
      const countryName = COUNTRY_NAMES[h.country_code] || h.country_code
      map.set(h.date, [...existing, { name: h.name, country: countryName }])
    })
    return map
  }, [holidays])

  // Leave entries expanded by date
  const entriesByDate = useMemo(() => {
    const map = new Map<string, DayEntry[]>()
    entries.forEach((entry) => {
      const start = new Date(entry.start_date)
      const end = new Date(entry.end_date)
      for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
        const dateStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
        const existing = map.get(dateStr) ?? []
        map.set(dateStr, [...existing, { employee_name: entry.employee_name, policy_name: entry.policy_name }])
      }
    })
    return map
  }, [entries])

  // Build weeks grid
  const weeks = useMemo(() => {
    const result: (number | null)[][] = []
    let currentWeek: (number | null)[] = []
    for (let i = 0; i < startDayOfWeek; i++) currentWeek.push(null)
    for (let day = 1; day <= daysInMonth; day++) {
      currentWeek.push(day)
      if (currentWeek.length === 7) { result.push(currentWeek); currentWeek = [] }
    }
    if (currentWeek.length > 0) {
      while (currentWeek.length < 7) currentWeek.push(null)
      result.push(currentWeek)
    }
    return result
  }, [startDayOfWeek, daysInMonth])

  const today = new Date()
  const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`

  return (
    <div
      className="relative mx-6 md:mx-0"
      style={{
        background: t.surface,
        borderRadius: 16,
        border: `1px solid ${t.border}`,
        overflow: 'hidden',
      }}
    >
      <div className="overflow-x-auto" style={{ WebkitOverflowScrolling: 'touch' }}>
        <div className="p-3 md:p-6" style={{ minWidth: '700px', width: '100%' }}>
          {/* Day headers */}
          <div className="grid grid-cols-7 gap-1.5 md:gap-2 mb-2" style={{ minWidth: '100%' }}>
            {DAY_HEADERS.map((day) => (
              <div
                key={day}
                className="text-center font-bold py-2 text-xs md:text-sm"
                style={{ color: t.textMuted, minWidth: '85px' }}
              >
                {day}
              </div>
            ))}
          </div>

          {/* Grid */}
          <div className="grid grid-cols-7 gap-1.5 md:gap-2" style={{ minWidth: '100%' }}>
            {weeks.map((week, weekIdx) =>
              week.map((day, dayIdx) => {
                if (day === null) {
                  return <div key={`empty-${weekIdx}-${dayIdx}`} style={{ minWidth: '85px' }} />
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
                    className="min-h-[70px] md:min-h-[100px] p-1.5 md:p-2 transition-colors relative cursor-pointer"
                    style={{
                      minWidth: '85px',
                      background: isToday
                        ? 'rgba(217,119,6,0.06)'
                        : isHoliday
                        ? 'rgba(232,87,87,0.05)'
                        : t.input,
                      border: isToday
                        ? `2px solid ${t.accent}`
                        : isHoliday
                        ? '1px solid rgba(232,87,87,0.3)'
                        : `1px solid ${t.inputBorder}`,
                      borderRadius: 6,
                      overflow: 'visible',
                    }}
                    onClick={(e) => {
                      e.stopPropagation()
                      if (hasInfo) setActiveTooltip(isActive ? null : dateStr)
                    }}
                    title={hasInfo ? 'Click for details' : ''}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <div
                        className="font-bold text-sm md:text-base"
                        style={{ color: isToday ? t.accent : isHoliday ? '#E85757' : t.text }}
                      >
                        {day}
                      </div>
                      {isHoliday && holidayInfo && (
                        <div className="space-y-1 hidden md:block">
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
                            className="text-xs px-1.5 py-0.5 md:py-1 truncate pointer-events-none"
                            style={{
                              background: getPolicyColor(entry.policy_name),
                              color: '#FFFFFF',
                              borderRadius: 4,
                              fontSize: 10,
                            }}
                          >
                            {entry.employee_name}
                          </div>
                        ))}
                        {dayEntries.length > 2 && (
                          <div
                            className="text-xs px-1.5 py-0.5 md:py-1 pointer-events-none"
                            style={{ color: t.textMuted, fontSize: 10 }}
                          >
                            +{dayEntries.length - 2} more
                          </div>
                        )}
                      </div>
                    )}

                    {/* Tooltip */}
                    {isActive && (
                      <>
                        <div
                          className="fixed inset-0"
                          style={{ zIndex: 9998 }}
                          onClick={(e) => { e.stopPropagation(); setActiveTooltip(null) }}
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
                              weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
                            })}
                          </div>

                          {holidayInfo && holidayInfo.length > 0 && (
                            <div className="mb-3">
                              <div className="text-xs font-semibold mb-1.5" style={{ color: '#FCA5A5' }}>
                                Public Holidays
                              </div>
                              {holidayInfo.map((holiday, idx) => (
                                <div key={idx} className="ml-2 mb-1" style={{ fontSize: 11 }}>
                                  {holiday.name}
                                  <span style={{ opacity: 0.7 }}> ({holiday.country})</span>
                                </div>
                              ))}
                            </div>
                          )}

                          {dayEntries.length > 0 && (
                            <div>
                              <div className="text-xs font-semibold mb-1.5" style={{ color: '#FCD34D' }}>
                                On Leave ({dayEntries.length})
                              </div>
                              {dayEntries.map((entry, idx) => (
                                <div key={idx} className="ml-2 mb-1" style={{ fontSize: 11 }}>
                                  {entry.employee_name}
                                  <span style={{ opacity: 0.7 }}> — {entry.policy_name}</span>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      </>
                    )}
                  </div>
                )
              })
            )}
          </div>

          {/* Legend */}
          {entries.length > 0 && (
            <div className="mt-6 pt-6" style={{ borderTop: `1px solid ${t.border}` }}>
              <p className="font-semibold mb-3 text-xs md:text-sm" style={{ color: t.text }}>
                Leave Types
              </p>
              <div className="flex flex-wrap gap-3">
                {Array.from(new Set(entries.map((e) => e.policy_name))).map((policyName) => (
                  <div key={policyName} className="flex items-center gap-2">
                    <div
                      style={{
                        width: 12,
                        height: 12,
                        borderRadius: 3,
                        background: getPolicyColor(policyName),
                      }}
                    />
                    <span className="text-xs md:text-sm" style={{ color: t.text }}>
                      {policyName}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ── Skeleton ─────────────────────────────────────────────────

function CalendarSkeleton() {
  return (
    <div
      className="animate-pulse mx-6 md:mx-0"
      style={{
        background: t.surface,
        borderRadius: 16,
        border: `1px solid ${t.border}`,
        padding: '1rem',
        height: '500px',
      }}
    />
  )
}
