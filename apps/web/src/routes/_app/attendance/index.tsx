import { createFileRoute } from '@tanstack/react-router'
import { useState, useEffect, useMemo, useRef } from 'react'
import { DateTime } from '@/components/workived/shared/DateTime'
import { NotificationBell } from '@/components/workived/shared/NotificationBell'
import { useOrganisation } from '@/lib/hooks/useOrganisation'
import { useMyWeek, useTeamWeek, useAllWeek, useWorkSchedules, useDailyReport, useCorrections } from '@/lib/hooks/useAttendance'
import { useMyEmployee } from '@/lib/hooks/useEmployees'
import { LocationAnalyticsWidget } from '@/components/workived/attendance/LocationAnalyticsWidget'
import { useAttendanceRole } from '@/lib/hooks/useAttendanceRole'
import { TeamMapView } from '@/components/workived/attendance/TeamMapView'
import { useCanManageEmployees } from '@/lib/hooks/useRole'
import { todayISO, formatDate, getMondayOfWeek } from '@/lib/utils/date'
import { Avatar } from '@/components/workived/layout/Avatar'
import { AttendanceCard } from '@/components/workived/attendance/AttendanceCard'
import { moduleBackgrounds, moduleThemes, typography, colors } from '@/design/tokens'
import { ChevronLeft, ChevronRight, Clock, Check, ChevronDown, Map, List } from 'lucide-react'
import { Skeleton } from '@/components/workived/shared/Skeleton'
import { WorkSchedulesPanel } from '@/components/workived/attendance/WorkSchedulesPanel'
import { CorrectionModal } from '@/components/workived/attendance/CorrectionModal'
import { CorrectionsPanel } from '@/components/workived/attendance/CorrectionsPanel'

const t = moduleThemes.attendance

export const Route = createFileRoute('/_app/attendance/')({
  component: AttendancePage,
})

function shiftDateISO(dateISO: string, days: number): string {
  const d = new Date(dateISO + 'T12:00:00Z')
  d.setUTCDate(d.getUTCDate() + days)
  return d.toISOString().split('T')[0] ?? dateISO
}

// Check if a week start date is in the future
function isWeekInFuture(weekStart: string, tz: string): boolean {
  try {
    const weekDate = new Date(weekStart)
    const now = new Date()
    const localNow = new Date(now.toLocaleString('en-US', { timeZone: tz }))
    const today = new Date(localNow.toISOString().split('T')[0] ?? '')
    return weekDate > today
  } catch {
    return false
  }
}

