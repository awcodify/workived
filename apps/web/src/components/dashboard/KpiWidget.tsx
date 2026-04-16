import React from 'react'
import type { Widget } from '@/types/api'
import { useExecuteQuery } from '@/lib/hooks/useDashboard'
import { moduleThemes, typography } from '@/design/tokens'

const t = moduleThemes.reports

interface Props {
  widget: Widget
  onEdit?: () => void
  onDelete?: () => void
  dateRange?: string
}

export function KpiWidget({ widget, onEdit, onDelete, dateRange }: Props) {
  const query = dateRange ? { ...widget.query_config, date_range: dateRange as typeof widget.query_config.date_range } : widget.query_config
  const { data, isLoading, isError } = useExecuteQuery(query)

  // group_by mode: data.rows has {group_key, value} — render breakdown list
  const isGrouped = !!(data?.rows?.length && 'group_key' in (data.rows[0] ?? {}))

  return (
    <div
      className="relative group h-full rounded-2xl p-5 flex flex-col gap-3 overflow-hidden"
      style={{ background: t.surface, border: `1px solid ${t.border}` }}
    >
      {/* Actions */}
      <div className="absolute top-3 right-3 hidden group-hover:flex gap-1">
        {onEdit && (
          <button
            onClick={onEdit}
            className="p-1.5 rounded-lg text-xs transition-colors hover:bg-black/5"
            style={{ color: t.textMuted }}
          >
            ✎
          </button>
        )}
        {onDelete && (
          <button
            onClick={onDelete}
            className="p-1.5 rounded-lg text-xs transition-colors hover:text-red-500 hover:bg-red-50"
            style={{ color: t.textMuted }}
          >
            ✕
          </button>
        )}
      </div>

      {/* Title */}
      <p className="text-xs font-medium uppercase tracking-widest pr-10" style={{ ...typography.label, color: t.textMuted }}>
        {widget.title}
      </p>

      {/* Value / Breakdown */}
      <div className="flex-1 min-h-0">
        {isLoading ? (
          <div className="flex flex-col gap-2">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="h-5 rounded animate-pulse" style={{ background: 'rgba(0,0,0,0.08)', width: `${60 + i * 15}%` }} />
            ))}
          </div>
        ) : isError ? (
          <span className="text-red-400 text-sm">Error</span>
        ) : isGrouped ? (
          <div className="flex flex-col gap-1.5 overflow-y-auto h-full">
            {(data!.rows as { group_key: unknown; value: unknown }[]).map((row, i) => {
              const label = String(row.group_key ?? '—')
              const val = typeof row.value === 'number' ? row.value : Number(row.value ?? 0)
              const total = (data!.rows as { value: unknown }[]).reduce((s, r) => s + (typeof r.value === 'number' ? r.value : Number(r.value ?? 0)), 0)
              const pct = total > 0 ? (val / total) * 100 : 0
              const color = widget.viz_config?.color ?? t.accent
              return (
                <div key={i} className="flex items-center gap-2 min-w-0">
                  <span className="text-xs w-24 shrink-0 truncate" style={{ color: t.textMuted }}>{label}</span>
                  <div className="flex-1 h-1.5 rounded-full overflow-hidden" style={{ background: 'rgba(0,0,0,0.06)' }}>
                    <div className="h-full rounded-full" style={{ width: `${pct}%`, background: color }} />
                  </div>
                  <span className="text-xs font-semibold tabular-nums shrink-0" style={{ color: t.text }}>
                    {formatKpiValue(val, widget.viz_config?.unit)}
                  </span>
                </div>
              )
            })}
          </div>
        ) : (
          <div className="flex items-end h-full">
            <span
              className="text-4xl font-bold"
              style={{ fontFamily: 'Plus Jakarta Sans', fontWeight: 800, color: t.text }}
            >
              {formatKpiValue(data?.value, widget.viz_config?.unit)}
            </span>
          </div>
        )}
      </div>

      {/* Unit label — scalar only */}
      {!isGrouped && widget.viz_config?.unit && (
        <p className="text-xs" style={{ color: t.textMuted }}>{widget.viz_config.unit}</p>
      )}
    </div>
  )
}

function formatKpiValue(value: number | undefined, unit?: string): string {
  if (value === undefined || value === null) return '—'
  if (unit === '%') return `${Math.round(value)}%`
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`
  if (value >= 1_000) return `${(value / 1_000).toFixed(1)}K`
  return String(Math.round(value * 100) / 100)
}
