import React from 'react'
import type { Widget } from '@/types/api'
import { useExecuteQuery } from '@/lib/hooks/useDashboard'
import { typography } from '@/design/tokens'

interface Props {
  widget: Widget
  onEdit?: () => void
  onDelete?: () => void
}

export function KpiWidget({ widget, onEdit, onDelete }: Props) {
  const { data, isLoading, isError } = useExecuteQuery(widget.query_config)

  return (
    <div
      className="relative group rounded-2xl p-5 flex flex-col gap-3"
      style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)' }}
    >
      {/* Actions */}
      <div className="absolute top-3 right-3 hidden group-hover:flex gap-1">
        {onEdit && (
          <button
            onClick={onEdit}
            className="p-1.5 rounded-lg text-xs text-white/40 hover:text-white hover:bg-white/10 transition-colors"
          >
            ✎
          </button>
        )}
        {onDelete && (
          <button
            onClick={onDelete}
            className="p-1.5 rounded-lg text-xs text-white/40 hover:text-red-400 hover:bg-red-400/10 transition-colors"
          >
            ✕
          </button>
        )}
      </div>

      {/* Title */}
      <p className="text-xs font-medium text-white/50 uppercase tracking-widest" style={typography.label}>
        {widget.title}
      </p>

      {/* Value */}
      <div className="flex-1 flex items-end">
        {isLoading ? (
          <div className="w-16 h-9 rounded-lg bg-white/5 animate-pulse" />
        ) : isError ? (
          <span className="text-red-400 text-sm">Error</span>
        ) : (
          <span
            className="text-4xl font-bold text-white"
            style={{ fontFamily: 'Plus Jakarta Sans', fontWeight: 800 }}
          >
            {formatKpiValue(data?.value, widget.viz_config?.unit)}
          </span>
        )}
      </div>

      {/* Unit label */}
      {widget.viz_config?.unit && (
        <p className="text-xs text-white/30">{widget.viz_config.unit}</p>
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
