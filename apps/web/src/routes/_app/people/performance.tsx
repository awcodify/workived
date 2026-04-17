import { useState, useMemo } from 'react'
import { createFileRoute, redirect, Link } from '@tanstack/react-router'
import { PieChart, Pie, Cell } from 'recharts'
import { DateTime } from '@/components/workived/shared/DateTime'
import { NotificationBell } from '@/components/workived/shared/NotificationBell'
import { Dropdown } from '@/components/workived/shared/Dropdown'
import type { DropdownTheme } from '@/components/workived/shared/Dropdown'
import { apiClient } from '@/lib/api/client'
import { useCompanySummary, useTeamScorecard, useMyScorecard, useEmployeeScorecard, useScorecardConfig } from '@/lib/hooks/useReports'
import { moduleBackgrounds, typography, colors, gradeColors, gradeColorsDim, getAvatarColor } from '@/design/tokens'
import {
  Clock,
  UserCheck,
  ListChecks,
  CalendarOff,
  TrendingUp,
  TrendingDown,
  Minus,
  ChevronUp,
  ChevronDown,
  ChevronLeft,
  ChevronsDown,
  ChevronsUp,
  Award,
  Zap,
  AlertTriangle,
  Users,
} from 'lucide-react'
import type { Grade } from '@/design/tokens'
import type { EmployeeScore } from '@/types/api'

export const Route = createFileRoute('/_app/people/performance')({
  loader: async () => {
    try {
      const { data } = await apiClient.get<{ data: Record<string, boolean> }>('/api/v1/features')
      if (data.data.reports === false) {
        throw redirect({ to: '/feature-disabled' })
      }
    } catch (err) {
      if (err && typeof err === 'object' && 'to' in err) throw err
    }
  },
  component: PerformancePage,
})

// ── Style constants (light theme) ────────────────────────────

const S = {
  text: '#0F0E13',
  textMuted: '#72708A',
  textDim: 'rgba(0,0,0,0.28)',
  glass: {
    background: 'rgba(255,255,255,0.72)',
    backdropFilter: 'blur(12px)',
    WebkitBackdropFilter: 'blur(12px)',
    boxShadow: '0 2px 16px rgba(99,87,232,0.07), 0 0 0 1px rgba(99,87,232,0.05)',
    borderRadius: '18px',
    padding: '20px',
  } as React.CSSProperties,
  card: {
    background: 'rgba(255,255,255,0.72)',
    backdropFilter: 'blur(12px)',
    WebkitBackdropFilter: 'blur(12px)',
    boxShadow: '0 2px 12px rgba(99,87,232,0.06), 0 0 0 1px rgba(99,87,232,0.05)',
    borderRadius: '14px',
  } as React.CSSProperties,
}

const PERIODS = [
  { key: 'this_month', label: 'This Month' },
  { key: 'this_quarter', label: 'This Quarter' },
  { key: 'this_year', label: 'This Year' },
] as const

const lightDropdownTheme: DropdownTheme = {
  text: S.text,
  textMuted: S.textMuted,
  input: '#FFFFFF',
  inputBorder: 'rgba(99,87,232,0.12)',
  surface: '#FFFFFF',
  border: 'rgba(99,87,232,0.10)',
  hoverBg: 'rgba(99,87,232,0.04)',
}

type SortKey = 'overall_score' | 'attendance_score' | 'punctuality_score' | 'leave_score' | 'tasks_score' | 'trend'
type SortDir = 'asc' | 'desc'

// ── Main Component ──────────────────────────────────────────

