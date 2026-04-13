import { useState } from 'react'
import { useMyScorecard } from '@/lib/hooks/useReports'
import { typography, gradeColors, gradeColorsDim, getAvatarColor } from '@/design/tokens'
import {
  X,
  TrendingUp,
  TrendingDown,
  Minus,
  AlertTriangle,
  Info,
} from 'lucide-react'
import type { Grade } from '@/design/tokens'
import type { Scorecard, ScorecardFlag } from '@/types/api'

const S = {
  text: '#F0F0FF',
  textMuted: 'rgba(255,255,255,0.4)',
  textDim: 'rgba(255,255,255,0.35)',
}

const PERIODS = [
  { key: 'this_month', label: 'This Month' },
  { key: 'this_quarter', label: 'Quarter' },
  { key: 'this_year', label: 'Year' },
] as const

const SIGNAL_LABELS: Record<string, string> = {
  attendance: 'Attendance',
  punctuality: 'Punctuality',
  leave: 'Leave',
  tasks: 'Tasks',
  claims: 'Claims',
}

interface Props {
  isOpen: boolean
  onClose: () => void
}

export function EmployeeScorecardPanel({ isOpen, onClose }: Props) {
  const [period, setPeriod] = useState('this_month')
  const { data: scorecard, isLoading, error } = useMyScorecard(period)

  if (!isOpen) return null

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-40"
        style={{ background: 'rgba(0,0,0,0.5)' }}
        onClick={onClose}
      />

      {/* Panel */}
      <div
        className="fixed right-0 top-0 bottom-0 z-50 w-full max-w-md overflow-y-auto"
        style={{ background: '#0F0F1A', borderLeft: '1px solid rgba(255,255,255,0.06)' }}
      >
        <div className="p-6">
          {/* Close */}
          <button onClick={onClose} className="mb-6 p-1 rounded-lg hover:bg-white/[0.06] transition-colors">
            <X size={18} style={{ color: S.textMuted }} />
          </button>

          {/* Period Toggle */}
          <div className="flex items-center gap-1 p-1 rounded-xl mb-6 w-fit" style={{ background: 'rgba(255,255,255,0.06)' }}>
            {PERIODS.map((p) => (
              <button
                key={p.key}
                onClick={() => setPeriod(p.key)}
                className="px-3 py-1 rounded-lg text-[11px] font-semibold transition-colors"
                style={{
                  background: period === p.key ? 'rgba(255,255,255,0.15)' : 'transparent',
                  color: period === p.key ? '#FFFFFF' : 'rgba(255,255,255,0.35)',
                }}
              >
                {p.label}
              </button>
            ))}
          </div>

          {/* Loading */}
          {isLoading && <ScorecardSkeleton />}

          {/* Error */}
          {error && !isLoading && (
            <div className="rounded-xl p-6 text-center" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(212,64,64,0.2)' }}>
              <AlertTriangle size={24} style={{ color: '#EF4444', margin: '0 auto 8px' }} />
              <p className="text-sm font-semibold" style={{ color: S.text }}>Failed to load scorecard</p>
            </div>
          )}

          {/* Scorecard */}
          {scorecard && !isLoading && (
            <ScorecardContent scorecard={scorecard} />
          )}
        </div>
      </div>
    </>
  )
}

function ScorecardContent({ scorecard }: { scorecard: Scorecard }) {
  const grade = scorecard.grade as Grade
  const avatarColor = getAvatarColor(scorecard.employee_id)

  return (
    <>
      {/* Employee Info */}
      <div className="flex items-center gap-3 mb-8">
        <div
          className="w-12 h-12 rounded-xl flex items-center justify-center text-lg font-bold flex-shrink-0"
          style={{ background: avatarColor.bg, color: avatarColor.text }}
        >
          {scorecard.employee_name.charAt(0)}
        </div>
        <div>
          <p className="text-base font-bold" style={{ color: S.text }}>{scorecard.employee_name}</p>
          <p className="text-xs" style={{ color: S.textMuted }}>{scorecard.department} · {scorecard.period_label}</p>
        </div>
      </div>

      {/* Score Ring */}
      <div className="flex flex-col items-center mb-8">
        <ScoreRing score={scorecard.overall_score} grade={grade} />
        <div className="flex items-center gap-2 mt-4">
          <div
            className="w-7 h-7 rounded-lg flex items-center justify-center text-xs font-bold"
            style={{ background: gradeColorsDim[grade], color: gradeColors[grade] }}
          >
            {grade}
          </div>
          <TrendBadge value={scorecard.trend} />
        </div>
      </div>

      {/* Insufficient Data Banner */}
      {!scorecard.sufficient && (
        <div
          className="flex items-center gap-2.5 px-4 py-3 rounded-xl mb-6"
          style={{ background: 'rgba(255,183,77,0.08)', border: '1px solid rgba(255,183,77,0.15)' }}
        >
          <Info size={14} style={{ color: '#F59E0B' }} />
          <span className="text-xs font-medium" style={{ color: '#F59E0B' }}>
            Not enough working days for a reliable score
          </span>
        </div>
      )}

      {/* Breakdown */}
      <div className="mb-6">
        <h3 className="text-xs font-bold uppercase tracking-wider mb-4" style={{ color: S.textDim }}>Breakdown</h3>
        <div className="flex flex-col gap-4">
          {Object.entries(scorecard.breakdown).map(([key, bd]) => {
            const barGrade = getGrade(bd.score)
            return (
              <div key={key}>
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-xs font-semibold" style={{ color: 'rgba(255,255,255,0.7)' }}>
                    {SIGNAL_LABELS[key] ?? key}
                  </span>
                  <span className="text-xs font-bold" style={{ color: gradeColors[barGrade], fontFamily: typography.fontMono }}>
                    {bd.score}
                  </span>
                </div>
                <div className="h-1.5 rounded-full" style={{ background: 'rgba(255,255,255,0.06)' }}>
                  <div
                    className="h-full rounded-full transition-all"
                    style={{ width: `${bd.score}%`, background: gradeColors[barGrade] }}
                  />
                </div>
                <p className="text-[11px] mt-1" style={{ color: S.textDim }}>{bd.detail}</p>
              </div>
            )
          })}
        </div>
      </div>

      {/* Flags */}
      {scorecard.flags.length > 0 && (
        <div>
          <h3 className="text-xs font-bold uppercase tracking-wider mb-3" style={{ color: S.textDim }}>Flags</h3>
          <div className="flex flex-col gap-2">
            {scorecard.flags.map((flag, idx) => (
              <FlagRow key={idx} flag={flag} />
            ))}
          </div>
        </div>
      )}
    </>
  )
}

