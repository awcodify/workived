import { createFileRoute } from '@tanstack/react-router'
import { useState, useEffect } from 'react'
import { useAuditLogs } from '@/lib/hooks/useAudit'
import { WorkivedLogo } from '@/components/workived/layout/WorkivedLogo'
import { moduleBackgrounds, colors, typography } from '@/design/tokens'
import { Download, X, Calendar, User, FileText } from 'lucide-react'
import type { AuditLog, AuditLogFilters } from '@/types/api'
import { DatePicker } from '@/components/ui'

export const Route = createFileRoute('/_app/settings/audit-logs')({
  component: AuditLogsPage,
})

// ── Shared token shorthands ────────────────────────────────────────────────────

const C = {
  accent: colors.accent,
  accentDim: colors.accentDim,
}

// ── Shared style constants ─────────────────────────────────────────────────────

const S = {
  text: '#FFFFFF',
  textMuted: 'rgba(255,255,255,0.55)',
  textDim: 'rgba(255,255,255,0.35)',
  divider: 'rgba(255,255,255,0.08)',
  inputBg: 'rgba(255,255,255,0.07)',
  inputBorder: 'rgba(255,255,255,0.12)',
  cardBg: 'rgba(255,255,255,0.04)',
}

// ── Helper functions ───────────────────────────────────────────────────────────

function formatDateTime(dateStr: string) {
  return new Date(dateStr).toLocaleString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function getActionLabel(action: string) {
  const labels: Record<string, string> = {
    'employee.created': 'Created Employee',
    'employee.updated': 'Updated Employee',
    'employee.deactivated': 'Deactivated Employee',
    'leave.request.created': 'Requested Leave',
    'leave.request.approved': 'Approved Leave',
    'leave.request.rejected': 'Rejected Leave',
    'leave.request.cancelled': 'Cancelled Leave',
    'claim.created': 'Created Claim',
    'claim.approved': 'Approved Claim',
    'claim.rejected': 'Rejected Claim',
    'task.created': 'Created Task',
    'task.updated': 'Updated Task',
    'task.completed': 'Completed Task',
  }
  return labels[action] || action
}

function getResourceTypeLabel(type: string) {
  const labels: Record<string, string> = {
    employee: 'Employee',
    leave: 'Leave',
    claim: 'Claim',
    task: 'Task',
    department: 'Department',
    organisation: 'Organisation',
  }
  return labels[type] || type
}

function cleanStateForDisplay(state: any): any {
  if (!state || typeof state !== 'object') return state

  const cleaned: any = {}
  // Fields to completely hide from users
  const fieldsToHide = [
    'password', 'token', 'session', 'auth', 'jwt', 'secret',
    'id', 'organisation_id', 'created_at', 'updated_at', 'deleted_at',
    'work_schedule_id', 'reporting_to', 'employee_id', 'user_id',
    'created_by', 'updated_by'
  ]
  
  for (const [key, value] of Object.entries(state)) {
    // Skip hidden fields
    if (fieldsToHide.includes(key.toLowerCase())) {
      continue
    }
    
    // Skip fields that look like tokens or sensitive data
    if (fieldsToHide.some(field => key.toLowerCase().includes(field))) {
      continue
    }
    
    // Skip very long string values (likely tokens/JWTs)
    if (typeof value === 'string' && value.length > 100) {
      continue
    }
    
    // Skip UUID values (they're not user-readable)
    if (typeof value === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value)) {
      continue
    }
    
    // Recursively clean nested objects
    if (value && typeof value === 'object') {
      cleaned[key] = cleanStateForDisplay(value)
    } else {
      cleaned[key] = value
    }
  }
  
  return cleaned
}

function formatFieldName(key: string): string {
  // Custom labels for specific fields
  const customLabels: Record<string, string> = {
    'full_name': 'Full Name',
    'job_title': 'Job Title',
    'email': 'Email',
    'phone_number': 'Phone Number',
    'hire_date': 'Hire Date',
    'birth_date': 'Date of Birth',
    'country_code': 'Country',
    'currency_code': 'Currency',
    'salary_amount': 'Salary',
    'salary_currency': 'Salary Currency',
    'employment_type': 'Employment Type',
    'work_days': 'Work Days',
    'is_active': 'Status',
    'is_verified': 'Verified',
  }
  
  if (customLabels[key]) return customLabels[key]
  
  // Default formatting: snake_case to Title Case
  return key
    .split('_')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ')
}

