import { useState } from 'react'
import { Link } from '@tanstack/react-router'
import { ChevronRight, TrendingUp, TrendingDown } from 'lucide-react'
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

export function PerformancePanel({ theme: t }: { theme: Theme }) {
  const [period, setPeriod] = useState<'this_month' | 'this_quarter' | 'this_year'>('this_month')
  const { data: summary, isLoading } = useCompanySummary(period)
  const { data: config } = useScorecardConfig()

  const weights = {
    attendance: config?.attendance_weight ?? 30,
    punctuality: config?.punctuality_weight ?? 20,
    tasks: config?.tasks_weight ?? 35,
  }

  const grade = summary ? getGrade(summary.avg_score) : null

  return (
    <div
      className="rounded-2xl overflow-hidden"
      style={{ background: t.surface, border: `1px solid ${t.border}`, boxShadow: '0 1px 8px rgba(0,0,0,0.05)' }}
    >
      {/* Panel header */}
      <div className="px-4 pt-4 pb-3 flex items-center justify-between">
        <p className="text-sm font-bold" style={{ color: t.text }}>Performance</p>
        <div className="flex items-center gap-0.5 p-0.5 rounded-lg" style={{ background: 'rgba(0,0,0,0.05)' }}>
          {PERIODS.map((p) => (
            <button
              key={p.key}
              onClick={() => setPeriod(p.key)}
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
        <div className="px-4 pb-4 flex flex-col gap-2">
          {[1, 2, 3].map((i) => (
            <div key={i} className="animate-pulse rounded-lg" style={{ background: 'rgba(0,0,0,0.06)', height: 32 }} />
          ))}
        </div>
      ) : summary ? (
        <>
          {/* Avg score */}
          <div className="px-4 py-6 flex flex-col items-center text-center" style={{ borderTop: `1px solid ${t.border}` }}>
            <p className="text-[10px] font-bold uppercase tracking-wider mb-3" style={{ color: t.textMuted }}>
              Team avg score
            </p>
            <span
              className="font-extrabold leading-none mb-3"
              style={{ fontSize: 64, color: grade ? gradeColors[grade] : t.text, fontFamily: typography.fontMono }}
            >
              {summary.avg_score}
            </span>
            {grade && (
              <div
                className="w-9 h-9 rounded-xl flex items-center justify-center text-base font-bold"
                style={{ background: gradeColorsDim[grade], color: gradeColors[grade] }}
              >
                {grade}
              </div>
            )}
          </div>

          {/* Metrics */}
          <div className="px-4 py-3" style={{ borderTop: `1px solid ${t.border}` }}>
            {[
              { label: 'Attendance', value: summary.attendance_rate, color: '#34D399', weight: weights.attendance },
              { label: 'Punctuality', value: summary.punctuality_rate, color: '#60A5FA', weight: weights.punctuality },
              { label: 'Tasks done', value: summary.task_completion_rate, color: '#818CF8', weight: weights.tasks },
            ].map(({ label, value, color, weight }) => (
              <div key={label} className="flex items-center justify-between py-1.5">
                <div>
                  <span className="text-xs" style={{ color: t.textMuted }}>{label}</span>
                  <span className="text-[10px] ml-1" style={{ color: t.textMuted, opacity: 0.6 }}>{weight}%</span>
                </div>
                <span className="text-xs font-bold tabular-nums" style={{ color, fontFamily: typography.fontMono }}>
                  {value}%
                </span>
              </div>
            ))}
          </div>

          {/* Top performer */}
          {(summary.top_performer || summary.most_improved) && (
            <div className="px-4 py-3" style={{ borderTop: `1px solid ${t.border}` }}>
              {summary.top_performer && (
                <div className="flex items-center gap-2.5 mb-2">
                  <Avatar name={summary.top_performer.name} id={summary.top_performer.employee_id} size={28} />
                  <div className="min-w-0 flex-1">
                    <p className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: t.textMuted }}>Top</p>
                    <p className="text-xs font-semibold truncate" style={{ color: t.text }}>{summary.top_performer.name}</p>
                  </div>
                  <span className="text-sm font-bold tabular-nums" style={{ color: '#34D399', fontFamily: typography.fontMono }}>
                    {summary.top_performer.score}
                  </span>
                </div>
              )}
              {summary.most_improved && (
                <div className="flex items-center gap-2.5">
                  <Avatar name={summary.most_improved.name} id={summary.most_improved.employee_id} size={28} />
                  <div className="min-w-0 flex-1">
                    <p className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: t.textMuted }}>Improved</p>
                    <p className="text-xs font-semibold truncate" style={{ color: t.text }}>{summary.most_improved.name}</p>
                  </div>
                  {summary.most_improved.trend !== undefined && (
                    <span
                      className="text-xs font-bold tabular-nums flex items-center gap-0.5"
                      style={{ color: summary.most_improved.trend > 0 ? '#34D399' : '#EF4444', fontFamily: typography.fontMono }}
                    >
                      {summary.most_improved.trend > 0 ? <TrendingUp size={11} /> : <TrendingDown size={11} />}
                      {summary.most_improved.trend > 0 ? '+' : ''}{summary.most_improved.trend}
                    </span>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Needs attention */}
          {summary.needs_attention_count > 0 && (
            <div className="mx-4 mb-3 px-3 py-2 rounded-xl text-xs font-medium" style={{ borderTop: `1px solid ${t.border}`, background: 'rgba(212,64,64,0.06)', color: '#D44040', marginTop: summary.top_performer || summary.most_improved ? 0 : undefined }}>
              {summary.needs_attention_count} employee{summary.needs_attention_count > 1 ? 's' : ''} need attention
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
          className="flex items-center justify-center gap-1.5 w-full py-2 rounded-xl text-xs font-semibold transition-colors hover:opacity-80"
          style={{ background: t.surfaceHover, color: colors.accent }}
        >
          Full scorecard
          <ChevronRight size={13} />
        </Link>
      </div>
    </div>
  )
}
