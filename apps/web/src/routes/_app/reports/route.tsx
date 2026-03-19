import { createFileRoute, redirect } from '@tanstack/react-router'
import { apiClient } from '@/lib/api/client'
import { moduleBackgrounds, typography } from '@/design/tokens'
import {
  Clock,
  Users,
  Receipt,
  CalendarOff,
  TrendingUp,
  TrendingDown,
  ArrowRight,
  BarChart3,
} from 'lucide-react'

export const Route = createFileRoute('/_app/reports')({
  loader: async () => {
    try {
      const { data } = await apiClient.get<{ data: Record<string, boolean> }>('/api/v1/features')
      if (data.data.reports === false) {
        throw redirect({ to: '/feature-disabled' })
      }
    } catch (err) {
      // Re-throw TanStack Router redirects; ignore network errors (fail open)
      if (err && typeof err === 'object' && 'to' in err) throw err
    }
  },
  component: ReportsPage,
})

// ── Types ───────────────────────────────────────────────────────

interface MetricCard {
  label: string
  value: string
  change: number
  icon: React.ElementType
  accent: string
}

interface ChartBar {
  label: string
  value: number
  max: number
}

// ── Dummy Data ──────────────────────────────────────────────────

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

const SUMMARY_CARDS: MetricCard[] = [
  { label: 'Attendance Rate', value: '94.2%', change: 2.1, icon: Clock, accent: '#34D399' },
  { label: 'Total Employees', value: '24', change: 4.2, icon: Users, accent: '#818CF8' },
  { label: 'Claims Submitted', value: '18', change: -8.3, icon: Receipt, accent: '#F59E0B' },
  { label: 'Leave Taken', value: '42 days', change: 12.5, icon: CalendarOff, accent: '#F472B6' },
]

const ATTENDANCE_TREND: ChartBar[] = [
  { label: 'Jan', value: 91, max: 100 },
  { label: 'Feb', value: 88, max: 100 },
  { label: 'Mar', value: 94, max: 100 },
  { label: 'Apr', value: 92, max: 100 },
  { label: 'May', value: 96, max: 100 },
  { label: 'Jun', value: 93, max: 100 },
]

const DEPARTMENT_BREAKDOWN = [
  { name: 'Engineering', attendance: 96, employees: 8, claims: 4200000 },
  { name: 'Operations', attendance: 93, employees: 6, claims: 2800000 },
  { name: 'Marketing', attendance: 91, employees: 5, claims: 1500000 },
  { name: 'Finance', attendance: 98, employees: 3, claims: 900000 },
  { name: 'HR', attendance: 95, employees: 2, claims: 600000 },
]

const LEAVE_BY_TYPE = [
  { type: 'Annual', days: 18, color: '#818CF8' },
  { type: 'Sick', days: 12, color: '#F472B6' },
  { type: 'Personal', days: 8, color: '#F59E0B' },
  { type: 'Maternity', days: 4, color: '#34D399' },
]

const RECENT_CLAIMS = [
  { id: '1', employee: 'Ahmad Rizki', category: 'Transport', amount: 350000, status: 'approved' },
  { id: '2', employee: 'Sarah Putri', category: 'Meals', amount: 180000, status: 'pending' },
  { id: '3', employee: 'Budi Santoso', category: 'Equipment', amount: 2400000, status: 'approved' },
  { id: '4', employee: 'Maya Dewi', category: 'Transport', amount: 275000, status: 'rejected' },
  { id: '5', employee: 'Adi Nugroho', category: 'Training', amount: 1500000, status: 'pending' },
]

// ── Main Component ──────────────────────────────────────────────

