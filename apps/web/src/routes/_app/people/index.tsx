import { createFileRoute, Link } from '@tanstack/react-router'
import { useState } from 'react'
import { Search, Plus, Users } from 'lucide-react'
import { useEmployees } from '@/lib/hooks/useEmployees'
import { Avatar } from '@/components/workived/layout/Avatar'
import { StatusSquare } from '@/components/workived/layout/StatusSquare'
import { moduleBackgrounds, moduleThemes } from '@/design/tokens'

const t = moduleThemes.people

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
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<string | undefined>(undefined)
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
      style={{ background: moduleBackgrounds.people }}
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1
            className="font-extrabold"
            style={{ fontSize: 44, letterSpacing: '-0.05em', color: t.text, lineHeight: 1 }}
          >
            People
          </h1>
          <p className="text-sm mt-2" style={{ color: t.textMuted }}>
            {employees.length} employee{employees.length !== 1 ? 's' : ''}
          </p>
        </div>
        <Link
          to="/people/$id"
          params={{ id: 'new' }}
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
      </div>

      {/* Search */}
      <div className="relative mb-4">
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
          {employees.map((emp) => (
            <Link
              key={emp.id}
              to="/people/$id"
              params={{ id: emp.id }}
              className="flex items-center gap-4 transition-all duration-150 hover:-translate-y-px"
              style={{
                background: t.surface,
                borderRadius: 12,
                padding: '14px 20px',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = t.surfaceHover
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = t.surface
              }}
            >
              <Avatar name={emp.full_name} id={emp.id} size={32} />

              <div className="flex-1 min-w-0 flex items-center gap-4">
                <p
                  className="font-semibold truncate"
                  style={{ fontSize: 13, color: t.text, minWidth: 0, flex: '0 1 auto', maxWidth: 200 }}
                >
                  {emp.full_name}
                </p>
                <p
                  className="truncate hidden md:block"
                  style={{ fontSize: 12, color: t.textMuted, flex: '0 1 auto', maxWidth: 160 }}
                >
                  {emp.job_title ?? emp.employment_type.replace('_', ' ')}
                </p>

                {emp.department_name && (
                  <span
                    className="font-semibold hidden md:inline-block truncate"
                    style={{
                      fontSize: 11,
                      color: t.textMuted,
                      background: t.surface,
                      padding: '3px 9px',
                      borderRadius: 6,
                      flexShrink: 0,
                    }}
                  >
                    {emp.department_name}
                  </span>
                )}
              </div>

              <StatusSquare status={emp.status} />
            </Link>
          ))}
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
  return (
    <div className="flex flex-col gap-[3px]">
      {Array.from({ length: 8 }).map((_, i) => (
        <div
          key={i}
          className="flex items-center gap-4 animate-pulse"
          style={{
            background: t.surface,
            borderRadius: 12,
            padding: '14px 20px',
          }}
        >
          <div className="rounded-[9px] flex-shrink-0" style={{ width: 32, height: 32, background: t.surfaceHover }} />
          <div className="flex-1 flex items-center gap-4">
            <div className="rounded-md" style={{ width: 120, height: 13, background: t.surfaceHover }} />
            <div className="rounded-md hidden md:block" style={{ width: 80, height: 12, background: t.surface }} />
            <div className="rounded-md hidden md:block" style={{ width: 64, height: 20, background: t.surface }} />
          </div>
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
      {!hasFiltering && (
        <Link
          to="/people/$id"
          params={{ id: 'new' }}
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
