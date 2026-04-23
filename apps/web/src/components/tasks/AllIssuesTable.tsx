/**
 * AllIssuesTable — full task history with filtering, sorting, and pagination.
 * Shows all tasks including completed ones.
 */

import { useState, useMemo, useEffect } from 'react'
import { typography } from '@/design/tokens'
import type { TaskWithDetails, Employee, FieldDefinition, TaskPriority, TaskList } from '@/types/api'
import { useAllTasks, useFieldDefinitions } from '@/lib/hooks/useTasks'
import { DatePicker } from '@/components/ui'

// ── Types ─────────────────────────────────────────────────────

interface AllIssuesFilters {
  search: string
  task_list_id: string  // Filter by task list (status column)
  status: '' | 'pending' | 'completed'  // Filter by completion state
  assignee_id: string
  priority: string
  completed_after: string
  completed_before: string
  cursor: string
}

type SortKey = 'title' | 'list_name' | 'assignee_name' | 'due_date' | 'priority' | 'completed_at' | 'created_at' | `field:${string}`
type SortDir = 'asc' | 'desc'

const PRIORITY_ORDER: Record<string, number> = { urgent: 0, high: 1, medium: 2, low: 3 }

const PRIORITY_COLORS: Record<TaskPriority, { bg: string; text: string }> = {
  urgent: { bg: '#FEE2E2', text: '#DC2626' },
  high:   { bg: '#FEF3C7', text: '#D97706' },
  medium: { bg: '#DBEAFE', text: '#2563EB' },
  low:    { bg: '#F3F4F6', text: '#6B7280' },
}

// ── Helpers ───────────────────────────────────────────────────

function formatDate(iso: string | null | undefined): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
}

function formatFieldCellValue(fd: FieldDefinition, task: TaskWithDetails, employees: Employee[]): string {
  const fv = task.field_values?.find((f) => f.field_id === fd.id)
  if (!fv) return '—'

  switch (fd.field_type) {
    case 'text':
      return fv.value_text ?? '—'
    case 'url':
      return fv.value_text ? fv.value_text : '—'
    case 'number':
      return fv.value_number !== undefined ? String(fv.value_number) : '—'
    case 'rating':
      return fv.value_number !== undefined ? '★'.repeat(fv.value_number) + '☆'.repeat(5 - fv.value_number) : '—'
    case 'boolean':
      return fv.value_boolean === true ? '✓ Yes' : fv.value_boolean === false ? '✗ No' : '—'
    case 'date':
      return fv.value_date ? formatDate(fv.value_date) : '—'
    case 'select':
      return typeof fv.value_json === 'string' ? fv.value_json : '—'
    case 'multi_select':
      return Array.isArray(fv.value_json) ? (fv.value_json as string[]).join(', ') : '—'
    case 'employee': {
      const empId = typeof fv.value_json === 'string' ? fv.value_json : undefined
      return empId ? (employees.find((e) => e.id === empId)?.full_name ?? empId) : '—'
    }
    default:
      return '—'
  }
}

function sortTasks(tasks: TaskWithDetails[], key: SortKey, dir: SortDir, fieldDefs: FieldDefinition[] = []): TaskWithDetails[] {
  return [...tasks].sort((a, b) => {
    let cmp = 0
    if (key.startsWith('field:')) {
      const fieldId = key.slice(6)
      const fd = fieldDefs.find((f) => f.id === fieldId)
      const aFv = a.field_values?.find((f) => f.field_id === fieldId)
      const bFv = b.field_values?.find((f) => f.field_id === fieldId)
      if (fd?.field_type === 'number' || fd?.field_type === 'rating') {
        cmp = (aFv?.value_number ?? -Infinity) - (bFv?.value_number ?? -Infinity)
      } else {
        const aStr = aFv?.value_text ?? aFv?.value_date ?? ''
        const bStr = bFv?.value_text ?? bFv?.value_date ?? ''
        cmp = aStr.localeCompare(bStr)
      }
    } else {
      switch (key) {
        case 'title':
          cmp = a.title.localeCompare(b.title)
          break
        case 'list_name':
          cmp = (a.list_name ?? '').localeCompare(b.list_name ?? '')
          break
        case 'assignee_name':
          cmp = (a.assignee_name ?? '').localeCompare(b.assignee_name ?? '')
          break
        case 'due_date':
          cmp = (a.due_date ?? '').localeCompare(b.due_date ?? '')
          break
        case 'priority':
          cmp = (PRIORITY_ORDER[a.priority ?? 'medium'] ?? 2) - (PRIORITY_ORDER[b.priority ?? 'medium'] ?? 2)
          break
        case 'completed_at':
          cmp = (a.completed_at ?? '').localeCompare(b.completed_at ?? '')
          break
        case 'created_at':
          cmp = (a.created_at ?? '').localeCompare(b.created_at ?? '')
          break
      }
    }
    return dir === 'asc' ? cmp : -cmp
  })
}