function getChangedFields(before: any, after: any): Array<{key: string; before: any; after: any}> {
  const changes: Array<{key: string; before: any; after: any}> = []
  const allKeys = new Set([...Object.keys(before || {}), ...Object.keys(after || {})])
  
  for (const key of allKeys) {
    const beforeVal = before?.[key]
    const afterVal = after?.[key]
    
    if (JSON.stringify(beforeVal) !== JSON.stringify(afterVal)) {
      changes.push({ key, before: beforeVal, after: afterVal })
    }
  }
  
  return changes
}

function formatValue(value: any): string {
  if (value === null || value === undefined) return 'None'
  if (typeof value === 'boolean') return value ? 'Yes' : 'No'
  
  // Format dates
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}/.test(value)) {
    try {
      const date = new Date(value)
      // Check if it's a date-only field (no time component matters)
      if (value.includes('T00:00:00') || !value.includes('T')) {
        return date.toLocaleDateString('en-US', { 
          year: 'numeric', 
          month: 'short', 
          day: 'numeric' 
        })
      }
      // Otherwise show date and time
      return date.toLocaleString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      })
    } catch {
      return String(value)
    }
  }
  
  // Format numbers with currency
  if (typeof value === 'number' && value > 1000000) {
    return new Intl.NumberFormat('en-US').format(value)
  }
  
  if (typeof value === 'object') return JSON.stringify(value, null, 2)
  return String(value)
}

function exportToCSV(logs: AuditLog[]) {
  const headers = ['Date & Time', 'Who (Actor)', 'What (Action)', 'Resource Type', 'Changes Made', 'Details']
  
  const rows = logs.map((log) => {
    // Get clean states and changes
    const cleanBefore = cleanStateForDisplay(log.before_state)
    const cleanAfter = cleanStateForDisplay(log.after_state)
    const changes = getChangedFields(cleanBefore, cleanAfter)
    
    // Format changes as "Field: before → after"
    const changesSummary = changes.length > 0
      ? changes.map(({ key, before, after }) => {
          const fieldName = formatFieldName(key)
          const beforeVal = formatValue(before).replace(/\n/g, ' ')
          const afterVal = formatValue(after).replace(/\n/g, ' ')
          return `${fieldName}: ${beforeVal} → ${afterVal}`
        }).join('; ')
      : 'No field changes recorded'
    
    // Format detailed description
    const details = `${getResourceTypeLabel(log.resource_type)} - ${getActionLabel(log.action)}`
    
    return [
      formatDateTime(log.created_at),
      log.actor_name || log.actor_user_id || 'System',
      getActionLabel(log.action),
      getResourceTypeLabel(log.resource_type),
      changesSummary,
      details,
    ]
  })

  const csv = [
    headers.join(','),
    ...rows.map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(',')),
  ].join('\n')

  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `workived-audit-logs-${new Date().toISOString().split('T')[0]}.csv`
  a.click()
  URL.revokeObjectURL(url)
}

// ── Pagination Component ───────────────────────────────────────────────────────

function PaginationControls({
  filters,
  setFilters,
  logCount,
}: {
  filters: AuditLogFilters
  setFilters: React.Dispatch<React.SetStateAction<AuditLogFilters>>
  logCount: number
}) {
  const currentPage = Math.floor((filters.offset || 0) / (filters.limit || 10)) + 1
  const hasFullPage = logCount >= (filters.limit || 10)
  const isOnFirstPage = (filters.offset || 0) === 0
  
  // Show pagination if we're on page 2+ or if we have a full page (suggesting more results)
  if (isOnFirstPage && !hasFullPage) return null

  return (
    <div className="flex items-center gap-2">
      <button
        onClick={() => setFilters((prev) => ({ ...prev, offset: Math.max(0, (prev.offset || 0) - (prev.limit || 10)) }))}
        disabled={isOnFirstPage}
        className="px-4 py-2 rounded-lg font-medium text-sm hover:bg-white/5 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        style={{ color: S.text }}
      >
        Previous
      </button>
      <button
        onClick={() => setFilters((prev) => ({ ...prev, offset: (prev.offset || 0) + (prev.limit || 10) }))}
        disabled={!hasFullPage}
        className="px-4 py-2 rounded-lg font-medium text-sm hover:bg-white/5 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        style={{ color: S.text }}
      >
        Next
      </button>
    </div>
  )
}

