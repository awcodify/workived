import { createFileRoute } from '@tanstack/react-router'
import { DateTime } from '@/components/workived/shared/DateTime'
import { NotificationBell } from '@/components/workived/shared/NotificationBell'
import { moduleBackgrounds, moduleThemes, typography, colors } from '@/design/tokens'
import {
  TrendingUp,
  TrendingDown,
  Minus,
  Award,
  Clock,
  Calendar,
  FileText,
  Users,
  ChevronRight,
  AlertTriangle,
  CheckCircle2,
  Info,
  Activity,
} from 'lucide-react'

// Use reports theme colors (light text on dark background)
const theme = moduleThemes.reports

export const Route = createFileRoute('/_app/reports/performance-v2')({
  component: PerformanceDashboard,
})

// ── Types ───────────────────────────────────────────────────────

interface EmployeeScore {
  id: string
  name: string
  department: string
  jobTitle: string
  scores: {
    taskCompletion: number
    attendance: number
    leavePlanning: number
    overall: number
  }
  attendanceBreakdown: {
    onTime: number
    late: number
    absent: number
    total: number
  }
  taskBreakdown: {
    completed: number
    onTime: number
    late: number
    pending: number
  }
  trend: 'up' | 'down' | 'stable'
  trendValue: number
  lastActive: string
  riskFlag?: 'high' | 'medium' | null
}

interface ScoreCard {
  title: string
  score: number
  change: number
  description: string
  icon: React.ElementType
  color: string
  breakdown?: { label: string; value: number; color: string }[]
}

interface TrendData {
  month: string
  overall: number
  tasks: number
  attendance: number
  leave: number
}

interface DepartmentTrend {
  department: string
  current: number
  previous: number
  change: number
  color: string
}

interface InsightItem {
  type: 'warning' | 'success' | 'info'
  title: string
  description: string
  action?: string
}

// ── Dummy Data ──────────────────────────────────────────────────

const PERFORMANCE_TRENDS: TrendData[] = [
  { month: 'Nov', overall: 86, tasks: 84, attendance: 90, leave: 82 },
  { month: 'Dec', overall: 88, tasks: 87, attendance: 91, leave: 84 },
  { month: 'Jan', overall: 89, tasks: 89, attendance: 92, leave: 83 },
  { month: 'Feb', overall: 91, tasks: 92, attendance: 93, leave: 86 },
  { month: 'Mar', overall: 92, tasks: 93, attendance: 93, leave: 88 },
  { month: 'Apr', overall: 91, tasks: 91, attendance: 93, leave: 89 },
]

const DEPARTMENT_TRENDS: DepartmentTrend[] = [
  { department: 'Engineering', current: 93, previous: 89, change: +4, color: '#818CF8' },
  { department: 'Finance', current: 98, previous: 97, change: +1, color: '#34D399' },
  { department: 'HR', current: 94, previous: 94, change: 0, color: '#F59E0B' },
  { department: 'Operations', current: 88, previous: 91, change: -3, color: '#EF4444' },
  { department: 'Marketing', current: 86, previous: 89, change: -3, color: '#EF4444' },
]

const INSIGHTS: InsightItem[] = [
  {
    type: 'warning',
    title: '2 employees need attention',
    description: 'Farhan Rahman and Maya Dewi showing declining scores',
    action: 'Schedule 1-on-1',
  },
  {
    type: 'success',
    title: 'Engineering improving',
    description: 'Team score increased 4 points this month',
  },
  {
    type: 'info',
    title: 'Late arrivals +12%',
    description: '11% of check-ins were late this week vs 8% last month',
    action: 'Review schedules',
  },
]

