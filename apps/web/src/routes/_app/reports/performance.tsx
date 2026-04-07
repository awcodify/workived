import { createFileRoute } from '@tanstack/react-router'
import { DateTime } from '@/components/workived/shared/DateTime'
import { NotificationBell } from '@/components/workived/shared/NotificationBell'
import { moduleBackgrounds, moduleThemes, typography, colors } from '@/design/tokens'
import {
  TrendingUp,
  TrendingDown,
  Minus,
  AlertTriangle,
  CheckCircle2,
  Clock,
  CalendarOff,
  ArrowRight,
  Sparkles,
  Shield,
  UserCheck,
  UserX,
  Timer,
} from 'lucide-react'

const theme = moduleThemes.reports
const glass = {
  card: {
    background: 'rgba(255,255,255,0.03)',
    border: '1px solid rgba(255,255,255,0.06)',
    borderRadius: '18px',
    padding: '20px',
  } as React.CSSProperties,
}

export const Route = createFileRoute('/_app/reports/performance')({
  component: PerformanceBriefing,
})

// ── Types ───────────────────────────────────────────────────────

interface EmployeeStory {
  name: string
  role: string
  department: string
  avatar: string
  story: string
  metricValue: string
  sentiment: 'positive' | 'negative'
  action?: string
}

interface TeamHealth {
  department: string
  headcount: number
  presentToday: number
  lateToday: number
  absentToday: number
  tasksCompleted: number
  tasksDue: number
  overdueTasks: number
  avgScore: number
  scoreChange: number
}

interface WeeklyStat {
  label: string
  thisWeek: number
  lastWeek: number
  unit: string
  goodDirection: 'up' | 'down'
}

// ── Dummy Data ──────────────────────────────────────────────────

const DAILY_BRIEFING = {
  date: 'Monday, April 7, 2026',
  headline: '6 of 8 employees checked in on time. 2 are late.',
  summary: [
    { icon: UserCheck, label: 'On time', value: '6', color: '#34D399' },
    { icon: Timer, label: 'Late', value: '2', color: '#F59E0B' },
    { icon: UserX, label: 'Absent', value: '0', color: '#EF4444' },
    { icon: CalendarOff, label: 'On leave', value: '0', color: '#818CF8' },
  ],
}

const ACTIONS_NEEDED: EmployeeStory[] = [
  {
    name: 'Farhan Rahman',
    role: 'Operations Specialist',
    department: 'Operations',
    avatar: 'F',
    story:
      'Late 5 times this month (most in the team). Has 8 overdue tasks — up from 3 last month. Score dropped 3 points in 2 weeks.',
    metricValue: '83 → 80',
    sentiment: 'negative',
    action: 'Schedule a 1-on-1 to discuss workload and punctuality',
  },
  {
    name: 'Maya Dewi',
    role: 'Marketing Specialist',
    department: 'Marketing',
    avatar: 'M',
    story:
      '3 tasks delivered late this week (was delivering 91% on time last month, now 75%). Submitted 2 leave requests with less than 24h notice.',
    metricValue: '91% → 75% on-time',
    sentiment: 'negative',
    action: 'Check if workload needs redistribution',
  },
]

const WORTH_CELEBRATING: EmployeeStory[] = [
  {
    name: 'Adi Nugroho',
    role: 'Finance Manager',
    department: 'Finance',
    avatar: 'A',
    story:
      'Perfect attendance — 23 consecutive days on time, zero late. Completed all 21 assigned tasks before deadline. Zero overdue items.',
    metricValue: 'Score: 98',
    sentiment: 'positive',
    action: 'Consider for employee of the month',
  },
  {
    name: 'Rina Wijaya',
    role: 'Junior Developer',
    department: 'Engineering',
    avatar: 'R',
    story:
      'Biggest improvement this month: +4 points. Reduced overdue tasks from 5 last month to 0 this month. Late check-ins dropped from 6 to 2.',
    metricValue: '+4 pts improvement',
    sentiment: 'positive',
    action: 'Acknowledge growth in team standup',
  },
]