// ── Sidebar Component ──────────────────────────────────────────────────────────

function FilterSidebar({
  filters,
  searchInput,
  isSearchPending,
  uniqueActors,
  onSearchChange,
  onChange,
  onClear,
}: {
  filters: AuditLogFilters
  searchInput: string
  isSearchPending: boolean
  uniqueActors: string[]
  onSearchChange: (value: string) => void
  onChange: (key: keyof AuditLogFilters, value: any) => void
  onClear: () => void
}) {
  const hasActiveFilters =
    searchInput ||
    filters.resource_type ||
    filters.action ||
    filters.actor_name ||
    filters.start_date ||
    filters.end_date

  return (
    <aside className="hidden lg:flex flex-col gap-6 sticky top-8 self-start pt-2" style={{ minWidth: 240 }}>
      <div className="flex items-center justify-between">
        <h3 style={{ fontSize: 14, fontWeight: 700, color: S.text, letterSpacing: '-0.02em' }}>
          Filters
        </h3>
        {hasActiveFilters && (
          <button
            onClick={onClear}
            className="flex items-center gap-1.5 px-2 py-1 rounded-md hover:bg-white/5 transition-colors text-xs"
            style={{ color: S.textMuted }}
          >
            <X size={12} />
            Clear
          </button>
        )}
      </div>

      <div className="flex flex-col gap-4">
        <div>
          <label className="block text-xs font-medium mb-2 flex items-center gap-2" style={{ color: S.textMuted }}>
            Search Everything
            {isSearchPending && (
              <span className="text-xs opacity-50">(searching...)</span>
            )}
          </label>
          <input
            type="text"
            placeholder="Search actions, people, resources, changes..."
            value={searchInput}
            onChange={(e) => onSearchChange(e.target.value)}
            className="w-full px-3 py-2 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-white/20"
            style={{ background: S.inputBg, border: `1px solid ${S.inputBorder}`, color: S.text }}
          />
        </div>

        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="block text-xs font-medium" style={{ color: S.textMuted }}>
              Resource Type
            </label>
            {filters.resource_type && (
              <button
                onClick={() => onChange('resource_type', '')}
                className="text-xs hover:opacity-70 transition-opacity"
                style={{ color: S.textMuted }}
              >
                <X size={12} />
              </button>
            )}
          </div>
          <select
            value={filters.resource_type || ''}
            onChange={(e) => onChange('resource_type', e.target.value)}
            className="w-full px-3 py-2 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-white/20 appearance-none"
            style={{ background: S.inputBg, border: `1px solid ${S.inputBorder}`, color: S.text }}
          >
            <option value="">All Types</option>
            <option value="employee">Employee</option>
            <option value="leave">Leave</option>
            <option value="claim">Claim</option>
            <option value="task">Task</option>
            <option value="department">Department</option>
            <option value="organisation">Organisation</option>
          </select>
        </div>

        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="block text-xs font-medium" style={{ color: S.textMuted }}>
              Action
            </label>
            {filters.action && (
              <button
                onClick={() => onChange('action', '')}
                className="text-xs hover:opacity-70 transition-opacity"
                style={{ color: S.textMuted }}
              >
                <X size={12} />
              </button>
            )}
          </div>
          <select
            value={filters.action || ''}
            onChange={(e) => onChange('action', e.target.value)}
            className="w-full px-3 py-2 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-white/20 appearance-none"
            style={{ background: S.inputBg, border: `1px solid ${S.inputBorder}`, color: S.text }}
          >
            <option value="">All Actions</option>
            <option value="created">Created</option>
            <option value="updated">Updated</option>
            <option value="deleted">Deleted</option>
            <option value="approved">Approved</option>
            <option value="rejected">Rejected</option>
            <option value="cancelled">Cancelled</option>
            <option value="completed">Completed</option>
            <option value="deactivated">Deactivated</option>
          </select>
        </div>

        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="block text-xs font-medium" style={{ color: S.textMuted }}>
              Actor (Who)
            </label>
            {filters.actor_name && (
              <button
                onClick={() => onChange('actor_name', '')}
                className="text-xs hover:opacity-70 transition-opacity"
                style={{ color: S.textMuted }}
              >
                <X size={12} />
              </button>
            )}
          </div>
          <select
            value={filters.actor_name || ''}
            onChange={(e) => onChange('actor_name', e.target.value)}
            className="w-full px-3 py-2 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-white/20 appearance-none"
            style={{ background: S.inputBg, border: `1px solid ${S.inputBorder}`, color: S.text }}
          >
            <option value="">All People</option>
            {uniqueActors.map((actor) => (
              <option key={actor} value={actor}>
                {actor}
              </option>
            ))}
          </select>
        </div>

        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="block text-xs font-medium" style={{ color: S.textMuted }}>
              Start Date
            </label>
            {filters.start_date && (
              <button
                onClick={() => onChange('start_date', '')}
                className="text-xs hover:opacity-70 transition-opacity"
                style={{ color: S.textMuted }}
              >
                <X size={12} />
              </button>
            )}
          </div>
          <DatePicker
            value={filters.start_date || ''}
            onChange={(e) => onChange('start_date', e.target.value)}
            className="w-full px-3 py-2 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-white/20"
            style={{ background: S.inputBg, border: `1px solid ${S.inputBorder}`, color: S.text }}
          />
        </div>

        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="block text-xs font-medium" style={{ color: S.textMuted }}>
              End Date
            </label>
            {filters.end_date && (
              <button
                onClick={() => onChange('end_date', '')}
                className="text-xs hover:opacity-70 transition-opacity"
                style={{ color: S.textMuted }}
              >
                <X size={12} />
              </button>
            )}
          </div>
          <DatePicker
            value={filters.end_date || ''}
            onChange={(e) => onChange('end_date', e.target.value)}
            className="w-full px-3 py-2 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-white/20"
            style={{ background: S.inputBg, border: `1px solid ${S.inputBorder}`, color: S.text }}
          />
        </div>
      </div>
    </aside>
  )
}

