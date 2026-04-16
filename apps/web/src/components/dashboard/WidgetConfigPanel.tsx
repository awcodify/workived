import React, { useState } from 'react'
import type { QueryConfig, VizConfig, WidgetType, AggregateType, FilterOp, QueryFilter } from '@/types/api'
import { useExecuteQuery } from '@/lib/hooks/useDashboard'
import { useFieldDefinitions } from '@/lib/hooks/useTasks'

// ── Source field definitions ───────────────────────────────────────────────────

const SOURCE_FIELDS: Record<string, { key: string; label: string; aggregable?: boolean }[]> = {
  tasks: [
    { key: 'title', label: 'Title' },
    { key: 'status', label: 'Status' },
    { key: 'assignee_name', label: 'Assignee' },
    { key: 'priority', label: 'Priority' },
    { key: 'due_date', label: 'Due Date' },
    { key: 'created_at', label: 'Created At' },
    { key: 'completed_at', label: 'Completed At' },
    { key: 'is_completed', label: 'Is Completed' },
    { key: 'list_name', label: 'List Name' },
  ],
  attendance: [
    { key: 'employee_name', label: 'Employee' },
    { key: 'date', label: 'Date' },
    { key: 'clock_in_at', label: 'Clock In' },
    { key: 'clock_out_at', label: 'Clock Out' },
    { key: 'is_late', label: 'Is Late' },
    { key: 'work_location_type', label: 'Location Type' },
    { key: 'department_name', label: 'Department' },
    { key: 'hours_worked', label: 'Hours Worked', aggregable: true },
    { key: 'status', label: 'Status' },
  ],
  leave: [
    { key: 'employee_name', label: 'Employee' },
    { key: 'leave_type', label: 'Leave Type' },
    { key: 'start_date', label: 'Start Date' },
    { key: 'end_date', label: 'End Date' },
    { key: 'total_days', label: 'Total Days', aggregable: true },
    { key: 'status', label: 'Status' },
    { key: 'department_id', label: 'Department' },
    { key: 'created_at', label: 'Submitted At' },
  ],
  claims: [
    { key: 'employee_name', label: 'Employee' },
    { key: 'category_name', label: 'Category' },
    { key: 'amount', label: 'Amount', aggregable: true },
    { key: 'currency_code', label: 'Currency' },
    { key: 'status', label: 'Status' },
    { key: 'submitted_at', label: 'Submitted At' },
    { key: 'claim_date', label: 'Claim Date' },
    { key: 'department_id', label: 'Department' },
  ],
}

// Only date/timestamp fields — shown in LINE chart "Date Field" picker.
// Using these as date_bucket target is safe (castable to timestamptz).
const SOURCE_DATE_FIELDS: Record<string, { key: string; label: string }[]> = {
  tasks: [
    { key: 'due_date', label: 'Due Date' },
    { key: 'created_at', label: 'Created At' },
    { key: 'completed_at', label: 'Completed At' },
  ],
  attendance: [
    { key: 'date', label: 'Date' },
    { key: 'clock_in_at', label: 'Clock In' },
    { key: 'clock_out_at', label: 'Clock Out' },
  ],
  leave: [
    { key: 'start_date', label: 'Start Date' },
    { key: 'end_date', label: 'End Date' },
    { key: 'created_at', label: 'Submitted At' },
  ],
  claims: [
    { key: 'submitted_at', label: 'Submitted At' },
    { key: 'claim_date', label: 'Claim Date' },
  ],
}

