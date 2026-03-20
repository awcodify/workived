import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useState } from 'react'
import { useMyClaims } from '@/lib/hooks/useClaims'
import { ClaimCard } from '@/components/workived/claims/ClaimCard'
import { moduleBackgrounds, moduleThemes, typography } from '@/design/tokens'
import type { ClaimWithDetails } from '@/types/api'

const t = moduleThemes.claims

export const Route = createFileRoute('/_app/claims/requests/')({
  component: MyClaimsPage,
})

const STATUS_TABS = [
  { value: 'all', label: 'All' },
  { value: 'pending', label: 'Pending' },
  { value: 'approved', label: 'Approved' },
  { value: 'rejected', label: 'Rejected' },
] as const

// Group claims by status
function groupByStatus(claims: ClaimWithDetails[]) {
  return {
    pending: claims.filter((c) => c.status === 'pending'),
    approved: claims.filter((c) => c.status === 'approved'),
    rejected: claims.filter((c) => c.status === 'rejected'),
  }
}

function MyClaimsPage() {
  const navigate = useNavigate()
  const [activeTab, setActiveTab] = useState<string>('all')
  const { data: response, isLoading } = useMyClaims()

  const claims = response?.data ?? []
  const grouped = groupByStatus(claims)
  const displayClaims =
    activeTab === 'all'
      ? claims
      : grouped[activeTab as keyof typeof grouped]

  const handleViewClaim = (id: string) => {
    navigate({ to: `/claims/${id}` })
  }

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
          My Claims
        </h1>
        <p className="text-sm mt-2" style={{ color: t.textMuted }}>
          {claims.length} total claim{claims.length === 1 ? '' : 's'}
        </p>
      </div>

      {/* Status filter tabs */}
      <div className="flex items-center gap-1 mb-5 overflow-x-auto">
        {STATUS_TABS.map((tab) => {
          const isActive = activeTab === tab.value
          const count =
            tab.value === 'all'
              ? claims.length
              : grouped[tab.value as keyof typeof grouped].length

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

      {/* Claims List */}
      {isLoading ? (
        <ClaimsSkeleton />
      ) : displayClaims.length === 0 ? (
        <EmptyClaims status={activeTab} />
      ) : (
        <div className="flex flex-col gap-[3px]">
          {displayClaims.map((claim) => (
            <ClaimCard
              key={claim.id}
              claim={claim}
              variant="my"
              onView={handleViewClaim}
            />
          ))}
        </div>
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

function EmptyClaims({ status }: { status: string }) {
  const message =
    status === 'all'
      ? 'No claims yet'
      : `No ${status} claims`

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
        <path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z" />
      </svg>
      <p
        className="font-bold"
        style={{ fontSize: typography.h3.size, color: t.text }}
      >
        {message}
      </p>
      <p className="text-sm mt-1" style={{ color: t.textMuted }}>
        {status === 'all' && 'Submit your first claim from the dashboard.'}
      </p>
    </div>
  )
}