const SCORE_CARDS: ScoreCard[] = [
  {
    title: 'Task Delivery',
    score: 91,
    change: +3,
    description: '131 tasks completed this month • 18.5 avg per person',
    icon: FileText,
    color: '#818CF8',
    breakdown: [
      { label: 'On Time', value: 78, color: '#34D399' },
      { label: 'Late', value: 13, color: '#F59E0B' },
      { label: 'Pending', value: 9, color: '#64748B' },
    ],
  },
  {
    title: 'Attendance',
    score: 93,
    change: -1,
    description: '161 on-time • 22 late • 5 absent (this month)',
    icon: Clock,
    color: '#34D399',
    breakdown: [
      { label: 'On Time', value: 87, color: '#34D399' },
      { label: 'Late', value: 11, color: '#F59E0B' },
      { label: 'Absent', value: 2, color: '#EF4444' },
    ],
  },
  {
    title: 'Leave Planning',
    score: 89,
    change: +2,
    description: '4.2 days avg advance notice for leave requests',
    icon: Calendar,
    color: '#F59E0B',
    breakdown: [
      { label: 'Well Planned (≥5 days)', value: 73, color: '#34D399' },
      { label: 'Short Notice (<5 days)', value: 27, color: '#F59E0B' },
    ],
  },
]

const EMPLOYEE_SCORES: EmployeeScore[] = [
  {
    id: '1',
    name: 'Adi Nugroho',
    department: 'Finance',
    jobTitle: 'Finance Manager',
    scores: { taskCompletion: 98, attendance: 99, leavePlanning: 98, overall: 98 },
    attendanceBreakdown: { onTime: 23, late: 0, absent: 0, total: 23 },
    taskBreakdown: { completed: 21, onTime: 21, late: 0, pending: 1 },
    trend: 'up',
    trendValue: 2,
    lastActive: '30 mins ago',
    riskFlag: null,
  },
  {
    id: '2',
    name: 'Sarah Putri',
    department: 'Engineering',
    jobTitle: 'Product Manager',
    scores: { taskCompletion: 97, attendance: 98, leavePlanning: 95, overall: 97 },
    attendanceBreakdown: { onTime: 22, late: 1, absent: 0, total: 23 },
    taskBreakdown: { completed: 24, onTime: 23, late: 1, pending: 2 },
    trend: 'up',
    trendValue: 5,
    lastActive: '1 hour ago',
    riskFlag: null,
  },
  {
    id: '3',
    name: 'Ahmad Rizki',
    department: 'Engineering',
    jobTitle: 'Senior Developer',
    scores: { taskCompletion: 92, attendance: 96, leavePlanning: 92, overall: 94 },
    attendanceBreakdown: { onTime: 21, late: 2, absent: 0, total: 23 },
    taskBreakdown: { completed: 18, onTime: 16, late: 2, pending: 3 },
    trend: 'up',
    trendValue: 3,
    lastActive: '2 hours ago',
    riskFlag: null,
  },
  {
    id: '4',
    name: 'Dina Permata',
    department: 'HR',
    jobTitle: 'HR Manager',
    scores: { taskCompletion: 94, attendance: 95, leavePlanning: 94, overall: 94 },
    attendanceBreakdown: { onTime: 21, late: 2, absent: 0, total: 23 },
    taskBreakdown: { completed: 17, onTime: 16, late: 1, pending: 3 },
    trend: 'stable',
    trendValue: 1,
    lastActive: '2 hours ago',
    riskFlag: null,
  },
  {
    id: '5',
    name: 'Budi Santoso',
    department: 'Operations',
    jobTitle: 'Operations Manager',
    scores: { taskCompletion: 89, attendance: 94, leavePlanning: 88, overall: 91 },
    attendanceBreakdown: { onTime: 20, late: 3, absent: 0, total: 23 },
    taskBreakdown: { completed: 15, onTime: 13, late: 2, pending: 4 },
    trend: 'stable',
    trendValue: 0,
    lastActive: '3 hours ago',
    riskFlag: null,
  },
  {
    id: '6',
    name: 'Rina Wijaya',
    department: 'Engineering',
    jobTitle: 'Junior Developer',
    scores: { taskCompletion: 88, attendance: 91, leavePlanning: 85, overall: 89 },
    attendanceBreakdown: { onTime: 19, late: 4, absent: 0, total: 23 },
    taskBreakdown: { completed: 14, onTime: 12, late: 2, pending: 5 },
    trend: 'up',
    trendValue: 4,
    lastActive: '1 hour ago',
    riskFlag: null,
  },
  {
    id: '7',
    name: 'Maya Dewi',
    department: 'Marketing',
    jobTitle: 'Marketing Specialist',
    scores: { taskCompletion: 85, attendance: 89, leavePlanning: 82, overall: 86 },
    attendanceBreakdown: { onTime: 18, late: 4, absent: 1, total: 23 },
    taskBreakdown: { completed: 12, onTime: 9, late: 3, pending: 6 },
    trend: 'down',
    trendValue: -2,
    lastActive: '5 hours ago',
    riskFlag: 'medium',
  },
  {
    id: '8',
    name: 'Farhan Rahman',
    department: 'Operations',
    jobTitle: 'Operations Specialist',
    scores: { taskCompletion: 81, attendance: 87, leavePlanning: 79, overall: 83 },
    attendanceBreakdown: { onTime: 17, late: 5, absent: 1, total: 23 },
    taskBreakdown: { completed: 10, onTime: 7, late: 3, pending: 8 },
    trend: 'down',
    trendValue: -3,
    lastActive: '1 day ago',
    riskFlag: 'high',
  },
]