// ── Main Component ─────────────────────────────────────────────────────────────

function AuditLogsPage() {
  const [filters, setFilters] = useState<AuditLogFilters>({
    limit: 10,
    offset: 0,
  })
  
  // Local state for search input to enable debouncing
  const [searchInput, setSearchInput] = useState('')
  const [isSearchPending, setIsSearchPending] = useState(false)
  const [uniqueActors, setUniqueActors] = useState<string[]>([])
  
  // Debounce search input - only update filters after 500ms of no typing
  useEffect(() => {
    if (searchInput !== (filters.search || '')) {
      setIsSearchPending(true)
    }
    
    const timer = setTimeout(() => {
      setFilters((prev) => ({
        ...prev,
        search: searchInput || undefined,
        offset: 0, // Reset pagination on search
      }))
      setIsSearchPending(false)
    }, 500)
    
    return () => clearTimeout(timer)
  }, [searchInput, filters.search])

  const { data, isLoading, error } = useAuditLogs(filters)
  
  // Fetch all actors for dropdown (unfiltered query)
  const { data: allActorsData } = useAuditLogs({ limit: 1000, offset: 0 })
  
  // Update unique actors list when allActorsData changes
  useEffect(() => {
    if (allActorsData?.data) {
      const actors = Array.from(
        new Set(
          allActorsData.data
            .map((log) => log.actor_name || log.actor_user_id)
            .filter(Boolean)
        )
      ).sort()
      setUniqueActors(actors)
    }
  }, [allActorsData])
  
  const logs = data?.data || []

  const handleFilterChange = (key: keyof AuditLogFilters, value: any) => {
    setFilters((prev) => ({
      ...prev,
      [key]: value || undefined,
      offset: 0, // Reset pagination
    }))
  }

  const clearFilters = () => {
    setFilters({ limit: 10, offset: 0 })
    setSearchInput('') // Also clear the search input
  }

  return (
    <div className="min-h-screen flex flex-col" style={{ background: moduleBackgrounds.settings }}>
      {/* Header */}
      <div className="px-10 pt-8 pb-2">
        <WorkivedLogo size={32} showWordmark variant="light" />
      </div>

      {/* Page title */}
      <div className="px-10 pt-6 pb-2 flex items-start justify-between">
        <div>
          <h1 style={{ fontSize: typography.h1.size, fontWeight: typography.h1.weight, letterSpacing: typography.h1.tracking, color: '#FFFFFF' }}>
            Audit Logs
          </h1>
          <p style={{ fontSize: 15, color: S.textMuted, marginTop: 4 }}>
            View all system activities and changes for compliance
          </p>
        </div>
        <button
          onClick={() => exportToCSV(logs)}
          disabled={logs.length === 0}
          className="flex items-center gap-2 px-4 py-2 rounded-lg font-medium text-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          style={{ background: 'rgba(255,255,255,0.07)', color: C.accent, border: `1px solid rgba(255,255,255,0.12)` }}
        >
          <Download size={16} />
          Export CSV
        </button>
      </div>

      {/* Two-column layout: sidebar + content */}
      <div className="flex-1 px-10 pt-8 pb-32 flex gap-12">
        
        {/* Sidebar */}
        <FilterSidebar 
          filters={filters} 
          searchInput={searchInput}
          isSearchPending={isSearchPending}
          uniqueActors={uniqueActors}
          onSearchChange={setSearchInput}
          onChange={handleFilterChange} 
          onClear={clearFilters} 
        />

        {/* Content */}
        <main className="flex-1 flex flex-col gap-6">
          
          {/* Header with pagination */}
          <div className="flex items-center justify-between">
            <h2 style={{ fontSize: 16, fontWeight: 700, color: S.text, letterSpacing: '-0.02em' }}>
              Recent Activity
            </h2>
            {!isLoading && !error && logs.length > 0 && (
              <PaginationControls filters={filters} setFilters={setFilters} logCount={logs.length} />
            )}
          </div>

        {/* Loading State */}
        {isLoading && (
          <div className="space-y-3">
            {[1, 2, 3, 4, 5].map((i) => (
              <div
                key={i}
                className="animate-pulse rounded-xl p-4"
                style={{ background: S.cardBg, height: 80 }}
              />
            ))}
          </div>
        )}

        {/* Error State */}
        {error && (
          <div
            className="rounded-xl p-6 text-center"
            style={{ background: 'rgba(212,64,64,0.1)', border: '1px solid rgba(212,64,64,0.3)' }}
          >
            <p style={{ color: '#F87171', fontSize: 14 }}>Failed to load audit logs. Please try again.</p>
          </div>
        )}

        {/* Empty State */}
        {!isLoading && !error && logs.length === 0 && (
          <div className="text-center py-16">
            <FileText size={64} style={{ color: S.textDim }} className="mx-auto mb-4 opacity-30" />
            <p style={{ color: S.textMuted, fontSize: 15 }}>
              {(filters.search || filters.resource_type || filters.action || filters.actor_name || filters.start_date || filters.end_date) 
                ? 'No audit logs match your search or filters' 
                : 'No audit logs recorded yet'}
            </p>
          </div>
        )}

        {/* Audit Log Table */}
        {!isLoading && !error && logs.length > 0 && (
          <div className="space-y-2">
            {logs.map((log) => (
              <div
                key={log.id}
                className="rounded-xl p-4 hover:bg-white/5 transition-colors"
                style={{ background: S.cardBg, border: `1px solid ${S.inputBorder}` }}
              >
                {(log.before_state || log.after_state) ? (
                  <details className="group">
                    {/* Header row: badges/timestamp on left, View Details on right */}
                    <summary className="flex items-start justify-between gap-4 cursor-pointer list-none">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          <span
                            className="px-2 py-1 rounded text-xs font-semibold"
                            style={{ background: C.accentDim, color: C.accent }}
                          >
                            {getActionLabel(log.action)}
                          </span>
                          <span
                            className="px-2 py-1 rounded text-xs font-medium"
                            style={{ background: S.inputBg, color: S.textMuted }}
                          >
                            {getResourceTypeLabel(log.resource_type)}
                          </span>
                        </div>
                        <div className="flex items-center gap-2 text-sm" style={{ color: S.textMuted }}>
                          <User size={14} />
                          <span>{log.actor_name || log.actor_user_id}</span>
                          <span>•</span>
                          <Calendar size={14} />
                          <span>{formatDateTime(log.created_at)}</span>
                        </div>
                      </div>

                      <div
                        className="shrink-0 px-3 py-1.5 rounded hover:bg-white/5 transition-colors text-sm"
                        style={{ color: S.textMuted, fontWeight: 500 }}
                      >
                        <span className="group-open:hidden">▶ View Details</span>
                        <span className="hidden group-open:inline">▼ Hide Details</span>
                      </div>
                    </summary>

                    {/* Details panel (shown when expanded) */}
                    <div
                      className="mt-4 rounded-lg overflow-hidden w-full"
                      style={{ background: S.inputBg, border: `1px solid ${S.inputBorder}` }}
                    >
                      {(() => {
                        const cleanBefore = cleanStateForDisplay(log.before_state)
                        const cleanAfter = cleanStateForDisplay(log.after_state)
                        const changes = getChangedFields(cleanBefore, cleanAfter)
                        
                        if (changes.length === 0) {
                          return (
                            <div className="p-4 text-center" style={{ color: S.textMuted }}>
                              No user-visible changes
                            </div>
                          )
                        }
                        
                        return (
                          <div className="overflow-x-auto w-full">
                            {/* Table Header */}
                            <div 
                              className="grid gap-6 px-6 py-3 border-b font-semibold text-xs"
                              style={{ 
                                gridTemplateColumns: '200px 1fr 1fr',
                                background: 'rgba(255,255,255,0.02)',
                                borderColor: S.divider,
                                color: S.textMuted,
                              }}
                            >
                              <div>Field</div>
                              <div>Before</div>
                              <div>After</div>
                            </div>
                            
                            {/* Table Rows */}
                            {changes.map(({ key, before, after }, index) => (
                              <div 
                                key={key}
                                className="grid gap-6 px-6 py-3.5 text-sm"
                                style={{ 
                                  gridTemplateColumns: '200px 1fr 1fr',
                                  borderBottom: index < changes.length - 1 ? `1px solid ${S.divider}` : 'none'
                                }}
                              >
                                <div className="font-semibold" style={{ color: S.text }}>
                                  {formatFieldName(key)}
                                </div>
                                <div 
                                  className="px-3 py-2 rounded font-mono text-xs"
                                  style={{ 
                                    background: 'rgba(212,64,64,0.1)', 
                                    color: '#F87171',
                                    wordBreak: 'break-word'
                                  }}
                                >
                                  {formatValue(before)}
                                </div>
                                <div 
                                  className="px-3 py-2 rounded font-mono text-xs"
                                  style={{ 
                                    background: 'rgba(18,160,92,0.1)', 
                                    color: '#34D399',
                                    wordBreak: 'break-word'
                                  }}
                                >
                                  {formatValue(after)}
                                </div>
                              </div>
                            ))}
                          </div>
                        )
                      })()}
                    </div>
                  </details>
                ) : (
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <span
                          className="px-2 py-1 rounded text-xs font-semibold"
                          style={{ background: C.accentDim, color: C.accent }}
                        >
                          {getActionLabel(log.action)}
                        </span>
                        <span
                          className="px-2 py-1 rounded text-xs font-medium"
                          style={{ background: S.inputBg, color: S.textMuted }}
                        >
                          {getResourceTypeLabel(log.resource_type)}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 text-sm" style={{ color: S.textMuted }}>
                        <User size={14} />
                        <span>{log.actor_name || log.actor_user_id}</span>
                        <span>•</span>
                        <Calendar size={14} />
                        <span>{formatDateTime(log.created_at)}</span>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Pagination (Bottom) */}
        {!isLoading && !error && logs.length > 0 && (
          <div className="mt-6 flex justify-end">
            <PaginationControls filters={filters} setFilters={setFilters} logCount={logs.length} />
          </div>
        )}
        
        </main>
      </div>
    </div>
  )
}
