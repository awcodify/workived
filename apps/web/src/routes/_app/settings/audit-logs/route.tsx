import { createFileRoute } from '@tanstack/react-router'
import { useState, useEffect } from 'react'
import { useAuditLogs } from '@/lib/hooks/useAudit'
import { WorkivedLogo } from '@/components/workived/layout/WorkivedLogo'
import { colors, typography, radius } from '@/design/tokens'
import { Download, X } from 'lucide-react'
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

// ── Page palette (matches company settings dark-bg: #0A0A12) ──────────────────

const pageBg    = '#0A0A12'
const surfaceBg = 'rgba(255,255,255,0.035)'
const text      = '#FFFFFF'
const textSec   = 'rgba(255,255,255,0.50)'
const textDim   = 'rgba(255,255,255,0.28)'
const border    = 'rgba(255,255,255,0.06)'
const inputBg   = 'rgba(255,255,255,0.05)'
const inputBdr  = 'rgba(255,255,255,0.10)'
const cardBg    = 'rgba(255,255,255,0.055)'

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

// ── Action color map ───────────────────────────────────────────────────────────

function getActionColor(action: string): { dot: string; bg: string; fg: string } {
  if (action.includes('created')) return { dot: '#34D399', bg: 'rgba(52,211,153,0.10)', fg: '#34D399' }
  if (action.includes('approved') || action.includes('completed')) return { dot: '#34D399', bg: 'rgba(52,211,153,0.10)', fg: '#34D399' }
  if (action.includes('updated')) return { dot: '#60A5FA', bg: 'rgba(96,165,250,0.10)', fg: '#60A5FA' }
  if (action.includes('deleted') || action.includes('deactivated')) return { dot: '#F87171', bg: 'rgba(248,113,113,0.10)', fg: '#F87171' }
  if (action.includes('rejected') || action.includes('cancelled')) return { dot: '#FBBF24', bg: 'rgba(251,191,36,0.10)', fg: '#FBBF24' }
  return { dot: C.accent, bg: C.accentDim, fg: C.accent }
}

// ── Resource type icon ─────────────────────────────────────────────────────────

function ResourceIcon({ type }: { type: string }) {
  const color = textSec
  switch (type) {
    case 'employee':
      return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="8" r="4"/><path d="M20 21a8 8 0 00-16 0"/></svg>
    case 'leave':
      return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round"><rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/></svg>
    case 'claim':
      return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
    case 'task':
      return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round"><polyline points="9 11 12 14 22 4"/><path d="M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11"/></svg>
    default:
      return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="12" r="10"/></svg>
  }
}

// ── Pagination ─────────────────────────────────────────────────────────────────

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

  if (isOnFirstPage && !hasFullPage) return null

  return (
    <div className="flex items-center gap-1">
      <button
        onClick={() => setFilters((prev) => ({ ...prev, offset: Math.max(0, (prev.offset || 0) - (prev.limit || 10)) }))}
        disabled={isOnFirstPage}
        className="px-3 py-1.5 transition-colors disabled:opacity-30 hover:brightness-125"
        style={{ color: textSec, borderRadius: radius.md, fontSize: typography.label.size, fontWeight: 600 }}
      >
        ← Newer
      </button>
      <span style={{ color: textDim, fontSize: typography.caption.size }}>Page {currentPage}</span>
      <button
        onClick={() => setFilters((prev) => ({ ...prev, offset: (prev.offset || 0) + (prev.limit || 10) }))}
        disabled={!hasFullPage}
        className="px-3 py-1.5 transition-colors disabled:opacity-30 hover:brightness-125"
        style={{ color: textSec, borderRadius: radius.md, fontSize: typography.label.size, fontWeight: 600 }}
      >
        Older →
      </button>
    </div>
  )
}

// ── Timeline entry ─────────────────────────────────────────────────────────────

