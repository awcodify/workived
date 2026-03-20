import { createFileRoute, Link } from '@tanstack/react-router'
import { useState } from 'react'
import { ChevronDown, ChevronRight, Users, ArrowLeft } from 'lucide-react'
import { useOrgChart } from '@/lib/hooks/useEmployees'
import { useCanManageEmployees } from '@/lib/hooks/useRole'
import { Avatar } from '@/components/workived/layout/Avatar'
import { StatusSquare } from '@/components/workived/layout/StatusSquare'
import { moduleBackgrounds, moduleThemes } from '@/design/tokens'
import type { OrgChartNode } from '@/types/api'

const t = moduleThemes.people

export const Route = createFileRoute('/_app/org-chart')({
  component: OrgChartPage,
})

function OrgChartPage() {
  const { data: tree, isLoading } = useOrgChart()

  return (
    <div
      className="min-h-screen px-6 py-8 md:px-11 md:py-10"
      style={{ background: moduleBackgrounds.people }}
    >
      {/* Header */}
      <div className="flex items-center gap-4 mb-6">
        <Link
          to="/people"
          className="flex items-center justify-center w-10 h-10 rounded-lg transition-colors"
          style={{ background: t.surface }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = t.surfaceHover
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = t.surface
          }}
        >
          <ArrowLeft size={18} style={{ color: t.text }} />
        </Link>
        <div>
          <h1
            className="font-extrabold"
            style={{ fontSize: 44, letterSpacing: '-0.05em', color: t.text, lineHeight: 1 }}
          >
            Org Chart
          </h1>
          <p className="text-sm mt-2" style={{ color: t.textMuted }}>
            Organizational hierarchy and reporting structure
          </p>
        </div>
      </div>

      {/* Org Chart Tree */}
      {isLoading ? (
        <div className="flex items-center justify-center py-16">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2" style={{ borderColor: t.accent }} />
        </div>
      ) : !tree || tree.length === 0 ? (
        <EmptyState />
      ) : (
        <div className="flex justify-center overflow-x-auto pb-8">
          <div className="inline-flex flex-col items-center gap-12">
            {tree.map((node) => (
              <OrgNode key={node.id} node={node} />
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

// ── Org Node (Recursive Tree) ────────────────────────────────────────
function OrgNode({ node }: { node: OrgChartNode }) {
  const [isExpanded, setIsExpanded] = useState(true)

  const hasReports = node.direct_reports && node.direct_reports.length > 0

  return (
    <div className="flex flex-col items-center">
      {/* Employee Card */}
      <div className="relative">
        <Link
          to="/people/$id"
          params={{ id: node.id }}
          className="flex flex-col items-center gap-2 transition-all duration-150"
          style={{
            background: t.surface,
            borderRadius: 12,
            padding: '16px 20px',
            minWidth: 200,
            border: `2px solid ${t.inputBorder}`,
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = t.surfaceHover
            e.currentTarget.style.borderColor = t.accent
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = t.surface
            e.currentTarget.style.borderColor = t.inputBorder
          }}
        >
          <Avatar name={node.full_name} id={node.id} size={48} />

          <div className="text-center w-full">
            <p
              className="font-semibold truncate"
              style={{ fontSize: 14, color: t.text }}
            >
              {node.full_name}
            </p>
            <p
              className="truncate text-xs mt-1"
              style={{ color: t.textMuted }}
            >
              {node.job_title || node.employment_type.replace('_', ' ')}
            </p>
          </div>

          <div className="flex items-center gap-2">
            <StatusSquare status={node.status} />
            {hasReports && node.direct_reports && (
              <div
                className="flex items-center gap-1 px-2 py-0.5 rounded-md"
                style={{ background: t.input, color: t.textMuted, fontSize: 10, fontWeight: 600 }}
              >
                <Users size={10} />
                {node.direct_reports.length}
              </div>
            )}
          </div>
        </Link>

        {/* Expand/Collapse Button */}
        {hasReports && (
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="absolute -bottom-5 left-1/2 -translate-x-1/2 w-8 h-8 flex items-center justify-center rounded-full transition-all"
            style={{ 
              background: t.accent,
              color: t.accentText,
              border: `2px solid ${moduleBackgrounds.people}`,
            }}
          >
            {isExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
          </button>
        )}
      </div>

      {/* Connector Line Down */}
      {hasReports && isExpanded && (
        <>
          <div
            style={{
              width: 2,
              height: 32,
              background: t.inputBorder,
              marginTop: 8,
            }}
          />

          {/* Direct Reports (Horizontal Layout) */}
          <div className="flex items-start gap-8 relative">
            {/* Horizontal Line */}
            {node.direct_reports && node.direct_reports.length > 1 && (
              <div
                style={{
                  position: 'absolute',
                  top: 0,
                  left: '50%',
                  transform: 'translateX(-50%)',
                  height: 2,
                  width: `calc(100% - ${200 / node.direct_reports.length}px)`,
                  background: t.inputBorder,
                }}
              />
            )}

            {node.direct_reports!.map((child) => (
              <div key={child.id} className="flex flex-col items-center">
                {/* Vertical line to child */}
                <div
                  style={{
                    width: 2,
                    height: 32,
                    background: t.inputBorder,
                  }}
                />
                <OrgNode node={child} />
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  )
}

// ── Empty State ──────────────────────────────────────────────────────
function EmptyState() {
  const canManageEmployees = useCanManageEmployees()

  return (
    <div className="flex flex-col items-center justify-center py-16 gap-3">
      <div
        className="grid place-items-center"
        style={{ width: 48, height: 48, borderRadius: 14, background: t.accent }}
      >
        <Users size={22} style={{ color: t.accentText }} />
      </div>
      <p className="font-bold" style={{ fontSize: 15, color: t.text }}>
        No organizational structure yet
      </p>
      <p style={{ fontSize: 13, color: t.textMuted }}>
        Add employees and assign managers to build your org chart.
      </p>
      {canManageEmployees && (
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
          Add employee
        </Link>
      )}
    </div>
  )
}
