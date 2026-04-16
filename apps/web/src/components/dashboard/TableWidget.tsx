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

export function TableWidget({ widget, onEdit, onDelete, dateRange }: Props) {
  const query = dateRange ? { ...widget.query_config, date_range: dateRange as typeof widget.query_config.date_range } : widget.query_config
  const { data, isLoading, isError } = useExecuteQuery(query)

  const columns = data?.columns ?? []
  const rows = data?.rows ?? []

  return (
    <div
      className="relative group h-full rounded-2xl flex flex-col overflow-hidden"
      style={{ background: t.surface, border: `1px solid ${t.border}` }}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-4" style={{ borderBottom: `1px solid ${t.border}` }}>
        <p className="text-xs font-medium uppercase tracking-widest" style={{ ...typography.label, color: t.textMuted }}>
          {widget.title}
        </p>
        <div className="hidden group-hover:flex gap-1">
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
      </div>

      {/* Body */}
      <div className="flex-1 overflow-auto">
        {isLoading ? (
          <div className="p-5 space-y-2">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="h-7 rounded-lg animate-pulse" style={{ background: 'rgba(0,0,0,0.06)' }} />
            ))}
          </div>
        ) : isError ? (
          <div className="p-5 text-sm text-red-500">Failed to load data</div>
        ) : rows.length === 0 ? (
          <div className="p-5 text-sm" style={{ color: t.textMuted }}>No results</div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr style={{ borderBottom: `1px solid ${t.border}` }}>
                {columns.map((col) => (
                  <th
                    key={col}
                    className="px-4 py-2.5 text-left text-xs font-medium uppercase tracking-wider"
                    style={{ color: t.textMuted }}
                  >
                    {col.replace(/_/g, ' ')}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row, i) => (
                <tr
                  key={i}
                  className="transition-colors"
                  style={{ borderBottom: `1px solid rgba(0,0,0,0.04)` }}
                  onMouseEnter={(e) => { e.currentTarget.style.background = t.surfaceHover }}
                  onMouseLeave={(e) => { e.currentTarget.style.background = '' }}
                >
                  {columns.map((col) => (
                    <td key={col} className="px-4 py-2.5 truncate max-w-[200px]" style={{ color: t.text }}>
                      {renderCell(row[col])}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}

function renderCell(value: unknown): React.ReactNode {
  if (value === null || value === undefined) return <span className="text-white/20">—</span>
  if (typeof value === 'boolean') return value ? 'Yes' : 'No'
  if (typeof value === 'string' && value.match(/^\d{4}-\d{2}-\d{2}/)) {
    return new Date(value).toLocaleDateString()
  }
  return String(value)
}
