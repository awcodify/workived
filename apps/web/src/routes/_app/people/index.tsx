import { createFileRoute, Link } from '@tanstack/react-router'
import { useState } from 'react'
import { Search, Plus, Network, Users } from 'lucide-react'
import { useEmployees } from '@/lib/hooks/useEmployees'
import { useCanManageEmployees } from '@/lib/hooks/useRole'
import { Avatar } from '@/components/workived/layout/Avatar'
import { StatusSquare } from '@/components/workived/layout/StatusSquare'
import { useModuleTheme, useModuleBackground, typography, colors } from '@/design/tokens'
import { DateTime } from '@/components/workived/shared/DateTime'

export const Route = createFileRoute('/_app/people/')({
  component: PeoplePage,
})

const STATUS_TABS = [
  { value: undefined, label: 'All' },
  { value: 'active', label: 'Active' },
  { value: 'probation', label: 'Probation' },
  { value: 'inactive', label: 'Inactive' },
] as const

function PeoplePage() {
  const t = useModuleTheme('people')
  const bg = useModuleBackground('people')
  const canManageEmployees = useCanManageEmployees()
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<string | undefined>('active')
  const [cursor, setCursor] = useState<string | undefined>(undefined)
  const [history, setHistory] = useState<(string | undefined)[]>([undefined])

  const { data, isLoading } = useEmployees({
    cursor,
    limit: 20,
    search: search || undefined,
    status: statusFilter,
  })
  const employees = data?.data ?? []
  const meta = data?.meta

  const handleNext = () => {
    if (meta?.next_cursor) {
      setHistory((h) => [...h, meta.next_cursor])
      setCursor(meta.next_cursor)
    }
  }

  const handlePrev = () => {
    setHistory((h) => {
      const prev = h.slice(0, -1)
      setCursor(prev[prev.length - 1])
      return prev
    })
  }

  const handleSearch = (value: string) => {
    setSearch(value)
    setCursor(undefined)
    setHistory([undefined])
  }

  const handleStatusFilter = (status: string | undefined) => {
    setStatusFilter(status)
    setCursor(undefined)
    setHistory([undefined])
  }

  return (
    <div
      className="min-h-screen px-6 py-8 md:px-11 md:py-10"
      style={{ background: bg, paddingBottom: '160px' }}
    >
      {/* Header */}
      <div className="mb-6">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1
            className="font-extrabold"
            style={{ fontSize: typography.display.size, letterSpacing: typography.display.tracking, color: t.text, lineHeight: typography.display.lineHeight }}
          >
            People
          </h1>
          <p className="text-sm mt-2" style={{ color: t.textMuted }}>
            {employees.length} employee{employees.length !== 1 ? 's' : ''}
          </p>
        </div>
        
        <div className="flex flex-col-reverse md:flex-row items-start md:items-center gap-3 md:gap-4">
          {/* Action Buttons */}
          {canManageEmployees && (
            <Link
              to="/people/$id"
              params={{ id: 'new' }}
              search={{ user_id: undefined }}
              className="flex items-center gap-1.5 text-sm font-semibold px-4 py-2.5 transition-colors hover:opacity-90"
              style={{
                background: t.accent,
                color: t.accentText,
                borderRadius: 12,
              }}
            >
              <Plus size={16} />
              Add employee
            </Link>
          )}
          
          <div className="flex items-center gap-4">
            <DateTime 
              textColor={t.text}
              textMutedColor={t.textMuted}
              borderColor={t.border}
            />
            {/* Notification Placeholder */}
            <div
              style={{
                minWidth: 36,
                height: 36,
                background: t.surface,
                borderRadius: 10,
                boxShadow: '0 1px 4px 0 rgba(0,0,0,0.04)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: 0,
                border: `1px solid ${t.border}`,
              }}
              title="No notifications"
            >
              <svg width="18" height="18" fill="none" viewBox="0 0 24 24" style={{ color: colors.accent, flexShrink: 0 }}>
                <path d="M18 16v-5a6 6 0 10-12 0v5a2 2 0 01-2 2h16a2 2 0 01-2-2z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                <path d="M13.73 21a2 2 0 01-3.46 0" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </div>
          </div>
        </div>
        </div>
      </div>
      {/* Search and Org Chart Row */}
      <div className="grid grid-cols-1 md:grid-cols-[1fr_auto] gap-3 mb-4">
        {/* Search */}
        <div className="relative">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: t.textMuted }} />
          <input
            type="text"
            placeholder="Search employees..."
            value={search}
            onChange={(e) => handleSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-2.5 text-sm focus:outline-none focus:ring-2"
            style={{
              background: t.input,
              border: `1px solid ${t.inputBorder}`,
              borderRadius: 12,
              color: t.text,
            }}
          />
        </div>
        
        {/* Org Chart Button */}
        <Link
          to="/org-chart"
          className="flex items-center gap-1.5 text-sm font-semibold px-4 py-2.5 transition-colors hover:opacity-90 whitespace-nowrap"
          style={{
            background: t.surface,
            color: t.text,
            borderRadius: 12,
            border: `1px solid ${t.border}`,
          }}
        >
          <Network size={16} />
          Org Chart
        </Link>
      </div>

      {/* Status filter tabs */}
      <div className="flex items-center gap-1 mb-5">
        {STATUS_TABS.map((tab) => {
          const isActive = statusFilter === tab.value
          return (
            <button
              key={tab.label}
              onClick={() => handleStatusFilter(tab.value)}
              className="text-sm font-medium px-3.5 py-1.5 transition-colors"
              style={{
                borderRadius: 8,
                background: isActive ? t.surfaceHover : 'transparent',
                color: isActive ? t.text : t.textMuted,
                boxShadow: 'none',
              }}
            >
              {tab.label}
            </button>
          )
        })}
      </div>

      {/* Employee list */}
      {isLoading ? (
        <PeopleRowsSkeleton />
      ) : employees.length === 0 ? (
        <PeopleEmptyState hasSearch={!!search} search={search} hasFilter={!!statusFilter} />
      ) : (
        <div className="flex flex-col gap-[3px]">
          {/* Table header */}
          <div
            className="grid items-center gap-4 px-5 py-2"
            style={{
              gridTemplateColumns: '40px 1.5fr 1fr 1fr 80px',
              color: t.textMuted,
              fontSize: 11,
              fontWeight: 600,
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
            }}
          >
            <div></div>
            <div>Employee</div>
            <div>Reporting to</div>
            <div>Department</div>
            <div>Status</div>
          </div>

          {/* Table rows */}
          {employees.map((emp) => {
            const isInactive = emp.status === 'inactive'
            return (
              <Link
                key={emp.id}
                to="/people/$id"
                params={{ id: emp.id }}
                search={{ user_id: undefined }}
                className="grid items-center gap-4 transition-all duration-150 hover:-translate-y-px"
                style={{
                  gridTemplateColumns: '40px 1.5fr 1fr 1fr 80px',
                  background: t.surface,
                  borderRadius: 12,
                  padding: '14px 20px',
                  opacity: isInactive ? 0.5 : 1,
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = t.surfaceHover
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = t.surface
                }}
              >
                <Avatar name={emp.full_name} id={emp.id} size={32} />

              <div className="min-w-0">
                <p
                  className="font-semibold truncate"
                  style={{ fontSize: 13, color: t.text }}
                >
                  {emp.full_name}
                </p>
                <p
                  className="truncate"
                  style={{ fontSize: 12, color: t.textMuted, marginTop: 2 }}
                >
                  {emp.job_title ?? emp.employment_type.replace('_', ' ')}
                </p>
              </div>

              <p
                className="truncate"
                style={{ fontSize: 12, color: t.textMuted }}
              >
                {emp.manager_name ?? '—'}
              </p>

              <p
                className="truncate"
                style={{ fontSize: 12, color: t.textMuted }}
              >
                {emp.department_name ?? '—'}
              </p>

              <StatusSquare status={emp.status} />
            </Link>
            )
          })}
        </div>
      )}

      {/* Pagination */}
      {(meta?.has_more || history.length > 1) && (
        <div className="flex items-center justify-center gap-2 mt-8">
          <button
            onClick={handlePrev}
            disabled={history.length <= 1}
            className="text-sm font-medium px-4 py-2 transition-colors disabled:opacity-30"
            style={{ color: t.textMuted, borderRadius: 8 }}
            onMouseEnter={(e) => {
              if (!e.currentTarget.disabled) e.currentTarget.style.background = t.surface
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'transparent'
            }}
          >
            Previous
          </button>
          <button
            onClick={handleNext}
            disabled={!meta?.has_more}
            className="text-sm font-medium px-4 py-2 transition-colors disabled:opacity-30"
            style={{ color: t.textMuted, borderRadius: 8 }}
            onMouseEnter={(e) => {
              if (!e.currentTarget.disabled) e.currentTarget.style.background = t.surface
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'transparent'
            }}
          >
            Next
          </button>
        </div>
      )}
    </div>
  )
}