function PerformancePage() {
  const [period, setPeriod] = useState('this_month')
  const [sortKey, setSortKey] = useState<SortKey>('overall_score')
  const [sortDir, setSortDir] = useState<SortDir>('desc')
  const [deptFilter, setDeptFilter] = useState<string>('')
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set())

  const { data: summary, isLoading: summaryLoading, error: summaryError } = useCompanySummary(period)
  const { data: team, isLoading: teamLoading, error: teamError } = useTeamScorecard(period)
  const { data: myScorecard } = useMyScorecard(period)
  const { data: scorecardConfig } = useScorecardConfig()
  const myEmployeeId = myScorecard?.employee_id ?? null

  const weights = useMemo(() => ({
    attendance: scorecardConfig?.attendance_weight ?? 30,
    punctuality: scorecardConfig?.punctuality_weight ?? 20,
    leave: scorecardConfig?.leave_weight ?? 15,
    tasks: scorecardConfig?.tasks_weight ?? 35,
  }), [scorecardConfig])

  function toggleExpanded(id: string) {
    setExpandedIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const departments = useMemo(() => {
    if (!team?.employees) return []
    const depts = new Set(team.employees.map((e) => e.department).filter(Boolean))
    return Array.from(depts).sort()
  }, [team])

  const sortedEmployees = useMemo(() => {
    if (!team?.employees) return []
    let filtered = team.employees
    if (deptFilter) {
      filtered = filtered.filter((e) => e.department === deptFilter)
    }
    return [...filtered].sort((a, b) => {
      const av = a[sortKey]
      const bv = b[sortKey]
      return sortDir === 'desc' ? bv - av : av - bv
    })
  }, [team, sortKey, sortDir, deptFilter])

  function handleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDir((d) => (d === 'desc' ? 'asc' : 'desc'))
    } else {
      setSortKey(key)
      setSortDir('desc')
    }
  }

  return (
    <div
      data-testid="performance-page"
      className="min-h-screen px-6 py-8 md:px-11 md:py-10"
      style={{ background: moduleBackgrounds.people, paddingBottom: '160px' }}
    >
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center justify-between">
          <div>
            <Link
              to="/people"
              className="inline-flex items-center gap-1 text-sm font-medium mb-3 transition-colors"
              style={{ color: S.textMuted }}
              onMouseEnter={(e) => { e.currentTarget.style.color = S.text }}
              onMouseLeave={(e) => { e.currentTarget.style.color = S.textMuted }}
            >
              <ChevronLeft size={14} />
              People
            </Link>
            <h1
              className="font-extrabold"
              style={{ fontSize: typography.display.size, letterSpacing: typography.display.tracking, color: S.text, lineHeight: typography.display.lineHeight }}
            >
              Performance
            </h1>
            <p className="mt-2" style={{ fontSize: 14, color: S.textMuted }}>
              Performance insights · {summary?.period_label ?? ''}
            </p>
          </div>
          <div className="flex items-center gap-4">
            <DateTime textColor={S.text} textMutedColor={S.textMuted} borderColor="rgba(0,0,0,0.08)" />
            <NotificationBell
              surfaceColor="rgba(0,0,0,0.04)"
              borderColor="rgba(0,0,0,0.06)"
              accentColor={colors.accent}
              textColor={S.text}
              textMutedColor={S.textMuted}
            />
          </div>
        </div>
      </div>

      {/* Period Toggle */}
      <div className="flex items-center gap-1 mb-8 p-1 rounded-xl w-fit" style={{ background: 'rgba(0,0,0,0.05)' }}>
        {PERIODS.map((p) => (
          <button
            key={p.key}
            data-testid={`performance-period-${p.key}`}
            onClick={() => setPeriod(p.key)}
            className="px-4 py-1.5 rounded-lg text-xs font-semibold transition-colors"
            style={{
              background: period === p.key ? '#FFFFFF' : 'transparent',
              color: period === p.key ? colors.accent : S.textMuted,
              boxShadow: period === p.key ? '0 1px 4px rgba(0,0,0,0.08)' : undefined,
            }}
          >
            {p.label}
          </button>
        ))}
      </div>

      {/* Summary Loading */}
      {summaryLoading && <LoadingSkeleton />}

      {/* Summary Error */}
      {summaryError && !summaryLoading && (
        <div className="rounded-2xl p-6 text-center" style={{ ...S.glass, borderColor: 'rgba(212,64,64,0.2)' }}>
          <AlertTriangle size={32} style={{ color: colors.err, margin: '0 auto 12px' }} />
          <p className="text-sm font-semibold" style={{ color: S.text }}>Something went wrong</p>
          <p className="text-xs mt-1" style={{ color: S.textMuted }}>Failed to load report data</p>
        </div>
      )}

      {/* Summary Data */}
      {summary && !summaryLoading && (
        <>
          {/* Metric Cards */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-6">
            <MetricCard label="Attendance" value={`${summary.attendance_rate}%`} icon={UserCheck} accent="#34D399"
              explanation="Share of scheduled working days where employees showed up." />
            <MetricCard label="Punctuality" value={`${summary.punctuality_rate}%`} icon={Clock} accent="#60A5FA"
              explanation="Share of present days where employees arrived on time." />
            <MetricCard label="Task Completion" value={`${summary.task_completion_rate}%`} icon={ListChecks} accent="#818CF8"
              explanation="Tasks finished as a share of total assigned. On-time delivery weighs more." />
            <MetricCard label="Leave Used" value={`${summary.leave_utilization}%`} icon={CalendarOff} accent="#F59E0B"
              explanation="Leave days taken vs entitlement. Short-notice requests penalise the score, not leave itself." />
            <ScoreCard score={summary.avg_score} />
          </div>

          {/* Grade Distribution + Highlights + Department */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
            {/* Grade Distribution */}
            {team && team.employees.length > 0 && (
              <GradeDistributionChart employees={team.employees} />
            )}

            {/* Highlights */}
            <div className="rounded-2xl p-5" style={S.glass}>
              <h3 className="text-sm font-bold mb-4" style={{ color: S.text }}>Highlights</h3>

              {summary.top_performer && (
                <HighlightRow
                  icon={Award}
                  iconColor="#34D399"
                  label="Top Performer"
                  name={summary.top_performer.name}
                  employeeId={summary.top_performer.employee_id}
                  score={summary.top_performer.score}
                />
              )}

              {summary.most_improved && (
                <HighlightRow
                  icon={Zap}
                  iconColor="#F59E0B"
                  label="Most Improved"
                  name={summary.most_improved.name}
                  employeeId={summary.most_improved.employee_id}
                  score={summary.most_improved.score}
                  trend={summary.most_improved.trend}
                />
              )}

              {summary.needs_attention_count > 0 && (
                <div className="flex items-center gap-3 mt-4 px-3 py-2.5 rounded-xl" style={{ background: 'rgba(239,68,68,0.06)' }}>
                  <AlertTriangle size={16} style={{ color: colors.err }} />
                  <span className="text-xs font-medium" style={{ color: colors.err }}>
                    {summary.needs_attention_count} employee{summary.needs_attention_count > 1 ? 's' : ''} need attention (grade D)
                  </span>
                </div>
              )}

              {!summary.top_performer && !summary.most_improved && summary.needs_attention_count === 0 && (
                <p className="text-xs" style={{ color: S.textDim }}>No highlights for this period yet</p>
              )}
            </div>

            {/* Department Breakdown */}
            <div className="rounded-2xl p-5" style={S.glass}>
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-bold" style={{ color: S.text }}>By Department</h3>
                <Users size={14} style={{ color: S.textDim }} />
              </div>

              {summary.department_breakdown && summary.department_breakdown.length > 0 ? (
                <>
                  <div className="flex items-center gap-2 mb-3 px-1">
                    <span className="text-[10px] font-bold uppercase tracking-wider flex-1" style={{ color: S.textDim }}>Department</span>
                    <span className="text-[10px] font-bold uppercase tracking-wider w-16 text-center" style={{ color: S.textDim }}>Avg Score</span>
                    <span className="text-[10px] font-bold uppercase tracking-wider w-12 text-center" style={{ color: S.textDim }}>Staff</span>
                  </div>
                  {summary.department_breakdown.map((dept) => {
                    const grade = getGrade(dept.avg_score)
                    return (
                      <div key={dept.department} className="flex items-center gap-2 px-1 py-2 rounded-lg transition-colors" style={{ cursor: 'default' }}
                        onMouseEnter={e => (e.currentTarget.style.background = 'rgba(99,87,232,0.04)')}
                        onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                        <span className="text-xs font-semibold flex-1" style={{ color: S.text }}>{dept.department}</span>
                        <div className="flex items-center gap-1.5 w-16 justify-center">
                          <span className="text-xs font-bold" style={{ color: gradeColors[grade], fontFamily: typography.fontMono }}>{dept.avg_score}</span>
                          <GradeBadge grade={grade} size="sm" />
                        </div>
                        <span className="text-xs w-12 text-center" style={{ color: S.textMuted, fontFamily: typography.fontMono }}>{dept.employee_count}</span>
                      </div>
                    )
                  })}
                </>
              ) : (
                <p className="text-xs" style={{ color: S.textDim }}>No department data available</p>
              )}
            </div>
          </div>
        </>
      )}

      {/* ── Team Ranking ──────────────────────────────────────── */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2
              className="font-extrabold"
              style={{ fontSize: typography.h2.size, letterSpacing: typography.h2.tracking, color: S.text, lineHeight: typography.h2.lineHeight }}
            >
              Team Ranking
            </h2>
            {team && (
              <p className="mt-1" style={{ fontSize: 13, color: S.textMuted }}>
                Team average: <span style={{ color: S.text, fontWeight: 700, fontFamily: typography.fontMono }}>{team.team_average}</span>
              </p>
            )}
          </div>

          {/* Department Filter */}
          {departments.length > 0 && (
            <Dropdown
              value={deptFilter}
              onChange={setDeptFilter}
              placeholder="All Departments"
              theme={lightDropdownTheme}
              options={[
                { value: '', label: 'All Departments' },
                ...departments.map((d) => ({ value: d, label: d })),
              ]}
            />
          )}
        </div>

        {/* Team Loading */}
        {teamLoading && <TableSkeleton />}

        {/* Team Error */}
        {teamError && !teamLoading && (
          <div className="rounded-2xl p-6 text-center" style={{ background: '#FFFFFF', border: '1px solid rgba(212,64,64,0.2)', borderRadius: 18 }}>
            <AlertTriangle size={32} style={{ color: colors.err, margin: '0 auto 12px' }} />
            <p className="text-sm font-semibold" style={{ color: S.text }}>Something went wrong</p>
            <p className="text-xs mt-1" style={{ color: S.textMuted }}>Failed to load team data</p>
          </div>
        )}

        {/* Empty */}
        {team && sortedEmployees.length === 0 && !teamLoading && (
          <div className="rounded-2xl p-12 text-center" style={{ background: '#FFFFFF', border: '1px solid rgba(99,87,232,0.08)', borderRadius: 18 }}>
            <Users size={48} style={{ color: S.textDim, margin: '0 auto 16px' }} />
            <p className="text-sm font-semibold" style={{ color: S.text }}>No employee data yet</p>
            <p className="text-xs mt-1" style={{ color: S.textMuted }}>Employees will appear here once they have enough working days</p>
          </div>
        )}

        {/* Table */}
        {sortedEmployees.length > 0 && (
          <div className="rounded-2xl overflow-hidden" style={{ background: 'rgba(255,255,255,0.72)', backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)', boxShadow: '0 2px 16px rgba(99,87,232,0.07), 0 0 0 1px rgba(99,87,232,0.05)' }}>
            {/* Caption + expand controls */}
            <div className="px-5 pt-3 pb-2 flex items-center justify-between">
              <p className="text-[11px]" style={{ color: S.textDim }}>Click an employee to see score breakdown</p>
              <div className="flex items-center gap-1">
                <button
                  data-testid="performance-expand-all-btn"
                  onClick={() => setExpandedIds(new Set(sortedEmployees.map(e => e.employee_id)))}
                  className="flex items-center gap-1 px-2 py-1 rounded text-[10px] font-medium transition-colors"
                  style={{ color: S.textMuted }}
                  onMouseEnter={e => (e.currentTarget.style.background = 'rgba(0,0,0,0.05)')}
                  onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                >
                  <ChevronsDown size={11} /> Expand all
                </button>
                <button
                  data-testid="performance-collapse-all-btn"
                  onClick={() => setExpandedIds(new Set())}
                  className="flex items-center gap-1 px-2 py-1 rounded text-[10px] font-medium transition-colors"
                  style={{ color: S.textMuted }}
                  onMouseEnter={e => (e.currentTarget.style.background = 'rgba(0,0,0,0.05)')}
                  onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                >
                  <ChevronsUp size={11} /> Collapse all
                </button>
              </div>
            </div>
            {/* Header */}
            <div className="flex items-center gap-2 px-5 py-3" style={{ borderBottom: '1px solid rgba(0,0,0,0.06)' }}>
              <span className="w-8 text-[11px] font-bold uppercase tracking-wider" style={{ color: S.textDim }}>#</span>
              <span className="flex-1 text-[11px] font-bold uppercase tracking-wider" style={{ color: S.textDim }}>Employee</span>
              <span className="w-20 text-[11px] font-bold uppercase tracking-wider hidden md:block" style={{ color: S.textDim }}>Dept</span>
              <SortHeader label="Score" sortKey="overall_score" currentKey={sortKey} dir={sortDir} onSort={handleSort} width="w-14" />
              <span className="w-8" />
              <SortHeader label="Trend" sortKey="trend" currentKey={sortKey} dir={sortDir} onSort={handleSort} width="w-12" />
              <SortHeader label="ATT" sortKey="attendance_score" currentKey={sortKey} dir={sortDir} onSort={handleSort} width="w-10" className="hidden md:flex" />
              <SortHeader label="PUN" sortKey="punctuality_score" currentKey={sortKey} dir={sortDir} onSort={handleSort} width="w-10" className="hidden md:flex" />
              <SortHeader label="LEV" sortKey="leave_score" currentKey={sortKey} dir={sortDir} onSort={handleSort} width="w-10" className="hidden md:flex" />
              <SortHeader label="TSK" sortKey="tasks_score" currentKey={sortKey} dir={sortDir} onSort={handleSort} width="w-10" className="hidden md:flex" />
              <span className="w-5" />
            </div>

            {/* Rows */}
            {sortedEmployees.map((emp, idx) => (
              <EmployeeRow
                key={emp.employee_id}
                emp={emp}
                rank={idx + 1}
                isMe={emp.employee_id === myEmployeeId}
                isExpanded={expandedIds.has(emp.employee_id)}
                period={period}
                weights={weights}
                onToggle={() => toggleExpanded(emp.employee_id)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

// ── Subcomponents ───────────────────────────────────────────

function MetricCard({ label, value, icon: Icon, accent, explanation }: { label: string; value: string; icon: React.ElementType; accent: string; explanation: string }) {
  const [hovered, setHovered] = useState(false)
  return (
    <div
      className="p-5 relative"
      style={{
        ...S.card,
        transition: 'box-shadow 0.15s ease',
        boxShadow: hovered
          ? '0 4px 24px rgba(99,87,232,0.13), 0 0 0 1px rgba(99,87,232,0.10)'
          : S.card.boxShadow,
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <div className="w-9 h-9 rounded-xl flex items-center justify-center mb-4" style={{ background: accent + '18' }}>
        <Icon size={18} style={{ color: accent }} />
      </div>
      <p className="text-2xl font-extrabold" style={{ color: S.text, fontFamily: typography.fontMono }}>{value}</p>
      <p className="text-sm font-semibold mt-1" style={{ color: S.textMuted }}>{label}</p>

      {/* Tooltip — shown on card hover */}
      <div
        className="absolute left-0 right-0 z-50 px-1"
        style={{
          bottom: 'calc(100% + 10px)',
          pointerEvents: 'none',
          opacity: hovered ? 1 : 0,
          transform: hovered ? 'translateY(0)' : 'translateY(4px)',
          transition: 'opacity 0.15s ease, transform 0.15s ease',
        }}
      >
        <div
          className="rounded-2xl px-4 py-3"
          style={{
            background: '#1C1A30',
            boxShadow: '0 12px 40px rgba(0,0,0,0.25), 0 0 0 1px rgba(255,255,255,0.06)',
          }}
        >
          <p className="text-xs font-semibold mb-1" style={{ color: 'rgba(255,255,255,0.5)', letterSpacing: '0.04em', textTransform: 'uppercase' }}>
            {label}
          </p>
          <p className="text-[12px] leading-relaxed" style={{ color: 'rgba(255,255,255,0.78)' }}>
            {explanation}
          </p>
        </div>
        {/* Caret */}
        <div
          className="absolute bottom-0 left-1/2 -translate-x-1/2 translate-y-full w-0 h-0"
          style={{
            borderLeft: '6px solid transparent',
            borderRight: '6px solid transparent',
            borderTop: '6px solid #1C1A30',
          }}
        />
      </div>
    </div>
  )
}

function ScoreCard({ score }: { score: number }) {
  const [hovered, setHovered] = useState(false)
  const grade = getGrade(score)
  return (
    <div
      className="p-5 relative"
      style={{
        ...S.card,
        transition: 'box-shadow 0.15s ease',
        boxShadow: hovered
          ? '0 4px 24px rgba(99,87,232,0.13), 0 0 0 1px rgba(99,87,232,0.10)'
          : S.card.boxShadow,
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <div className="flex items-center gap-2 mb-4">
        <GradeBadge grade={grade} size="md" />
      </div>
      <p className="text-2xl font-extrabold" style={{ color: S.text, fontFamily: typography.fontMono }}>{score}</p>
      <p className="text-sm font-semibold mt-1" style={{ color: S.textMuted }}>Avg Score</p>

      <div
        className="absolute left-0 right-0 z-50 px-1"
        style={{
          bottom: 'calc(100% + 10px)',
          pointerEvents: 'none',
          opacity: hovered ? 1 : 0,
          transform: hovered ? 'translateY(0)' : 'translateY(4px)',
          transition: 'opacity 0.15s ease, transform 0.15s ease',
        }}
      >
        <div
          className="rounded-2xl px-4 py-3"
          style={{
            background: '#1C1A30',
            boxShadow: '0 12px 40px rgba(0,0,0,0.25), 0 0 0 1px rgba(255,255,255,0.06)',
          }}
        >
          <p className="text-xs font-semibold mb-1" style={{ color: 'rgba(255,255,255,0.5)', letterSpacing: '0.04em', textTransform: 'uppercase' }}>
            Avg Score
          </p>
          <p className="text-[12px] leading-relaxed" style={{ color: 'rgba(255,255,255,0.78)' }}>
            Weighted average across all active signals this period. Signals with no data are excluded from the calculation.
          </p>
        </div>
        <div
          className="absolute bottom-0 left-1/2 -translate-x-1/2 translate-y-full w-0 h-0"
          style={{
            borderLeft: '6px solid transparent',
            borderRight: '6px solid transparent',
            borderTop: '6px solid #1C1A30',
          }}
        />
      </div>
    </div>
  )
}

function GradeDistributionChart({ employees }: { employees: EmployeeScore[] }) {
  const grades = ['A', 'B', 'C', 'D'] as const
  const counts = useMemo(() => {
    const c = { A: 0, B: 0, C: 0, D: 0 }
    employees.forEach(e => { c[getGrade(e.overall_score)]++ })
    return c
  }, [employees])

  const data = grades
    .map(g => ({ grade: g, value: counts[g], color: gradeColors[g] }))
    .filter(d => d.value > 0)

  const total = employees.length

  return (
    <div className="rounded-2xl p-5" style={S.glass}>
      <h3 className="text-sm font-bold mb-4" style={{ color: S.text }}>Grade Distribution</h3>
      <div className="flex items-center gap-5">
        {/* Donut */}
        <div className="relative flex-shrink-0" style={{ width: 100, height: 100 }}>
          <PieChart width={100} height={100}>
            <Pie
              data={data.length > 0 ? data : [{ grade: 'A', value: 1, color: 'rgba(0,0,0,0.06)' }]}
              cx={46}
              cy={46}
              innerRadius={28}
              outerRadius={44}
              paddingAngle={data.length > 1 ? 3 : 0}
              dataKey="value"
              startAngle={90}
              endAngle={-270}
              stroke="none"
            >
              {(data.length > 0 ? data : [{ color: 'rgba(0,0,0,0.06)' }]).map((entry, i) => (
                <Cell key={i} fill={entry.color} />
              ))}
            </Pie>
          </PieChart>
          <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
            <span className="text-xl font-extrabold leading-none" style={{ color: S.text, fontFamily: typography.fontMono }}>{total}</span>
            <span className="text-[9px] mt-0.5" style={{ color: S.textDim }}>total</span>
          </div>
        </div>

        {/* Legend */}
        <div className="flex flex-col gap-2.5 flex-1">
          {grades.map(g => (
            <div key={g} className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-sm" style={{ background: gradeColors[g] }} />
                <span className="text-xs font-medium" style={{ color: S.textMuted }}>Grade {g}</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="text-xs font-bold tabular-nums" style={{ color: gradeColors[g], fontFamily: typography.fontMono }}>
                  {counts[g]}
                </span>
                <span className="text-[10px] tabular-nums w-7 text-right" style={{ color: S.textDim }}>
                  {total > 0 ? Math.round(counts[g] / total * 100) : 0}%
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

function HighlightRow({ icon: Icon, iconColor, label, name, employeeId, score, trend }: {
  icon: React.ElementType
  iconColor: string
  label: string
  name: string
  employeeId: string
  score: number
  trend?: number
}) {
  const avatarColor = getAvatarColor(employeeId)
  const grade = getGrade(score)
  return (
    <div className="flex items-center gap-3 py-2.5">
      <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: iconColor + '15' }}>
        <Icon size={14} style={{ color: iconColor }} />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-[11px] font-medium" style={{ color: S.textDim }}>{label}</p>
        <div className="flex items-center gap-2 mt-0.5">
          <div
            className="w-5 h-5 rounded-md flex items-center justify-center text-[10px] font-bold flex-shrink-0"
            style={{ background: avatarColor.bg, color: avatarColor.text }}
          >
            {name.charAt(0)}
          </div>
          <span className="text-xs font-semibold truncate" style={{ color: S.text }}>{name}</span>
          <span className="text-xs font-bold" style={{ color: gradeColors[grade], fontFamily: typography.fontMono }}>{score}</span>
          {trend !== undefined && trend !== 0 && (
            <span className="text-[10px] font-bold flex items-center gap-0.5" style={{ color: trend > 0 ? '#34D399' : '#EF4444' }}>
              {trend > 0 ? <TrendingUp size={10} /> : <TrendingDown size={10} />}
              {trend > 0 ? '+' : ''}{trend}
            </span>
          )}
        </div>
      </div>
    </div>
  )
}

function GradeBadge({ grade, size = 'sm' }: { grade: Grade; size?: 'sm' | 'md' }) {
  const px = size === 'sm' ? 'w-5 h-5 text-[10px]' : 'w-6 h-6 text-[11px]'
  return (
    <div
      className={`${px} rounded-md flex items-center justify-center font-bold`}
      style={{ background: gradeColorsDim[grade], color: gradeColors[grade] }}
    >
      {grade}
    </div>
  )
}

function SortHeader({ label, sortKey: key, currentKey, dir, onSort, width, className = '' }: {
  label: string
  sortKey: SortKey
  currentKey: SortKey
  dir: SortDir
  onSort: (key: SortKey) => void
  width: string
  className?: string
}) {
  const active = currentKey === key
  return (
    <button
      onClick={() => onSort(key)}
      className={`${width} flex items-center justify-center gap-0.5 ${className}`}
    >
      <span className="text-[10px] font-bold uppercase tracking-wider" style={{ color: active ? colors.accent : S.textDim }}>
        {label}
      </span>
      {active && (
        dir === 'desc' ? <ChevronDown size={10} style={{ color: colors.accent }} /> : <ChevronUp size={10} style={{ color: colors.accent }} />
      )}
    </button>
  )
}

const SIGNALS: Array<{
  label: string
  key: string
  weightKey: 'attendance' | 'punctuality' | 'leave' | 'tasks'
  icon: React.ElementType
  explanation: string
  formula: string
}> = [
  {
    label: 'Attendance',
    key: 'attendance',
    weightKey: 'attendance',
    icon: UserCheck,
    explanation: 'Measures how often the employee shows up on their scheduled working days. Unapproved absences count against this score.',
    formula: 'days present ÷ working days × 100',
  },
  {
    label: 'Punctuality',
    key: 'punctuality',
    weightKey: 'punctuality',
    icon: Clock,
    explanation: 'Measures how consistently the employee arrives on time on days they are present. Only calculated when attendance data exists.',
    formula: 'on-time arrivals ÷ days present × 100',
  },
  {
    label: 'Leave',
    key: 'leave',
    weightKey: 'leave',
    icon: CalendarOff,
    explanation: 'Taking leave is a right and is not penalised. This score only drops for short-notice requests filed less than 24 hours before the start.',
    formula: '100 − (short-notice requests × 10)',
  },
  {
    label: 'Tasks',
    key: 'tasks',
    weightKey: 'tasks',
    icon: ListChecks,
    explanation: 'Reflects how reliably the employee completes assigned work. Finishing on time weighs more than just completing tasks late.',
    formula: 'completion rate × 70% + on-time rate × 30%',
  },
]

function EmployeeRow({ emp, rank, isMe, isExpanded, period, weights, onToggle }: {
  emp: EmployeeScore
  rank: number
  isMe: boolean
  isExpanded: boolean
  period: string
  weights: { attendance: number; punctuality: number; leave: number; tasks: number }
  onToggle: () => void
}) {
  const grade = getGrade(emp.overall_score)
  const avatarColor = getAvatarColor(emp.employee_id)

  const { data: scorecard, isLoading: scorecardLoading } = useEmployeeScorecard(
    isExpanded ? emp.employee_id : null,
    period,
  )

  const scores: Record<string, number> = {
    attendance: emp.attendance_score,
    punctuality: emp.punctuality_score,
    leave: emp.leave_score,
    tasks: emp.tasks_score,
  }

  const rowBg = isMe ? 'rgba(99,87,232,0.06)' : isExpanded ? 'rgba(99,87,232,0.03)' : 'transparent'

  return (
    <div style={isMe ? { borderLeft: `3px solid ${colors.accent}` } : undefined}>
      {/* ── Row button ── */}
      <button
        data-testid={`performance-row-${emp.employee_id}`}
        onClick={onToggle}
        className="flex items-center gap-2 px-5 py-3 w-full text-left transition-colors"
        style={{ background: rowBg }}
        onMouseEnter={e => { if (!isExpanded && !isMe) e.currentTarget.style.background = 'rgba(99,87,232,0.025)' }}
        onMouseLeave={e => { if (!isExpanded && !isMe) e.currentTarget.style.background = 'transparent' }}
      >
        <span className="w-8 text-xs font-bold" style={{ color: S.textDim, fontFamily: typography.fontMono }}>{rank}</span>

        <div className="flex-1 flex items-center gap-2.5 min-w-0">
          <div
            className="w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold flex-shrink-0"
            style={{ background: avatarColor.bg, color: avatarColor.text }}
          >
            {emp.employee_name.charAt(0)}
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <p className="text-sm font-semibold truncate" style={{ color: S.text }}>{emp.employee_name}</p>
              {isMe && (
                <span className="text-[9px] font-bold px-1.5 py-0.5 rounded" style={{ background: `${colors.accent}18`, color: colors.accent }}>
                  YOU
                </span>
              )}
            </div>
            <p className="text-[11px] truncate md:hidden" style={{ color: S.textDim }}>{emp.department}</p>
          </div>
        </div>

        <span className="w-20 text-sm truncate hidden md:block" style={{ color: S.textMuted }}>{emp.department}</span>

        <span className="w-14 text-center text-base font-extrabold" style={{ color: gradeColors[grade], fontFamily: typography.fontMono }}>
          {emp.overall_score}
        </span>

        <div className="w-8 flex justify-center">
          <div className="w-6 h-6 rounded-md flex items-center justify-center text-[11px] font-bold"
            style={{ background: gradeColorsDim[grade], color: gradeColors[grade] }}>
            {grade}
          </div>
        </div>

        <div className="w-12 flex justify-center">
          <TrendIndicator value={emp.trend} />
        </div>

        <SubScore value={emp.attendance_score} />
        <SubScore value={emp.punctuality_score} />
        <SubScore value={emp.leave_score} />
        <SubScore value={emp.tasks_score} />

        {/* Expand chevron */}
        <div className="w-5 flex justify-center">
          {isExpanded
            ? <ChevronUp size={13} style={{ color: colors.accent }} />
            : <ChevronDown size={13} style={{ color: S.textDim }} />}
        </div>
      </button>

      {/* ── Expanded detail ── */}
      {isExpanded && (
        <div data-testid={`performance-detail-${emp.employee_id}`} className="px-5 pb-4 pt-0" style={{ background: 'rgba(99,87,232,0.025)', borderTop: '1px solid rgba(99,87,232,0.08)' }}>
          {scorecardLoading ? (
            <div className="flex flex-col">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="py-3.5" style={{ borderTop: i > 1 ? '1px solid rgba(0,0,0,0.05)' : undefined }}>
                  <div className="flex items-center justify-between mb-2">
                    <div className="h-3 w-28 rounded animate-pulse" style={{ background: 'rgba(0,0,0,0.07)' }} />
                    <div className="h-5 w-10 rounded animate-pulse" style={{ background: 'rgba(0,0,0,0.07)' }} />
                  </div>
                  <div className="h-0.5 w-full rounded-full animate-pulse" style={{ background: 'rgba(0,0,0,0.05)' }} />
                </div>
              ))}
            </div>
          ) : (
            <>
              {/* Signal flat list */}
              <div className="flex flex-col">
                {SIGNALS.map((sig, idx) => {
                  const value = scores[sig.key] ?? 0
                  const barGrade = getGrade(value)
                  const detail = scorecard?.breakdown[sig.key]?.detail
                  const weight = weights[sig.weightKey]
                  const Icon = sig.icon
                  const isZero = value === 0
                  const color = isZero ? 'rgba(0,0,0,0.25)' : gradeColors[barGrade]

                  return (
                    <div
                      key={sig.key}
                      className="py-3.5"
                      style={{ borderTop: idx > 0 ? '1px solid rgba(0,0,0,0.05)' : undefined }}
                    >
                      {/* Row header: icon + label + weight left, score right */}
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2.5">
                          <Icon size={13} style={{ color }} />
                          <span className="text-xs font-semibold uppercase tracking-wider"
                            style={{ color: isZero ? S.textDim : S.text }}>
                            {sig.label}
                          </span>
                          <span className="text-[11px]" style={{ color: S.textDim }}>
                            {weight}%
                          </span>
                        </div>
                        <span className="text-base font-extrabold tabular-nums"
                          style={{ color, fontFamily: typography.fontMono }}>
                          {value}
                          <span className="text-[10px] font-normal ml-0.5" style={{ color: S.textDim }}>/100</span>
                        </span>
                      </div>

                      {/* Progress bar */}
                      <div className="h-[3px] rounded-full mb-2.5" style={{ background: 'rgba(0,0,0,0.06)' }}>
                        <div className="h-full rounded-full transition-all duration-500"
                          style={{ width: `${value}%`, background: isZero ? 'rgba(0,0,0,0.10)' : color }} />
                      </div>

                      {/* Raw numbers | formula */}
                      <div className="flex items-baseline justify-between gap-4">
                        <p className="text-xs font-medium" style={{ color: isZero ? S.textDim : S.text }}>
                          {detail ?? '—'}
                        </p>
                        <p className="text-[11px] shrink-0" style={{ color: S.textDim, fontStyle: 'italic' }}>
                          {sig.formula}
                        </p>
                      </div>
                    </div>
                  )
                })}
              </div>

              {/* Flags */}
              {scorecard?.flags && scorecard.flags.length > 0 && (
                <div className="mt-1 flex flex-col gap-1.5 pb-1">
                  {scorecard.flags.map((flag, i) => (
                    <div
                      key={i}
                      className="flex items-start gap-2 px-3 py-2 rounded-lg text-[11px]"
                      style={{
                        background: flag.severity === 'alert' ? 'rgba(239,68,68,0.06)' : 'rgba(245,158,11,0.06)',
                        border: `1px solid ${flag.severity === 'alert' ? 'rgba(239,68,68,0.15)' : 'rgba(245,158,11,0.15)'}`,
                        color: flag.severity === 'alert' ? '#D44040' : '#C97B2A',
                      }}
                    >
                      <AlertTriangle size={12} className="flex-shrink-0 mt-0.5" />
                      <span>{flag.message}</span>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  )
}

function SubScore({ value }: { value: number }) {
  return (
    <span className="w-10 text-center text-xs font-medium hidden md:block" style={{ color: S.textMuted, fontFamily: typography.fontMono }}>
      {value}
    </span>
  )
}

function TrendIndicator({ value }: { value: number }) {
  if (value === 0) return <Minus size={12} style={{ color: S.textDim }} />
  const isUp = value > 0
  const Icon = isUp ? TrendingUp : TrendingDown
  return (
    <span className="flex items-center gap-0.5 text-[11px] font-bold" style={{ color: isUp ? '#12A05C' : '#D44040' }}>
      <Icon size={12} />
      {isUp ? '+' : ''}{value}
    </span>
  )
}

function LoadingSkeleton() {
  const pulse = 'animate-pulse rounded-xl'
  const bg = 'rgba(0,0,0,0.05)'
  return (
    <>
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-6">
        {[...Array(5)].map((_, i) => (
          <div key={i} className={pulse} style={{ background: bg, height: 120 }} />
        ))}
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className={pulse} style={{ background: bg, height: 200 }} />
        <div className={pulse} style={{ background: bg, height: 200 }} />
        <div className={pulse} style={{ background: bg, height: 200 }} />
      </div>
    </>
  )
}

function TableSkeleton() {
  const pulse = 'animate-pulse rounded-xl'
  return (
    <div className="rounded-2xl overflow-hidden" style={{ background: '#FFFFFF', border: '1px solid rgba(99,87,232,0.08)' }}>
      {[...Array(6)].map((_, i) => (
        <div key={i} className="flex items-center gap-4 px-5 py-4">
          <div className={`${pulse} w-8 h-4`} style={{ background: 'rgba(0,0,0,0.05)' }} />
          <div className={`${pulse} w-8 h-8`} style={{ background: 'rgba(0,0,0,0.05)' }} />
          <div className={`${pulse} flex-1 h-4`} style={{ background: 'rgba(0,0,0,0.05)' }} />
          <div className={`${pulse} w-12 h-4`} style={{ background: 'rgba(0,0,0,0.05)' }} />
        </div>
      ))}
    </div>
  )
}

// ── Helpers ─────────────────────────────────────────────────

function getGrade(score: number): Grade {
  if (score >= 90) return 'A'
  if (score >= 75) return 'B'
  if (score >= 60) return 'C'
  return 'D'
}
