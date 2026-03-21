import { createFileRoute } from '@tanstack/react-router'
import { useState } from 'react'
import { useMyRequests } from '@/lib/hooks/useLeave'
import { RequestCard } from '@/components/workived/leave/RequestCard'
import { moduleBackgrounds, moduleThemes, typography } from '@/design/tokens'
import type { LeaveRequestWithDetails } from '@/types/api'

const t = moduleThemes.leave

export const Route = createFileRoute('/_app/leave/requests/')({
  component: MyRequestsPage,
})

// Group requests by time period
function groupByTimePeriod(requests: LeaveRequestWithDetails[]) {
  const now = new Date()
  const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1)
  const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1)

  const active: LeaveRequestWithDetails[] = []
  const thisMonth: LeaveRequestWithDetails[] = []
  const lastMonth: LeaveRequestWithDetails[] = []
  const older: LeaveRequestWithDetails[] = []

  requests.forEach((req) => {
    const createdAt = new Date(req.created_at)
    
    // Active: pending or future approved requests
    const startDate = new Date(req.start_date)
    if (req.status === 'pending' || (req.status === 'approved' && startDate >= now)) {
      active.push(req)
    }
    // This month
    else if (createdAt >= thisMonthStart) {
      thisMonth.push(req)
    }
    // Last month
    else if (createdAt >= lastMonthStart) {
      lastMonth.push(req)
    }
    // Older (3+ months)
    else {
      older.push(req)
    }
  })

  // Sort active by start date (upcoming first)
  active.sort((a, b) => new Date(a.start_date).getTime() - new Date(b.start_date).getTime())
  
  // Sort others by created date (newest first)
  thisMonth.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
  lastMonth.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
  older.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())

  return { active, thisMonth, lastMonth, older }
}

function MyRequestsPage() {
  const { data: requests, isLoading } = useMyRequests()
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set(['active', 'thisMonth']))

  const grouped = requests ? groupByTimePeriod(requests) : null

  const toggleSection = (section: string) => {
    setExpandedSections((prev) => {
      const next = new Set(prev)
      if (next.has(section)) {
        next.delete(section)
      } else {
        next.add(section)
      }
      return next
    })
  }

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

      {/* Timeline Feed */}
      {isLoading ? (
        <RequestsSkeleton />
      ) : !requests || requests.length === 0 ? (
        <EmptyRequests />
      ) : (
        <div className="space-y-6">
          {/* Active Requests */}
          {grouped && grouped.active.length > 0 && (
            <TimelineSection
              title="📍 ACTIVE"
              subtitle={`${grouped.active.length} pending or upcoming`}
              requests={grouped.active}
              isExpanded={expandedSections.has('active')}
              onToggle={() => toggleSection('active')}
              alwaysExpanded
            />
          )}

          {/* This Month */}
          {grouped && grouped.thisMonth.length > 0 && (
            <TimelineSection
              title="📍 THIS MONTH"
              subtitle={`${grouped.thisMonth.length} request${grouped.thisMonth.length === 1 ? '' : 's'}`}
              requests={grouped.thisMonth}
              isExpanded={expandedSections.has('thisMonth')}
              onToggle={() => toggleSection('thisMonth')}
            />
          )}

          {/* Last Month */}
          {grouped && grouped.lastMonth.length > 0 && (
            <TimelineSection
              title="📍 LAST MONTH"
              subtitle={`${grouped.lastMonth.length} request${grouped.lastMonth.length === 1 ? '' : 's'}`}
              requests={grouped.lastMonth}
              isExpanded={expandedSections.has('lastMonth')}
              onToggle={() => toggleSection('lastMonth')}
            />
          )}

          {/* Older */}
          {grouped && grouped.older.length > 0 && (
            <TimelineSection
              title="📍 OLDER"
              subtitle={`${grouped.older.length} request${grouped.older.length === 1 ? '' : 's'}`}
              requests={grouped.older}
              isExpanded={expandedSections.has('older')}
              onToggle={() => toggleSection('older')}
            />
          )}
        </div>
      )}
    </div>
  )
}

interface TimelineSectionProps {
  title: string
  subtitle: string
  requests: LeaveRequestWithDetails[]
  isExpanded: boolean
  onToggle: () => void
  alwaysExpanded?: boolean
}

function TimelineSection({ 
  title, 
  subtitle, 
  requests, 
  isExpanded, 
  onToggle,
  alwaysExpanded = false 
}: TimelineSectionProps) {
  return (
    <div>
      {/* Section Header */}
      <button
        onClick={onToggle}
        disabled={alwaysExpanded}
        className="w-full flex items-center justify-between mb-3 text-left transition-opacity hover:opacity-70 disabled:opacity-100 disabled:cursor-default"
      >
        <div>
          <h2
            className="font-bold uppercase tracking-wider text-xs"
            style={{ color: t.textMuted }}
          >
            {title}
          </h2>
          <p className="text-xs mt-0.5" style={{ color: t.textMuted }}>
            {subtitle}
          </p>
        </div>
        {!alwaysExpanded && (
          <span className="text-xs font-medium" style={{ color: t.textMuted }}>
            {isExpanded ? 'Collapse' : 'Expand'}
          </span>
        )}
      </button>

      {/* Section Content */}
      {isExpanded && (
        <div 
          className="grid gap-3"
          style={{
            gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
          }}
        >
          {requests.map((request) => (
            <RequestCard key={request.id} request={request} variant="my" />
          ))}
        </div>
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
            height: 120,
          }}
        >
          <div style={{ background: t.surfaceHover, height: 16, width: '60%', borderRadius: 4 }} />
          <div style={{ background: t.surfaceHover, height: 12, width: '40%', borderRadius: 4, marginTop: 8 }} />
        </div>
      ))}
    </div>
  )
}

function EmptyRequests() {
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
        No leave requests yet
      </p>
      <p className="text-sm mt-1" style={{ color: t.textMuted }}>
        Submit your first request from the dashboard
      </p>
    </div>
  )
}