// ── Skeleton loader ──────────────────────────────────────────────
function PeopleRowsSkeleton() {
  const t = useModuleTheme('people')
  
  return (
    <div className="flex flex-col gap-[3px]">
      {/* Header skeleton */}
      <div
        className="grid items-center gap-4 px-5 py-2"
        style={{
          gridTemplateColumns: '40px 1.5fr 1fr 1fr 80px',
        }}
      >
        <div></div>
        <div className="rounded-md" style={{ width: 40, height: 11, background: t.surfaceHover }} />
        <div className="rounded-md" style={{ width: 50, height: 11, background: t.surfaceHover }} />
        <div className="rounded-md" style={{ width: 70, height: 11, background: t.surfaceHover }} />
        <div className="rounded-md" style={{ width: 40, height: 11, background: t.surfaceHover }} />
      </div>

      {/* Row skeletons */}
      {Array.from({ length: 8 }).map((_, i) => (
        <div
          key={i}
          className="grid items-center gap-4 animate-pulse"
          style={{
            gridTemplateColumns: '40px 1.5fr 1fr 1fr 80px',
            background: t.surface,
            borderRadius: 12,
            padding: '14px 20px',
          }}
        >
          <div className="rounded-[9px] flex-shrink-0" style={{ width: 32, height: 32, background: t.surfaceHover }} />
          <div className="min-w-0">
            <div className="rounded-md" style={{ width: 120, height: 13, background: t.surfaceHover, marginBottom: 4 }} />
            <div className="rounded-md" style={{ width: 90, height: 12, background: t.surface }} />
          </div>
          <div className="rounded-md" style={{ width: 90, height: 12, background: t.surface }} />
          <div className="rounded-md" style={{ width: 70, height: 12, background: t.surface }} />
          <div className="flex items-center gap-1.5">
            <div className="rounded-sm" style={{ width: 7, height: 7, background: t.surfaceHover }} />
            <div className="rounded-sm" style={{ width: 40, height: 12, background: t.surface }} />
          </div>
        </div>
      ))}
    </div>
  )
}