function ReportsPage() {
  const now = new Date()
  const monthLabel = `${MONTHS[now.getMonth()]} ${now.getFullYear()}`

  return (
    <div
      className="min-h-screen px-6 py-8 md:px-11 md:py-10 pb-28"
      style={{ background: moduleBackgrounds.reports }}
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1
            className="font-extrabold"
            style={{ fontSize: 44, letterSpacing: '-0.05em', color: '#F0F0FF', lineHeight: 1 }}
          >
            Reports
          </h1>
          <p className="mt-2" style={{ fontSize: 14, color: 'rgba(255,255,255,0.4)' }}>
            Analytics & insights · {monthLabel}
          </p>
        </div>
        <div
          className="flex items-center gap-2 px-3 py-1.5 rounded-lg"
          style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.08)' }}
        >
          <BarChart3 size={14} style={{ color: 'rgba(255,255,255,0.5)' }} />
          <span className="text-xs font-medium" style={{ color: 'rgba(255,255,255,0.5)' }}>
            {monthLabel}
          </span>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-8">
        {SUMMARY_CARDS.map((card) => (
          <SummaryCard key={card.label} card={card} />
        ))}
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
        <GlassCard title="Attendance Trend" subtitle="Last 6 months">
          <div className="flex items-end gap-2 h-32 mt-4">
            {ATTENDANCE_TREND.map((bar) => (
              <div key={bar.label} className="flex-1 flex flex-col items-center gap-1.5">
                <span
                  className="text-[10px] font-bold"
                  style={{ color: 'rgba(255,255,255,0.5)', fontFamily: typography.fontMono }}
                >
                  {bar.value}%
                </span>
                <div className="w-full rounded-t-md" style={{ position: 'relative', height: '100%' }}>
                  <div
                    className="absolute bottom-0 w-full rounded-md transition-all"
                    style={{
                      height: `${(bar.value / bar.max) * 100}%`,
                      background: bar.value >= 93
                        ? 'linear-gradient(to top, #34D399, #34D39960)'
                        : 'linear-gradient(to top, #F59E0B, #F59E0B60)',
                    }}
                  />
                </div>
                <span className="text-[10px] font-medium" style={{ color: 'rgba(255,255,255,0.3)' }}>
                  {bar.label}
                </span>
              </div>
            ))}
          </div>
        </GlassCard>

        <GlassCard title="Leave by Type" subtitle={`${LEAVE_BY_TYPE.reduce((s, l) => s + l.days, 0)} total days`}>
          <div className="flex flex-col gap-3 mt-4">
            {LEAVE_BY_TYPE.map((item) => {
              const total = LEAVE_BY_TYPE.reduce((s, l) => s + l.days, 0)
              const pct = Math.round((item.days / total) * 100)
              return (
                <div key={item.type}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-semibold" style={{ color: 'rgba(255,255,255,0.7)' }}>
                      {item.type}
                    </span>
                    <span
                      className="text-xs font-bold"
                      style={{ color: item.color, fontFamily: typography.fontMono }}
                    >
                      {item.days}d · {pct}%
                    </span>
                  </div>
                  <div className="h-1.5 rounded-full" style={{ background: 'rgba(255,255,255,0.06)' }}>
                    <div
                      className="h-full rounded-full transition-all"
                      style={{ width: `${pct}%`, background: item.color }}
                    />
                  </div>
                </div>
              )
            })}
          </div>
        </GlassCard>
      </div>

      {/* Department Table + Recent Claims */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <GlassCard title="By Department" subtitle="Attendance & claims">
          <div className="mt-4">
            <div className="flex items-center gap-2 mb-3 px-1">
              <span className="text-[10px] font-bold uppercase tracking-wider flex-1" style={{ color: 'rgba(255,255,255,0.3)' }}>
                Department
              </span>
              <span className="text-[10px] font-bold uppercase tracking-wider w-16 text-center" style={{ color: 'rgba(255,255,255,0.3)' }}>
                Attend.
              </span>
              <span className="text-[10px] font-bold uppercase tracking-wider w-12 text-center" style={{ color: 'rgba(255,255,255,0.3)' }}>
                Staff
              </span>
              <span className="text-[10px] font-bold uppercase tracking-wider w-20 text-right" style={{ color: 'rgba(255,255,255,0.3)' }}>
                Claims
              </span>
            </div>
            {DEPARTMENT_BREAKDOWN.map((dept) => (
              <div
                key={dept.name}
                className="flex items-center gap-2 px-1 py-2 rounded-lg hover:bg-white/[0.03] transition-colors"
              >
                <span className="text-xs font-semibold flex-1" style={{ color: 'rgba(255,255,255,0.8)' }}>
                  {dept.name}
                </span>
                <span
                  className="text-xs font-bold w-16 text-center"
                  style={{
                    color: dept.attendance >= 95 ? '#34D399' : dept.attendance >= 92 ? '#F59E0B' : '#F472B6',
                    fontFamily: typography.fontMono,
                  }}
                >
                  {dept.attendance}%
                </span>
                <span
                  className="text-xs w-12 text-center"
                  style={{ color: 'rgba(255,255,255,0.5)', fontFamily: typography.fontMono }}
                >
                  {dept.employees}
                </span>
                <span
                  className="text-xs font-medium w-20 text-right"
                  style={{ color: 'rgba(255,255,255,0.5)', fontFamily: typography.fontMono }}
                >
                  {(dept.claims / 1000).toFixed(0)}K
                </span>
              </div>
            ))}
          </div>
        </GlassCard>

        <GlassCard title="Recent Claims" subtitle="Last 5 submissions">
          <div className="flex flex-col gap-2 mt-4">
            {RECENT_CLAIMS.map((claim) => (
              <div
                key={claim.id}
                className="flex items-center gap-3 px-2 py-2 rounded-lg hover:bg-white/[0.03] transition-colors"
              >
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold truncate" style={{ color: 'rgba(255,255,255,0.8)' }}>
                    {claim.employee}
                  </p>
                  <p className="text-[11px]" style={{ color: 'rgba(255,255,255,0.35)' }}>
                    {claim.category}
                  </p>
                </div>
                <span
                  className="text-xs font-bold"
                  style={{ color: 'rgba(255,255,255,0.7)', fontFamily: typography.fontMono }}
                >
                  {new Intl.NumberFormat('id-ID').format(claim.amount)}
                </span>
                <StatusBadge status={claim.status} />
              </div>
            ))}
          </div>
        </GlassCard>
      </div>
    </div>
  )
}

