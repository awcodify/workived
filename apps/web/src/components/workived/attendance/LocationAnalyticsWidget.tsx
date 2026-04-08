import { useState } from 'react'
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts'
import { useLocationAnalytics } from '@/lib/hooks/useAttendance'
import { moduleThemes, colors } from '@/design/tokens'
import { Skeleton } from '@/components/workived/shared/Skeleton'
import type { LocationBreakdownItem } from '@/types/api'

const t = moduleThemes.attendance

const LOCATION_META: Record<string, { label: string; color: string }> = {
  office:  { label: 'Office',  color: colors.ok },
  wfh:     { label: 'WFH',     color: colors.accent },
  remote:  { label: 'Remote',  color: colors.warn },
  wfa:     { label: 'Remote',  color: colors.warn },
  unknown: { label: 'Unknown', color: '#9CA3AF' },
}

function getMeta(type: string) {
  return LOCATION_META[type] ?? { label: type, color: '#9CA3AF' }
}

interface Props {
  className?: string
}

export function LocationAnalyticsWidget({ className }: Props) {
  const [period, setPeriod] = useState<'this_week' | 'this_month'>('this_week')
  const { data, isLoading } = useLocationAnalytics(period)

  return (
    <div
      className={className}
      style={{
        background: t.surface,
        borderRadius: 16,
        border: `1px solid ${t.border}`,
        padding: '20px 24px',
      }}
    >
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
        <div>
          <h3 style={{ fontSize: 13, fontWeight: 700, color: t.text, margin: 0 }}>
            Work Location
          </h3>
          {data && (
            <p style={{ fontSize: 11, color: t.textMuted, margin: '2px 0 0' }}>
              {data.total} clock-ins · {data.start_date} – {data.end_date}
            </p>
          )}
        </div>

        {/* Period toggle */}
        <div
          style={{
            display: 'flex',
            gap: 2,
            padding: 3,
            borderRadius: 8,
            background: t.border,
          }}
        >
          {(['this_week', 'this_month'] as const).map((p) => (
            <button
              key={p}
              onClick={() => setPeriod(p)}
              style={{
                padding: '4px 10px',
                borderRadius: 6,
                border: 'none',
                cursor: 'pointer',
                fontSize: 11,
                fontWeight: 700,
                background: period === p ? t.surface : 'transparent',
                color: period === p ? t.text : t.textMuted,
                transition: 'all 0.15s',
              }}
            >
              {p === 'this_week' ? 'Week' : 'Month'}
            </button>
          ))}
        </div>
      </div>

      {isLoading && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <Skeleton height={160} />
          <Skeleton height={16} width="60%" />
          <Skeleton height={16} width="45%" />
        </div>
      )}

      {!isLoading && data && data.total === 0 && (
        <div
          style={{
            textAlign: 'center',
            padding: '32px 0',
            color: t.textMuted,
            fontSize: 13,
          }}
        >
          No clock-in data for this period
        </div>
      )}

      {!isLoading && data && data.total > 0 && (
        <div style={{ display: 'flex', gap: 24, alignItems: 'center' }}>
          {/* Donut chart */}
          <div style={{ flexShrink: 0 }}>
            <ResponsiveContainer width={140} height={140}>
              <PieChart>
                <Pie
                  data={data.breakdown}
                  cx="50%"
                  cy="50%"
                  innerRadius={42}
                  outerRadius={62}
                  paddingAngle={2}
                  dataKey="count"
                  startAngle={90}
                  endAngle={-270}
                >
                  {data.breakdown.map((item: LocationBreakdownItem) => (
                    <Cell key={item.type} fill={getMeta(item.type).color} stroke="none" />
                  ))}
                </Pie>
                <Tooltip
                  formatter={(value: number, _: string, props: { payload?: LocationBreakdownItem }) => [
                    `${value} (${props.payload?.percentage ?? 0}%)`,
                    getMeta(props.payload?.type ?? '').label,
                  ]}
                  contentStyle={{
                    borderRadius: 8,
                    border: `1px solid ${t.border}`,
                    fontSize: 12,
                  }}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>

          {/* Legend + stats */}
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 8 }}>
            {data.breakdown.map((item: LocationBreakdownItem) => {
              const meta = getMeta(item.type)
              return (
                <div
                  key={item.type}
                  style={{ display: 'flex', alignItems: 'center', gap: 8 }}
                >
                  <div
                    style={{
                      width: 8,
                      height: 8,
                      borderRadius: '50%',
                      background: meta.color,
                      flexShrink: 0,
                    }}
                  />
                  <span style={{ fontSize: 13, color: t.text, flex: 1, fontWeight: 500 }}>
                    {meta.label}
                  </span>
                  <span style={{ fontSize: 13, fontWeight: 700, color: t.text }}>
                    {item.count}
                  </span>
                  <span
                    style={{
                      fontSize: 11,
                      color: t.textMuted,
                      width: 38,
                      textAlign: 'right',
                    }}
                  >
                    {item.percentage}%
                  </span>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
