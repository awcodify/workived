import { useState } from 'react'
import { Link } from '@tanstack/react-router'
import { ChevronRight, TrendingUp, TrendingDown, AlertTriangle, Trophy, Zap } from 'lucide-react'
import { useCompanySummary, useScorecardConfig } from '@/lib/hooks/useReports'
import { gradeColors, gradeColorsDim, typography, colors } from '@/design/tokens'
import { Avatar } from '@/components/workived/layout/Avatar'
import type { Grade } from '@/design/tokens'

function getGrade(score: number): Grade {
  if (score >= 90) return 'A'
  if (score >= 75) return 'B'
  if (score >= 60) return 'C'
  return 'D'
}

const PERIODS = [
  { key: 'this_month', label: 'Mo' },
  { key: 'this_quarter', label: 'Qr' },
  { key: 'this_year', label: 'Yr' },
] as const

interface Theme {
  text: string
  textMuted: string
  surface: string
  surfaceHover: string
  border: string
}

/* ── SVG score ring ──────────────────────────────────────── */
function ScoreRing({ score, grade, size = 120 }: { score: number; grade: Grade; size?: number }) {
  const strokeWidth = 8
  const r = (size - strokeWidth) / 2
  const circumference = 2 * Math.PI * r
  const progress = Math.min(score / 100, 1)
  const dashOffset = circumference * (1 - progress)
  const color = gradeColors[grade]

  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke="rgba(0,0,0,0.05)"
          strokeWidth={strokeWidth}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={color}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={dashOffset}
          style={{ transition: 'stroke-dashoffset 0.8s ease-out' }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span
          className="font-extrabold leading-none"
          style={{ fontSize: 32, color, fontFamily: typography.fontMono }}
        >
          {score}
        </span>
        <div
          className="mt-1 px-1.5 py-0.5 rounded-md text-[10px] font-bold"
          style={{ background: gradeColorsDim[grade], color }}
        >
          Grade {grade}
        </div>
      </div>
    </div>
  )
}

/* ── Metric bar ──────────────────────────────────────────── */
function MetricBar({
  label,
  value,
  color,
  weight,
  textColor,
  mutedColor,
}: {
  label: string
  value: number
  color: string
  weight: number
  textColor: string
  mutedColor: string
}) {
  return (
    <div className="py-1.5">
      <div className="flex items-center justify-between mb-1">
        <div className="flex items-center gap-1.5">
          <div className="w-1.5 h-1.5 rounded-full" style={{ background: color }} />
          <span className="text-xs font-medium" style={{ color: textColor }}>{label}</span>
          <span className="text-[10px]" style={{ color: mutedColor, opacity: 0.5 }}>{weight}%w</span>
        </div>
        <span className="text-xs font-bold tabular-nums" style={{ color, fontFamily: typography.fontMono }}>
          {value}%
        </span>
      </div>
      <div className="h-1.5 rounded-full overflow-hidden" style={{ background: 'rgba(0,0,0,0.05)' }}>
        <div
          className="h-full rounded-full"
          style={{
            width: `${Math.min(value, 100)}%`,
            background: color,
            transition: 'width 0.6s ease-out',
          }}
        />
      </div>
    </div>
  )
}

/* ── Department mini-row ─────────────────────────────────── */
function DeptRow({
  name,
  score,
  count,
  maxScore,
  textColor,
  mutedColor,
}: {
  name: string
  score: number
  count: number
  maxScore: number
  textColor: string
  mutedColor: string
}) {
  const grade = getGrade(score)
  const barPct = maxScore > 0 ? (score / maxScore) * 100 : 0
  return (
    <div className="flex items-center gap-2 py-1">
      <div className="w-20 truncate text-[11px] font-medium" style={{ color: textColor }}>{name}</div>
      <div className="flex-1 h-1 rounded-full overflow-hidden" style={{ background: 'rgba(0,0,0,0.05)' }}>
        <div
          className="h-full rounded-full"
          style={{ width: `${barPct}%`, background: gradeColors[grade], transition: 'width 0.5s ease-out' }}
        />
      </div>
      <span className="text-[11px] font-bold tabular-nums w-7 text-right" style={{ color: gradeColors[grade], fontFamily: typography.fontMono }}>
        {score}
      </span>
      <span className="text-[10px] w-4 text-right" style={{ color: mutedColor }}>{count}</span>
    </div>
  )
}