// ── Subcomponents ───────────────────────────────────────────────

function SummaryCard({ card }: { card: MetricCard }) {
  const isPositive = card.change >= 0
  const TrendIcon = isPositive ? TrendingUp : TrendingDown

  return (
    <div
      className="rounded-xl p-4"
      style={{
        background: 'rgba(255,255,255,0.04)',
        border: '1px solid rgba(255,255,255,0.06)',
      }}
    >
      <div className="flex items-center justify-between mb-3">
        <div
          className="w-8 h-8 rounded-lg flex items-center justify-center"
          style={{ background: card.accent + '15' }}
        >
          <card.icon size={16} style={{ color: card.accent }} />
        </div>
        <div className="flex items-center gap-1">
          <TrendIcon size={12} style={{ color: isPositive ? '#34D399' : '#F87171' }} />
          <span
            className="text-[11px] font-bold"
            style={{
              color: isPositive ? '#34D399' : '#F87171',
              fontFamily: typography.fontMono,
            }}
          >
            {isPositive ? '+' : ''}{card.change}%
          </span>
        </div>
      </div>
      <p
        className="text-xl font-extrabold"
        style={{ color: '#F0F0FF', fontFamily: typography.fontMono }}
      >
        {card.value}
      </p>
      <p className="text-[11px] font-medium mt-0.5" style={{ color: 'rgba(255,255,255,0.4)' }}>
        {card.label}
      </p>
    </div>
  )
}

function GlassCard({
  title,
  subtitle,
  children,
}: {
  title: string
  subtitle: string
  children: React.ReactNode
}) {
  return (
    <div
      className="rounded-2xl p-5"
      style={{
        background: 'rgba(255,255,255,0.03)',
        border: '1px solid rgba(255,255,255,0.06)',
      }}
    >
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-bold" style={{ color: 'rgba(255,255,255,0.85)' }}>
            {title}
          </h3>
          <p className="text-[11px] mt-0.5" style={{ color: 'rgba(255,255,255,0.35)' }}>
            {subtitle}
          </p>
        </div>
        <ArrowRight size={14} style={{ color: 'rgba(255,255,255,0.2)' }} />
      </div>
      {children}
    </div>
  )
}

function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, { bg: string; color: string }> = {
    approved: { bg: 'rgba(52,211,153,0.12)', color: '#34D399' },
    pending: { bg: 'rgba(245,158,11,0.12)', color: '#F59E0B' },
    rejected: { bg: 'rgba(244,114,182,0.12)', color: '#F472B6' },
  }
  const s = styles[status] ?? styles.pending!

  return (
    <span
      className="text-[10px] font-bold uppercase px-2 py-0.5 rounded-md"
      style={{ background: s.bg, color: s.color }}
    >
      {status}
    </span>
  )
}
