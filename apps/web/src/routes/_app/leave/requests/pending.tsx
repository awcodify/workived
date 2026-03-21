import { createFileRoute } from '@tanstack/react-router'
import { useState } from 'react'
import { useAllRequests, useAllBalances } from '@/lib/hooks/useLeave'
import { RequestCard } from '@/components/workived/leave/RequestCard'
import { ApprovalDialog } from '@/components/workived/leave/ApprovalDialog'
import type { LeaveRequestWithDetails } from '@/types/api'
import { moduleBackgrounds, moduleThemes, typography } from '@/design/tokens'

const t = moduleThemes.leave

export const Route = createFileRoute('/_app/leave/requests/pending')({
  component: PendingApprovalsPage,
})

function PendingApprovalsPage() {
  const currentYear = new Date().getFullYear()
  const { data: requests, isLoading } = useAllRequests({ status: 'pending' })
  const { data: balances } = useAllBalances(currentYear)
  const [selectedRequest, setSelectedRequest] = useState<LeaveRequestWithDetails | null>(null)

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
          Pending Approvals
        </h1>
        <p className="text-sm mt-2" style={{ color: t.textMuted }}>
          {requests?.length ?? 0} pending request{requests?.length === 1 ? '' : 's'}
        </p>
      </div>

      {/* Requests List */}
      {isLoading ? (
        <RequestsSkeleton />
      ) : !requests || requests.length === 0 ? (
        <EmptyPending />
      ) : (
        <div 
          className="grid gap-3"
          style={{
            gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
          }}
        >
          {requests.map((request) => {
            // Find matching balance for the employee + policy
            const balance = balances?.find(
              (b) => b.employee_id === request.employee_id && b.leave_policy_id === request.leave_policy_id
            )
            
            return (
              <RequestCard
                key={request.id}
                request={request}
                variant="approval"
                balance={balance}
                onViewDetails={() => setSelectedRequest(request)}
              />
            )
          })}
        </div>
      )}

      {/* Approval Dialog */}
      {selectedRequest && (
        <ApprovalDialog
          request={selectedRequest}
          onClose={() => setSelectedRequest(null)}
        />
      )}
    </div>
  )
}

function RequestsSkeleton() {
  return (
    <div 
      className="grid gap-3"
      style={{
        gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
      }}
    >
      {[1, 2, 3, 4, 5, 6].map((i) => (
        <div
          key={i}
          className="animate-pulse"
          style={{
            background: t.surface,
            borderRadius: 14,
            border: `1px solid ${t.border}`,
            padding: '14px 16px',
            height: 140,
          }}
        >
          <div style={{ background: t.surfaceHover, height: 16, width: '60%', borderRadius: 4 }} />
          <div style={{ background: t.surfaceHover, height: 12, width: '40%', borderRadius: 4, marginTop: 8 }} />
          <div style={{ background: t.surfaceHover, height: 40, width: '100%', borderRadius: 8, marginTop: 12 }} />
        </div>
      ))}
    </div>
  )
}

function EmptyPending() {
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
        <polyline points="20 6 9 17 4 12" />
      </svg>
      <p
        className="font-bold"
        style={{ fontSize: typography.h3.size, color: t.text }}
      >
        All caught up!
      </p>
      <p className="text-sm mt-1" style={{ color: t.textMuted }}>
        No pending leave requests to review.
      </p>
    </div>
  )
}
