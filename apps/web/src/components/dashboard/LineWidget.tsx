import React, { useMemo } from 'react'
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts'
import { Pencil, Trash2 } from 'lucide-react'
import type { Widget } from '@/types/api'
import { useExecuteQuery } from '@/lib/hooks/useDashboard'
import { moduleThemes } from '@/design/tokens'

const t = moduleThemes.reports

// Distinct palette for multi-series lines
const SERIES_COLORS = [
  '#6357E8', '#12A05C', '#C97B2A', '#D44040',
  '#3B82F6', '#8B5CF6', '#EC4899', '#14B8A6',
]

interface Props {
  widget: Widget
  onEdit?: () => void
  onDelete?: () => void
  dateRange?: string
}

function formatBucket(value: unknown): string {
  if (typeof value !== 'string') return String(value ?? '')
  const d = new Date(value)
  if (isNaN(d.getTime())) return String(value)
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
}

// Pivot [{bucket, series_key, value}] → [{bucket, [key]: value, ...}]
function pivotSeries(rows: Record<string, unknown>[]): {
  data: Record<string, unknown>[]
  seriesKeys: string[]
} {
  const bucketMap = new Map<string, Record<string, unknown>>()
  const keySet = new Set<string>()

  for (const row of rows) {
    const bucket = String(row.bucket ?? '')
    const key = String(row.series_key ?? '')
    const value = row.value

    keySet.add(key)
    if (!bucketMap.has(bucket)) bucketMap.set(bucket, { bucket })
    bucketMap.get(bucket)![key] = value
  }

  // Sort buckets chronologically
  const data = Array.from(bucketMap.values()).sort((a, b) =>
    String(a.bucket) < String(b.bucket) ? -1 : 1,
  )

  return { data, seriesKeys: Array.from(keySet).sort() }
}

export function LineWidget({ widget, onEdit, onDelete, dateRange }: Props) {
  const query = dateRange
    ? { ...widget.query_config, date_range: dateRange as typeof widget.query_config.date_range }
    : widget.query_config
  const { isLoading, isError, data } = useExecuteQuery(query)

  const isMultiSeries = !!(data?.rows?.length && 'series_key' in (data.rows[0] ?? {}))
  const { data: chartData, seriesKeys } = useMemo(() => {
    if (!isMultiSeries || !data?.rows) return { data: data?.rows ?? [], seriesKeys: [] }
    return pivotSeries(data.rows as Record<string, unknown>[])
  }, [isMultiSeries, data?.rows])

  const baseColor = widget.viz_config?.color ?? t.accent

  return (
    <div
      className="h-full rounded-2xl p-5 flex flex-col gap-3 group relative"
      style={{ background: t.surface, border: `1px solid ${t.border}` }}
    >
      {/* Header */}
      <div className="flex items-center justify-between min-h-[20px]">
        <p className="text-xs font-medium truncate pr-2" style={{ color: t.textMuted }}>{widget.title}</p>
        {(onEdit || onDelete) && (
          <div className="hidden group-hover:flex gap-1 flex-shrink-0">
            {onEdit && (
              <button
                onClick={onEdit}
                className="p-1 rounded-lg transition-colors hover:bg-black/5"
                style={{ color: t.textMuted }}
              >
                <Pencil size={12} />
              </button>
            )}
            {onDelete && (
              <button
                onClick={onDelete}
                className="p-1 rounded-lg transition-colors hover:text-red-500 hover:bg-red-50"
                style={{ color: t.textMuted }}
              >
                <Trash2 size={12} />
              </button>
            )}
          </div>
        )}
      </div>

      {/* Chart */}
      <div className="flex-1 min-h-0">
        {isLoading ? (
          <div className="h-full rounded-xl animate-pulse" style={{ background: 'rgba(0,0,0,0.06)' }} />
        ) : isError ? (
          <div className="h-full flex items-center justify-center text-red-500 text-xs">
            Failed to load data
          </div>
        ) : !data?.rows?.length ? (
          <div className="h-full flex items-center justify-center text-xs" style={{ color: t.textMuted }}>
            No data
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <LineChart
              data={isMultiSeries ? chartData : data.rows}
              margin={{ top: 4, right: 4, left: -20, bottom: 0 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.06)" />
              <XAxis
                dataKey="bucket"
                tickFormatter={formatBucket}
                tick={{ fill: 'rgba(0,0,0,0.4)', fontSize: 10 }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                tick={{ fill: 'rgba(0,0,0,0.4)', fontSize: 10 }}
                axisLine={false}
                tickLine={false}
              />
              <Tooltip
                labelFormatter={formatBucket}
                contentStyle={{
                  background: '#fff',
                  border: `1px solid ${t.border}`,
                  borderRadius: 8,
                  fontSize: 12,
                  color: t.text,
                }}
              />
              {isMultiSeries ? (
                <>
                  <Legend
                    wrapperStyle={{ fontSize: 10, color: t.textMuted, paddingTop: 4 }}
                  />
                  {seriesKeys.map((key, i) => (
                    <Line
                      key={key}
                      type="monotone"
                      dataKey={key}
                      name={key}
                      stroke={SERIES_COLORS[i % SERIES_COLORS.length]}
                      strokeWidth={2}
                      dot={false}
                      activeDot={{ r: 4 }}
                      connectNulls
                    />
                  ))}
                </>
              ) : (
                <Line
                  type="monotone"
                  dataKey="value"
                  stroke={baseColor}
                  strokeWidth={2}
                  dot={false}
                  activeDot={{ r: 4, fill: baseColor }}
                />
              )}
            </LineChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  )
}