const SOURCES = [
  { value: 'tasks', label: 'Tasks' },
  { value: 'attendance', label: 'Attendance' },
  { value: 'leave', label: 'Leave' },
  { value: 'claims', label: 'Claims' },
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

const DATE_BUCKETS = [
  { value: 'day', label: 'Day' },
  { value: 'week', label: 'Week' },
  { value: 'month', label: 'Month' },
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

  // Fields for selected source, plus custom fields when source=tasks
  const builtinFields = SOURCE_FIELDS[query.source] ?? SOURCE_FIELDS['tasks']
  const customFields =
    query.source === 'tasks'
      ? (fieldDefs ?? [])
          .filter((f) => f.is_active)
          .map((f) => ({ key: `field:${f.id}`, label: f.name, aggregable: f.field_type === 'number' || f.field_type === 'rating' }))
      : []
  const allFields = [...builtinFields, ...customFields]
  // sum/avg/min/max only work on numeric fields
  const needsNumericField = query.aggregate === 'sum' || query.aggregate === 'avg' || query.aggregate === 'min' || query.aggregate === 'max'
  const fieldOptions = needsNumericField ? allFields.filter((f) => f.aggregable) : allFields
  const dateFields = SOURCE_DATE_FIELDS[query.source] ?? SOURCE_DATE_FIELDS['tasks']

  const { data: previewResult, isLoading: previewLoading, isError: previewError } = useExecuteQuery(
    { ...query, limit: 5 },
    preview && !!query.source,
  )

  const patchQuery = (patch: Partial<QueryConfig>) => setQuery((q) => ({ ...q, ...patch }))

  const handleSourceChange = (newSource: string) => {
    // Reset field-dependent config when source changes
    patchQuery({
      source: newSource,
      field: undefined,
      group_by: undefined,
      columns: undefined,
      filters: undefined,
    })
  }

  const handleTypeChange = (t: WidgetType) => {
    setWidgetType(t)
    // Ensure aggregate is set for non-table types
    if (t !== 'table' && !query.aggregate) {
      patchQuery({ aggregate: 'count' })
    }
    if (t === 'line') {
      // Default to day bucket when switching to line
      if (!query.date_bucket) patchQuery({ date_bucket: 'day', group_by: undefined, facet: undefined })
    } else {
      // Clear line-specific fields when leaving line
      patchQuery({ date_bucket: undefined, facet: undefined })
    }
    // Clear group_by when switching to bar (it will pick its own)
    if (t === 'bar') {
      patchQuery({ group_by: undefined })
    }
  }

  const addFilter = () => {
    const defaultField = allFields[0]?.key ?? 'status'
    patchQuery({ filters: [...(query.filters ?? []), { field: defaultField, op: 'eq', value: '' }] })
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

  const isLine = widgetType === 'line'

  return (
    <div className="flex flex-col gap-5 p-6 text-white">
      {/* Title */}
      <div className="flex flex-col gap-1.5">
        <label className="text-xs text-white/50 uppercase tracking-wider">Widget Title</label>
        <input
          className="bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm text-white placeholder-white/20 focus:outline-none focus:border-white/30"
          placeholder="e.g. Tasks Completed This Month"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
        />
      </div>

      {/* Widget type */}
      <div className="flex flex-col gap-1.5">
        <label className="text-xs text-white/50 uppercase tracking-wider">Type</label>
        <div className="flex gap-2 flex-wrap">
          {(['kpi', 'bar', 'line', 'table'] as WidgetType[]).map((t) => (
            <button
              key={t}
              onClick={() => handleTypeChange(t)}
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

      {/* Source */}
      <div className="flex flex-col gap-1.5">
        <label className="text-xs text-white/50 uppercase tracking-wider">Data Source</label>
        <select
          className="bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm text-white"
          value={query.source}
          onChange={(e) => handleSourceChange(e.target.value)}
        >
          {SOURCES.map((s) => (
            <option key={s.value} value={s.value} className="bg-[#1a1a2e]">{s.label}</option>
          ))}
        </select>
      </div>

      {/* KPI / Bar / Line aggregate config */}
      {widgetType !== 'table' && (
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

          {/* count_distinct: field = any field */}
          {query.aggregate === 'count_distinct' && (
            <div className="flex flex-col gap-1.5">
              <label className="text-xs text-white/50 uppercase tracking-wider">Field</label>
              <select
                className="bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm text-white"
                value={query.field ?? ''}
                onChange={(e) => patchQuery({ field: e.target.value || undefined })}
              >
                <option value="" className="bg-[#1a1a2e]">Select field…</option>
                {allFields.map((f) => (
                  <option key={f.key} value={f.key} className="bg-[#1a1a2e]">{f.label}</option>
                ))}
              </select>
            </div>
          )}

          {/* sum/avg/min/max: numeric fields only */}
          {(query.aggregate === 'sum' || query.aggregate === 'avg' || query.aggregate === 'min' || query.aggregate === 'max') && (
            <div className="flex flex-col gap-1.5">
              <label className="text-xs text-white/50 uppercase tracking-wider">Field</label>
              {fieldOptions.length === 0 ? (
                <p className="text-xs text-red-400/80 py-2">No numeric fields available for this source</p>
              ) : (
                <select
                  className="bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm text-white"
                  value={query.field ?? ''}
                  onChange={(e) => patchQuery({ field: e.target.value || undefined })}
                >
                  <option value="" className="bg-[#1a1a2e]">Select field…</option>
                  {fieldOptions.map((f) => (
                    <option key={f.key} value={f.key} className="bg-[#1a1a2e]">{f.label}</option>
                  ))}
                </select>
              )}
            </div>
          )}

          {/* KPI: optional count-by breakdown */}
          {widgetType === 'kpi' && (
            <div className="flex flex-col gap-1.5">
              <label className="text-xs text-white/50 uppercase tracking-wider">Count by (optional)</label>
              <select
                className="bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm text-white"
                value={query.group_by ?? ''}
                onChange={(e) => patchQuery({ group_by: e.target.value || undefined })}
              >
                <option value="" className="bg-[#1a1a2e]">Single number</option>
                {allFields.filter((f) => !f.aggregable).map((f) => (
                  <option key={f.key} value={f.key} className="bg-[#1a1a2e]">{f.label}</option>
                ))}
              </select>
            </div>
          )}

          {/* Bar: categorical group by */}
          {widgetType === 'bar' && (
            <div className="flex flex-col gap-1.5">
              <label className="text-xs text-white/50 uppercase tracking-wider">Group By</label>
              <select
                className="bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm text-white"
                value={query.group_by ?? ''}
                onChange={(e) => patchQuery({ group_by: e.target.value || undefined })}
              >
                <option value="" className="bg-[#1a1a2e]">Select field…</option>
                {allFields.map((f) => (
                  <option key={f.key} value={f.key} className="bg-[#1a1a2e]">{f.label}</option>
                ))}
              </select>
            </div>
          )}

          {/* Line: date field + bucket + optional facet */}
          {isLine && (
            <>
              <div className="flex flex-col gap-1.5">
                <label className="text-xs text-white/50 uppercase tracking-wider">Date Field</label>
                <select
                  className="bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm text-white"
                  value={query.group_by ?? ''}
                  onChange={(e) => patchQuery({ group_by: e.target.value || undefined })}
                >
                  <option value="" className="bg-[#1a1a2e]">Source default</option>
                  {dateFields.map((f) => (
                    <option key={f.key} value={f.key} className="bg-[#1a1a2e]">{f.label}</option>
                  ))}
                </select>
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-xs text-white/50 uppercase tracking-wider">Bucket By</label>
                <div className="flex gap-2">
                  {DATE_BUCKETS.map((b) => (
                    <button
                      key={b.value}
                      onClick={() => patchQuery({ date_bucket: b.value as 'day' | 'week' | 'month' })}
                      className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                        query.date_bucket === b.value
                          ? 'bg-[#6357E8] text-white'
                          : 'bg-white/5 text-white/50 hover:bg-white/10'
                      }`}
                    >
                      {b.label}
                    </button>
                  ))}
                </div>
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-xs text-white/50 uppercase tracking-wider">Split by (optional)</label>
                <select
                  className="bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm text-white"
                  value={query.facet ?? ''}
                  onChange={(e) => patchQuery({ facet: e.target.value || undefined })}
                >
                  <option value="" className="bg-[#1a1a2e]">No split — single line</option>
                  {allFields.filter((f) => !f.aggregable).map((f) => (
                    <option key={f.key} value={f.key} className="bg-[#1a1a2e]">{f.label}</option>
                  ))}
                </select>
              </div>
            </>
          )}
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
            <div className="text-red-400">Query error — check config</div>
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