// ── Empty state ──────────────────────────────────────────────────
function PeopleEmptyState({
  hasSearch,
  search,
  hasFilter,
}: {
  hasSearch: boolean
  search: string
  hasFilter: boolean
}) {
  const t = useModuleTheme('people')
  const canManageEmployees = useCanManageEmployees()
  const hasFiltering = hasSearch || hasFilter

  return (
    <div className="flex flex-col items-center justify-center py-16 gap-3">
      <div
        className="grid place-items-center"
        style={{ width: 48, height: 48, borderRadius: 14, background: t.accent }}
      >
        <Users size={22} style={{ color: t.accentText }} />
      </div>
      <p className="font-bold" style={{ fontSize: 15, color: t.text }}>
        {hasSearch ? `No results for "${search}"` : hasFilter ? 'No employees match this filter' : 'No employees yet'}
      </p>
      <p style={{ fontSize: 13, color: t.textMuted }}>
        {hasFiltering
          ? 'Try a different search or clear the filter.'
          : 'Add your first team member to get started.'}
      </p>
      {!hasFiltering && canManageEmployees && (
        <Link
          to="/people/$id"
          params={{ id: 'new' }}
          search={{ user_id: undefined }}
          className="flex items-center gap-1.5 text-sm font-semibold px-4 py-2.5 mt-2 transition-colors hover:opacity-90"
          style={{
            background: t.accent,
            color: t.accentText,
            borderRadius: 12,
          }}
        >
          <Plus size={16} />
          Add employee
        </Link>
      )}
    </div>
  )
}