// ── Helper Functions ────────────────────────────────────────────

function getScoreColor(score: number): string {
  if (score >= 90) return '#34D399'
  if (score >= 75) return '#F59E0B'
  return '#EF4444'
}

function getScoreBadge(score: number): string {
  if (score >= 90) return 'Excellent'
  if (score >= 75) return 'Good'
  if (score >= 60) return 'Fair'
  return 'Needs Improvement'
}

function getTrendIcon(trend: 'up' | 'down' | 'stable') {
  if (trend === 'up') return TrendingUp
  if (trend === 'down') return TrendingDown
  return Minus
}

function getTrendColor(trend: 'up' | 'down' | 'stable'): string {
  if (trend === 'up') return '#34D399'
  if (trend === 'down') return '#EF4444'
  return '#64748B'
}

// ── Components ──────────────────────────────────────────────────

function EnhancedScoreCard({ card }: { card: ScoreCard }) {
  const Icon = card.icon
  const changeColor = card.change > 0 ? '#34D399' : card.change < 0 ? '#EF4444' : '#64748B'

  return (
    <div
      className="rounded-2xl p-5 shadow-sm"
      style={{ backgroundColor: theme.surface, border: `1px solid ${theme.border}` }}
    >
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="rounded-xl p-2.5" style={{ backgroundColor: `${card.color}20` }}>
            <Icon size={20} style={{ color: card.color }} />
          </div>
          <div>
            <div className="font-semibold text-sm" style={{ color: theme.text }}>
              {card.title}
            </div>
            <div className="flex items-center gap-2 mt-1">
              <span className="text-3xl font-bold" style={{ color: card.color }}>
                {card.score}
              </span>
              <div className="flex items-center gap-1">
                {card.change > 0 ? (
                  <TrendingUp size={14} style={{ color: changeColor }} />
                ) : card.change < 0 ? (
                  <TrendingDown size={14} style={{ color: changeColor }} />
                ) : null}
                <span className="text-xs font-semibold" style={{ color: changeColor }}>
                  {card.change > 0 ? '+' : ''}
                  {card.change}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="text-xs mb-3" style={{ color: theme.textMuted }}>
        {card.description}
      </div>

      {card.breakdown && (
        <div className="space-y-2">
          {card.breakdown.map((item) => (
            <div key={item.label}>
              <div className="flex items-center justify-between text-xs mb-1">
                <span style={{ color: theme.textMuted }}>{item.label}</span>
                <span className="font-semibold" style={{ color: item.color }}>
                  {item.value}%
                </span>
              </div>
              <div className="h-1.5 rounded-full" style={{ backgroundColor: theme.border }}>
                <div
                  className="h-full rounded-full transition-all"
                  style={{ width: `${item.value}%`, backgroundColor: item.color }}
                />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function InsightCard({ insight }: { insight: InsightItem }) {
  const Icon = insight.type === 'warning' ? AlertTriangle : insight.type === 'success' ? CheckCircle2 : Info
  const color = insight.type === 'warning' ? '#F59E0B' : insight.type === 'success' ? '#34D399' : '#60A5FA'

  return (
    <div
      className="rounded-xl p-4"
      style={{ backgroundColor: theme.surface, border: `1px solid ${theme.border}` }}
    >
      <div className="flex items-start gap-3">
        <div className="rounded-lg p-2" style={{ backgroundColor: `${color}15` }}>
          <Icon size={18} style={{ color }} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="font-semibold text-sm mb-1" style={{ color: theme.text }}>
            {insight.title}
          </div>
          <div className="text-xs mb-2" style={{ color: theme.textMuted }}>
            {insight.description}
          </div>
          {insight.action && (
            <button
              className="text-xs font-medium px-3 py-1.5 rounded-lg"
              style={{
                backgroundColor: `${color}20`,
                color,
              }}
            >
              {insight.action}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

function PerformanceAnalytics() {
  const latestMonth = PERFORMANCE_TRENDS[PERFORMANCE_TRENDS.length - 1]
  const previousMonth = PERFORMANCE_TRENDS[PERFORMANCE_TRENDS.length - 2]
  const sixMonthsAgo = PERFORMANCE_TRENDS[0]
  const overallChange = latestMonth.overall - sixMonthsAgo.overall

  // Determine what drove the change
  const taskChange = latestMonth.tasks - previousMonth.tasks
  const attendanceChange = latestMonth.attendance - previousMonth.attendance
  const leaveChange = latestMonth.leave - previousMonth.leave

  const biggestDriver =
    Math.abs(taskChange) > Math.abs(attendanceChange) && Math.abs(taskChange) > Math.abs(leaveChange)
      ? 'tasks'
      : Math.abs(attendanceChange) > Math.abs(leaveChange)
        ? 'attendance'
        : 'leave'

  const driverLabel =
    biggestDriver === 'tasks'
      ? 'Task Completion'
      : biggestDriver === 'attendance'
        ? 'Attendance'
        : 'Leave Planning'
  const driverChange =
    biggestDriver === 'tasks' ? taskChange : biggestDriver === 'attendance' ? attendanceChange : leaveChange

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
      {/* Main Trend Chart */}
      <div
        className="lg:col-span-2 rounded-xl p-5"
        style={{ backgroundColor: theme.surface, border: `1px solid ${theme.border}` }}
      >
        <div className="flex items-start justify-between mb-6">
          <div>
            <div className="font-semibold mb-1 text-base" style={{ color: theme.text }}>
              6-Month Performance Breakdown
            </div>
            <div className="text-xs" style={{ color: theme.textMuted }}>
              Track which metrics are improving or declining
            </div>
          </div>
          <div className="text-right">
            <div className="flex items-center gap-1.5">
              {overallChange > 0 ? (
                <TrendingUp size={16} style={{ color: '#34D399' }} />
              ) : overallChange < 0 ? (
                <TrendingDown size={16} style={{ color: '#EF4444' }} />
              ) : (
                <Minus size={16} style={{ color: '#64748B' }} />
              )}
              <span
                className="text-sm font-semibold"
                style={{ color: overallChange > 0 ? '#34D399' : overallChange < 0 ? '#EF4444' : '#64748B' }}
              >
                {overallChange > 0 ? '+' : ''}
                {overallChange} pts
              </span>
            </div>
            <div className="text-xs mt-0.5" style={{ color: theme.textMuted }}>
              since Nov
            </div>
          </div>
        </div>

        {/* Line Chart */}
        <div className="mb-6">
          <div className="relative h-40">
            {/* Grid lines */}
            <div className="absolute inset-0 flex flex-col justify-between">
              {[100, 90, 80, 70].map((value) => (
                <div
                  key={value}
                  className="border-t"
                  style={{ borderColor: theme.border, opacity: 0.3 }}
                >
                  <span className="text-xs -mt-2 inline-block" style={{ color: theme.textMuted }}>
                    {value}
                  </span>
                </div>
              ))}
            </div>

            {/* Lines for each metric */}
            <svg className="absolute inset-0 w-full h-full" style={{ overflow: 'visible' }}>
              {/* Overall line */}
              <polyline
                points={PERFORMANCE_TRENDS.map(
                  (d, i) => `${(i / (PERFORMANCE_TRENDS.length - 1)) * 90 + 5}%,${100 - (d.overall - 70) * 3}%`
                ).join(' ')}
                fill="none"
                stroke="#818CF8"
                strokeWidth="3"
                strokeLinecap="round"
              />
              {/* Tasks line */}
              <polyline
                points={PERFORMANCE_TRENDS.map(
                  (d, i) => `${(i / (PERFORMANCE_TRENDS.length - 1)) * 90 + 5}%,${100 - (d.tasks - 70) * 3}%`
                ).join(' ')}
                fill="none"
                stroke="#34D399"
                strokeWidth="2"
                strokeDasharray="4 2"
                opacity="0.6"
              />
              {/* Attendance line */}
              <polyline
                points={PERFORMANCE_TRENDS.map(
                  (d, i) => `${(i / (PERFORMANCE_TRENDS.length - 1)) * 90 + 5}%,${100 - (d.attendance - 70) * 3}%`
                ).join(' ')}
                fill="none"
                stroke="#F59E0B"
                strokeWidth="2"
                strokeDasharray="4 2"
                opacity="0.6"
              />
            </svg>
          </div>

          {/* X-axis labels */}
          <div className="flex justify-between mt-2">
            {PERFORMANCE_TRENDS.map((trend) => (
              <div key={trend.month} className="text-xs" style={{ color: theme.textMuted }}>
                {trend.month}
              </div>
            ))}
          </div>
        </div>

        {/* Legend */}
        <div className="flex items-center gap-6 pb-3" style={{ borderBottom: `1px solid ${theme.border}` }}>
          <div className="flex items-center gap-2">
            <div className="w-8 h-0.5 rounded" style={{ backgroundColor: '#818CF8' }} />
            <span className="text-xs" style={{ color: theme.textMuted }}>
              Overall
            </span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-8 h-0.5 rounded" style={{ backgroundColor: '#34D399', opacity: 0.6 }} />
            <span className="text-xs" style={{ color: theme.textMuted }}>
              Tasks
            </span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-8 h-0.5 rounded" style={{ backgroundColor: '#F59E0B', opacity: 0.6 }} />
            <span className="text-xs" style={{ color: theme.textMuted }}>
              Attendance
            </span>
          </div>
        </div>

        {/* Key Insight */}
        <div className="mt-4 p-3 rounded-lg" style={{ backgroundColor: `rgba(129,140,248,0.1)` }}>
          <div className="flex items-start gap-2">
            <Info size={16} style={{ color: '#818CF8', marginTop: '2px' }} />
            <div className="flex-1">
              <div className="text-xs font-semibold mb-1" style={{ color: theme.text }}>
                What changed this month
              </div>
              <div className="text-xs" style={{ color: theme.textMuted }}>
                {driverLabel} {driverChange > 0 ? 'improved' : 'declined'} by {Math.abs(driverChange)} points —{' '}
                {driverChange > 0
                  ? 'driven by better task delivery and more on-time completions'
                  : 'due to increased late tasks and missed deadlines'}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Department Comparison */}
      <div
        className="rounded-xl p-5"
        style={{ backgroundColor: theme.surface, border: `1px solid ${theme.border}` }}
      >
        <div className="mb-4">
          <div className="font-semibold mb-1" style={{ color: theme.text }}>
            Department Changes
          </div>
          <div className="text-xs" style={{ color: theme.textMuted }}>
            vs last month
          </div>
        </div>

        <div className="space-y-3">
          {DEPARTMENT_TRENDS.sort((a, b) => b.change - a.change).map((dept) => (
            <div key={dept.department}>
              <div className="flex items-center justify-between mb-1.5">
                <div className="flex items-center gap-2">
                  <div
                    className="w-2 h-2 rounded-full"
                    style={{ backgroundColor: dept.color }}
                  />
                  <span className="text-xs font-medium" style={{ color: theme.text }}>
                    {dept.department}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-semibold" style={{ color: dept.color }}>
                    {dept.current}
                  </span>
                  {dept.change !== 0 && (
                    <div className="flex items-center gap-0.5">
                      {dept.change > 0 ? (
                        <TrendingUp size={10} style={{ color: '#34D399' }} />
                      ) : (
                        <TrendingDown size={10} style={{ color: '#EF4444' }} />
                      )}
                      <span
                        className="text-xs font-semibold"
                        style={{ color: dept.change > 0 ? '#34D399' : '#EF4444' }}
                      >
                        {Math.abs(dept.change)}
                      </span>
                    </div>
                  )}
                </div>
              </div>
              <div className="h-1.5 rounded-full" style={{ backgroundColor: theme.border }}>
                <div
                  className="h-full rounded-full transition-all"
                  style={{ width: `${dept.current}%`, backgroundColor: dept.color }}
                />
              </div>
            </div>
          ))}
        </div>

        <div className="mt-5 pt-4" style={{ borderTop: `1px solid ${theme.border}` }}>
          <div className="text-xs font-semibold mb-2" style={{ color: theme.text }}>
            Action Items
          </div>
          <div className="space-y-2">
            {DEPARTMENT_TRENDS.filter((d) => d.change < 0).map((dept) => (
              <div
                key={dept.department}
                className="text-xs p-2 rounded"
                style={{ backgroundColor: 'rgba(239,68,68,0.1)', color: '#FCA5A5' }}
              >
                Review {dept.department} team 1-on-1s
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

function EmployeeRow({ employee }: { employee: EmployeeScore }) {
  const TrendIcon = getTrendIcon(employee.trend)
  const trendColor = getTrendColor(employee.trend)
  const overallColor = getScoreColor(employee.scores.overall)
  const onTimeRate = Math.round((employee.attendanceBreakdown.onTime / employee.attendanceBreakdown.total) * 100)
  const taskOnTimeRate = Math.round((employee.taskBreakdown.onTime / employee.taskBreakdown.completed) * 100)

  return (
    <div
      className="rounded-xl p-4 mb-3 hover:shadow-lg transition-all cursor-pointer relative"
      style={{
        backgroundColor: theme.surface,
        border: `1px solid ${employee.riskFlag ? '#F59E0B' : theme.border}`,
      }}
    >
      {employee.riskFlag && (
        <div className="absolute top-2 right-2">
          <div
            className="px-2 py-0.5 rounded-full flex items-center gap-1"
            style={{
              backgroundColor: employee.riskFlag === 'high' ? '#FEE2E2' : '#FEF3C7',
            }}
          >
            <AlertTriangle size={10} style={{ color: employee.riskFlag === 'high' ? '#EF4444' : '#F59E0B' }} />
            <span
              className="text-xs font-semibold uppercase"
              style={{ color: employee.riskFlag === 'high' ? '#DC2626' : '#D97706', fontSize: '10px' }}
            >
              {employee.riskFlag} Risk
            </span>
          </div>
        </div>
      )}

      <div className="flex items-center justify-between">
        {/* Left: Employee Info */}
        <div className="flex items-center gap-3 flex-1 min-w-0">
          <div
            className="w-12 h-12 rounded-full flex items-center justify-center flex-shrink-0"
            style={{
              backgroundColor: `${overallColor}20`,
              color: overallColor,
              fontWeight: 700,
              fontSize: '16px',
            }}
          >
            {employee.name.charAt(0)}
          </div>
          <div className="flex-1 min-w-0">
            <div className="font-semibold text-base mb-0.5" style={{ color: theme.text }}>
              {employee.name}
            </div>
            <div className="text-xs" style={{ color: theme.textMuted }}>
              {employee.jobTitle} · {employee.department}
            </div>
            <div className="flex items-center gap-3 mt-1.5 text-xs" style={{ color: theme.textMuted }}>
              <span>
                <Activity size={12} className="inline mr-1" />
                {employee.lastActive}
              </span>
              <span>
                {employee.taskBreakdown.completed} tasks • {taskOnTimeRate}% on time
              </span>
              <span>
                {employee.attendanceBreakdown.onTime}/{employee.attendanceBreakdown.total} on-time
              </span>
            </div>
          </div>
        </div>

        {/* Right: Score */}
        <div className="flex items-center gap-4">
          <div className="text-center">
            <div className="text-3xl font-bold" style={{ color: overallColor }}>
              {employee.scores.overall}
            </div>
            <div className="text-xs mt-0.5" style={{ color: theme.textMuted }}>
              {getScoreBadge(employee.scores.overall)}
            </div>
            <div className="flex items-center justify-center gap-1 mt-1">
              <TrendIcon size={12} style={{ color: trendColor }} />
              {employee.trendValue !== 0 && (
                <span className="text-xs font-semibold" style={{ color: trendColor }}>
                  {Math.abs(employee.trendValue)}
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Expanded details */}
      <div className="mt-3 pt-3 grid grid-cols-3 gap-4" style={{ borderTop: `1px solid ${theme.border}` }}>
        <div>
          <div className="text-xs mb-1" style={{ color: theme.textMuted }}>
            Task Completion
          </div>
          <div className="font-semibold" style={{ color: getScoreColor(employee.scores.taskCompletion) }}>
            {employee.scores.taskCompletion}/100
          </div>
        </div>
        <div>
          <div className="text-xs mb-1" style={{ color: theme.textMuted }}>
            Attendance
          </div>
          <div className="font-semibold" style={{ color: getScoreColor(employee.scores.attendance) }}>
            {employee.scores.attendance}/100
          </div>
          <div className="text-xs mt-0.5" style={{ color: theme.textMuted }}>
            {employee.attendanceBreakdown.late} late, {employee.attendanceBreakdown.absent} absent
          </div>
        </div>
        <div>
          <div className="text-xs mb-1" style={{ color: theme.textMuted }}>
            Leave Planning
          </div>
          <div className="font-semibold" style={{ color: getScoreColor(employee.scores.leavePlanning) }}>
            {employee.scores.leavePlanning}/100
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Main Component ──────────────────────────────────────────────

function PerformanceDashboard() {
  const topPerformers = [...EMPLOYEE_SCORES].sort((a, b) => b.scores.overall - a.scores.overall).slice(0, 3)
  const atRisk = EMPLOYEE_SCORES.filter((e) => e.riskFlag)

  return (
    <div
      className="min-h-screen px-6 py-8 md:px-11 md:py-10"
      style={{ background: moduleBackgrounds.reports, paddingBottom: '160px' }}
    >
      {/* Header */}
      <div className="flex justify-between items-start mb-8">
        <div>
          <h1 className="text-3xl font-bold mb-2" style={{ color: theme.text }}>
            Performance Dashboard
          </h1>
          <p className="text-sm" style={{ color: theme.textMuted }}>
            Real-time insights into task delivery, attendance, and team performance
          </p>
        </div>
        <div className="flex items-center gap-4">
          <DateTime className="hidden md:block" />
          <NotificationBell />
        </div>
      </div>

      {/* Insights */}
      {INSIGHTS.length > 0 && (
        <section className="mb-8">
          <h2 className="text-lg font-semibold mb-4" style={{ color: theme.text }}>
            Key Insights
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {INSIGHTS.map((insight, idx) => (
              <InsightCard key={idx} insight={insight} />
            ))}
          </div>
        </section>
      )}

      {/* Score Cards */}
      <section className="mb-8">
        <h2 className="text-lg font-semibold mb-4" style={{ color: theme.text }}>
          Organization Overview
        </h2>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {SCORE_CARDS.map((card) => (
            <EnhancedScoreCard key={card.title} card={card} />
          ))}
        </div>
      </section>

      {/* Performance Analytics */}
      <section className="mb-8">
        <h2 className="text-lg font-semibold mb-4" style={{ color: theme.text }}>
          Performance Analysis
        </h2>
        <PerformanceAnalytics />
      </section>

      {/* At Risk Employees */}
      {atRisk.length > 0 && (
        <section className="mb-8">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <AlertTriangle size={20} style={{ color: '#F59E0B' }} />
              <h2 className="text-lg font-semibold" style={{ color: theme.text }}>
                Needs Attention
              </h2>
              <span
                className="text-xs px-2 py-1 rounded-full"
                style={{ backgroundColor: 'rgba(245,158,11,0.15)', color: '#FCD34D' }}
              >
                {atRisk.length} employees
              </span>
            </div>
          </div>
          {atRisk.map((employee) => (
            <EmployeeRow key={employee.id} employee={employee} />
          ))}
        </section>
      )}

      {/* Top Performers */}
      <section className="mb-8">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Award size={20} style={{ color: '#34D399' }} />
            <h2 className="text-lg font-semibold" style={{ color: theme.text }}>
              Top Performers
            </h2>
          </div>
          <button
            className="text-sm flex items-center gap-1 hover:underline"
            style={{ color: colors.accent }}
          >
            View All
            <ChevronRight size={16} />
          </button>
        </div>
        {topPerformers.map((employee) => (
          <EmployeeRow key={employee.id} employee={employee} />
        ))}
      </section>

      {/* Info */}
      <div
        className="rounded-xl p-5"
        style={{ backgroundColor: theme.surface, border: `1px solid ${theme.border}` }}
      >
        <div className="flex items-start gap-3">
          <div className="rounded-lg p-2" style={{ backgroundColor: 'rgba(99,87,232,0.15)' }}>
            <Users size={20} style={{ color: colors.accent }} />
          </div>
          <div className="flex-1">
            <h3 className="font-semibold mb-1 text-sm" style={{ color: theme.text }}>
              How Scores Are Calculated
            </h3>
            <p className="text-xs mb-2" style={{ color: theme.textMuted }}>
              Overall Performance Score is weighted as follows:
            </p>
            <ul className="text-xs space-y-1" style={{ color: theme.textMuted }}>
              <li>
                • <strong style={{ color: theme.text }}>Task Completion (45%):</strong> Completed on time, quality, no
                rework
              </li>
              <li>
                • <strong style={{ color: theme.text }}>Attendance (30%):</strong> On-time check-ins, consistency, low
                absences
              </li>
              <li>
                • <strong style={{ color: theme.text }}>Leave Planning (15%):</strong> Advance notice, policy
                compliance
              </li>
              <li>
                • <strong style={{ color: theme.text }}>Collaboration (10%):</strong> Helping teammates, engagement
              </li>
            </ul>
            <p className="text-xs mt-3" style={{ color: theme.textMuted }}>
              Scores update daily based on rolling 30-day averages.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