function TimelineEntry({ log }: { log: AuditLog }) {
  const [expanded, setExpanded] = useState(false)
  const ac = getActionColor(log.action)
  const hasDetails = log.before_state || log.after_state

  const cleanBefore = cleanStateForDisplay(log.before_state)
  const cleanAfter = cleanStateForDisplay(log.after_state)
  const changes = hasDetails ? getChangedFields(cleanBefore, cleanAfter) : []

  return (
    <div className="flex gap-5 group">
      {/* Timeline spine */}
      <div className="flex flex-col items-center pt-1">
        <div className="w-3 h-3 shrink-0" style={{ background: ac.dot, borderRadius: '50%', boxShadow: `0 0 8px ${ac.dot}40` }} />
        <div className="w-px flex-1 mt-1" style={{ background: border }} />
      </div>

      {/* Content */}
      <div className="flex-1 pb-8">
        {/* Actor + time */}
        <div className="flex items-center gap-2 mb-1.5">
          <span style={{ color: text, fontSize: typography.body.size, fontWeight: 600 }}>
            {log.actor_name || log.actor_user_id || 'System'}
          </span>
          <span style={{ color: textDim, fontSize: typography.caption.size }}>
            {formatDateTime(log.created_at)}
          </span>
        </div>

        {/* Action sentence */}
        <div className="flex items-center gap-2 flex-wrap mb-2">
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1" style={{ background: ac.bg, color: ac.fg, borderRadius: radius.md, fontSize: typography.label.size, fontWeight: 600 }}>
            {getActionLabel(log.action)}
          </span>
          <span className="inline-flex items-center gap-1.5 px-2 py-1" style={{ background: inputBg, color: textSec, borderRadius: radius.md, fontSize: typography.label.size }}>
            <ResourceIcon type={log.resource_type} />
            {getResourceTypeLabel(log.resource_type)}
          </span>
        </div>

        {/* Inline changes preview */}
        {hasDetails && changes.length > 0 && (
          <div className="mt-2">
            {!expanded && (
              <button
                onClick={() => setExpanded(true)}
                className="flex items-center gap-2 px-3 py-1.5 transition-colors hover:brightness-125"
                style={{ background: inputBg, border: `1px solid ${inputBdr}`, borderRadius: radius.lg, color: textSec, fontSize: typography.label.size }}
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M12 5v14M5 12h14"/></svg>
                {changes.length} field{changes.length > 1 ? 's' : ''} changed
              </button>
            )}

            {expanded && (
              <div className="mt-1" style={{ background: inputBg, border: `1px solid ${inputBdr}`, borderRadius: radius.lg, overflow: 'hidden' }}>
                {/* Collapse button */}
                <button
                  onClick={() => setExpanded(false)}
                  className="w-full flex items-center gap-2 px-4 py-2 transition-colors hover:bg-white/[0.02]"
                  style={{ color: textSec, fontSize: typography.label.size, borderBottom: `1px solid ${border}` }}
                >
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M5 12h14"/></svg>
                  Hide changes
                </button>

                {/* Change rows */}
                <div className="divide-y" style={{ borderColor: border }}>
                  {changes.map(({ key, before, after }) => (
                    <div key={key} className="px-4 py-3 flex flex-col gap-1.5">
                      <span style={{ color: text, fontSize: typography.label.size, fontWeight: 600 }}>{formatFieldName(key)}</span>
                      <div className="flex items-start gap-3">
                        {before != null && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 font-mono" style={{ background: 'rgba(248,113,113,0.08)', color: '#F87171', borderRadius: radius.sm, fontSize: typography.caption.size, wordBreak: 'break-word' }}>
                            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round"><path d="M5 12h14"/></svg>
                            {formatValue(before)}
                          </span>
                        )}
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke={textDim} strokeWidth="2" strokeLinecap="round" className="mt-1 shrink-0"><path d="M5 12h14"/><polyline points="12 5 19 12 12 19"/></svg>
                        {after != null && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 font-mono" style={{ background: 'rgba(52,211,153,0.08)', color: '#34D399', borderRadius: radius.sm, fontSize: typography.caption.size, wordBreak: 'break-word' }}>
                            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round"><path d="M12 5v14"/><path d="M5 12h14"/></svg>
                            {formatValue(after)}
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {hasDetails && changes.length === 0 && (
          <p className="mt-1" style={{ color: textDim, fontSize: typography.caption.size, fontStyle: 'italic' }}>No visible field changes</p>
        )}
      </div>
    </div>
  )
}

// ── Filter chip ────────────────────────────────────────────────────────────────

function FilterChip({ label, value, onClear }: { label: string; value: string; onClear: () => void }) {
  return (
    <span className="inline-flex items-center gap-1.5 px-2.5 py-1" style={{ background: C.accentDim, color: C.accent, borderRadius: radius.md, fontSize: typography.caption.size, fontWeight: 600 }}>
      {label}: {value}
      <button onClick={onClear} className="hover:opacity-70 transition-opacity ml-0.5">
        <X size={11} />
      </button>
    </span>
  )
}

// ── Main Component ─────────────────────────────────────────────────────────────

function AuditLogsPage() {
  const [filters, setFilters] = useState<AuditLogFilters>({
    limit: 10,
    offset: 0,
  })
  const [showFilters, setShowFilters] = useState(false)

  const [searchInput, setSearchInput] = useState('')
  const [isSearchPending, setIsSearchPending] = useState(false)
  const [uniqueActors, setUniqueActors] = useState<string[]>([])

  useEffect(() => {
    if (searchInput !== (filters.search || '')) {
      setIsSearchPending(true)
    }

    const timer = setTimeout(() => {
      setFilters((prev) => ({
        ...prev,
        search: searchInput || undefined,
        offset: 0,
      }))
      setIsSearchPending(false)
    }, 500)

    return () => clearTimeout(timer)
  }, [searchInput, filters.search])

  const { data, isLoading, error } = useAuditLogs(filters)

  const { data: allActorsData } = useAuditLogs({ limit: 1000, offset: 0 })

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
      offset: 0,
    }))
  }

  const clearFilters = () => {
    setFilters({ limit: 10, offset: 0 })
    setSearchInput('')
  }

  const hasActiveFilters = filters.resource_type || filters.action || filters.actor_name || filters.start_date || filters.end_date

  return (
    <div className="min-h-screen relative" style={{ background: pageBg, fontFamily: typography.fontFamily }}>
      {/* Radial glow */}
      <div className="absolute inset-0 pointer-events-none" style={{ background: 'radial-gradient(ellipse at 50% 30%, rgba(99,87,232,0.14) 0%, transparent 60%)' }} />

      {/* Accent line at top */}
      <div className="h-[2px]" style={{ background: `linear-gradient(90deg, ${C.accent}, transparent 70%)` }} />

      <div className="w-full max-w-3xl mx-auto px-6 pt-10 pb-32 relative z-10">
        {/* Centered header with logo */}
        <div className="flex flex-col items-center mb-12">
          <div className="mb-4">
            <WorkivedLogo size={36} showWordmark variant="light" />
          </div>
          <h1 style={{ color: text, fontSize: typography.h1.size, fontWeight: typography.h1.weight, letterSpacing: typography.h1.tracking }}>
            Audit Logs
          </h1>
          <p className="mt-2" style={{ color: textDim, fontSize: typography.body.size }}>
            Everything that happened in your workspace
          </p>
        </div>

        {/* Search bar + filter toggle + export */}
        <div className="flex items-center gap-3 mb-4">
          <div className="flex-1 relative">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={textDim} strokeWidth="2" strokeLinecap="round" className="absolute left-3.5 top-1/2 -translate-y-1/2">
              <circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/>
            </svg>
            <input
              type="text"
              placeholder="Search people, actions, resources..."
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 focus:outline-none focus:ring-1 transition-colors"
              style={{ background: surfaceBg, border: `1px solid ${inputBdr}`, color: text, borderRadius: radius.lg, fontSize: typography.body.size, fontFamily: typography.fontFamily }}
            />
            {isSearchPending && (
              <span className="absolute right-3.5 top-1/2 -translate-y-1/2" style={{ color: textDim, fontSize: typography.caption.size }}>...</span>
            )}
          </div>

          <button
            onClick={() => setShowFilters(!showFilters)}
            className="flex items-center gap-2 px-3.5 py-2.5 transition-colors hover:brightness-125 shrink-0"
            style={{ background: showFilters ? cardBg : surfaceBg, border: `1px solid ${showFilters ? C.accent + '40' : inputBdr}`, color: showFilters ? C.accent : textSec, borderRadius: radius.lg, fontSize: typography.body.size }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="4" y1="6" x2="20" y2="6"/><line x1="8" y1="12" x2="16" y2="12"/><line x1="11" y1="18" x2="13" y2="18"/></svg>
            Filter
          </button>

          <button
            onClick={() => exportToCSV(logs)}
            disabled={logs.length === 0}
            className="flex items-center gap-2 px-3.5 py-2.5 transition-all disabled:opacity-30 hover:brightness-125 shrink-0"
            style={{ background: surfaceBg, border: `1px solid ${inputBdr}`, color: textSec, borderRadius: radius.lg, fontSize: typography.body.size }}
          >
            <Download size={16} />
            CSV
          </button>
        </div>

        {/* Filter panel (collapsible) */}
        {showFilters && (
          <div className="mb-4 p-4 flex flex-col gap-3" style={{ background: surfaceBg, border: `1px solid ${border}`, borderRadius: radius.xl }}>
            <div className="flex flex-wrap gap-3 items-end">
              <div className="flex-1 min-w-[140px]">
                <label className="block mb-1.5" style={{ color: textDim, fontSize: typography.caption.size, fontWeight: 600 }}>Resource</label>
                <select
                  value={filters.resource_type || ''}
                  onChange={(e) => handleFilterChange('resource_type', e.target.value)}
                  className="w-full px-3 py-2 appearance-none focus:outline-none"
                  style={{ background: inputBg, border: `1px solid ${inputBdr}`, color: text, borderRadius: radius.md, fontSize: typography.label.size }}
                >
                  <option value="">All</option>
                  <option value="employee">Employee</option>
                  <option value="leave">Leave</option>
                  <option value="claim">Claim</option>
                  <option value="task">Task</option>
                  <option value="department">Department</option>
                  <option value="organisation">Organisation</option>
                </select>
              </div>
              <div className="flex-1 min-w-[140px]">
                <label className="block mb-1.5" style={{ color: textDim, fontSize: typography.caption.size, fontWeight: 600 }}>Action</label>
                <select
                  value={filters.action || ''}
                  onChange={(e) => handleFilterChange('action', e.target.value)}
                  className="w-full px-3 py-2 appearance-none focus:outline-none"
                  style={{ background: inputBg, border: `1px solid ${inputBdr}`, color: text, borderRadius: radius.md, fontSize: typography.label.size }}
                >
                  <option value="">All</option>
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
              <div className="flex-1 min-w-[140px]">
                <label className="block mb-1.5" style={{ color: textDim, fontSize: typography.caption.size, fontWeight: 600 }}>Who</label>
                <select
                  value={filters.actor_name || ''}
                  onChange={(e) => handleFilterChange('actor_name', e.target.value)}
                  className="w-full px-3 py-2 appearance-none focus:outline-none"
                  style={{ background: inputBg, border: `1px solid ${inputBdr}`, color: text, borderRadius: radius.md, fontSize: typography.label.size }}
                >
                  <option value="">Anyone</option>
                  {uniqueActors.map((actor) => (
                    <option key={actor} value={actor}>{actor}</option>
                  ))}
                </select>
              </div>
            </div>
            <div className="flex flex-wrap gap-3 items-end">
              <div className="flex-1 min-w-[130px]">
                <label className="block mb-1.5" style={{ color: textDim, fontSize: typography.caption.size, fontWeight: 600 }}>From</label>
                <DatePicker
                  value={filters.start_date || ''}
                  onChange={(e) => handleFilterChange('start_date', e.target.value)}
                  className="w-full px-3 py-2 focus:outline-none"
                  style={{ background: inputBg, border: `1px solid ${inputBdr}`, color: text, borderRadius: radius.md, fontSize: typography.label.size }}
                />
              </div>
              <div className="flex-1 min-w-[130px]">
                <label className="block mb-1.5" style={{ color: textDim, fontSize: typography.caption.size, fontWeight: 600 }}>To</label>
                <DatePicker
                  value={filters.end_date || ''}
                  onChange={(e) => handleFilterChange('end_date', e.target.value)}
                  className="w-full px-3 py-2 focus:outline-none"
                  style={{ background: inputBg, border: `1px solid ${inputBdr}`, color: text, borderRadius: radius.md, fontSize: typography.label.size }}
                />
              </div>
              {hasActiveFilters && (
                <button
                  onClick={clearFilters}
                  className="flex items-center gap-1.5 px-3 py-2 transition-colors hover:brightness-125"
                  style={{ color: textSec, fontSize: typography.label.size }}
                >
                  <X size={14} />
                  Clear
                </button>
              )}
            </div>
          </div>
        )}

        {/* Active filter chips */}
        {hasActiveFilters && (
          <div className="flex flex-wrap gap-2 mb-5">
            {filters.resource_type && <FilterChip label="Resource" value={getResourceTypeLabel(filters.resource_type)} onClear={() => handleFilterChange('resource_type', '')} />}
            {filters.action && <FilterChip label="Action" value={filters.action} onClear={() => handleFilterChange('action', '')} />}
            {filters.actor_name && <FilterChip label="By" value={filters.actor_name} onClear={() => handleFilterChange('actor_name', '')} />}
            {filters.start_date && <FilterChip label="From" value={filters.start_date} onClear={() => handleFilterChange('start_date', '')} />}
            {filters.end_date && <FilterChip label="To" value={filters.end_date} onClear={() => handleFilterChange('end_date', '')} />}
          </div>
        )}

        {/* Loading */}
        {isLoading && (
          <div className="space-y-6 pl-8 mt-8">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="flex gap-5">
                <div className="w-3 h-3 rounded-full animate-pulse shrink-0" style={{ background: inputBg }} />
                <div className="flex-1 space-y-2">
                  <div className="h-3 w-40 animate-pulse" style={{ background: inputBg, borderRadius: radius.sm }} />
                  <div className="h-6 w-56 animate-pulse" style={{ background: inputBg, borderRadius: radius.sm }} />
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="py-12 text-center" style={{ color: '#F87171' }}>
            <p style={{ fontSize: typography.body.size }}>Failed to load audit logs. Please try again.</p>
          </div>
        )}

        {/* Empty */}
        {!isLoading && !error && logs.length === 0 && (
          <div className="text-center py-20">
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke={textDim} strokeWidth="1" strokeLinecap="round" className="mx-auto mb-4 opacity-40">
              <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
            </svg>
            <p style={{ color: textSec, fontSize: typography.body.size }}>
              {hasActiveFilters || searchInput ? 'No logs match your filters' : 'No audit logs yet'}
            </p>
          </div>
        )}

        {/* Timeline feed */}
        {!isLoading && !error && logs.length > 0 && (
          <div className="mt-6">
            {logs.map((log) => (
              <TimelineEntry key={log.id} log={log} />
            ))}
          </div>
        )}

        {/* Bottom pagination */}
        {!isLoading && !error && logs.length > 0 && (
          <div className="mt-4 flex justify-center">
            <PaginationControls filters={filters} setFilters={setFilters} logCount={logs.length} />
          </div>
        )}
      </div>
    </div>
  )
}
