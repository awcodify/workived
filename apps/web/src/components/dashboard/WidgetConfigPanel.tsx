import React, { useState } from 'react'
import type { QueryConfig, VizConfig, WidgetType, AggregateType, FilterOp, QueryFilter } from '@/types/api'
import { useExecuteQuery } from '@/lib/hooks/useDashboard'
import { useFieldDefinitions } from '@/lib/hooks/useTasks'

const TASK_FIELDS = [
  { key: 'title', label: 'Title' },
  { key: 'status', label: 'Status' },
  { key: 'assignee_name', label: 'Assignee' },
  { key: 'priority', label: 'Priority' },
  { key: 'due_date', label: 'Due Date' },
  { key: 'created_at', label: 'Created At' },
  { key: 'completed_at', label: 'Completed At' },
  { key: 'is_completed', label: 'Is Completed' },
]

const AGGREGATES: { value: AggregateType; label: string }[] = [
  { value: 'count', label: 'Count' },
  { value: 'count_distinct', label: 'Count Distinct' },
  { value: 'sum', label: 'Sum' },
  { value: 'avg', label: 'Average' },
  { value: 'min', label: 'Min' },
  { value: 'max', label: 'Max' },
]

const FILTER_OPS: { value: FilterOp; label: string }[] = [
  { value: 'eq', label: '=' },
  { value: 'neq', label: '≠' },
  { value: 'gt', label: '>' },
  { value: 'gte', label: '≥' },
  { value: 'lt', label: '<' },
  { value: 'lte', label: '≤' },
  { value: 'in', label: 'in' },
  { value: 'is_null', label: 'is empty' },
  { value: 'not_null', label: 'is not empty' },
]

const DATE_RANGES = [
  { value: 'today', label: 'Today' },
  { value: 'this_week', label: 'This Week' },
  { value: 'this_month', label: 'This Month' },
  { value: 'last_30_days', label: 'Last 30 Days' },
  { value: 'this_quarter', label: 'This Quarter' },
  { value: 'this_year', label: 'This Year' },
]

interface Props {
  initialTitle?: string
  initialType?: WidgetType
  initialQuery?: QueryConfig
  initialViz?: VizConfig
  onSave: (title: string, type: WidgetType, query: QueryConfig, viz: VizConfig) => void
  onCancel: () => void
  saving?: boolean
}