// ── Sub-components ────────────────────────────────────────────

function SortHeader({
  label,
  sortKey,
  current,
  dir,
  onSort,
}: {
  label: string
  sortKey: SortKey
  current: SortKey
  dir: SortDir
  onSort: (k: SortKey) => void
}) {
  const active = current === sortKey
  return (
    <th
      onClick={() => onSort(sortKey)}
      className="text-left px-3 py-2.5 text-xs font-bold cursor-pointer select-none whitespace-nowrap"
      style={{
        color: active ? '#2C3E50' : '#94A3B8',
        fontFamily: typography.fontFamily,
        borderBottom: `2px solid ${active ? '#C97B2A' : '#E2E8F0'}`,
      }}
    >
      {label}
      {active && <span className="ml-1 opacity-60">{dir === 'asc' ? '↑' : '↓'}</span>}
    </th>
  )
}

const DEFAULT_CUSTOM_COLUMNS = 2

// ── Main Component ────────────────────────────────────────────

interface AllIssuesTableProps {
  employees: Employee[]
  taskLists: TaskList[]  // For status filter dropdown
  onTaskClick: (task: TaskWithDetails) => void
  hideFilters?: boolean // Hide filter bar (render it externally)
  externalFilters?: Partial<AllIssuesFilters> // External filter values (when hideFilters=true)
  externalVisibleFieldIds?: Set<string> | null // External column visibility state (when hideFilters=true)
}

const EMPTY_FILTERS: AllIssuesFilters = {
  search:          '',
  task_list_id:    '',
  status:          '',
  assignee_id:     '',
  priority:        '',
  completed_after:  '',
  completed_before: '',
  cursor:          '',
}

