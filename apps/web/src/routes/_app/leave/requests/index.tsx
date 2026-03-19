import { createFileRoute } from '@tanstack/react-router'
import { useState } from 'react'
import { useMyRequests } from '@/lib/hooks/useLeave'
import { RequestCard } from '@/components/workived/leave/RequestCard'
import { groupByStatus } from '@/lib/utils/leave'
import { moduleBackgrounds, moduleThemes, typography } from '@/design/tokens'

const t = moduleThemes.leave

export const Route = createFileRoute('/_app/leave/requests/')({
  component: MyRequestsPage,
})

const STATUS_TABS = [
  { value: 'all', label: 'All' },
  { value: 'pending', label: 'Pending' },
  { value: 'approved', label: 'Approved' },
  { value: 'rejected', label: 'Rejected' },
] as const

function MyRequestsPage() {
  const [activeTab, setActiveTab] = useState<string>('all')
  const { data: requests, isLoading } = useMyRequests()

  const grouped = requests ? groupByStatus(requests) : null
  const displayRequests =
    activeTab === 'all'
      ? requests
      : grouped
      ? grouped[activeTab as keyof typeof grouped]
      : []

  return (
    <div
      className="min-h-screen px-6 py-8 md:px-11 md:py-10 pb-28"
      style={{ background: moduleBackgrounds.leave }}
    >
      {/* Header */}
      <div className="mb-6">
        <h1
          className="font-extrabold"
          style={{
            fontSize: typography.display.size,
            letterSpacing: typography.display.tracking,
            color: t.text,
            lineHeight: typography.display.lineHeight,
          }}
        >
          My Requests
        </h1>
        <p className="text-sm mt-2" style={{ color: t.textMuted }}>
          {requests?.length ?? 0} total request{requests?.length === 1 ? '' : 's'}
        </p>
      </div>

      {/* Status filter tabs */}
      <div className="flex items-center gap-1 mb-5 overflow-x-auto">
        {STATUS_TABS.map((tab) => {
          const isActive = activeTab === tab.value
          const count =
            tab.value === 'all'
              ? requests?.length ?? 0
              : grouped
              ? grouped[tab.value as keyof typeof grouped].length
              : 0

          return (
            <button
              key={tab.value}
              onClick={() => setActiveTab(tab.value)}
              className="text-sm font-medium px-3.5 py-1.5 transition-colors whitespace-nowrap"
              style={{
                borderRadius: 8,
                background: isActive ? t.surfaceHover : 'transparent',
                color: isActive ? t.text : t.textMuted,
              }}
            >
              {tab.label} {count > 0 && `(${count})`}
            </button>
          )
        })}
      </div>

      {/* Requests List */}
      {isLoading ? (
        <RequestsSkeleton />
      ) : !displayRequests || displayRequests.length === 0 ? (
        <EmptyRequests status={activeTab} />
      ) : (
        <div className="flex flex-col gap-[3px]">
          {displayRequests.map((request) => (
            <RequestCard key={request.id} request={request} variant="my" />
          ))}
        </div>
      )}
    </div>
  )
}

function RequestsSkeleton() {
  return (
    <div className="flex flex-col gap-[3px]">
      {[1, 2, 3].map((i) => (
        <div
          key={i}
          className="animate-pulse"
          style={{
            background: t.surface,
            borderRadius: 14,
            border: `1px solid ${t.border}`,
            padding: 20,
            height: 120,
          }}
        >
          <div style={{ background: t.surfaceHover, height: 16, width: '30%', borderRadius: 4 }} />
          <div style={{ background: t.surfaceHover, height: 12, width: '50%', borderRadius: 4, marginTop: 8 }} />
        </div>
      ))}
    </div>
  )
}

function EmptyRequests({ status }: { status: string }) {
  const message =
    status === 'all'
      ? 'No leave requests yet'
      : `No ${status} requests`

  return (
    <div
      className="flex flex-col items-center justify-center text-center"
      style={{
        background: t.surface,
        borderRadius: 14,
        border: `1px solid ${t.border}`,
        padding: 48,
        minHeight: 240,
      }}
    >
      <svg
        width="48"
        height="48"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        style={{ color: '#B0AEBE', marginBottom: 12 }}
      >
        <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
      </svg>
      <p
        className="font-bold"
        style={{ fontSize: typography.h3.size, color: t.text }}
      >
        {message}
      </p>
      <p className="text-sm mt-1" style={{ color: t.textMuted }}>
        {status === 'all' && 'Submit your first request from the dashboard.'}
      </p>
    </div>
  )
}