function AttendancePage() {
  const { data: org } = useOrganisation()
  const tz = org?.timezone ?? 'UTC'
  const role = useAttendanceRole()
  const canManageEmployees = useCanManageEmployees()
  
  // Track if org has loaded to recalculate initial date
  const orgLoadedRef = useRef(false)
  
  // Work schedules panel and filter
  const [schedulesOpen, setSchedulesOpen] = useState(false)
  const [scheduleFilters, setScheduleFilters] = useState<string[]>([])
  const [scheduleDropdownOpen, setScheduleDropdownOpen] = useState(false)
  const { data: workSchedules = [] } = useWorkSchedules()

  // Attendance detail expand (row click)
  const [expandedRowId, setExpandedRowId] = useState<string | null>(null)

  // Correction modals
  const [correctionDay, setCorrectionDay] = useState<import('@/types/api').WeekDay | null>(null)
  const [correctionsOpen, setCorrectionsOpen] = useState(false)

  // Sprint 12: Show others toggle
  const [showOthers, setShowOthers] = useState(true)
  
  // Filter by clock-in status
  const [clockInFilter, setClockInFilter] = useState<'all' | 'clocked-in'>('all')

  // Map / list view toggle (admin only, desktop)
  const [viewMode, setViewMode] = useState<'list' | 'map'>('list')

  // Week navigation state (0 = current week, -1 = previous week, etc.)
  const [weekOffset, setWeekOffset] = useState(0)
  const weekStart = useMemo(() => getMondayOfWeek(tz, weekOffset), [tz, weekOffset])
  
  // Conditionally fetch based on role to avoid 404 errors
  const { data: myEmployee } = useMyEmployee()
  const myEmployeeId = myEmployee?.id
  const { data: myWeek, isLoading: myWeekLoading } = useMyWeek(weekStart)
  const { data: teamWeek, isLoading: teamWeekLoading } = useTeamWeek(weekStart, role.canViewTeam)
  const { data: allWeek, isLoading: allWeekLoading } = useAllWeek(weekStart, role.canViewAll)
  
  // Determine if we're loading any data
  const isLoading = myWeekLoading || (role.canViewTeam && teamWeekLoading) || (role.canViewAll && allWeekLoading)
  
  // Check if we can navigate to next week (cannot go to future)
  const canNavigateNext = !isWeekInFuture(getMondayOfWeek(tz, weekOffset + 1), tz)
  
  // Daily report state
  const [date, setDate] = useState(() => todayISO('UTC'))
  const { data: dailyEntries = [] } = useDailyReport(date)

  // Month picker state
  const [showMonthPicker, setShowMonthPicker] = useState(false)
  
  // Update date to correct timezone's today when org first loads
  useEffect(() => {
    if (org && !orgLoadedRef.current) {
      orgLoadedRef.current = true
      setDate(todayISO(tz))
    }
  }, [org, tz])

  // Close month picker when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (showMonthPicker) {
        const target = e.target as HTMLElement
        if (!target.closest('[data-month-picker]')) {
          setShowMonthPicker(false)
        }
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [showMonthPicker])

  // Close schedule dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (scheduleDropdownOpen) {
        const target = e.target as HTMLElement
        if (!target.closest('[data-schedule-dropdown]')) {
          setScheduleDropdownOpen(false)
        }
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [scheduleDropdownOpen])

  // Get employee list based on toggle and role
  const getEmployeeList = () => {
    // If toggle is off or no team/all data, show empty (can add "my" later if needed)
    let employees = []
    
    if (!showOthers) {
      // Show only my attendance as a single-item array
      employees = myWeek ? [{ employee_id: 'me', employee_name: 'Me', week: myWeek }] : []
    } else {
      // Show all employees based on role
      if (role.canViewAll) {
        employees = allWeek ?? []
      } else if (role.canViewTeam) {
        employees = teamWeek ?? []
      } else {
        // Default: show only my week
        employees = myWeek ? [{ employee_id: 'me', employee_name: 'Me', week: myWeek }] : []
      }
    }

    // Apply clock-in filter for selected date
    if (clockInFilter === 'clocked-in') {
      employees = employees.filter((emp: any) => {
        const dayData = emp.week?.days.find((d: any) => d.date === date)
        return dayData?.clock_in_at != null
      })
    }

    // Apply schedule filter (multi-select)
    if (scheduleFilters.length > 0) {
      employees = employees.filter((emp: any) => scheduleFilters.includes(emp.work_schedule_name))
    }

    // Pin own profile to top when viewing team/all list
    if (myEmployeeId && employees.length > 1) {
      employees = [...employees].sort((a: any, b: any) => {
        if (a.employee_id === myEmployeeId) return -1
        if (b.employee_id === myEmployeeId) return 1
        return 0
      })
    }

    return employees
  }

  // Calculate statistics for selected date
  const getStatistics = () => {
    const employees = getEmployeeList()
    const total = employees.length
    let present = 0
    let late = 0
    let absent = 0
    let onLeave = 0
    let overtime = 0

    employees.forEach((emp: any) => {
      const dayData = emp.week?.days.find((d: any) => d.date === date)
      if (dayData) {
        if (dayData.status === 'on-time' || dayData.status === 'present') {
          present++
        } else if (dayData.status === 'late') {
          late++
        } else if (dayData.status === 'on_leave') {
          onLeave++
        } else if (dayData.status === 'absent') {
          absent++
        } else if (dayData.status === 'overtime') {
          overtime++
        }
        // Note: 'holiday', 'weekend', 'future' are not counted as they're non-working days
      }
    })

    return { total, present, late, absent, onLeave, overtime }
  }

  const stats = getStatistics()

  // Get month name for selected date (not the Monday's month)
  const getDisplayMonthName = () => {
    try {
      const dateObj = new Date(date + 'T12:00:00Z')
      return new Intl.DateTimeFormat('en', { month: 'long' }).format(dateObj)
    } catch {
      return 'Month'
    }
  }

  // Handle month selection
  const handleMonthSelect = (monthIndex: number) => {
    // Get current date in org's timezone
    const now = new Date()
    const localNow = new Date(now.toLocaleString('en-US', { timeZone: tz }))
    const currentYear = localNow.getFullYear()
    const currentMonth = localNow.getMonth()
    
    // Determine target year
    let targetYear = currentYear
    if (monthIndex > currentMonth) {
      // Future month = previous year
      targetYear = currentYear - 1
    }
    
    // Create ISO date string for 1st of target month
    const monthStr = String(monthIndex + 1).padStart(2, '0')
    const targetDateStr = `${targetYear}-${monthStr}-01`
    
    // Parse as calendar date (use noon UTC to avoid date boundary issues)
    const targetDate = new Date(targetDateStr + 'T12:00:00Z')
    
    // Find Monday of that week using UTC methods
    const dayOfWeek = targetDate.getUTCDay()
    const daysToMonday = dayOfWeek === 0 ? -6 : 1 - dayOfWeek
    const mondayTime = targetDate.getTime() + (daysToMonday * 24 * 60 * 60 * 1000)
    const targetMondayDate = new Date(mondayTime)
    const targetMondayStr = targetMondayDate.toISOString().split('T')[0]
    
    // Get c className="flex-1"urrent Monday and calculate week offset
    const currentMondayStr = getMondayOfWeek(tz, 0)
    const currentMonday = new Date(currentMondayStr + 'T12:00:00Z')
    const targetMonday = new Date(targetMondayStr + 'T12:00:00Z')
    
    const diffTime = targetMonday.getTime() - currentMonday.getTime()
    const diffWeeks = Math.round(diffTime / (1000 * 60 * 60 * 24 * 7))
    
    setWeekOffset(diffWeeks)
    setShowMonthPicker(false)
    setDate(targetDateStr)
  }

  return (
    <div
      className="min-h-screen px-6 py-8 md:px-11 md:py-10"
      data-testid="attendance-page"
      style={{ background: moduleBackgrounds.attendance, paddingBottom: '160px' }}
    >
      {/* Header with Title and Toggle */}
      <div className="mb-6">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1
            className="font-extrabold mb-4"
            style={{ 
              fontSize: typography.display.size, 
              letterSpacing: typography.display.tracking, 
              color: t.text, 
              lineHeight: typography.display.lineHeight,
            }}
          >
            Attendance
          </h1>
          
          {/* Statistics */}
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <div 
                className="w-2 h-2 rounded-full" 
                style={{ background: t.accent }}
              />
              <span className="text-sm font-semibold" style={{ color: t.text }}>
                {stats.total} Total
              </span>
            </div>
            <div className="flex items-center gap-2">
              <div 
                className="w-2 h-2 rounded-full" 
                style={{ background: colors.ok }}
              />
              <span className="text-sm font-semibold" style={{ color: t.text }}>
                {stats.present} Present
              </span>
            </div>
            {stats.late > 0 && (
              <div className="flex items-center gap-2">
                <div 
                  className="w-2 h-2 rounded-full" 
                  style={{ background: colors.warn }}
                />
                <span className="text-sm font-semibold" style={{ color: t.text }}>
                  {stats.late} Late
                </span>
              </div>
            )}
            {stats.onLeave > 0 && (
              <div className="flex items-center gap-2">
                <div 
                  className="w-2 h-2 rounded-full" 
                  style={{ background: colors.accentMid }}
                />
                <span className="text-sm font-semibold" style={{ color: t.text }}>
                  {stats.onLeave} On Leave
                </span>
              </div>
            )}
            {stats.overtime > 0 && (
              <div className="flex items-center gap-2">
                <div 
                  className="w-2 h-2 rounded-full" 
                  style={{ background: colors.accent }}
                />
                <span className="text-sm font-semibold" style={{ color: t.text }}>
                  {stats.overtime} Overtime
                </span>
              </div>
            )}
            {stats.absent > 0 && (
              <div className="flex items-center gap-2">
                <div 
                  className="w-2 h-2 rounded-full" 
                  style={{ background: colors.err }}
                />
                <span className="text-sm font-semibold" style={{ color: t.text }}>
                  {stats.absent} Absent
                </span>
              </div>
            )}
          </div>
        </div>
        
        {/* Right side: DateTime and Notification */}
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

      {/* Filters Row */}
      <div className="flex items-center justify-end gap-3 mb-6">
          {/* Corrections button (manager/admin) */}
          {(role.canViewTeam || role.canViewAll) && (
            <button
              data-testid="attendance-corrections-btn"
              onClick={() => setCorrectionsOpen(true)}
              className="flex items-center gap-2 px-4 py-2.5 rounded-lg transition-all text-xs font-bold"
              style={{ background: t.surface, color: t.text, border: `1px solid ${t.border}` }}
            >
              <Clock size={14} />
              Corrections
            </button>
          )}
          {/* Clock-in Filter */}
          <div className="flex items-center gap-2 p-1 rounded-lg" style={{ background: t.border }}>
            <button
              onClick={() => setClockInFilter('all')}
              data-testid="attendance-filter-all-btn"
              className="px-4 py-2 text-xs font-bold rounded-md transition-all"
              style={{
                background: clockInFilter === 'all' ? t.surface : 'transparent',
                color: clockInFilter === 'all' ? t.text : t.textMuted,
              }}
            >
              All
            </button>
            <button
              onClick={() => setClockInFilter('clocked-in')}
              data-testid="attendance-filter-clocked-in-btn"
              className="px-4 py-2 text-xs font-bold rounded-md transition-all"
              style={{
                background: clockInFilter === 'clocked-in' ? t.surface : 'transparent',
                color: clockInFilter === 'clocked-in' ? t.text : t.textMuted,
              }}
            >
              Clocked In
            </button>
          </div>

          {/* Schedule Filter */}
          {workSchedules.length > 1 && (
            <div className="relative" data-schedule-dropdown>
              <button
                onClick={() => setScheduleDropdownOpen(!scheduleDropdownOpen)}
                className="flex items-center gap-2 px-4 py-2.5 rounded-lg transition-all"
                style={{
                  background: scheduleFilters.length > 0 ? t.surface : 'transparent',
                  color: scheduleFilters.length > 0 ? t.text : t.textMuted,
                  border: `1px solid ${t.border}`,
                }}
              >
                <Clock size={14} />
                <span className="text-xs font-bold">
                  {scheduleFilters.length === 0 ? 'All schedules' : scheduleFilters.length === 1 ? scheduleFilters[0] : `${scheduleFilters.length} schedules`}
                </span>
                <ChevronDown 
                  size={14} 
                  style={{ 
                    transition: 'transform 0.2s',
                    transform: scheduleDropdownOpen ? 'rotate(180deg)' : 'rotate(0deg)'
                  }} 
                />
              </button>

              {scheduleDropdownOpen && (
                <div
                  className="absolute top-full right-0 mt-2 rounded-lg shadow-lg z-50 py-1 min-w-[220px]"
                  style={{
                    background: t.surface,
                    border: `1px solid ${t.border}`,
                  }}
                >
                  {/* All schedules option */}
                  <button
                    onClick={() => {
                      setScheduleFilters([])
                      setScheduleDropdownOpen(false)
                    }}
                    className="w-full px-4 py-2.5 text-left hover:bg-black/5 transition-colors flex items-center justify-between"
                  >
                    <span className="text-sm font-semibold" style={{ color: t.text }}>
                      All schedules
                    </span>
                    {scheduleFilters.length === 0 && (
                      <Check size={14} style={{ color: colors.accent }} />
                    )}
                  </button>

                  <div className="h-px my-1" style={{ background: t.border }} />

                  {/* Individual schedules */}
                  {workSchedules.map((ws) => {
                    const dayNames = [...ws.work_days]
                      .sort((a, b) => a - b)
                      .map((d) => ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'][d])
                      .join(', ')
                    
                    return (
                      <button
                        key={ws.id}
                        onClick={() => {
                          setScheduleFilters(prev =>
                            prev.includes(ws.name) ? prev.filter(n => n !== ws.name) : [...prev, ws.name]
                          )
                        }}
                        className="w-full px-4 py-2.5 text-left hover:bg-black/5 transition-colors"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-0.5">
                              <span className="text-sm font-semibold" style={{ color: t.text }}>
                                {ws.name}
                              </span>
                              {ws.is_default && (
                                <span
                                  className="text-[9px] font-bold uppercase px-1.5 py-0.5 rounded"
                                  style={{ background: `${colors.accent}20`, color: colors.accent }}
                                >
                                  Default
                                </span>
                              )}
                            </div>
                            <p className="text-[11px]" style={{ color: t.textMuted }}>
                              {dayNames} • {ws.start_time.slice(0, 5)}–{ws.end_time.slice(0, 5)}
                            </p>
                          </div>
                          {scheduleFilters.includes(ws.name) && (
                            <Check size={14} style={{ color: colors.accent }} className="flex-shrink-0 mt-0.5" />
                          )}
                        </div>
                      </button>
                    )
                  })}
                </div>
              )}
            </div>
          )}

          {/* Show All Employees Toggle */}
          {(role.canViewTeam || role.canViewAll) && (
          <button
            onClick={() => setShowOthers(!showOthers)}
            data-testid="attendance-show-all-btn"
            className="flex items-center gap-3 px-5 py-2.5 rounded-lg transition-all"
            style={{
              background: showOthers ? t.accent : t.surface,
              color: showOthers ? t.accentText : t.text,
              border: `1px solid ${t.border}`,
            }}
          >
            <span className="text-sm font-bold">
              Show All Employees
            </span>
            <div
              className="w-11 h-6 rounded-full relative transition-all"
              style={{
                background: showOthers ? t.accentText : t.border,
              }}
            >
              <div
                className="absolute top-0.5 w-5 h-5 rounded-full shadow transition-all"
                style={{
                  background: showOthers ? t.accent : t.surface,
                  left: showOthers ? '22px' : '2px',
                }}
              />
            </div>
          </button>
          )}
      </div>

      {/* 2-Column Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-[380px_1fr] gap-6">
        {/* LEFT COLUMN: Attendance Card */}
        <div>
          <div className="sticky top-6">
            <AttendanceCard variant="light" />

            {/* Schedule list */}
            {workSchedules.length > 0 && (
              <div
                className="mt-6 rounded-2xl p-4"
                style={{ background: t.surface, border: `1px solid ${t.border}` }}
              >
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-xs font-bold uppercase tracking-wide" style={{ color: t.textMuted }}>
                    Work Schedules
                  </h3>
                  <button
                    onClick={() => setSchedulesOpen(true)}
                    className="text-[10px] font-bold uppercase px-2 py-1 rounded-md hover:bg-black/5 transition-colors"
                    style={{ color: colors.accent }}
                  >
                    Manage
                  </button>
                </div>
                <div className="space-y-2">
                  {workSchedules.map((ws) => {
                    const dayNames = [...ws.work_days]
                      .sort((a, b) => a - b)
                      .map((d) => ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'][d])
                      .join(', ')
                    const isSelected = scheduleFilters.includes(ws.name)
                    return (
                      <button
                        key={ws.id}
                        onClick={() => setScheduleFilters(prev =>
                          prev.includes(ws.name) ? prev.filter(n => n !== ws.name) : [...prev, ws.name]
                        )}
                        className="w-full rounded-lg px-3 py-2.5 text-left transition-all hover:bg-black/5"
                        style={{
                          border: `1px solid ${isSelected ? colors.accent : t.border}`,
                          background: isSelected ? `${colors.accent}10` : 'transparent',
                        }}
                      >
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-semibold" style={{ color: isSelected ? colors.accent : t.text }}>
                            {ws.name}
                          </span>
                          {ws.is_default && (
                            <span
                              className="text-[9px] font-bold uppercase px-1 py-0.5 rounded"
                              style={{ background: `${colors.accent}20`, color: colors.accent }}
                            >
                              Default
                            </span>
                          )}
                        </div>
                        <p className="text-[11px] mt-0.5" style={{ color: t.textMuted }}>
                          {dayNames} &middot; {ws.start_time.slice(0, 5)}&ndash;{ws.end_time.slice(0, 5)}
                        </p>
                      </button>
                    )
                  })}
                </div>
              </div>
            )}

            {/* Corrections widget */}
            <CorrectionsWidget onViewAll={() => setCorrectionsOpen(true)} />

            {/* Location Analytics Widget — admin only */}
            {role.canViewAll && (
              <LocationAnalyticsWidget className="mt-6" />
            )}
          </div>
        </div>

        {/* RIGHT COLUMN: Week Calendar + Employee Table (Wider) */}
        <div className="space-y-6">
          {/* Week Calendar Navigation */}
          <div 
            className="p-5"
            style={{
              background: t.surface,
              borderRadius: 16,
              border: `1px solid ${t.border}`,
            }}
          >
            {/* Month Navigation */}
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <button
                  onClick={() => {
                    setWeekOffset(weekOffset - 1)
                    setDate(shiftDateISO(date, -7))
                  }}
                  data-testid="attendance-prev-week-btn"
                  className="p-2 rounded-lg hover:bg-black/5 transition-all"
                  style={{ color: t.textMuted }}
                >
                  <ChevronLeft size={20} strokeWidth={2.5} />
                </button>
                
                {/* Month Picker */}
                <div style={{ position: 'relative' }} data-month-picker>
                  <button
                    data-month-picker
                    onClick={() => setShowMonthPicker(!showMonthPicker)}
                    className="font-bold text-sm px-4 py-2 rounded-lg hover:bg-black/5 transition-all"
                    style={{ color: t.text }}
                  >
                    {getDisplayMonthName()}
                  </button>
                  
                  {showMonthPicker && (
                    <div
                      data-month-picker
                      className="absolute top-full left-0 mt-2 rounded-lg shadow-lg z-50 grid grid-cols-3 gap-1 p-2"
                      style={{
                        background: t.surface,
                        border: `1px solid ${t.border}`,
                        minWidth: '240px',
                      }}
                    >
                      {['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'].map((month, idx) => (
                        <button
                          key={month}
                          onClick={() => handleMonthSelect(idx)}
                          className="px-3 py-2 text-sm font-semibold rounded-md hover:bg-black/5 transition-all"
                          style={{ color: t.text }}
                        >
                          {month}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                
                <button
                  onClick={() => {
                    setWeekOffset(weekOffset + 1)
                    const nextDate = shiftDateISO(date, 7)
                    const todayStr = todayISO(tz)
                    setDate(nextDate > todayStr ? todayStr : nextDate)
                  }}
                  disabled={!canNavigateNext}
                  data-testid="attendance-next-week-btn"
                  className="p-2 rounded-lg hover:bg-black/5 transition-all disabled:opacity-30 disabled:cursor-not-allowed"
                  style={{ color: t.textMuted }}
                >
                  <ChevronRight size={20} strokeWidth={2.5} />
                </button>
              </div>

              <button
                onClick={() => {
                  setWeekOffset(0)
                  setDate(todayISO(tz))
                }}
                data-testid="attendance-today-btn"
                className="px-4 py-2 text-sm font-bold rounded-lg transition-all"
                style={{
                  background: weekOffset === 0 ? t.accent : 'transparent',
                  color: weekOffset === 0 ? t.accentText : t.textMuted,
                }}
              >
                Today
              </button>
            </div>

            {/* Horizontal Week Days */}
            <div className="grid grid-cols-7 gap-2">
              {myWeek?.days.map((day, index) => (
                <DayButton
                  key={day.date || index}
                  day={day}
                  isSelected={day.date === date}
                  onClick={() => setDate(day.date || todayISO(tz))}
                />
              ))}
            </div>
          </div>

          {/* Map / List toggle (admin only, desktop only) */}
          {role.canViewAll && (
            <div className="flex items-center justify-end">
              <div className="flex items-center gap-1 p-1 rounded-lg" style={{ background: t.border }}>
                <button
                  onClick={() => setViewMode('list')}
                  data-testid="attendance-view-list-btn"
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-md transition-all"
                  style={{
                    background: viewMode === 'list' ? t.surface : 'transparent',
                    color: viewMode === 'list' ? t.text : t.textMuted,
                  }}
                >
                  <List size={13} />
                  List
                </button>
                <button
                  onClick={() => setViewMode('map')}
                  data-testid="attendance-view-map-btn"
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-md transition-all"
                  style={{
                    background: viewMode === 'map' ? t.surface : 'transparent',
                    color: viewMode === 'map' ? t.text : t.textMuted,
                  }}
                >
                  <Map size={13} />
                  Map
                </button>
              </div>
            </div>
          )}

          {/* Guide row — above table only in list mode */}
          {viewMode === 'list' && (
            <div className="flex items-center gap-3 px-1" style={{ color: t.textMuted }}>
              <span className="text-[11px]">↓ Click a row to see details and request a correction</span>
              <span className="text-[11px] opacity-30">·</span>
              <span
                className="inline-flex items-center gap-1 text-[10px] font-bold px-1.5 py-0.5 rounded"
                style={{ background: `${colors.accent}15`, color: colors.accent }}
              >
                ✎ corrected
              </span>
              <span className="text-[11px]">= time was corrected via a correction request</span>
            </div>
          )}

          {/* Map view */}
          {viewMode === 'map' && role.canViewAll ? (
            <div
              className="p-5"
              style={{
                background: t.surface,
                borderRadius: 16,
                border: `1px solid ${t.border}`,
              }}
            >
              <TeamMapView entries={dailyEntries} date={date} timezone={tz} />
            </div>
          ) : (
          /* Employee Attendance Table */
          <div
            className="overflow-hidden"
            style={{
              background: t.surface,
              borderRadius: 16,
              border: `1px solid ${t.border}`,
            }}
          >
            {/* Table Header */}
            <div
              className="px-6 py-4 border-b"
              style={{ borderColor: t.border }}
            >
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-10 flex-shrink-0"></div>
                <div className="flex-1 min-w-0 text-sm font-bold" style={{ color: t.text }}>Employee</div>
                <div className="w-28 flex-shrink-0 text-sm font-bold text-center" style={{ color: t.text }}>Clock In</div>
                <div className="w-28 flex-shrink-0 text-sm font-bold text-center" style={{ color: t.text }}>Clock Out</div>
              </div>
            </div>

            {/* Table Body */}
            <div>
              {isLoading ? (
                <AttendanceTableSkeleton />
              ) : (
                <>
                  {getEmployeeList().map((employee) => {
                    const isMe = myEmployeeId ? employee.employee_id === myEmployeeId : employee.employee_id === 'me'
                    const isExpanded = expandedRowId === employee.employee_id
                    return (
                      <EmployeeRow
                        key={employee.employee_id}
                        employee={employee}
                        date={date}
                        tz={tz}
                        isMe={isMe}
                        isExpanded={isExpanded}
                        onClick={() => setExpandedRowId(isExpanded ? null : employee.employee_id)}
                        onRequestCorrection={isMe ? (day) => setCorrectionDay(day) : undefined}
                      />
                    )
                  })}
                </>
              )}
            </div>

            {/* Empty State */}
            {!isLoading && getEmployeeList().length === 0 && (
              <div className="px-6 py-12 text-center" data-testid="attendance-empty">
                <p className="text-sm font-bold" style={{ color: t.textMuted }}>
                  No employees to display
                </p>
              </div>
            )}
          </div>
          )}
        </div>
      </div>

      {schedulesOpen && (
        <WorkSchedulesPanel onClose={() => setSchedulesOpen(false)} />
      )}

      {correctionDay && (
        <CorrectionModal
          day={correctionDay}
          onClose={() => setCorrectionDay(null)}
        />
      )}

      {correctionsOpen && (
        <CorrectionsPanel onClose={() => setCorrectionsOpen(false)} />
      )}
    </div>
  )
}

// ── Subcomponents ──────────────────────────────────────────────

// Corrections Widget — sidebar, shows 3 latest pending corrections
function CorrectionsWidget({ onViewAll }: { onViewAll: () => void }) {
  const { data: corrections = [], isLoading } = useCorrections()
  const pending = corrections.filter((c) => c.status === 'pending')
  const latest = pending.slice(0, 3)

  if (isLoading) return null
  if (corrections.length === 0) return null

  return (
    <div
      className="mt-6 rounded-2xl p-4"
      style={{ background: t.surface, border: `1px solid ${t.border}` }}
      data-testid="corrections-widget"
    >
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <h3 className="text-xs font-bold uppercase tracking-wide" style={{ color: t.textMuted }}>
            Corrections
          </h3>
          {pending.length > 0 && (
            <span
              className="text-[10px] font-black px-1.5 py-0.5 rounded-full"
              style={{ background: colors.warnDim, color: colors.warnText }}
            >
              {pending.length} pending
            </span>
          )}
        </div>
        <button
          onClick={onViewAll}
          data-testid="corrections-widget-view-all-btn"
          className="text-[10px] font-bold uppercase px-2 py-1 rounded-md hover:bg-black/5 transition-colors"
          style={{ color: colors.accent }}
        >
          View all
        </button>
      </div>

      {latest.length === 0 ? (
        <p className="text-xs text-center py-2" style={{ color: t.textMuted }}>No pending corrections</p>
      ) : (
        <div className="space-y-2">
          {latest.map((c) => (
            <button
              key={c.id}
              data-testid={`correction-widget-item-${c.id}`}
              onClick={onViewAll}
              className="w-full rounded-lg px-3 py-2.5 text-left hover:bg-black/5 transition-colors"
              style={{ border: `1px solid ${t.border}` }}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-xs font-bold truncate" style={{ color: t.text }}>{c.employee_name}</p>
                  <p className="text-[10px] mt-0.5" style={{ color: t.textMuted }}>{c.date}</p>
                </div>
                <span
                  className="text-[9px] font-bold uppercase px-1.5 py-0.5 rounded-full flex-shrink-0"
                  style={{ background: colors.warnDim, color: colors.warnText }}
                >
                  pending
                </span>
              </div>
              {c.reason && (
                <p className="text-[10px] mt-1 truncate" style={{ color: t.textMuted }}>"{c.reason}"</p>
              )}
            </button>
          ))}
        </div>
      )}

      {pending.length > 3 && (
        <button
          onClick={onViewAll}
          className="w-full mt-2 py-2 text-[11px] font-bold rounded-lg hover:bg-black/5 transition-colors"
          style={{ color: colors.accent }}
        >
          +{pending.length - 3} more corrections →
        </button>
      )}
    </div>
  )
}

// Day Button for Horizontal Week Calendar
interface DayButtonProps {
  day: import('@/types/api').WeekDay
  isSelected: boolean
  onClick: () => void
}

function DayButton({ day, isSelected, onClick }: DayButtonProps) {
  return (
    <div className="relative group">
      <button
        data-testid={`attendance-day-btn-${day.date}`}
        onClick={onClick}
        className="flex flex-col items-center px-2 py-3 rounded-lg transition-all w-full"
        style={{
          background: isSelected ? t.accent : 'transparent',
          border: `1px solid ${isSelected ? t.accent : t.border}`,
        }}
      >
        <span
          className="text-xs font-bold uppercase mb-1"
          style={{ color: isSelected ? t.accentText : t.textMuted }}
        >
          {day.day_name?.substring(0, 2)}
        </span>
        <span
          className="text-2xl font-black"
          style={{
            color: isSelected ? t.accentText : t.text,
            opacity: (day.status === 'weekend' || day.status === 'future') ? 0.3 : 1,
          }}
        >
          {day.day_number || '—'}
        </span>
      </button>
    </div>
  )
}

// Employee Row Component
interface EmployeeRowProps {
  employee: any
  date: string
  tz: string
  isMe?: boolean
  isExpanded?: boolean
  onClick: () => void
  onRequestCorrection?: (day: import('@/types/api').WeekDay) => void
}

function EmployeeRow({ employee, date, tz, isMe, isExpanded, onClick, onRequestCorrection }: EmployeeRowProps) {
  // Find attendance for selected date
  const dayData = employee.week?.days.find((d: any) => d.date === date)
  
  // Debug: Log when dayData is missing to help diagnose issues
  if (!dayData && process.env.NODE_ENV === 'development') {
    console.warn(`Missing day data for employee ${employee.employee_name} on ${date}`, {
      availableDates: employee.week?.days.map((d: any) => d.date),
      requestedDate: date,
    })
  }
  
  const clockInTime = dayData?.clock_in_at ? formatDate(dayData.clock_in_at, tz, 'time') : null
  const clockOutTime = dayData?.clock_out_at ? formatDate(dayData.clock_out_at, tz, 'time') : null
  
  // Determine status display
  const getStatusBadge = () => {
    if (!dayData) return null
    
    const status = dayData.status
    
    if (status === 'overtime') {
      return {
        label: 'Overtime',
        bg: colors.accentDim,
        dot: colors.accent,
        text: colors.accentText,
      }
    } else if (status === 'on-time') {
      return {
        label: 'On Time',
        bg: colors.okDim,
        dot: colors.ok,
        text: colors.okText,
      }
    } else if (status === 'late') {
      return {
        label: 'Late',
        bg: colors.warnDim,
        dot: colors.warn,
        text: colors.warnText,
      }
    } else if (status === 'on_leave') {
      return {
        label: 'On Leave',
        bg: colors.accentDim,
        dot: colors.accentMid,
        text: colors.accentText,
      }
    } else if (status === 'absent') {
      return {
        label: 'Absent',
        bg: colors.errDim,
        dot: colors.err,
        text: colors.errText,
      }
    } else if (status === 'holiday') {
      return {
        label: 'Holiday',
        bg: colors.accentDim,
        dot: colors.accentMid,
        text: colors.accentText,
      }
    } else if (status === 'weekend') {
      return {
        label: 'Weekend',
        bg: 'rgba(0,0,0,0.05)',
        dot: t.textMuted,
        text: t.textMuted,
      }
    } else if (status === 'future') {
      return {
        label: 'Future',
        bg: 'rgba(0,0,0,0.03)',
        dot: t.textMuted,
        text: t.textMuted,
      }
    }
    return null
  }
  
  const badge = getStatusBadge()

  const isPastWorkday = dayData && !dayData.is_today && dayData.status !== 'future' && dayData.status !== 'weekend' && dayData.status !== 'holiday'
  const correctionDisabledReason = !isPastWorkday
    ? dayData?.status === 'future' ? 'Cannot request correction for future dates'
      : dayData?.is_today ? 'Cannot request correction for today'
      : dayData?.status === 'weekend' ? 'No correction needed for weekends'
      : dayData?.status === 'holiday' ? 'No correction needed for holidays'
      : null
    : null

  return (
    <div
      className="border-b transition-all cursor-pointer"
      data-testid={`attendance-row-${employee.employee_id}`}
      style={{
        borderColor: t.border,
        background: isMe ? 'rgba(99,87,232,0.06)' : undefined,
        borderLeft: isMe ? `3px solid ${colors.accent}` : undefined,
      }}
    >
      {/* Main row */}
      <div className="px-6 py-4 flex items-center gap-3 min-w-0 hover:bg-black/[0.02]" onClick={onClick}>
        {/* Avatar — always show real name */}
        <div className="w-10 flex-shrink-0 relative">
          <Avatar
            id={employee.employee_id}
            name={employee.employee_name}
            size={40}
          />
          {isMe && (
            <span
              className="absolute -bottom-1 -right-1 text-[8px] font-black px-1 rounded"
              style={{ background: colors.accent, color: '#fff', lineHeight: '14px' }}
            >
              ME
            </span>
          )}
        </div>

        {/* Name + Status */}
        <div className="flex-1 min-w-0 flex items-center gap-2">
          <span
            className="text-sm font-bold truncate"
            style={{ color: isMe ? colors.accent : t.text }}
          >
            {employee.employee_name}
          </span>
          {!dayData && (
            <span className="text-xs italic flex-shrink-0" style={{ color: t.textMuted }}>No data</span>
          )}
          {badge && (
            <div className="inline-flex items-center gap-1.5 px-2 py-1 rounded-full flex-shrink-0" style={{ background: badge.bg }}>
              <div className="w-1.5 h-1.5 rounded-full" style={{ background: badge.dot }} />
              <span className="text-[10px] font-bold uppercase tracking-wide" style={{ color: badge.text }}>
                {badge.label}
              </span>
            </div>
          )}
        </div>

        {/* Clock In */}
        <div className="w-28 flex-shrink-0 flex flex-col items-center gap-0.5">
          {clockInTime ? (
            <div className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-full"
              style={{ background: dayData.status === 'overtime' ? colors.accentDim : colors.okDim }}>
              <div className="w-2 h-2 rounded-full flex-shrink-0"
                style={{ background: dayData.status === 'overtime' ? colors.accent : colors.ok }} />
              <span className="text-xs font-bold whitespace-nowrap"
                style={{ color: dayData.status === 'overtime' ? colors.accentText : colors.okText }}>
                {clockInTime}
              </span>
            </div>
          ) : (
            <div className="flex items-center gap-1.5 px-3 py-2 rounded-lg border"
              style={{ background: t.surface, borderColor: t.border }}>
              <Clock size={14} style={{ color: t.textMuted, opacity: 0.4 }} />
            </div>
          )}
          {dayData?.is_corrected && clockInTime && (
            <span className="text-[9px] font-bold px-1 rounded" style={{ background: `${colors.accent}15`, color: colors.accent }}>✎ corrected</span>
          )}
        </div>

        {/* Clock Out */}
        <div className="w-28 flex-shrink-0 flex flex-col items-center gap-0.5">
          {clockOutTime ? (
            <div className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-full" style={{ background: colors.ink100 }}>
              <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: colors.ink500 }} />
              <span className="text-xs font-bold whitespace-nowrap" style={{ color: colors.ink700 }}>{clockOutTime}</span>
            </div>
          ) : clockInTime ? (
            <div className="flex items-center gap-1.5 px-3 py-2 rounded-lg border"
              style={{ background: colors.warnDim, borderColor: colors.warn }}>
              <div className="w-2 h-2 rounded-full" style={{ background: colors.warn }} />
              <span className="text-[10px] font-bold whitespace-nowrap" style={{ color: colors.warnText }}>Working</span>
            </div>
          ) : (
            <div className="flex items-center gap-1.5 px-3 py-2 rounded-lg border"
              style={{ background: t.surface, borderColor: t.border }}>
              <Clock size={14} style={{ color: t.textMuted, opacity: 0.4 }} />
            </div>
          )}
          {dayData?.is_corrected && clockOutTime && (
            <span className="text-[9px] font-bold px-1 rounded" style={{ background: `${colors.accent}15`, color: colors.accent }}>✎ corrected</span>
          )}
        </div>
      </div>

      {/* Expanded detail */}
      {isExpanded && dayData && (
        <div
          data-testid={`attendance-detail-${employee.employee_id}`}
          className="px-6 pb-5 pt-3 border-t"
          style={{ borderColor: t.border, background: isMe ? 'rgba(99,87,232,0.04)' : 'rgba(0,0,0,0.02)' }}
        >
          {/* Detail grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-3">
            <div className="rounded-xl p-3" style={{ background: t.surface, border: `1px solid ${t.border}` }}>
              <p className="text-[10px] font-bold uppercase tracking-wide mb-1" style={{ color: t.textMuted }}>Employee</p>
              <p className="text-sm font-semibold" style={{ color: t.text }}>{employee.employee_name}</p>
            </div>
            <div className="rounded-xl p-3" style={{ background: t.surface, border: `1px solid ${t.border}` }}>
              <p className="text-[10px] font-bold uppercase tracking-wide mb-1" style={{ color: t.textMuted }}>Schedule</p>
              <p className="text-sm font-semibold" style={{ color: t.text }}>{employee.work_schedule_name ?? '—'}</p>
            </div>
            <div className="rounded-xl p-3" style={{ background: t.surface, border: `1px solid ${t.border}` }}>
              <p className="text-[10px] font-bold uppercase tracking-wide mb-1" style={{ color: t.textMuted }}>Clock In</p>
              <div className="flex items-center gap-1.5">
                <p className="text-sm font-semibold" style={{ color: t.text }}>
                  {dayData.clock_in_at ? formatDate(dayData.clock_in_at, tz, 'time') : '—'}
                </p>
                {dayData.is_corrected && dayData.clock_in_at && (
                  <span className="text-[9px] font-bold px-1 rounded" style={{ background: `${colors.accent}15`, color: colors.accent }}>✎</span>
                )}
              </div>
            </div>
            <div className="rounded-xl p-3" style={{ background: t.surface, border: `1px solid ${t.border}` }}>
              <p className="text-[10px] font-bold uppercase tracking-wide mb-1" style={{ color: t.textMuted }}>Clock Out</p>
              <div className="flex items-center gap-1.5">
                <p className="text-sm font-semibold" style={{ color: t.text }}>
                  {dayData.clock_out_at ? formatDate(dayData.clock_out_at, tz, 'time') : '—'}
                </p>
                {dayData.is_corrected && dayData.clock_out_at && (
                  <span className="text-[9px] font-bold px-1 rounded" style={{ background: `${colors.accent}15`, color: colors.accent }}>✎</span>
                )}
              </div>
            </div>
          </div>

          {/* Note — always show */}
          <div className="rounded-xl px-3 py-2.5 mb-4" style={{ background: t.surface, border: `1px solid ${t.border}` }}>
            <p className="text-[10px] font-bold uppercase tracking-wide mb-1" style={{ color: t.textMuted }}>Note</p>
            <p className="text-sm" style={{ color: dayData.note ? t.text : t.textMuted }}>
              {dayData.note ?? 'No note'}
            </p>
          </div>

          {/* Correction button — own row only */}
          {isMe && onRequestCorrection && (
            <div className="relative group inline-block">
              <button
                data-testid={`attendance-correction-btn-${employee.employee_id}`}
                disabled={!isPastWorkday}
                onClick={(e) => {
                  if (!isPastWorkday) return
                  e.stopPropagation()
                  onRequestCorrection(dayData)
                }}
                className="flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-all"
                style={isPastWorkday ? {
                  background: colors.accent,
                  color: '#fff',
                  cursor: 'pointer',
                } : {
                  background: `${t.border}`,
                  color: `${t.textMuted}80`,
                  cursor: 'not-allowed',
                }}
              >
                <Clock size={13} strokeWidth={2.5} />
                Request attendance correction
              </button>
              {correctionDisabledReason && (
                <div
                  className="absolute bottom-full left-0 mb-1.5 px-2.5 py-1.5 rounded-lg text-[11px] font-medium whitespace-nowrap pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity z-50"
                  style={{ background: '#1a1a2e', color: '#fff' }}
                >
                  {correctionDisabledReason}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ── Attendance Table Skeleton ──────────────────────────────────

function AttendanceTableSkeleton() {
  return (
    <div data-testid="attendance-skeleton">
      {Array.from({ length: 5 }).map((_, i) => (
        <div
          key={i}
          className="px-6 py-4 border-b animate-pulse"
          style={{ borderColor: t.border }}
        >
          <div className="flex items-center gap-3 min-w-0">
            {/* Avatar skeleton */}
            <div className="w-10 flex-shrink-0">
              <Skeleton width={40} height={40} borderRadius={10} />
            </div>
            
            {/* Name */}
            <div className="flex-1 min-w-0">
              <Skeleton width="40%" height={14} style={{ marginBottom: 4 }} />
              <Skeleton width="30%" height={12} />
            </div>

            {/* Schedule */}
            <div className="w-24 flex-shrink-0 hidden lg:block">
              <Skeleton width={70} height={12} />
            </div>

            {/* Clock In */}
            <div className="w-28 flex-shrink-0 flex justify-center">
              <Skeleton width={80} height={28} borderRadius={999} />
            </div>
            
            {/* Clock Out */}
            <div className="w-28 flex-shrink-0 flex justify-center">
              <Skeleton width={80} height={28} borderRadius={999} />
            </div>
            
            {/* Note */}
            <div className="w-32 flex-shrink-0 hidden md:block">
              <Skeleton width="60%" height={12} />
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}