export function AllIssuesTable({ employees, taskLists, onTaskClick, hideFilters = false, externalFilters, externalVisibleFieldIds }: AllIssuesTableProps) {
  const [filters, setFilters]           = useState<AllIssuesFilters>(EMPTY_FILTERS)
  
  // Use external filters when provided (for hideFilters mode)
  const activeFilters = useMemo(() => {
    if (hideFilters && externalFilters) {
      return { ...EMPTY_FILTERS, ...externalFilters }
    }
    return filters
  }, [hideFilters, externalFilters, filters])
  const [sortKey, setSortKey]           = useState<SortKey>('created_at')
  const [sortDir, setSortDir]           = useState<SortDir>('desc')
  const [cursorStack, setCursorStack]   = useState<string[]>([])
  const [showColumnPicker, setShowColumnPicker] = useState(false)
  // Set of field IDs to show — default: first 2 active fields
  // Use external state when provided (for hideFilters mode)
  const [internalVisibleFieldIds, setInternalVisibleFieldIds] = useState<Set<string> | null>(null) // null = use default
  const visibleFieldIds = hideFilters && externalVisibleFieldIds !== undefined ? externalVisibleFieldIds : internalVisibleFieldIds

  const { data: fieldDefs = [] } = useFieldDefinitions()
  const activeFields = fieldDefs.filter((fd) => fd.is_active)

  // Resolve which custom columns to show
  const visibleCustomFields = useMemo(() => {
    if (visibleFieldIds === null) return activeFields.slice(0, DEFAULT_CUSTOM_COLUMNS)
    return activeFields.filter((fd) => visibleFieldIds.has(fd.id))
  }, [activeFields, visibleFieldIds])

  const toggleFieldColumn = (fdId: string) => {
    setInternalVisibleFieldIds((prev) => {
      const base = prev ?? new Set(activeFields.slice(0, DEFAULT_CUSTOM_COLUMNS).map((f) => f.id))
      const next = new Set(base)
      if (next.has(fdId)) next.delete(fdId)
      else next.add(fdId)
      return next
    })
  }

  // Parse task_list_id and assignee_id filters - backend now supports comma-separated values
  const queryFilters = {
    ...(activeFilters.search          ? { search:           activeFilters.search }          : {}),
    ...(activeFilters.task_list_id    ? { task_list_id:     activeFilters.task_list_id }    : {}),
    ...(activeFilters.status          ? { status:           activeFilters.status as 'pending' | 'completed' } : {}),
    ...(activeFilters.assignee_id     ? { assignee_id:      activeFilters.assignee_id }     : {}),
    ...(activeFilters.priority        ? { priority:         activeFilters.priority as TaskPriority } : {}),
    ...(activeFilters.completed_after  ? { completed_after:  activeFilters.completed_after }  : {}),
    ...(activeFilters.completed_before ? { completed_before: activeFilters.completed_before } : {}),
    ...(activeFilters.cursor          ? { cursor:           activeFilters.cursor }          : {}),
  }

  const { data, isLoading } = useAllTasks(queryFilters)
  const tasks    = data?.tasks ?? []
  const meta     = data?.meta
  const hasMore  = meta?.has_more ?? false
  const nextCursor = meta?.next_cursor

  const sorted = useMemo(() => sortTasks(tasks, sortKey, sortDir, fieldDefs), [tasks, sortKey, sortDir, fieldDefs])

  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
    } else {
      setSortKey(key)
      setSortDir('desc')
    }
  }

  const setFilter = (key: keyof AllIssuesFilters, value: string) => {
    setFilters((f) => ({ ...f, [key]: value, cursor: '' }))
    setCursorStack([])
  }

  const goNext = () => {
    if (!nextCursor) return
    setCursorStack((s) => [...s, filters.cursor])
    setFilters((f) => ({ ...f, cursor: nextCursor }))
  }

  const goPrev = () => {
    const stack = [...cursorStack]
    const prev = stack.pop() ?? ''
    setCursorStack(stack)
    setFilters((f) => ({ ...f, cursor: prev }))
  }

  const clearFilters = () => {
    setFilters(EMPTY_FILTERS)
    setCursorStack([])
  }

  const hasActiveFilters = Object.entries(filters).some(
    ([k, v]) => k !== 'cursor' && v !== ''
  )

  const inputStyle: React.CSSProperties = {
    background: 'rgba(255,255,255,0.7)',
    border: '1px solid rgba(0,0,0,0.12)',
    borderRadius: '6px',
    color: '#2C3E50',
    fontFamily: typography.fontFamily,
    fontSize: '12px',
    padding: '6px 10px',
    outline: 'none',
  }

  return (
    <div className="flex flex-col gap-4 h-full">
      {/* ── Filter bar ─────────────────────────────────────── */}
      {!hideFilters && (
        <div className="flex items-center gap-2 flex-wrap">
          {/* Search */}
          <input
            type="search"
            value={filters.search}
            onChange={(e) => setFilter('search', e.target.value)}
            placeholder="Search tasks..."
            style={{ ...inputStyle, minWidth: '200px', flex: '1' }}
          />

        {/* Status */}
        <select
          value={filters.task_list_id}
          onChange={(e) => setFilter('task_list_id', e.target.value)}
          style={inputStyle}
        >
          <option value="">All statuses</option>
          {taskLists.map((list) => (
            <option key={list.id} value={list.id}>{list.name}</option>
          ))}
        </select>

        {/* Assignee */}
        <select
          value={filters.assignee_id}
          onChange={(e) => setFilter('assignee_id', e.target.value)}
          style={inputStyle}
        >
          <option value="">All assignees</option>
          {employees.map((e) => (
            <option key={e.id} value={e.id}>{e.full_name}</option>
          ))}
        </select>

        {/* Priority */}
        <select
          value={filters.priority}
          onChange={(e) => setFilter('priority', e.target.value)}
          style={inputStyle}
        >
          <option value="">All priorities</option>
          <option value="urgent">Urgent</option>
          <option value="high">High</option>
          <option value="medium">Medium</option>
          <option value="low">Low</option>
        </select>

        {/* Completed date range */}
        <div className="flex items-center gap-1">
          <span className="text-xs font-semibold" style={{ color: '#94A3B8', fontFamily: typography.fontFamily }}>Completed:</span>
          <DatePicker
            value={filters.completed_after}
            onChange={(e) => setFilter('completed_after', e.target.value)}
            style={{ ...inputStyle, colorScheme: 'light' }}
            className=""
          />
          <span className="text-xs" style={{ color: '#94A3B8' }}>–</span>
          <DatePicker
            value={filters.completed_before}
            onChange={(e) => setFilter('completed_before', e.target.value)}
            style={{ ...inputStyle, colorScheme: 'light' }}
            className=""
          />
        </div>

        {hasActiveFilters && (
          <button
            onClick={clearFilters}
            className="text-xs font-bold px-3 py-1.5 rounded-md transition-colors hover:opacity-80"
            style={{ background: '#FEE2E2', color: '#EF4444', fontFamily: typography.fontFamily }}
          >
            Clear filters
          </button>
        )}

        {/* Column picker — only shown when custom fields exist */}
        {activeFields.length > 0 && (
          <div className="relative ml-auto">
            <button
              onClick={() => setShowColumnPicker((v) => !v)}
              className="flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-md transition-colors"
              style={{
                background: showColumnPicker ? '#2C3E50' : 'rgba(0,0,0,0.06)',
                color: showColumnPicker ? 'white' : '#64748B',
                fontFamily: typography.fontFamily,
              }}
            >
              <span>⊞</span> Columns
              {visibleFieldIds !== null && visibleFieldIds.size !== DEFAULT_CUSTOM_COLUMNS && (
                <span className="ml-1 px-1 rounded text-xs" style={{ background: '#C97B2A', color: 'white' }}>
                  {visibleFieldIds.size}
                </span>
              )}
            </button>

            {showColumnPicker && (
              <div
                className="absolute right-0 top-full mt-1 z-50 rounded-xl shadow-xl p-3 min-w-[200px]"
                style={{ background: 'white', border: '1px solid #E2E8F0' }}
              >
                <p className="text-xs font-bold mb-2" style={{ color: '#94A3B8', fontFamily: typography.fontFamily }}>
                  Custom field columns
                </p>
                {activeFields.map((fd) => {
                  const checked = visibleFieldIds === null
                    ? activeFields.indexOf(fd) < DEFAULT_CUSTOM_COLUMNS
                    : visibleFieldIds.has(fd.id)
                  return (
                    <label key={fd.id} className="flex items-center gap-2 py-1.5 cursor-pointer group">
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => toggleFieldColumn(fd.id)}
                        className="w-3.5 h-3.5 accent-amber-500"
                      />
                      <span className="text-xs font-medium" style={{ color: '#2C3E50', fontFamily: typography.fontFamily }}>
                        {fd.name}
                      </span>
                      <span className="text-xs opacity-50 ml-auto" style={{ fontFamily: typography.fontFamily }}>
                        {fd.field_type}
                      </span>
                    </label>
                  )
                })}
                <button
                  onClick={() => setInternalVisibleFieldIds(null)}
                  className="mt-2 w-full text-xs py-1 rounded-md transition-colors"
                  style={{ background: '#F1F5F9', color: '#64748B', fontFamily: typography.fontFamily }}
                >
                  Reset to default
                </button>
              </div>
            )}
          </div>
        )}
      </div>
      )}

      {/* ── Table ──────────────────────────────────────────── */}
      <div className="flex-1 overflow-auto rounded-xl" style={{ background: 'rgba(255,255,255,0.6)', border: '1px solid rgba(0,0,0,0.08)' }}>
        {isLoading ? (
          <div className="flex items-center justify-center h-40">
            <div className="animate-spin w-6 h-6 rounded-full border-2 border-amber-500 border-t-transparent" />
          </div>
        ) : sorted.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-40 gap-2">
            <span className="text-3xl">📋</span>
            <p className="text-sm font-semibold" style={{ color: '#94A3B8', fontFamily: typography.fontFamily }}>
              No tasks found
            </p>
            {hasActiveFilters && (
              <button onClick={clearFilters} className="text-xs underline" style={{ color: '#C97B2A', fontFamily: typography.fontFamily }}>
                Clear filters
              </button>
            )}
          </div>
        ) : (
          <table className="w-full border-collapse">
            <thead>
              <tr style={{ background: 'rgba(0,0,0,0.03)' }}>
                <th className="text-left px-3 py-2.5 text-xs font-bold" style={{ color: '#94A3B8', fontFamily: typography.fontFamily, borderBottom: '2px solid #E2E8F0' }}>Code</th>
                <SortHeader label="Title"       sortKey="title"        current={sortKey} dir={sortDir} onSort={handleSort} />
                <SortHeader label="List"        sortKey="list_name"    current={sortKey} dir={sortDir} onSort={handleSort} />
                <SortHeader label="Assignee"    sortKey="assignee_name" current={sortKey} dir={sortDir} onSort={handleSort} />
                <SortHeader label="Due"         sortKey="due_date"     current={sortKey} dir={sortDir} onSort={handleSort} />
                <SortHeader label="Priority"    sortKey="priority"     current={sortKey} dir={sortDir} onSort={handleSort} />
                <th className="text-left px-3 py-2.5 text-xs font-bold" style={{ color: '#94A3B8', fontFamily: typography.fontFamily, borderBottom: '2px solid #E2E8F0' }}>Labels</th>
                <SortHeader label="Completed"   sortKey="completed_at" current={sortKey} dir={sortDir} onSort={handleSort} />
                {visibleCustomFields.map((fd) => (
                  <SortHeader
                    key={fd.id}
                    label={fd.name}
                    sortKey={`field:${fd.id}`}
                    current={sortKey}
                    dir={sortDir}
                    onSort={handleSort}
                  />
                ))}
              </tr>
            </thead>
            <tbody>
              {sorted.map((task, i) => {
                const isDone = !!task.completed_at
                const priorityColors = PRIORITY_COLORS[task.priority as TaskPriority] ?? PRIORITY_COLORS.medium
                return (
                  <tr
                    key={task.id}
                    onClick={() => onTaskClick(task)}
                    className="cursor-pointer transition-colors group"
                    style={{
                      background: i % 2 === 0 ? 'transparent' : 'rgba(0,0,0,0.015)',
                      opacity: isDone ? 0.7 : 1,
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(201,123,42,0.06)')}
                    onMouseLeave={(e) => (e.currentTarget.style.background = i % 2 === 0 ? 'transparent' : 'rgba(0,0,0,0.015)')}
                  >
                    {/* Code */}
                    <td className="px-3 py-2.5">
                      {task.code && (
                        <span
                          className="inline-block text-xs font-mono font-semibold px-2 py-0.5 rounded whitespace-nowrap"
                          style={{
                            background: isDone ? '#E5E7EB' : '#F3F4F6',
                            color: isDone ? '#9CA3AF' : '#6B7280',
                            fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
                          }}
                        >
                          {task.code}
                        </span>
                      )}
                    </td>
                    {/* Title */}
                    <td className="px-3 py-2.5 max-w-[280px]">
                      <div className="flex items-center gap-2">
                        {isDone && (
                          <span className="flex-shrink-0 w-4 h-4 rounded-full flex items-center justify-center text-xs"
                            style={{ background: '#D1FAE5', color: '#059669' }}>✓</span>
                        )}
                        <span
                          className="text-sm font-semibold truncate"
                          style={{
                            color: isDone ? '#94A3B8' : '#2C3E50',
                            textDecoration: isDone ? 'line-through' : 'none',
                            fontFamily: typography.fontFamily,
                          }}
                        >
                          {task.title}
                        </span>
                      </div>
                    </td>
                    {/* List */}
                    <td className="px-3 py-2.5 text-xs" style={{ color: '#64748B', fontFamily: typography.fontFamily }}>
                      {task.list_name ?? '—'}
                    </td>
                    {/* Assignee */}
                    <td className="px-3 py-2.5 text-xs" style={{ color: '#64748B', fontFamily: typography.fontFamily }}>
                      {task.assignee_name ?? '—'}
                    </td>
                    {/* Due date */}
                    <td className="px-3 py-2.5 text-xs whitespace-nowrap" style={{ color: '#64748B', fontFamily: typography.fontFamily }}>
                      {task.due_date ? formatDate(task.due_date) : '—'}
                    </td>
                    {/* Priority */}
                    <td className="px-3 py-2.5">
                      <span
                        className="text-xs font-bold px-2 py-0.5 rounded capitalize"
                        style={{ background: priorityColors.bg, color: priorityColors.text, fontFamily: typography.fontFamily }}
                      >
                        {task.priority ?? 'medium'}
                      </span>
                    </td>
                    {/* Labels */}
                    <td className="px-3 py-2.5">
                      {task.labels && task.labels.length > 0 ? (
                        <div className="flex flex-wrap gap-1 max-w-[200px]">
                          {task.labels.slice(0, 2).map((label) => (
                            <span
                              key={label}
                              className="inline-block px-1.5 py-0.5 rounded text-xs font-medium whitespace-nowrap"
                              style={{
                                background: '#EEF2FF',
                                color: '#4F46E5',
                                fontFamily: typography.fontFamily,
                                fontSize: '11px',
                              }}
                            >
                              {label}
                            </span>
                          ))}
                          {task.labels.length > 2 && (
                            <span
                              className="inline-block px-1.5 py-0.5 rounded text-xs font-medium"
                              style={{
                                background: '#F3F4F6',
                                color: '#6B7280',
                                fontFamily: typography.fontFamily,
                                fontSize: '11px',
                              }}
                            >
                              +{task.labels.length - 2}
                            </span>
                          )}
                        </div>
                      ) : (
                        <span className="text-xs" style={{ color: '#94A3B8', fontFamily: typography.fontFamily }}>—</span>
                      )}
                    </td>
                    {/* Completed at */}
                    <td className="px-3 py-2.5 text-xs whitespace-nowrap" style={{ color: '#64748B', fontFamily: typography.fontFamily }}>
                      {task.completed_at ? formatDate(task.completed_at) : '—'}
                    </td>
                    {/* Custom field columns */}
                    {visibleCustomFields.map((fd) => {
                      const cellValue = formatFieldCellValue(fd, task, employees)
                      const isUrl = fd.field_type === 'url' && cellValue !== '—'
                      // Ensure URL has protocol to prevent relative navigation
                      const normalizedUrl = isUrl && cellValue.match(/^https?:\/\//i) ? cellValue : `https://${cellValue}`
                      
                      return (
                        <td key={fd.id} className="px-3 py-2.5 text-xs max-w-[160px] truncate"
                          style={{ color: '#64748B', fontFamily: typography.fontFamily }}>
                          {isUrl ? (
                            <a
                              href={normalizedUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              onClick={(e) => e.stopPropagation()}
                              className="underline hover:opacity-70 transition-opacity"
                              style={{ color: '#3B82F6' }}
                            >
                              {cellValue}
                            </a>
                          ) : (
                            cellValue
                          )}
                        </td>
                      )
                    })}
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* ── Pagination ─────────────────────────────────────── */}
      <div className="flex items-center justify-between">
        <span className="text-xs" style={{ color: '#94A3B8', fontFamily: typography.fontFamily }}>
          {sorted.length} task{sorted.length !== 1 ? 's' : ''} on this page
        </span>
        <div className="flex items-center gap-2">
          <button
            onClick={goPrev}
            disabled={cursorStack.length === 0}
            className="text-xs font-bold px-4 py-2 rounded-lg transition-all disabled:opacity-30"
            style={{ background: 'rgba(0,0,0,0.06)', color: '#2C3E50', fontFamily: typography.fontFamily }}
          >
            ← Prev
          </button>
          <button
            onClick={goNext}
            disabled={!hasMore}
            className="text-xs font-bold px-4 py-2 rounded-lg transition-all disabled:opacity-30"
            style={{ background: hasMore ? '#C97B2A' : 'rgba(0,0,0,0.06)', color: hasMore ? '#FFF' : '#2C3E50', fontFamily: typography.fontFamily }}
          >
            Next →
          </button>
        </div>
      </div>
    </div>
  )
}
