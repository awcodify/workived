import React from 'react'
import type { Widget } from '@/types/api'
import { useExecuteQuery } from '@/lib/hooks/useDashboard'
import { typography } from '@/design/tokens'

interface Props {
  widget: Widget
  onEdit?: () => void
  onDelete?: () => void
}

export function TableWidget({ widget, onEdit, onDelete }: Props) {
  const { data, isLoading, isError } = useExecuteQuery(widget.query_config)

  const columns = data?.columns ?? []
  const rows = data?.rows ?? []

  return (
    <div
      className="relative group rounded-2xl flex flex-col overflow-hidden"
      style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)' }}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-white/5">
        <p className="text-xs font-medium text-white/50 uppercase tracking-widest" style={typography.label}>
          {widget.title}
        </p>
        <div className="hidden group-hover:flex gap-1">
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
      </div>

      {/* Body */}
      <div className="flex-1 overflow-auto">
        {isLoading ? (
          <div className="p-5 space-y-2">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="h-7 rounded-lg bg-white/5 animate-pulse" />
            ))}
          </div>
        ) : isError ? (
          <div className="p-5 text-sm text-red-400">Failed to load data</div>
        ) : rows.length === 0 ? (
          <div className="p-5 text-sm text-white/30">No results</div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/5">
                {columns.map((col) => (
                  <th
                    key={col}
                    className="px-4 py-2.5 text-left text-xs font-medium text-white/40 uppercase tracking-wider"
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
                  className="border-b border-white/[0.03] hover:bg-white/[0.03] transition-colors"
                >
                  {columns.map((col) => (
                    <td key={col} className="px-4 py-2.5 text-white/70 truncate max-w-[200px]">
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
