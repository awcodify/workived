import { moduleThemes } from '@/design/tokens'
import type { WeekCalendar, WeekDay } from '@/types/api'
import { CheckCircle2, XCircle, Clock, Coffee, ChevronLeft, ChevronRight } from 'lucide-react'
import { useOrganisation } from '@/lib/hooks/useOrganisation'
import { formatDate } from '@/lib/utils/date'

const t = moduleThemes.attendance

// Modern minimal status colors
const statusConfig = {
  'on-time': {
    color: '#10B981',
    bgColor: 'rgba(16, 185, 129, 0.12)',
    icon: CheckCircle2,
    label: 'On Time',
  },
  'late': {
    color: '#F59E0B',
    bgColor: 'rgba(245, 158, 11, 0.12)',
    icon: Clock,
    label: 'Late',
  },
  'absent': {
    color: '#EF4444',
    bgColor: 'rgba(239, 68, 68, 0.12)',
    icon: XCircle,
    label: 'Absent',
  },
  'weekend': {
    color: 'rgba(255,255,255,0.35)',
    bgColor: 'rgba(255,255,255,0.04)',
    icon: Coffee,
    label: 'Off Day',
  },
  'future': {
    color: 'rgba(255,255,255,0.2)',
    bgColor: 'rgba(255,255,255,0.02)',
    icon: Clock,
    label: '—',
  },
} as const

interface AttendanceWeekCalendarProps {
  week?: WeekCalendar // Optional - will show empty state if missing
  employeeName?: string // For team view
  onPreviousWeek?: () => void
  onNextWeek?: () => void
  onCurrentWeek?: () => void
  canNavigateNext?: boolean
  isCurrentWeek?: boolean
}

/**
 * AttendanceWeekCalendar - Redesigned horizontal week view (Sprint 12).
 * 
 * Features: Modern timeline design with integrated navigation, cleaner status display.
 */
export function AttendanceWeekCalendar({ 
  week, 
  employeeName,
  onPreviousWeek,
  onNextWeek,
  onCurrentWeek,
  canNavigateNext = true,
  isCurrentWeek = false,
}: AttendanceWeekCalendarProps) {
  const { data: org } = useOrganisation()
  const tz = org?.timezone ?? 'UTC'
  
  // Generate empty week structure if no data
  const days = week?.days ?? generateEmptyWeek()
  const weekRange = week 
    ? `${formatShortDate(week.start_date)} — ${formatShortDate(week.end_date)}`
    : 'Loading week...'
  
  const showNavigation = onPreviousWeek || onNextWeek || onCurrentWeek

  return (
    <div className="mb-4">
      {/* Employee name (if team view) */}
      {employeeName && (
        <h3 
          className="font-bold mb-3 px-4" 
          style={{ fontSize: 15, color: t.text }}
        >
          {employeeName}
        </h3>
      )}

      {/* Week Calendar Table */}
      <div
        style={{
          background: '#FFFFFF',
          border: '1px solid #E5E7EB',
          borderRadius: 16,
          overflow: 'hidden',
          boxShadow: '0 1px 3px rgba(0,0,0,0.06), 0 1px 2px rgba(0,0,0,0.04)',
        }}
      >
        {/* Navigation Header */}
        <div 
          className="flex items-center justify-between px-5 py-4"
          style={{
            background: '#F9FAFB',
            borderBottom: '1px solid #E5E7EB',
          }}
        >
          <span 
            className="font-bold text-sm"
            style={{ color: '#111827' }}
          >
            {weekRange}
          </span>

          {/* Week navigation */}
          {showNavigation && (
            <div className="flex items-center gap-2">
              {onPreviousWeek && (
                <button
                  onClick={onPreviousWeek}
                  className="p-2 rounded-lg transition-all hover:bg-white"
                  style={{ color: '#6B7280' }}
                  title="Previous week"
                >
                  <ChevronLeft size={16} strokeWidth={2.5} />
                </button>
              )}
              
              {onCurrentWeek && (
                <button
                  onClick={onCurrentWeek}
                  className="px-3 py-2 text-xs font-bold transition-all rounded-lg"
                  style={{
                    color: isCurrentWeek ? '#FFFFFF' : '#6B7280',
                    background: isCurrentWeek ? 'linear-gradient(135deg, #8B5CF6 0%, #7C3AED 100%)' : '#FFFFFF',
                    boxShadow: isCurrentWeek ? '0 2px 6px rgba(139,92,246,0.2)' : 'none',
                  }}
                  title="Jump to current week"
                >
                  Today
                </button>
              )}
              
              {onNextWeek && (
                <button
                  onClick={onNextWeek}
                  disabled={!canNavigateNext}
                  className="p-2 rounded-lg transition-all hover:bg-white disabled:opacity-30 disabled:cursor-not-allowed disabled:hover:bg-transparent"
                  style={{ color: '#6B7280' }}
                  title={canNavigateNext ? "Next week" : "Cannot view future weeks"}
                >
                  <ChevronRight size={16} strokeWidth={2.5} />
                </button>
              )}
            </div>
          )}
        </div>

        {/* 7-day grid */}
        <div className="grid grid-cols-7">
          {days.map((day, index) => (
            <DayColumn key={day.date || index} day={day} isLast={index === 6} tz={tz} />
          ))}
        </div>
      </div>
    </div>
  )
}