const TEAM_HEALTH: TeamHealth[] = [
  {
    department: 'Finance',
    headcount: 3,
    presentToday: 3,
    lateToday: 0,
    absentToday: 0,
    tasksCompleted: 21,
    tasksDue: 22,
    overdueTasks: 0,
    avgScore: 98,
    scoreChange: +1,
  },
  {
    department: 'Engineering',
    headcount: 3,
    presentToday: 3,
    lateToday: 0,
    absentToday: 0,
    tasksCompleted: 56,
    tasksDue: 60,
    overdueTasks: 2,
    avgScore: 93,
    scoreChange: +4,
  },
  {
    department: 'HR',
    headcount: 1,
    presentToday: 1,
    lateToday: 0,
    absentToday: 0,
    tasksCompleted: 17,
    tasksDue: 20,
    overdueTasks: 1,
    avgScore: 94,
    scoreChange: 0,
  },
  {
    department: 'Operations',
    headcount: 2,
    presentToday: 1,
    lateToday: 1,
    absentToday: 0,
    tasksCompleted: 25,
    tasksDue: 31,
    overdueTasks: 6,
    avgScore: 87,
    scoreChange: -3,
  },
  {
    department: 'Marketing',
    headcount: 1,
    presentToday: 0,
    lateToday: 1,
    absentToday: 0,
    tasksCompleted: 12,
    tasksDue: 18,
    overdueTasks: 4,
    avgScore: 86,
    scoreChange: -3,
  },
]

const WEEKLY_COMPARISON: WeeklyStat[] = [
  { label: 'Tasks completed', thisWeek: 34, lastWeek: 29, unit: 'tasks', goodDirection: 'up' },
  { label: 'On-time delivery', thisWeek: 82, lastWeek: 88, unit: '%', goodDirection: 'up' },
  { label: 'Late check-ins', thisWeek: 7, lastWeek: 4, unit: 'days', goodDirection: 'down' },
  { label: 'Overdue tasks', thisWeek: 13, lastWeek: 9, unit: 'tasks', goodDirection: 'down' },
  { label: 'Leave days used', thisWeek: 3, lastWeek: 5, unit: 'days', goodDirection: 'down' },
  { label: 'Avg leave notice', thisWeek: 4.2, lastWeek: 3.8, unit: 'days', goodDirection: 'up' },
]

const PREDICTIONS = [
  {
    icon: AlertTriangle,
    color: '#F59E0B',
    title: 'Operations team may miss their sprint deadline',
    description:
      '6 overdue tasks and slowing velocity. At current pace, 4 tasks won't be done by Friday.',
    recommendation: 'Reassign 2 tasks to Engineering — they have bandwidth this week.',
  },
  {
    icon: TrendingDown,
    color: '#EF4444',
    title: 'Farhan's score will drop below 80 within 2 weeks',
    description:
      'His attendance and task patterns are trending down consistently. Below 80 = "Needs Improvement" territory.',
    recommendation: 'A 1-on-1 conversation this week can reverse this trend before it gets worse.',
  },
  {
    icon: CheckCircle2,
    color: '#34D399',
    title: 'Engineering is on track for their best month ever',
    description:
      'At current pace, the team will hit 95+ average score — highest since we started tracking.',
    recommendation: 'Maintain current workload. Don't pile on extra tasks and risk burnout.',
  },
]

// ── Components ──────────────────────────────────────────────────

function SectionTitle({ children, subtitle }: { children: React.ReactNode; subtitle?: string }) {
  return (
    <div className="mb-5">
      <h2 className="text-lg font-bold" style={{ color: '#F0F0FF', letterSpacing: '-0.02em' }}>
        {children}
      </h2>
      {subtitle && (
        <p className="text-xs mt-1" style={{ color: theme.textMuted }}>
          {subtitle}
        </p>
      )}
    </div>
  )
}

