import { createFileRoute, Link } from '@tanstack/react-router'
import { useState } from 'react'
import { Search, Plus } from 'lucide-react'
import { useEmployees } from '@/lib/hooks/useEmployees'
import { Avatar } from '@/components/workived/layout/Avatar'
import { StatusSquare } from '@/components/workived/layout/StatusSquare'
import { moduleBackgrounds } from '@/design/tokens'

export const Route = createFileRoute('/_app/people')({
  component: PeoplePage,
})

function PeoplePage() {
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)

  const { data, isLoading } = useEmployees({ page, per_page: 20, search: search || undefined })
  const employees = data?.data ?? []
  const meta = data?.meta

  return (
    <div
      className="min-h-screen px-6 py-8 md:px-11 md:py-10"
      style={{ background: moduleBackgrounds.people }}
    >
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tighter text-ink-900">People</h1>
          <p className="text-sm text-ink-500 mt-0.5">
            {meta?.total ?? 0} employees
          </p>
        </div>
        <Link
          to="/people/$id"
          params={{ id: 'new' }}
          className="flex items-center gap-1.5 bg-accent text-white text-sm font-semibold px-3 py-2 rounded-lg hover:bg-accent-text transition-colors"
        >
          <Plus size={16} />
          Add
        </Link>
      </div>

      <div className="relative mb-4">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-300" />
        <input
          type="text"
          placeholder="Search employees..."
          value={search}
          onChange={(e) => {
            setSearch(e.target.value)
            setPage(1)
          }}
          className="w-full pl-9 pr-3 py-2 bg-white border border-ink-150 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-accent/40"
        />
      </div>

      {isLoading ? (
        <div className="text-sm text-ink-500 py-8 text-center">Loading...</div>
      ) : employees.length === 0 ? (
        <div className="text-sm text-ink-500 py-8 text-center">No employees found</div>
      ) : (
        <div className="space-y-2">
          {employees.map((emp) => (
            <Link
              key={emp.id}
              to="/people/$id"
              params={{ id: emp.id }}
              className="flex items-center gap-3 bg-white rounded-xl px-4 py-3 border border-ink-100 hover:border-ink-150 transition-colors"
            >
              <Avatar name={emp.full_name} id={emp.id} size={36} />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-ink-900 truncate">{emp.full_name}</p>
                <p className="text-xs text-ink-500 truncate">{emp.job_title ?? emp.employment_type}</p>
              </div>
              <StatusSquare status={emp.status} />
            </Link>
          ))}
        </div>
      )}

      {meta && meta.total_pages > 1 && (
        <div className="flex items-center justify-center gap-2 mt-6">
          <button
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page <= 1}
            className="text-sm text-ink-500 px-3 py-1.5 rounded-lg hover:bg-white disabled:opacity-30"
          >
            Previous
          </button>
          <span className="text-sm text-ink-500">
            {page} / {meta.total_pages}
          </span>
          <button
            onClick={() => setPage((p) => Math.min(meta.total_pages, p + 1))}
            disabled={page >= meta.total_pages}
            className="text-sm text-ink-500 px-3 py-1.5 rounded-lg hover:bg-white disabled:opacity-30"
          >
            Next
          </button>
        </div>
      )}
    </div>
  )
}