function DayColumn({ day, isLast, tz }: { day: WeekDay; isLast: boolean; tz: string }) {
  const config = statusConfig[day.status]
  const Icon = config.icon
  const isToday = day.is_today

  return (
    <div
      className="flex flex-col items-center py-6 px-3 relative transition-all"
      style={{
        borderRight: isLast ? 'none' : '1px solid #F3F4F6',
        background: isToday ? '#F9FAFB' : '#FFFFFF',
      }}
    >
      {/* Today indicator */}
      {isToday && (
        <div 
          className="absolute top-0 left-0 right-0 h-1"
          style={{
            background: `linear-gradient(90deg, transparent 0%, ${config.color} 50%, transparent 100%)`,
          }}
        />
      )}

      {/* Day name */}
      <div 
        className="text-[10px] font-bold uppercase tracking-wider mb-3"
        style={{
          color: isToday ? config.color : '#9CA3AF',
        }}
      >
        {day.day_name}
      </div>

      {/* Day number */}
      <div 
        className="mb-5 font-black tabular-nums"
        style={{
          fontSize: 32,
          color: isToday ? config.color : '#111827',
          lineHeight: 1,
          opacity: (day.status === 'weekend' || day.status === 'future') ? 0.25 : 1,
          letterSpacing: '-0.03em',
        }}
      >
        {day.day_number || '—'}
      </div>

      {/* Status icon with badge */}
      <div 
        className="mb-4 p-2.5"
        style={{
          background: `${config.color}15`,
          borderRadius: 10,
        }}
      >
        <Icon 
          size={20} 
          style={{ 
            color: config.color,
            strokeWidth: 2.5,
            opacity: day.status === 'future' ? 0.25 : 1,
          }} 
        />
      </div>

      {/* Clock times */}
      {day.clock_in_at || day.clock_out_at ? (
        <div className="space-y-2 w-full text-center">
          {day.clock_in_at && (
            <div 
              className="py-2 px-3 rounded-lg"
              style={{
                background: '#F0FDF4',
                border: '1px solid #D1FAE5',
              }}
            >
              <div 
                className="text-[9px] font-bold uppercase tracking-wider mb-1"
                style={{ color: '#10B981', opacity: 0.7 }}
              >
                In
              </div>
              <div 
                className="text-xs font-bold tabular-nums"
                style={{ color: '#10B981' }}
              >
                {formatDate(day.clock_in_at, tz, 'time')}
              </div>
            </div>
          )}
          
          {day.clock_out_at && (
            <div 
              className="py-2 px-3 rounded-lg"
              style={{
                background: '#F9FAFB',
                border: '1px solid #E5E7EB',
              }}
            >
              <div 
                className="text-[9px] font-bold uppercase tracking-wider mb-1"
                style={{ color: '#6B7280', opacity: 0.7 }}
              >
                Out
              </div>
              <div 
                className="text-xs font-bold tabular-nums"
                style={{ color: '#374151' }}
              >
                {formatDate(day.clock_out_at, tz, 'time')}
              </div>
            </div>
          )}
        </div>
      ) : (
        <div 
          className="text-[10px] font-bold"
          style={{ 
            color: config.color,
            opacity: day.status === 'future' ? 0.25 : 0.6,
          }}
        >
          {config.label}
        </div>
      )}
    </div>
  )
}

// Helper: Generate empty week structure for placeholder
function generateEmptyWeek(): WeekDay[] {
  const today = new Date()
  const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
  
  return Array.from({ length: 7 }, (_, i) => {
    const date = new Date(today)
    date.setDate(today.getDate() - today.getDay() + i)
    
    return {
      date: date.toISOString().split('T')[0] ?? '',
      day_name: dayNames[i] ?? '—',
      day_number: date.getDate(),
      status: 'future' as const,
      is_today: false,
    }
  })
}

// Helper: Format date as "Mar 16"
function formatShortDate(isoDate: string): string {
  try {
    const date = new Date(isoDate)
    return new Intl.DateTimeFormat('en', { month: 'short', day: 'numeric' }).format(date)
  } catch {
    return isoDate
  }
}
