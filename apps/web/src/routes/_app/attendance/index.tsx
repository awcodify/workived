import { createFileRoute } from '@tanstack/react-router'
import { useState, useEffect, useMemo, useRef } from 'react'
import { DateTime } from '@/components/workived/shared/DateTime'
import { useOrganisation } from '@/lib/hooks/useOrganisation'
import { useMyWeek, useTeamWeek, useAllWeek } from '@/lib/hooks/useAttendance'
import { useAttendanceRole } from '@/lib/hooks/useAttendanceRole'
import { todayISO, formatDate, getMondayOfWeek } from '@/lib/utils/date'
import { Avatar } from '@/components/workived/layout/Avatar'
import { AttendanceCard } from '@/components/workived/attendance/AttendanceCard'
import { moduleBackgrounds, moduleThemes, typography, colors } from '@/design/tokens'
import { ChevronLeft, ChevronRight, Clock } from 'lucide-react'

const t = moduleThemes.attendance

export const Route = createFileRoute('/_app/attendance/')({
  component: AttendancePage,
})

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
  
  // Track if org has loaded to recalculate initial date
  const orgLoadedRef = useRef(false)
  
  // Sprint 12: Show others toggle
  const [showOthers, setShowOthers] = useState(true)
  
  // Filter by clock-in status
  const [clockInFilter, setClockInFilter] = useState<'all' | 'clocked-in'>('all')
  
  // Week navigation state (0 = current week, -1 = previous week, etc.)
  const [weekOffset, setWeekOffset] = useState(0)
  const weekStart = useMemo(() => getMondayOfWeek(tz, weekOffset), [tz, weekOffset])
  
  // Conditionally fetch based on role to avoid 404 errors
  const { data: myWeek } = useMyWeek(weekStart)
  const { data: teamWeek } = useTeamWeek(weekStart, role.canViewTeam)
  const { data: allWeek } = useAllWeek(weekStart, role.canViewAll)
  
  // Check if we can navigate to next week (cannot go to future)
  const canNavigateNext = !isWeekInFuture(getMondayOfWeek(tz, weekOffset + 1), tz)
  
  // Daily report state
  const [date, setDate] = useState(() => todayISO('UTC'))
  
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
        if (dayData.status === 'present' || dayData.status === 'late') {
          if (dayData.status === 'late') late++
          else present++
        } else if (dayData.status === 'on_leave') {
          onLeave++
        } else if (dayData.status === 'absent') {
          absent++
        } else if (dayData.status === 'overtime') {
          overtime++
        }
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
          {/* Notification Placeholder */}
          <div
              style={{
                minWidth: 36,
                height: 36,
                background: t.surface,
                borderRadius: 10,
                boxShadow: '0 1px 4px 0 rgba(0,0,0,0.04)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: 0,
                border: `1px solid ${t.border}`,
              }}
              title="No notifications"
            >
              <svg width="18" height="18" fill="none" viewBox="0 0 24 24" style={{ color: colors.accent, flexShrink: 0 }}>
                <path d="M18 16v-5a6 6 0 10-12 0v5a2 2 0 01-2 2h16a2 2 0 01-2-2z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                <path d="M13.73 21a2 2 0 01-3.46 0" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </div>
        </div>
      </div>
      </div>

      {/* Filters Row */}
      <div className="flex items-center justify-end gap-3 mb-6">
          {/* Clock-in Filter */}
          <div className="flex items-center gap-2 p-1 rounded-lg" style={{ background: t.border }}>
            <button
              onClick={() => setClockInFilter('all')}
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
              className="px-4 py-2 text-xs font-bold rounded-md transition-all"
              style={{
                background: clockInFilter === 'clocked-in' ? t.surface : 'transparent',
                color: clockInFilter === 'clocked-in' ? t.text : t.textMuted,
              }}
            >
              Clocked In
            </button>
          </div>
          
          {/* Show All Employees Toggle */}
          {(role.canViewTeam || role.canViewAll) && (
          <button
            onClick={() => setShowOthers(!showOthers)}
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
                  onClick={() => setWeekOffset(weekOffset - 1)}
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
                  onClick={() => setWeekOffset(weekOffset + 1)}
                  disabled={!canNavigateNext}
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

          {/* Employee Attendance Table */}
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
              <div className="flex items-center gap-6">
                <div className="w-10"></div> {/* Avatar space */}
                <div className="flex-1 text-sm font-bold" style={{ color: t.text }}>Employee</div>
                <div className="w-32 text-sm font-bold text-center" style={{ color: t.text }}>Clock In</div>
                <div className="w-32 text-sm font-bold text-center" style={{ color: t.text }}>Clock Out</div>
                <div className="w-40 text-sm font-bold" style={{ color: t.text }}>Note</div>
              </div>
            </div>

            {/* Table Body */}
            <div>
              {getEmployeeList().map((employee) => (
                <EmployeeRow
                  key={employee.employee_id}
                  employee={employee}
                  date={date}
                  tz={tz}
                />
              ))}
            </div>

            {/* Empty State */}
            {getEmployeeList().length === 0 && (
              <div className="px-6 py-12 text-center">
                <p className="text-sm font-bold" style={{ color: t.textMuted }}>
                  No employees to display
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Subcomponents ──────────────────────────────────────────────

// Day Button for Horizontal Week Calendar
interface DayButtonProps {
  day: any
  isSelected: boolean
  onClick: () => void
}

function DayButton({ day, isSelected, onClick }: DayButtonProps) {
  return (
    <button
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
  )
}

// Employee Row Component
interface EmployeeRowProps {
  employee: any
  date: string
  tz: string
}

function EmployeeRow({ employee, date, tz }: EmployeeRowProps) {
  // Find attendance for selected date
  const dayData = employee.week?.days.find((d: any) => d.date === date)
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
    }
    return null
  }
  
  const badge = getStatusBadge()

  return (
    <div
      className="px-6 py-4 border-b transition-all hover:bg-black/[0.02]"
      style={{
        borderColor: t.border,
      }}
    >
      <div className="flex items-center gap-6">
        {/* Avatar */}
        <div className="w-10 flex-shrink-0">
          <Avatar id={employee.employee_id} name={employee.employee_name} size={40} />
        </div>

        {/* Employee Name + Status Badge */}
        <div className="flex-1 flex items-center gap-3">
          <span className="text-sm font-bold" style={{ color: t.text }}>
            {employee.employee_name}
          </span>
          {badge && (
            <div 
              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full"
              style={{ background: badge.bg }}
            >
              <div className="w-1.5 h-1.5 rounded-full" style={{ background: badge.dot }} />
              <span className="text-[10px] font-bold uppercase tracking-wide" style={{ color: badge.text }}>
                {badge.label}
              </span>
            </div>
          )}
        </div>

        {/* Clock In */}
        <div className="w-32 flex justify-center">
          {clockInTime ? (
            <div className="flex flex-col items-center gap-1">
              <div 
                className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full"
                style={{
                  background: dayData.status === 'overtime' ? colors.accentDim : colors.okDim,
                }}
              >
                <div className="w-2 h-2 rounded-full" style={{ 
                  background: dayData.status === 'overtime' ? colors.accent : colors.ok 
                }} />
                <span className="text-xs font-bold" style={{ 
                  color: dayData.status === 'overtime' ? colors.accentText : colors.okText 
                }}>
                  {clockInTime}
                </span>
              </div>
              <span className="text-[10px] font-medium" style={{ 
                color: dayData.status === 'overtime' ? colors.accentText : colors.okText 
              }}>
              </span>
            </div>
          ) : (
            <div 
              className="flex flex-col items-center gap-1.5 px-4 py-2.5 rounded-lg border"
              style={{
                background: t.surface,
                borderColor: t.border,
              }}
            >
              <Clock size={16} style={{ color: t.textMuted, opacity: 0.4 }} />
            </div>
          )}
        </div>

        {/* Clock Out */}
        <div className="w-32 flex justify-center">
          {clockOutTime ? (
            <div className="flex flex-col items-center gap-1">
              <div 
                className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full"
                style={{
                  background: colors.ink100,
                }}
              >
                <div className="w-2 h-2 rounded-full" style={{ background: colors.ink500 }} />
                <span className="text-xs font-bold" style={{ color: colors.ink700 }}>
                  {clockOutTime}
                </span>
              </div>
            </div>
          ) : clockInTime ? (
            <div 
              className="flex flex-col items-center gap-1.5 px-4 py-2.5 rounded-lg border"
              style={{
                background: colors.warnDim,
                borderColor: colors.warn,
              }}
            >
              <div className="w-2 h-2 rounded-full" style={{ background: colors.warn }} />
              <span className="text-[10px] font-bold" style={{ color: colors.warnText }}>
                Working
              </span>
            </div>
          ) : (
            <div 
              className="flex flex-col items-center gap-1.5 px-4 py-2.5 rounded-lg border"
              style={{
                background: t.surface,
                borderColor: t.border,
              }}
            >
              <Clock size={16} style={{ color: t.textMuted, opacity: 0.4 }} />
            </div>
          )}
        </div>

        {/* Note */}
        <div className="w-40">
          {dayData?.note ? (
            <div 
              className="w-full px-3 py-2 text-xs rounded-lg"
              style={{
                background: t.surface,
                border: `1px solid ${t.border}`,
                color: t.text,
              }}
            >
              {dayData.note}
            </div>
          ) : (
            <span className="text-xs" style={{ color: t.textMuted }}>
              No note
            </span>
          )}
        </div>
      </div>
    </div>
  )
}