export function PerformancePanel({ theme: t }: { theme: Theme }) {
  const [period, setPeriod] = useState<'this_month' | 'this_quarter' | 'this_year'>('this_month')
  const { data: summary, isLoading } = useCompanySummary(period)
  const { data: config } = useScorecardConfig()

  const weights = {
    attendance: config?.attendance_weight ?? 30,
    punctuality: config?.punctuality_weight ?? 20,
    tasks: config?.tasks_weight ?? 35,
    leave: config?.leave_weight ?? 15,
  }

  const grade = summary ? getGrade(summary.avg_score) : null

  return (
    <div
      data-testid="performance-panel"
      className="rounded-2xl overflow-hidden"
      style={{ background: t.surface, border: `1px solid ${t.border}`, boxShadow: '0 1px 8px rgba(0,0,0,0.05)' }}
    >
      {/* Header */}
      <div className="px-4 pt-4 pb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <p className="text-sm font-bold" style={{ color: t.text }}>Performance</p>
          {summary && summary.needs_attention_count > 0 && (
            <span
              className="flex items-center gap-1 text-[10px] font-bold px-1.5 py-0.5 rounded-md"
              style={{ background: 'rgba(212,64,64,0.08)', color: '#D44040' }}
            >
              <AlertTriangle size={10} />
              {summary.needs_attention_count}
            </span>
          )}
        </div>
        <div className="flex items-center gap-0.5 p-0.5 rounded-lg" style={{ background: 'rgba(0,0,0,0.05)' }}>
          {PERIODS.map((p) => (
            <button
              key={p.key}
              onClick={() => setPeriod(p.key)}
              data-testid={`performance-period-${p.key}-btn`}
              className="px-2 py-0.5 rounded-md text-[11px] font-semibold transition-colors"
              style={{
                background: period === p.key ? '#fff' : 'transparent',
                color: period === p.key ? t.text : t.textMuted,
                boxShadow: period === p.key ? '0 1px 3px rgba(0,0,0,0.08)' : undefined,
              }}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      {isLoading ? (
        <div className="px-4 pb-4 flex flex-col gap-3" data-testid="performance-skeleton">
          <div className="flex justify-center py-4">
            <div className="animate-pulse rounded-full" style={{ width: 120, height: 120, background: 'rgba(0,0,0,0.06)' }} />
          </div>
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="animate-pulse rounded-lg" style={{ background: 'rgba(0,0,0,0.06)', height: 28 }} />
          ))}
        </div>
      ) : summary ? (
        <>
          {/* Score ring */}
          <div className="flex justify-center py-4" style={{ borderTop: `1px solid ${t.border}` }}>
            {grade && <ScoreRing score={summary.avg_score} grade={grade} />}
          </div>

          {/* Metrics with progress bars */}
          <div className="px-4 pb-2" style={{ borderTop: `1px solid ${t.border}` }}>
            <p className="text-[10px] font-bold uppercase tracking-wider pt-3 pb-1" style={{ color: t.textMuted }}>
              Breakdown
            </p>
            <MetricBar label="Attendance" value={summary.attendance_rate} color="#34D399" weight={weights.attendance} textColor={t.text} mutedColor={t.textMuted} />
            <MetricBar label="Punctuality" value={summary.punctuality_rate} color="#60A5FA" weight={weights.punctuality} textColor={t.text} mutedColor={t.textMuted} />
            <MetricBar label="Tasks" value={summary.task_completion_rate} color="#818CF8" weight={weights.tasks} textColor={t.text} mutedColor={t.textMuted} />
            <MetricBar label="Leave balance" value={100 - summary.leave_utilization} color="#F59E0B" weight={weights.leave} textColor={t.text} mutedColor={t.textMuted} />
          </div>

          {/* Highlights: top performer + most improved */}
          {(summary.top_performer || summary.most_improved) && (
            <div className="px-4 py-3 grid grid-cols-2 gap-2" style={{ borderTop: `1px solid ${t.border}` }}>
              {summary.top_performer && (
                <div className="rounded-xl px-3 py-2.5" style={{ background: 'rgba(52,211,153,0.06)' }}>
                  <div className="flex items-center gap-1 mb-2">
                    <Trophy size={10} style={{ color: '#34D399' }} />
                    <span className="text-[10px] font-bold uppercase tracking-wider" style={{ color: '#34D399' }}>Top</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Avatar name={summary.top_performer.name} id={summary.top_performer.employee_id} size={24} />
                    <div className="min-w-0 flex-1">
                      <p className="text-[11px] font-semibold truncate" style={{ color: t.text }}>{summary.top_performer.name}</p>
                    </div>
                  </div>
                  <span className="text-lg font-extrabold tabular-nums block mt-1" style={{ color: '#34D399', fontFamily: typography.fontMono }}>
                    {summary.top_performer.score}
                  </span>
                </div>
              )}
              {summary.most_improved && (
                <div className="rounded-xl px-3 py-2.5" style={{ background: 'rgba(96,165,250,0.06)' }}>
                  <div className="flex items-center gap-1 mb-2">
                    <Zap size={10} style={{ color: '#60A5FA' }} />
                    <span className="text-[10px] font-bold uppercase tracking-wider" style={{ color: '#60A5FA' }}>Improved</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Avatar name={summary.most_improved.name} id={summary.most_improved.employee_id} size={24} />
                    <div className="min-w-0 flex-1">
                      <p className="text-[11px] font-semibold truncate" style={{ color: t.text }}>{summary.most_improved.name}</p>
                    </div>
                  </div>
                  {summary.most_improved.trend !== undefined && (
                    <span
                      className="text-lg font-extrabold tabular-nums flex items-center gap-0.5 mt-1"
                      style={{ color: summary.most_improved.trend > 0 ? '#60A5FA' : '#EF4444', fontFamily: typography.fontMono }}
                    >
                      {summary.most_improved.trend > 0 ? <TrendingUp size={13} /> : <TrendingDown size={13} />}
                      {summary.most_improved.trend > 0 ? '+' : ''}{summary.most_improved.trend}
                    </span>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Department breakdown */}
          {summary.department_breakdown && summary.department_breakdown.length > 0 && (
            <div className="px-4 py-3" style={{ borderTop: `1px solid ${t.border}` }}>
              <div className="flex items-center justify-between mb-1">
                <p className="text-[10px] font-bold uppercase tracking-wider" style={{ color: t.textMuted }}>
                  By department
                </p>
                <p className="text-[10px]" style={{ color: t.textMuted, opacity: 0.5 }}>#</p>
              </div>
              {summary.department_breakdown
                .slice(0, 4)
                .map((dept) => {
                  const maxScore = Math.max(...summary.department_breakdown.map((d) => d.avg_score), 1)
                  return (
                    <DeptRow
                      key={dept.department}
                      name={dept.department}
                      score={dept.avg_score}
                      count={dept.employee_count}
                      maxScore={maxScore}
                      textColor={t.text}
                      mutedColor={t.textMuted}
                    />
                  )
                })}
            </div>
          )}
        </>
      ) : (
        <div className="px-4 py-6 text-center">
          <p className="text-xs" style={{ color: t.textMuted }}>No performance data yet</p>
        </div>
      )}

      {/* CTA */}
      <div className="px-4 py-3" style={{ borderTop: `1px solid ${t.border}` }}>
        <Link
          to="/people/performance"
          data-testid="performance-full-scorecard-btn"
          className="flex items-center justify-center gap-1.5 w-full py-2.5 rounded-xl text-xs font-semibold transition-all hover:opacity-80"
          style={{ background: t.surfaceHover, color: colors.accent }}
        >
          Full scorecard
          <ChevronRight size={13} />
        </Link>
      </div>
    </div>
  )
}