// ── Score Ring ──────────────────────────────────────────────

function ScoreRing({ score, grade }: { score: number; grade: Grade }) {
  const size = 120
  const strokeWidth = 8
  const r = (size - strokeWidth) / 2
  const circumference = 2 * Math.PI * r
  const offset = circumference - (score / 100) * circumference

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      {/* Track */}
      <circle
        cx={size / 2}
        cy={size / 2}
        r={r}
        fill="none"
        stroke="rgba(255,255,255,0.06)"
        strokeWidth={strokeWidth}
      />
      {/* Fill */}
      <circle
        cx={size / 2}
        cy={size / 2}
        r={r}
        fill="none"
        stroke={gradeColors[grade]}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeDasharray={circumference}
        strokeDashoffset={offset}
        transform={`rotate(-90 ${size / 2} ${size / 2})`}
        style={{ transition: 'stroke-dashoffset 0.6s ease' }}
      />
      {/* Score text */}
      <text
        x={size / 2}
        y={size / 2 + 2}
        textAnchor="middle"
        dominantBaseline="middle"
        fill={S.text}
        fontSize={32}
        fontWeight={800}
        fontFamily={typography.fontMono}
      >
        {score}
      </text>
    </svg>
  )
}

// ── Flag Row ───────────────────────────────────────────────

function FlagRow({ flag }: { flag: ScorecardFlag }) {
  const flagColor = flag.severity === 'alert' ? '#EF4444' : '#F59E0B'
  return (
    <div className="flex items-start gap-2.5 px-3 py-2.5 rounded-xl" style={{ background: `${flagColor}08` }}>
      <div className="w-[7px] h-[7px] rounded-[2px] flex-shrink-0 mt-1" style={{ background: flagColor }} />
      <span className="text-xs font-medium" style={{ color: flagColor }}>{flag.message}</span>
    </div>
  )
}

// ── Helpers ─────────────────────────────────────────────────

function TrendBadge({ value }: { value: number }) {
  if (value === 0) return <span className="text-xs" style={{ color: S.textDim }}>No change</span>
  const isUp = value > 0
  const Icon = isUp ? TrendingUp : TrendingDown
  return (
    <span className="flex items-center gap-1 text-xs font-bold" style={{ color: isUp ? '#34D399' : '#EF4444' }}>
      <Icon size={14} />
      {isUp ? '+' : ''}{value} pts vs prev period
    </span>
  )
}

function ScorecardSkeleton() {
  const pulse = 'animate-pulse rounded-xl'
  const bg = 'rgba(255,255,255,0.04)'
  return (
    <div className="flex flex-col items-center gap-6">
      <div className={`${pulse} w-12 h-12`} style={{ background: bg }} />
      <div className={`${pulse} w-[120px] h-[120px] rounded-full`} style={{ background: bg }} />
      <div className="w-full flex flex-col gap-4">
        {[...Array(5)].map((_, i) => (
          <div key={i}>
            <div className={`${pulse} w-24 h-3 mb-2`} style={{ background: bg }} />
            <div className={`${pulse} w-full h-1.5`} style={{ background: bg }} />
          </div>
        ))}
      </div>
    </div>
  )
}

function getGrade(score: number): Grade {
  if (score >= 90) return 'A'
  if (score >= 75) return 'B'
  if (score >= 60) return 'C'
  return 'D'
}
