import { createFileRoute, Link, useNavigate } from '@tanstack/react-router'
import { useState } from 'react'
import { Search, Plus, Network, Users, Settings } from 'lucide-react'
import { useEmployees } from '@/lib/hooks/useEmployees'
import { useOrganisation } from '@/lib/hooks/useOrganisation'
import { useCanManageEmployees } from '@/lib/hooks/useRole'
import { Avatar } from '@/components/workived/layout/Avatar'
import { StatusSquare } from '@/components/workived/layout/StatusSquare'
import { useModuleTheme, useModuleBackground, typography, colors } from '@/design/tokens'
import { DateTime } from '@/components/workived/shared/DateTime'
import { NotificationBell } from '@/components/workived/shared/NotificationBell'
import { EmployeeDetailModal } from '@/components/workived/shared/EmployeeDetailModal'
import { ManagementPanel } from '@/components/workived/people/ManagementPanel'
import { PerformancePanel } from '@/components/workived/people/PerformancePanel'

export const Route = createFileRoute('/_app/people/')({
  component: PeoplePage,
})

const STATUS_TABS = [
  { value: undefined, label: 'All' },
  { value: 'active', label: 'Active' },
  { value: 'inactive', label: 'Inactive' },
] as const

function PeoplePage() {
  const t = useModuleTheme('people')
  const bg = useModuleBackground('people')
  const navigate = useNavigate()
  const { data: org } = useOrganisation()
  const canManageEmployees = useCanManageEmployees()
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<string | undefined>('active')
  const [cursor, setCursor] = useState<string | undefined>(undefined)
  const [history, setHistory] = useState<(string | undefined)[]>([undefined])
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<string | null>(null)
  const [showManagementPanel, setShowManagementPanel] = useState(false)

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
      data-testid="people-page"
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
        
        <div className="flex items-center gap-3">
          <DateTime
            textColor={t.text}
            textMutedColor={t.textMuted}
            borderColor={t.border}
          />
          {org?.plan === 'pro' && (
            <div
              className="flex items-center px-3 py-1.5 rounded-lg"
              style={{
                background: 'linear-gradient(135deg, #F59E0B 0%, #D97706 100%)',
                boxShadow: '0 2px 8px rgba(245, 158, 11, 0.3)',
              }}
            >
              <span
                className="text-[10px] font-bold uppercase"
                style={{ color: '#FFFFFF', letterSpacing: '0.05em' }}
              >
                ⭐ PRO
              </span>
            </div>
          )}
          <NotificationBell
            surfaceColor={t.surface}
            borderColor={t.border}
            accentColor={colors.accent}
            textColor={t.text}
            textMutedColor={t.textMuted}
          />
        </div>
        </div>
      </div>
      {/* Two-column layout: performance panel (left) + employee list (right) */}
      <div className="grid grid-cols-1 lg:grid-cols-[380px_1fr] gap-6 items-start">

      {/* Left: Performance panel — sticky while list scrolls */}
      <div className="hidden lg:block sticky top-8 self-start">
        <PerformancePanel theme={t} />
      </div>

      <div className="min-w-0">
      {/* Sticky toolbar */}
      <div className="sticky top-6 z-10 pb-2" style={{ background: bg }}>
        {/* Single row: segmented tabs + search + icon actions + CTA */}
        <div className="flex items-center gap-2 mb-3">
          {/* Status segmented control */}
          <div
            className="flex items-center gap-0.5 p-1 rounded-xl shrink-0"
            style={{ background: 'rgba(0,0,0,0.06)' }}
          >
            {STATUS_TABS.map((tab) => {
              const isActive = statusFilter === tab.value
              return (
                <button
                  key={tab.label}
                  onClick={() => handleStatusFilter(tab.value)}
                  className="text-sm font-semibold px-3.5 py-1.5 transition-all"
                  style={{
                    borderRadius: 9,
                    background: isActive ? t.surface : 'transparent',
                    color: isActive ? t.text : t.textMuted,
                    boxShadow: isActive ? '0 1px 4px rgba(0,0,0,0.10)' : undefined,
                  }}
                >
                  {tab.label}
                </button>
              )
            })}
          </div>

          {/* Search — compact, fills remaining space */}
          <div className="relative flex-1 min-w-0">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: t.textMuted }} />
            <input
              type="text"
              placeholder="Search…"
              value={search}
              onChange={(e) => handleSearch(e.target.value)}
              data-testid="people-search-input"
              className="w-full pl-8 pr-3 py-2 text-sm focus:outline-none"
              style={{
                background: t.surface,
                border: `1px solid ${t.border}`,
                borderRadius: 10,
                color: t.text,
              }}
            />
          </div>

          {/* Secondary actions */}
          <button
            onClick={() => setShowManagementPanel(true)}
            data-testid="people-manage-btn"
            className="flex items-center gap-1.5 text-sm font-medium shrink-0 px-3.5 py-2 transition-opacity hover:opacity-70 whitespace-nowrap"
            style={{ borderRadius: 10, background: t.surface, border: `1px solid ${t.border}`, color: t.textMuted }}
          >
            Dept. & Job Titles
          </button>

          <Link
            to="/org-chart"
            className="flex items-center gap-1.5 text-sm font-medium shrink-0 px-3.5 py-2 transition-opacity hover:opacity-70 whitespace-nowrap"
            style={{ borderRadius: 10, background: t.surface, border: `1px solid ${t.border}`, color: t.textMuted }}
          >
            <Network size={14} />
            Org. Chart
          </Link>

          {canManageEmployees && (
            <Link
              to="/people/new"
              search={{ user_id: undefined }}
              data-testid="people-add-btn"
              className="flex items-center gap-1.5 text-sm font-semibold px-4 py-2 shrink-0 transition-opacity hover:opacity-90 whitespace-nowrap"
              style={{ background: t.accent, color: t.accentText, borderRadius: 10 }}
            >
              <Plus size={15} />
              Emp.
            </Link>
          )}
        </div>

      </div>

      {/* Employee table */}
      <div
        className="overflow-hidden"
        style={{ background: t.surface, borderRadius: 16, border: `1px solid ${t.border}` }}
      >
        {/* Table header */}
        <div className="px-6 py-4 border-b" style={{ borderColor: t.border }}>
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 shrink-0" />
            <div className="flex-1 min-w-0 text-sm font-bold" style={{ color: t.text }}>Employee</div>
            <div className="w-32 shrink-0 text-sm font-bold hidden lg:block" style={{ color: t.text }}>Schedule</div>
            <div className="w-32 shrink-0 text-sm font-bold hidden md:block" style={{ color: t.text }}>Reporting to</div>
            <div className="w-32 shrink-0 text-sm font-bold hidden md:block" style={{ color: t.text }}>Department</div>
            <div className="w-24 shrink-0 text-sm font-bold" style={{ color: t.text }}>Status</div>
          </div>
        </div>

        {/* Body */}
        {isLoading ? (
          <PeopleRowsSkeleton />
        ) : employees.length === 0 ? (
          <PeopleEmptyState hasSearch={!!search} search={search} hasFilter={!!statusFilter} />
        ) : (
          employees.map((emp) => (
            <div
              key={emp.id}
              onClick={() => setSelectedEmployeeId(emp.id)}
              data-testid={`people-row-${emp.id}`}
              className="px-6 py-4 border-b transition-colors hover:bg-black/[0.02] cursor-pointer"
              style={{ borderColor: t.border, opacity: emp.status === 'inactive' ? 0.5 : 1 }}
            >
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-10 shrink-0">
                  <Avatar name={emp.full_name} id={emp.id} size={40} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold truncate" style={{ color: t.text }}>{emp.full_name}</p>
                  <p className="text-xs truncate mt-0.5" style={{ color: t.textMuted }}>
                    {emp.job_title ?? emp.employment_type.replace('_', ' ')}
                  </p>
                </div>
                <div className="w-32 shrink-0 hidden lg:block">
                  <span className="text-xs truncate block" style={{ color: t.textMuted }}>{emp.work_schedule_name ?? '—'}</span>
                </div>
                <div className="w-32 shrink-0 hidden md:block">
                  <span className="text-xs truncate block" style={{ color: t.textMuted }}>{emp.manager_name ?? '—'}</span>
                </div>
                <div className="w-32 shrink-0 hidden md:block">
                  <span className="text-xs truncate block" style={{ color: t.textMuted }}>{emp.department_name ?? '—'}</span>
                </div>
                <div className="w-24 shrink-0">
                  <StatusSquare
                    status={
                      emp.invitation_pending
                        ? 'pending'
                        : emp.probation_end_date && new Date(emp.probation_end_date) > new Date()
                          ? 'probation'
                          : emp.status
                    }
                  />
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Pagination */}
      {(meta?.has_more || history.length > 1) && (
        <div className="flex items-center justify-center gap-2 mt-8">
          <button
            onClick={handlePrev}
            disabled={history.length <= 1}
            data-testid="people-prev-btn"
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
            data-testid="people-next-btn"
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

      </div>{/* end right column */}

      </div>{/* end two-column grid */}

      {/* Employee Detail Modal */}
      {selectedEmployeeId && (
        <EmployeeDetailModal
          employeeId={selectedEmployeeId}
          onClose={() => setSelectedEmployeeId(null)}
          canEdit={canManageEmployees}
        />
      )}

      {/* Management Panel */}
      {showManagementPanel && (
        <ManagementPanel onClose={() => setShowManagementPanel(false)} />
      )}
    </div>
  )
}

// ── Skeleton loader ──────────────────────────────────────────────
function PeopleRowsSkeleton() {
  const t = useModuleTheme('people')

  return (
    <div data-testid="people-skeleton">
      {Array.from({ length: 8 }).map((_, i) => (
        <div
          key={i}
          className="px-6 py-4 border-b animate-pulse"
          style={{ borderColor: t.border }}
        >
          <div className="flex items-center gap-3">
            <div className="w-10 shrink-0 rounded-[9px]" style={{ width: 40, height: 40, background: t.surfaceHover }} />
            <div className="flex-1 min-w-0">
              <div className="rounded-md mb-1.5" style={{ width: 130, height: 13, background: t.surfaceHover }} />
              <div className="rounded-md" style={{ width: 90, height: 11, background: t.border }} />
            </div>
            <div className="w-32 shrink-0 hidden lg:block rounded-md" style={{ height: 11, background: t.border }} />
            <div className="w-32 shrink-0 hidden md:block rounded-md" style={{ height: 11, background: t.border }} />
            <div className="w-32 shrink-0 hidden md:block rounded-md" style={{ height: 11, background: t.border }} />
            <div className="w-24 shrink-0 flex items-center gap-1.5">
              <div className="rounded-sm" style={{ width: 7, height: 7, background: t.surfaceHover }} />
              <div className="rounded-md" style={{ width: 44, height: 11, background: t.border }} />
            </div>
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
    <div className="flex flex-col items-center justify-center py-16 gap-3" data-testid="people-empty">
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
          to="/people/new"
          search={{ user_id: undefined }}
          className="flex items-center gap-1.5 text-sm font-semibold px-4 py-2.5 mt-2 transition-colors hover:opacity-90"
          style={{
            background: t.accent,
            color: t.accentText,
            borderRadius: 12,
          }}
        >
          <Plus size={16} />
          Emp.
        </Link>
      )}
    </div>
  )
}
