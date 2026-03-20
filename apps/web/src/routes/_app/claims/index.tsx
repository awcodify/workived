import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useState } from 'react'
import { useMyClaims, useAllClaims } from '@/lib/hooks/useClaims'
import { ClaimCard } from '@/components/workived/claims/ClaimCard'
import { moduleBackgrounds, moduleThemes, typography } from '@/design/tokens'
import { Plus } from 'lucide-react'

const t = moduleThemes.claims

export const Route = createFileRoute('/_app/claims/')({
  component: ClaimsPage,
})

const STATUS_TABS = [
  { value: 'all', label: 'All' },
  { value: 'pending', label: 'Pending' },
  { value: 'approved', label: 'Approved' },
  { value: 'rejected', label: 'Rejected' },
] as const

function ClaimsPage() {
  const navigate = useNavigate()
  const [activeTab, setActiveTab] = useState<string>('all')
  const [view, setView] = useState<'my' | 'team'>('my')
  
  const { data: myClaims, isLoading: myLoading } = useMyClaims()
  const { data: allClaims, isLoading: allLoading } = useAllClaims()

  const isLoading = view === 'my' ? myLoading : allLoading
  const claimsData = view === 'my' ? myClaims?.data : allClaims?.data
  const claims = claimsData || []

  const filteredClaims =
    activeTab === 'all'
      ? claims
      : claims.filter((c) => c.status === activeTab)

  const handleViewClaim = (id: string) => {
    navigate({ to: `/claims/${id}` })
  }

  return (
    <div
      className="min-h-screen px-6 py-8 md:px-11 md:py-10 pb-28"
      style={{ background: moduleBackgrounds.claims }}
    >
      {/* Header */}
      <div className="mb-6 flex items-end justify-between">
        <div>
          <h1
            className="font-extrabold"
            style={{
              fontSize: typography.display.size,
              letterSpacing: typography.display.tracking,
              color: t.text,
              lineHeight: typography.display.lineHeight,
            }}
          >
            Claims
          </h1>
          <p className="text-sm mt-2" style={{ color: t.textMuted }}>
            {claims.length} total claim{claims.length === 1 ? '' : 's'}
          </p>
        </div>

        {/* Submit New Claim Button */}
        <button
          onClick={() => navigate({ to: '/claims/new' })}
          className="flex items-center gap-2 px-4 py-2.5 font-semibold text-sm transition-opacity hover:opacity-90"
          style={{
            background: t.accent,
            color: t.accentText,
            borderRadius: 12,
          }}
        >
          <Plus size={18} />
          New Claim
        </button>
      </div>

      {/* View Toggle (My / Team) */}
      <div className="flex items-center gap-1 mb-4">
        <button
          onClick={() => setView('my')}
          className="text-sm font-medium px-3.5 py-1.5 transition-colors"
          style={{
            borderRadius: 8,
            background: view === 'my' ? t.surfaceHover : 'transparent',
            color: view === 'my' ? t.text : t.textMuted,
          }}
        >
          My Claims
        </button>
        <button
          onClick={() => setView('team')}
          className="text-sm font-medium px-3.5 py-1.5 transition-colors"
          style={{
            borderRadius: 8,
            background: view === 'team' ? t.surfaceHover : 'transparent',
            color: view === 'team' ? t.text : t.textMuted,
          }}
        >
          All Claims
        </button>
      </div>

      {/* Status filter tabs */}
      <div className="flex items-center gap-1 mb-5 overflow-x-auto">
        {STATUS_TABS.map((tab) => {
          const isActive = activeTab === tab.value
          const count =
            tab.value === 'all'
              ? claims.length
              : claims.filter((c) => c.status === tab.value).length

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
      ) : filteredClaims.length === 0 ? (
        <EmptyClaims status={activeTab} view={view} />
      ) : (
        <div className="flex flex-col gap-[3px]">
          {filteredClaims.map((claim) => (
            <ClaimCard
              key={claim.id}
              claim={claim}
              variant={view === 'my' ? 'my' : 'team'}
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
            height: 140,
          }}
        >
          <div style={{ background: t.surfaceHover, height: 16, width: '30%', borderRadius: 4 }} />
          <div style={{ background: t.surfaceHover, height: 12, width: '50%', borderRadius: 4, marginTop: 8 }} />
        </div>
      ))}
    </div>
  )
}

function EmptyClaims({ status, view }: { status: string; view: 'my' | 'team' }) {
  const navigate = useNavigate()
  const message =
    status === 'all'
      ? view === 'my'
        ? 'No claims yet'
        : 'No team claims yet'
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
        <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
        <line x1="9" y1="9" x2="15" y2="9" />
        <line x1="9" y1="13" x2="15" y2="13" />
        <line x1="9" y1="17" x2="13" y2="17" />
      </svg>
      <p
        className="font-semibold mb-1"
        style={{ fontSize: typography.body.size, color: t.text }}
      >
        {message}
      </p>
      <p
        className="mb-4"
        style={{ fontSize: typography.label.size, color: t.textMuted }}
      >
        {view === 'my' && status === 'all' && 'Submit your first expense claim to get started'}
      </p>
      {view === 'my' && status === 'all' && (
        <button
          onClick={() => navigate({ to: '/claims/new' })}
          className="font-semibold text-sm px-4 py-2 transition-opacity hover:opacity-90"
          style={{
            background: t.accent,
            color: t.accentText,
            borderRadius: 10,
          }}
        >
          Submit New Claim
        </button>
      )}
    </div>
  )
}
