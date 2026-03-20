import { createFileRoute } from '@tanstack/react-router'
import { useState } from 'react'
import { useAllClaims } from '@/lib/hooks/useClaims'
import { ClaimCard } from '@/components/workived/claims/ClaimCard'
import { ClaimApprovalDialog } from '@/components/workived/claims/ClaimApprovalDialog'
import { moduleBackgrounds, moduleThemes, typography } from '@/design/tokens'
import type { ClaimWithDetails } from '@/types/api'

const t = moduleThemes.claims

export const Route = createFileRoute('/_app/claims/requests/pending')({
  component: PendingApprovalsPage,
})

function PendingApprovalsPage() {
  const [selectedClaim, setSelectedClaim] = useState<ClaimWithDetails | null>(null)
  const { data: response, isLoading } = useAllClaims()

  const claims = response?.data ?? []
  const pendingClaims = claims.filter((c) => c.status === 'pending')

  return (
    <div
      className="min-h-screen px-6 py-8 md:px-11 md:py-10 pb-28"
      style={{ background: moduleBackgrounds.claims }}
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
          {pendingClaims.length} pending claim{pendingClaims.length === 1 ? '' : 's'}
        </p>
      </div>

      {/* Claims List */}
      {isLoading ? (
        <ClaimsSkeleton />
      ) : pendingClaims.length === 0 ? (
        <EmptyPending />
      ) : (
        <div className="flex flex-col gap-[3px]">
          {pendingClaims.map((claim) => (
            <ClaimCard
              key={claim.id}
              claim={claim}
              variant="team"
              onView={() => setSelectedClaim(claim)}
            />
          ))}
        </div>
      )}

      {/* Approval Dialog */}
      {selectedClaim && (
        <ClaimApprovalDialog
          claim={selectedClaim}
          onClose={() => setSelectedClaim(null)}
        />
      )}
    </div>
  )
}

function ClaimsSkeleton() {
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
        No pending claims to review.
      </p>
    </div>
  )
}
