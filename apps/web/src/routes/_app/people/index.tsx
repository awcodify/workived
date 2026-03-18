import { createFileRoute, Link } from '@tanstack/react-router'
import { useState } from 'react'
import { Search, Plus, Users } from 'lucide-react'
import { useEmployees } from '@/lib/hooks/useEmployees'
import { Avatar } from '@/components/workived/layout/Avatar'
import { StatusSquare } from '@/components/workived/layout/StatusSquare'
import { moduleBackgrounds } from '@/design/tokens'

export const Route = createFileRoute('/_app/people/')({
  component: PeoplePage,
})

function PeoplePage() {
  const [search, setSearch] = useState('')
  const [cursor, setCursor] = useState<string | undefined>(undefined)
  const [history, setHistory] = useState<(string | undefined)[]>([undefined])

  const { data, isLoading } = useEmployees({
    cursor,
    limit: 20,
    search: search || undefined,
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
            style={{ fontSize: 44, letterSpacing: '-0.05em', color: '#1A1208', lineHeight: 1 }}
          >
            People
          </h1>
          <p className="text-sm mt-2" style={{ color: '#9C8B6E' }}>
            {employees.length} employee{employees.length !== 1 ? 's' : ''}
          </p>
        </div>
        <Link
          to="/people/$id"
          params={{ id: 'new' }}
          className="flex items-center gap-1.5 text-sm font-semibold px-4 py-2.5 transition-colors hover:opacity-90"
          style={{
            background: '#1A1208',
            color: moduleBackgrounds.people,
            borderRadius: 12,
          }}
        >
          <Plus size={16} />
          Add employee
        </Link>
      </div>

      {/* Search */}
      <div className="relative mb-6">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: '#9C8B6E' }} />
        <input
          type="text"
          placeholder="Search employees..."
          value={search}
          onChange={(e) => handleSearch(e.target.value)}
          className="w-full pl-9 pr-3 py-2.5 text-sm focus:outline-none focus:ring-2"
          style={{
            background: '#FFFFFF',
            border: '1px solid rgba(26,18,8,0.06)',
            borderRadius: 12,
            color: '#1A1208',
          }}
        />
      </div>

      {/* Content */}
      {isLoading ? (
        <PeopleGridSkeleton />
      ) : employees.length === 0 ? (
        <PeopleEmptyState hasSearch={!!search} search={search} />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {employees.map((emp) => (
            <Link
              key={emp.id}
              to="/people/$id"
              params={{ id: emp.id }}
              className="block p-[22px] transition-all duration-200 hover:-translate-y-0.5"
              style={{
                background: '#FFFFFF',
                borderRadius: 16,
                border: '1px solid rgba(26,18,8,0.06)',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.boxShadow = '0 8px 24px rgba(26,18,8,0.08)'
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.boxShadow = 'none'
              }}
            >
              <Avatar name={emp.full_name} id={emp.id} size={44} />
              <p
                className="font-bold mt-3 truncate"
                style={{ fontSize: 15, color: '#1A1208', letterSpacing: '-0.02em' }}
              >
                {emp.full_name}
              </p>
              <p className="truncate mt-0.5" style={{ fontSize: 12, color: '#9C8B6E' }}>
                {emp.job_title ?? emp.employment_type.replace('_', ' ')}
              </p>

              <div className="flex items-center justify-between mt-4">
                {emp.department_name ? (
                  <span
                    className="font-semibold truncate"
                    style={{
                      fontSize: 11,
                      color: '#9C8B6E',
                      background: moduleBackgrounds.people,
                      padding: '3px 9px',
                      borderRadius: 6,
                    }}
                  >
                    {emp.department_name}
                  </span>
                ) : (
                  <span />
                )}
                <StatusSquare status={emp.status} />
              </div>
            </Link>
          ))}

          {/* Add employee placeholder card */}
          <Link
            to="/people/$id"
            params={{ id: 'new' }}
            className="flex flex-col items-center justify-center gap-2 p-[22px] transition-colors hover:border-[rgba(26,18,8,0.25)]"
            style={{
              borderRadius: 16,
              border: '1.5px dashed rgba(26,18,8,0.12)',
              minHeight: 180,
            }}
          >
            <div
              className="grid place-items-center"
              style={{
                width: 44,
                height: 44,
                borderRadius: 12,
                background: 'rgba(26,18,8,0.04)',
              }}
            >
              <Plus size={20} style={{ color: '#9C8B6E' }} />
            </div>
            <span className="font-medium" style={{ fontSize: 13, color: '#9C8B6E' }}>
              Add employee
            </span>
          </Link>
        </div>
      )}

      {/* Pagination */}
      {(meta?.has_more || history.length > 1) && (
        <div className="flex items-center justify-center gap-2 mt-8">
          <button
            onClick={handlePrev}
            disabled={history.length <= 1}
            className="text-sm font-medium px-4 py-2 rounded-lg transition-colors disabled:opacity-30"
            style={{ color: '#9C8B6E' }}
            onMouseEnter={(e) => {
              if (!e.currentTarget.disabled) e.currentTarget.style.background = '#FFFFFF'
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
            className="text-sm font-medium px-4 py-2 rounded-lg transition-colors disabled:opacity-30"
            style={{ color: '#9C8B6E' }}
            onMouseEnter={(e) => {
              if (!e.currentTarget.disabled) e.currentTarget.style.background = '#FFFFFF'
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
function PeopleGridSkeleton() {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
      {Array.from({ length: 6 }).map((_, i) => (
        <div
          key={i}
          className="p-[22px] animate-pulse"
          style={{
            background: '#FFFFFF',
            borderRadius: 16,
            border: '1px solid rgba(26,18,8,0.06)',
          }}
        >
          <div className="rounded-[12px]" style={{ width: 44, height: 44, background: 'rgba(26,18,8,0.06)' }} />
          <div className="rounded-md mt-3" style={{ width: '70%', height: 16, background: 'rgba(26,18,8,0.06)' }} />
          <div className="rounded-md mt-2" style={{ width: '45%', height: 12, background: 'rgba(26,18,8,0.04)' }} />
          <div className="flex items-center justify-between mt-4">
            <div className="rounded-md" style={{ width: 72, height: 20, background: 'rgba(26,18,8,0.04)' }} />
            <div className="rounded-sm" style={{ width: 7, height: 7, background: 'rgba(26,18,8,0.06)' }} />
          </div>
        </div>
      ))}
    </div>
  )
}

// ── Empty state ──────────────────────────────────────────────────
function PeopleEmptyState({ hasSearch, search }: { hasSearch: boolean; search: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 gap-3">
      <div
        className="grid place-items-center"
        style={{ width: 48, height: 48, borderRadius: 14, background: '#EAE4D8' }}
      >
        <Users size={22} style={{ color: '#7C5C2E' }} />
      </div>
      <p className="font-bold" style={{ fontSize: 15, color: '#1A1208' }}>
        {hasSearch ? `No results for "${search}"` : 'No employees yet'}
      </p>
      <p style={{ fontSize: 13, color: '#9C8B6E' }}>
        {hasSearch
          ? 'Try a different name or clear the filter.'
          : 'Add your first team member to get started.'}
      </p>
      {!hasSearch && (
        <Link
          to="/people/$id"
          params={{ id: 'new' }}
          className="flex items-center gap-1.5 text-sm font-semibold px-4 py-2.5 mt-2 transition-colors hover:opacity-90"
          style={{
            background: '#1A1208',
            color: moduleBackgrounds.people,
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
