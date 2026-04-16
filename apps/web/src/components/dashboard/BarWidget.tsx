import React from 'react'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts'
import { Pencil, Trash2 } from 'lucide-react'
import type { Widget } from '@/types/api'
import { useExecuteQuery } from '@/lib/hooks/useDashboard'
import { moduleThemes } from '@/design/tokens'

const t = moduleThemes.reports

interface Props {
  widget: Widget
  onEdit?: () => void
  onDelete?: () => void
  dateRange?: string
}

export function BarWidget({ widget, onEdit, onDelete, dateRange }: Props) {
  const query = dateRange ? { ...widget.query_config, date_range: dateRange as typeof widget.query_config.date_range } : widget.query_config
  const { isLoading, isError, data } = useExecuteQuery(query)

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
            <BarChart data={data.rows} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.06)" />
              <XAxis
                dataKey="group_key"
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
                contentStyle={{
                  background: '#fff',
                  border: `1px solid ${t.border}`,
                  borderRadius: 8,
                  fontSize: 12,
                  color: t.text,
                }}
                cursor={{ fill: `${t.accent}10` }}
              />
              <Bar
                dataKey="value"
                fill={widget.viz_config?.color ?? t.accent}
                radius={[4, 4, 0, 0]}
              />
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  )
}