function PersonCard({ story }: { story: EmployeeStory }) {
  const accent = story.sentiment === 'negative' ? '#EF4444' : '#34D399'

  return (
    <div
      className="rounded-2xl p-5"
      style={{
        background: 'rgba(255,255,255,0.03)',
        border: `1px solid ${accent}30`,
      }}
    >
      <div className="flex items-start gap-4">
        <div
          className="w-11 h-11 rounded-full flex items-center justify-center flex-shrink-0 text-sm font-bold"
          style={{ backgroundColor: `${accent}20`, color: accent }}
        >
          {story.avatar}
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-1">
            <span className="font-semibold text-sm" style={{ color: '#F0F0FF' }}>
              {story.name}
            </span>
            <span
              className="text-xs px-2 py-0.5 rounded-full font-medium"
              style={{ backgroundColor: `${accent}15`, color: accent }}
            >
              {story.metricValue}
            </span>
          </div>
          <div className="text-xs mb-3" style={{ color: theme.textMuted }}>
            {story.role} · {story.department}
          </div>
          <p className="text-sm leading-relaxed mb-3" style={{ color: 'rgba(255,255,255,0.75)' }}>
            {story.story}
          </p>
          {story.action && (
            <div className="flex items-start gap-2 p-3 rounded-xl" style={{ backgroundColor: `${accent}10` }}>
              <ArrowRight size={14} style={{ color: accent, marginTop: 2, flexShrink: 0 }} />
              <span className="text-xs font-medium" style={{ color: accent }}>
                {story.action}
              </span>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function TeamCard({ team }: { team: TeamHealth }) {
  const taskPct = Math.round((team.tasksCompleted / team.tasksDue) * 100)
  const changeColor = team.scoreChange > 0 ? '#34D399' : team.scoreChange < 0 ? '#EF4444' : '#64748B'
  const scoreColor = team.avgScore >= 90 ? '#34D399' : team.avgScore >= 80 ? '#F59E0B' : '#EF4444'
  const hasIssue = team.overdueTasks > 3 || team.lateToday > 0

  return (
    <div
      className="rounded-xl p-4"
      style={{
        background: 'rgba(255,255,255,0.03)',
        border: `1px solid ${hasIssue ? 'rgba(245,158,11,0.25)' : 'rgba(255,255,255,0.06)'}`,
      }}
    >
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-3">
          <div className="w-2 h-8 rounded-full" style={{ backgroundColor: scoreColor }} />
          <div>
            <div className="font-semibold text-sm" style={{ color: '#F0F0FF' }}>
              {team.department}
            </div>
            <div className="text-xs" style={{ color: theme.textMuted }}>
              {team.headcount} {team.headcount === 1 ? 'person' : 'people'}
            </div>
          </div>
        </div>
        <div className="text-right">
          <div className="text-xl font-bold" style={{ color: scoreColor }}>
            {team.avgScore}
          </div>
          <div className="flex items-center gap-1 justify-end">
            {team.scoreChange > 0 ? (
              <TrendingUp size={10} style={{ color: changeColor }} />
            ) : team.scoreChange < 0 ? (
              <TrendingDown size={10} style={{ color: changeColor }} />
            ) : (
              <Minus size={10} style={{ color: changeColor }} />
            )}
            <span className="text-xs font-semibold" style={{ color: changeColor }}>
              {team.scoreChange > 0 ? '+' : ''}
              {team.scoreChange}
            </span>
          </div>
        </div>
      </div>

      {/* Quick stats */}
      <div className="grid grid-cols-3 gap-3 text-center">
        <div>
          <div className="text-xs mb-1" style={{ color: theme.textMuted }}>
            Today
          </div>
          <div className="flex items-center justify-center gap-1">
            {team.lateToday > 0 ? (
              <Clock size={12} style={{ color: '#F59E0B' }} />
            ) : (
              <CheckCircle2 size={12} style={{ color: '#34D399' }} />
            )}
            <span className="text-xs font-semibold" style={{ color: '#F0F0FF' }}>
              {team.presentToday}/{team.headcount}
              {team.lateToday > 0 && <span style={{ color: '#F59E0B' }}> ({team.lateToday} late)</span>}
            </span>
          </div>
        </div>
        <div>
          <div className="text-xs mb-1" style={{ color: theme.textMuted }}>
            Tasks
          </div>
          <div className="text-xs font-semibold" style={{ color: '#F0F0FF' }}>
            {team.tasksCompleted}/{team.tasksDue}
            <span style={{ color: theme.textMuted }}> ({taskPct}%)</span>
          </div>
        </div>
        <div>
          <div className="text-xs mb-1" style={{ color: theme.textMuted }}>
            Overdue
          </div>
          <div
            className="text-xs font-bold"
            style={{ color: team.overdueTasks > 0 ? '#EF4444' : '#34D399' }}
          >
            {team.overdueTasks === 0 ? '✓ None' : `${team.overdueTasks} tasks`}
          </div>
        </div>
      </div>

      {/* Progress */}
      <div className="mt-3 h-1.5 rounded-full" style={{ backgroundColor: 'rgba(255,255,255,0.06)' }}>
        <div
          className="h-full rounded-full"
          style={{
            width: `${taskPct}%`,
            backgroundColor: taskPct >= 90 ? '#34D399' : taskPct >= 70 ? '#F59E0B' : '#EF4444',
          }}
        />
      </div>
    </div>
  )
}

function WeekComparison() {
  return (
    <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
      {WEEKLY_COMPARISON.map((stat) => {
        const diff = +(stat.thisWeek - stat.lastWeek).toFixed(1)
        const isGood =
          (stat.goodDirection === 'up' && diff > 0) || (stat.goodDirection === 'down' && diff < 0)
        const isBad =
          (stat.goodDirection === 'up' && diff < 0) || (stat.goodDirection === 'down' && diff > 0)
        const color = isGood ? '#34D399' : isBad ? '#EF4444' : '#64748B'

        return (
          <div
            key={stat.label}
            className="rounded-xl p-4"
            style={{
              background: 'rgba(255,255,255,0.03)',
              border: `1px solid ${isBad ? 'rgba(239,68,68,0.2)' : 'rgba(255,255,255,0.06)'}`,
            }}
          >
            <div className="text-xs mb-2" style={{ color: theme.textMuted }}>
              {stat.label}
            </div>
            <div className="flex items-baseline gap-2">
              <span
                className="text-2xl font-bold"
                style={{ color: '#F0F0FF', fontFamily: typography.fontMono }}
              >
                {stat.thisWeek}
              </span>
              <span className="text-xs" style={{ color: theme.textMuted }}>
                {stat.unit}
              </span>
            </div>
            <div className="flex items-center gap-1 mt-1">
              {diff > 0 ? (
                <TrendingUp size={12} style={{ color }} />
              ) : diff < 0 ? (
                <TrendingDown size={12} style={{ color }} />
              ) : (
                <Minus size={12} style={{ color }} />
              )}
              <span className="text-xs font-semibold" style={{ color }}>
                {diff > 0 ? '+' : ''}
                {diff} vs last week
              </span>
            </div>
          </div>
        )
      })}
    </div>
  )
}

function Prediction({ item }: { item: (typeof PREDICTIONS)[0] }) {
  const Icon = item.icon
  return (
    <div
      className="rounded-xl p-4"
      style={{ background: 'rgba(255,255,255,0.03)', border: `1px solid ${item.color}30` }}
    >
      <div className="flex items-start gap-3">
        <div className="rounded-lg p-2 flex-shrink-0" style={{ backgroundColor: `${item.color}15` }}>
          <Icon size={18} style={{ color: item.color }} />
        </div>
        <div className="flex-1">
          <div className="font-semibold text-sm mb-1" style={{ color: '#F0F0FF' }}>
            {item.title}
          </div>
          <p className="text-xs leading-relaxed mb-3" style={{ color: 'rgba(255,255,255,0.6)' }}>
            {item.description}
          </p>
          <div className="flex items-start gap-2 p-2.5 rounded-lg" style={{ backgroundColor: `${item.color}10` }}>
            <Sparkles size={12} style={{ color: item.color, marginTop: 2, flexShrink: 0 }} />
            <span className="text-xs font-medium" style={{ color: item.color }}>
              {item.recommendation}
            </span>
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Main Page ───────────────────────────────────────────────────

function PerformanceBriefing() {
  return (
    <div
      className="min-h-screen px-6 py-8 md:px-11 md:py-10"
      style={{ background: moduleBackgrounds.reports, paddingBottom: '160px' }}
    >
      {/* Header */}
      <div className="flex justify-between items-start mb-2">
        <div>
          <h1
            className="font-extrabold"
            style={{
              fontSize: typography.display.size,
              letterSpacing: typography.display.tracking,
              color: '#F0F0FF',
              lineHeight: typography.display.lineHeight,
            }}
          >
            Daily Briefing
          </h1>
          <p className="mt-2" style={{ fontSize: 14, color: 'rgba(255,255,255,0.4)' }}>
            {DAILY_BRIEFING.date}
          </p>
        </div>
        <div className="flex items-center gap-4">
          <DateTime
            textColor="#F0F0FF"
            textMutedColor="rgba(255,255,255,0.4)"
            borderColor="rgba(255,255,255,0.08)"
          />
          <NotificationBell
            surfaceColor="rgba(255,255,255,0.06)"
            borderColor="rgba(255,255,255,0.08)"
            accentColor={colors.accent}
            textColor="#F0F0FF"
            textMutedColor="rgba(255,255,255,0.4)"
          />
        </div>
      </div>

      {/* Headline — the single most important thing */}
      <p
        className="text-xl md:text-2xl font-semibold leading-snug mt-6 mb-8"
        style={{ color: 'rgba(255,255,255,0.85)', maxWidth: '640px' }}
      >
        {DAILY_BRIEFING.headline}
      </p>

      {/* Today at a glance */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-12">
        {DAILY_BRIEFING.summary.map((item) => {
          const Icon = item.icon
          return (
            <div
              key={item.label}
              className="rounded-xl p-4 text-center"
              style={{
                background: 'rgba(255,255,255,0.03)',
                border: '1px solid rgba(255,255,255,0.06)',
              }}
            >
              <Icon size={20} className="mx-auto mb-2" style={{ color: item.color }} />
              <div
                className="text-2xl font-bold mb-0.5"
                style={{ color: item.color, fontFamily: typography.fontMono }}
              >
                {item.value}
              </div>
              <div className="text-xs" style={{ color: theme.textMuted }}>
                {item.label}
              </div>
            </div>
          )
        })}
      </div>

      {/* ─── Who Needs Attention ─── */}
      <section className="mb-12">
        <SectionTitle subtitle="Employees showing declining patterns — act this week">
          🔴 Who Needs Your Attention
        </SectionTitle>
        <div className="space-y-3">
          {ACTIONS_NEEDED.map((s) => (
            <PersonCard key={s.name} story={s} />
          ))}
        </div>
      </section>

      {/* ─── Worth Celebrating ─── */}
      <section className="mb-12">
        <SectionTitle subtitle="Top performers and biggest improvers this month">
          🟢 Worth Celebrating
        </SectionTitle>
        <div className="space-y-3">
          {WORTH_CELEBRATING.map((s) => (
            <PersonCard key={s.name} story={s} />
          ))}
        </div>
      </section>

      {/* ─── Team Health ─── */}
      <section className="mb-12">
        <SectionTitle subtitle="Attendance, task progress, and overdue items per department">
          Team Health
        </SectionTitle>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {TEAM_HEALTH.sort((a, b) => b.avgScore - a.avgScore).map((t) => (
            <TeamCard key={t.department} team={t} />
          ))}
        </div>
      </section>

      {/* ─── This Week vs Last Week ─── */}
      <section className="mb-12">
        <SectionTitle subtitle="Red borders = getting worse and needs attention">
          This Week vs Last Week
        </SectionTitle>
        <WeekComparison />
      </section>

      {/* ─── Predictions ─── */}
      <section className="mb-12">
        <SectionTitle subtitle="What will happen if current patterns continue — with recommended actions">
          If This Continues…
        </SectionTitle>
        <div className="space-y-3">
          {PREDICTIONS.map((p, i) => (
            <Prediction key={i} item={p} />
          ))}
        </div>
      </section>

      {/* Footer explanation */}
      <div style={glass.card}>
        <div className="flex items-start gap-3">
          <div className="rounded-lg p-2" style={{ backgroundColor: 'rgba(99,87,232,0.15)' }}>
            <Shield size={20} style={{ color: colors.accent }} />
          </div>
          <div className="flex-1">
            <h3 className="font-semibold mb-1 text-sm" style={{ color: '#F0F0FF' }}>
              How Performance is Measured
            </h3>
            <p className="text-xs leading-relaxed" style={{ color: theme.textMuted }}>
              Scores combine{' '}
              <strong style={{ color: '#F0F0FF' }}>task completion (45%)</strong> — completed on time
              vs overdue,{' '}
              <strong style={{ color: '#F0F0FF' }}>attendance (30%)</strong> — on-time vs late
              check-ins,{' '}
              <strong style={{ color: '#F0F0FF' }}>leave planning (15%)</strong> — advance notice
              given, and{' '}
              <strong style={{ color: '#F0F0FF' }}>collaboration (10%)</strong> — activity on team
              tasks. All based on a rolling 30-day window. Late check-in = partial attendance credit.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