export function WidgetConfigPanel({
  initialTitle = '',
  initialType = 'kpi',
  initialQuery = { source: 'tasks', aggregate: 'count' },
  initialViz = {},
  onSave,
  onCancel,
  saving,
}: Props) {
  const [title, setTitle] = useState(initialTitle)
  const [widgetType, setWidgetType] = useState<WidgetType>(initialType)
  const [query, setQuery] = useState<QueryConfig>(initialQuery)
  const [viz, setViz] = useState<VizConfig>(initialViz)
  const [preview, setPreview] = useState(false)

  const { data: fieldDefs } = useFieldDefinitions()

  const allFields = [
    ...TASK_FIELDS,
    ...(fieldDefs ?? [])
      .filter((f) => f.is_active)
      .map((f) => ({ key: `field:${f.id}`, label: f.name })),
  ]

  const { data: previewResult, isLoading: previewLoading, isError: previewError } = useExecuteQuery(
    { ...query, limit: 5 },
    preview && !!query.source,
  )

  const patchQuery = (patch: Partial<QueryConfig>) => setQuery((q) => ({ ...q, ...patch }))

  const addFilter = () => {
    patchQuery({ filters: [...(query.filters ?? []), { field: 'priority', op: 'eq', value: '' }] })
  }

  const updateFilter = (i: number, patch: Partial<QueryFilter>) => {
    const filters = [...(query.filters ?? [])]
    filters[i] = { ...filters[i], ...patch }
    patchQuery({ filters })
  }

  const removeFilter = (i: number) => {
    patchQuery({ filters: query.filters?.filter((_, idx) => idx !== i) })
  }

  const handleSave = () => {
    if (!title.trim()) return
    onSave(title, widgetType, query, viz)
  }

  return (
    <div className="flex flex-col gap-5 p-6 text-white">
      {/* Title */}
      <div className="flex flex-col gap-1.5">
        <label className="text-xs text-white/50 uppercase tracking-wider">Widget Title</label>
        <input
          className="bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm text-white placeholder-white/20 focus:outline-none focus:border-white/30"
          placeholder="e.g. Total Tasks This Month"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
        />
      </div>

      {/* Widget type */}
      <div className="flex flex-col gap-1.5">
        <label className="text-xs text-white/50 uppercase tracking-wider">Type</label>
        <div className="flex gap-2">
          {(['kpi', 'table'] as WidgetType[]).map((t) => (
            <button
              key={t}
              onClick={() => setWidgetType(t)}
              className={`px-4 py-2 rounded-xl text-sm font-medium transition-colors ${
                widgetType === t
                  ? 'bg-[#6357E8] text-white'
                  : 'bg-white/5 text-white/50 hover:bg-white/10'
              }`}
            >
              {t.toUpperCase()}
            </button>
          ))}
        </div>
      </div>

      {/* KPI config */}
      {widgetType === 'kpi' && (
        <div className="flex flex-col gap-3">
          <div className="flex flex-col gap-1.5">
            <label className="text-xs text-white/50 uppercase tracking-wider">Aggregate</label>
            <select
              className="bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm text-white"
              value={query.aggregate ?? 'count'}
              onChange={(e) => patchQuery({ aggregate: e.target.value as AggregateType })}
            >
              {AGGREGATES.map((a) => (
                <option key={a.value} value={a.value} className="bg-[#1a1a2e]">{a.label}</option>
              ))}
            </select>
          </div>

          {query.aggregate !== 'count' && (
            <div className="flex flex-col gap-1.5">
              <label className="text-xs text-white/50 uppercase tracking-wider">Field</label>
              <select
                className="bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm text-white"
                value={query.field ?? ''}
                onChange={(e) => patchQuery({ field: e.target.value })}
              >
                <option value="" className="bg-[#1a1a2e]">Select field…</option>
                {allFields.map((f) => (
                  <option key={f.key} value={f.key} className="bg-[#1a1a2e]">{f.label}</option>
                ))}
              </select>
            </div>
          )}

          <div className="flex flex-col gap-1.5">
            <label className="text-xs text-white/50 uppercase tracking-wider">Group By (optional)</label>
            <select
              className="bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm text-white"
              value={query.group_by ?? ''}
              onChange={(e) => patchQuery({ group_by: e.target.value || undefined })}
            >
              <option value="" className="bg-[#1a1a2e]">No grouping</option>
              {allFields.map((f) => (
                <option key={f.key} value={f.key} className="bg-[#1a1a2e]">{f.label}</option>
              ))}
            </select>
          </div>
        </div>
      )}

      {/* Table config */}
      {widgetType === 'table' && (
        <div className="flex flex-col gap-1.5">
          <label className="text-xs text-white/50 uppercase tracking-wider">Columns</label>
          <div className="flex flex-wrap gap-2">
            {allFields.map((f) => {
              const selected = query.columns?.includes(f.key) ?? false
              return (
                <button
                  key={f.key}
                  onClick={() => {
                    const cols = query.columns ?? []
                    patchQuery({
                      columns: selected ? cols.filter((c) => c !== f.key) : [...cols, f.key],
                    })
                  }}
                  className={`px-3 py-1.5 rounded-lg text-xs transition-colors ${
                    selected
                      ? 'bg-[#6357E8] text-white'
                      : 'bg-white/5 text-white/50 hover:bg-white/10'
                  }`}
                >
                  {f.label}
                </button>
              )
            })}
          </div>
        </div>
      )}

      {/* Date range */}
      <div className="flex flex-col gap-1.5">
        <label className="text-xs text-white/50 uppercase tracking-wider">Date Range</label>
        <select
          className="bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm text-white"
          value={query.date_range ?? ''}
          onChange={(e) => patchQuery({ date_range: (e.target.value || undefined) as typeof query.date_range })}
        >
          <option value="" className="bg-[#1a1a2e]">All time</option>
          {DATE_RANGES.map((d) => (
            <option key={d.value} value={d.value} className="bg-[#1a1a2e]">{d.label}</option>
          ))}
        </select>
      </div>

      {/* Filters */}
      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <label className="text-xs text-white/50 uppercase tracking-wider">Filters</label>
          <button
            onClick={addFilter}
            className="text-xs text-[#6357E8] hover:text-purple-300 transition-colors"
          >
            + Add filter
          </button>
        </div>
        {(query.filters ?? []).map((f, i) => (
          <div key={i} className="flex gap-2 items-center">
            <select
              className="flex-1 bg-white/5 border border-white/10 rounded-lg px-2 py-1.5 text-xs text-white"
              value={f.field}
              onChange={(e) => updateFilter(i, { field: e.target.value })}
            >
              {allFields.map((af) => (
                <option key={af.key} value={af.key} className="bg-[#1a1a2e]">{af.label}</option>
              ))}
            </select>
            <select
              className="w-24 bg-white/5 border border-white/10 rounded-lg px-2 py-1.5 text-xs text-white"
              value={f.op}
              onChange={(e) => updateFilter(i, { op: e.target.value as FilterOp })}
            >
              {FILTER_OPS.map((op) => (
                <option key={op.value} value={op.value} className="bg-[#1a1a2e]">{op.label}</option>
              ))}
            </select>
            {f.op !== 'is_null' && f.op !== 'not_null' && (
              <input
                className="flex-1 bg-white/5 border border-white/10 rounded-lg px-2 py-1.5 text-xs text-white placeholder-white/20"
                placeholder="value"
                value={String(f.value ?? '')}
                onChange={(e) => updateFilter(i, { value: e.target.value })}
              />
            )}
            <button
              onClick={() => removeFilter(i)}
              className="text-white/30 hover:text-red-400 transition-colors text-xs"
            >
              ✕
            </button>
          </div>
        ))}
      </div>

      {/* Preview */}
      <button
        onClick={() => setPreview((p) => !p)}
        className="text-sm text-[#6357E8] hover:text-purple-300 transition-colors text-left"
      >
        {preview ? '▾ Hide preview' : '▸ Preview results'}
      </button>

      {preview && (
        <div className="rounded-xl border border-white/10 p-4 min-h-[80px] text-sm">
          {previewLoading ? (
            <div className="text-white/30 animate-pulse">Loading…</div>
          ) : previewError ? (
            <div className="text-red-400">Query error — check your config</div>
          ) : previewResult?.value !== undefined ? (
            <div className="text-3xl font-bold text-white">{previewResult.value}</div>
          ) : (
            <div className="text-white/50">{previewResult?.rows?.length ?? 0} rows</div>
          )}
        </div>
      )}

      {/* Actions */}
      <div className="flex gap-3 pt-2 border-t border-white/5">
        <button
          onClick={handleSave}
          disabled={!title.trim() || saving}
          className="flex-1 py-2.5 rounded-xl bg-[#6357E8] text-white text-sm font-medium disabled:opacity-40 hover:bg-purple-500 transition-colors"
        >
          {saving ? 'Saving…' : 'Save Widget'}
        </button>
        <button
          onClick={onCancel}
          className="px-5 py-2.5 rounded-xl bg-white/5 text-white/60 text-sm hover:bg-white/10 transition-colors"
        >
          Cancel
        </button>
      </div>
    </div>
  )
}
