import { createFileRoute, Link } from '@tanstack/react-router'
import { Plus, Pencil, Trash2, Download } from 'lucide-react'
import { usePolicies, useDeactivatePolicy } from '@/lib/hooks/useLeave'
import { useState } from 'react'
import { moduleBackgrounds, moduleThemes, typography } from '@/design/tokens'
import { ImportTemplatesModal } from '@/components/workived/leave/ImportTemplatesModal'

const t = moduleThemes.leave

export const Route = createFileRoute('/_app/leave/policies/')({
  component: PoliciesPage,
})

function PoliciesPage() {
  const { data: policies, isLoading } = usePolicies()
  const deactivateMutation = useDeactivatePolicy()
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [showImportModal, setShowImportModal] = useState(false)

  const handleDeactivate = async (id: string) => {
    if (deletingId === id) {
      try {
        await deactivateMutation.mutateAsync(id)
        setDeletingId(null)
      } catch (error) {
        // Error handled by mutation
      }
    } else {
      setDeletingId(id)
    }
  }

  const activePolicies = policies?.filter((p) => p.is_active) ?? []

  return (
    <div
      className="min-h-screen px-6 py-8 md:px-11 md:py-10 pb-28"
      style={{ background: moduleBackgrounds.leave }}
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
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
            Leave Policies
          </h1>
          <p className="text-sm mt-2" style={{ color: t.textMuted }}>
            {activePolicies.length} active polic{activePolicies.length === 1 ? 'y' : 'ies'}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowImportModal(true)}
            className="flex items-center gap-1.5 text-sm font-semibold px-4 py-2.5 transition-opacity hover:opacity-70"
            style={{
              background: t.surface,
              color: t.accent,
              borderRadius: 12,
              border: `1px solid ${t.border}`,
            }}
          >
            <Download size={16} />
            Import Templates
          </button>
          <Link
            to="/leave/policies/new"
            className="flex items-center gap-1.5 text-sm font-semibold px-4 py-2.5 transition-colors hover:opacity-90"
            style={{
              background: t.accent,
              color: t.accentText,
              borderRadius: 12,
            }}
          >
            <Plus size={16} />
            Add policy
          </Link>
        </div>
      </div>

      {/* Policies List */}
      {isLoading ? (
        <PoliciesSkeleton />
      ) : !activePolicies || activePolicies.length === 0 ? (
        <EmptyPolicies onImport={() => setShowImportModal(true)} />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {activePolicies.map((policy) => (
            <div
              key={policy.id}
              className="transition-all duration-150 hover:-translate-y-px"
              style={{
                background: t.surface,
                borderRadius: 14,
                border: `1px solid ${t.border}`,
                padding: 20,
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = t.surfaceHover
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = t.surface
              }}
            >
              {/* Policy Info */}
              <div className="mb-4">
                <h3
                  className="font-bold mb-2"
                  style={{
                    fontSize: typography.h2.size,
                    letterSpacing: typography.h2.tracking,
                    color: t.text,
                  }}
                >
                  {policy.name}
                </h3>
                <div
                  className="space-y-1"
                  style={{
                    fontSize: typography.label.size,
                    color: t.textMuted,
                  }}
                >
                  <p>Days per year: {policy.days_per_year}</p>
                  <p>Carry over: {policy.carry_over_days} days</p>
                  {policy.min_tenure_days > 0 && (
                    <p>Min tenure: {policy.min_tenure_days} days</p>
                  )}
                  <p>Requires approval: {policy.requires_approval ? 'Yes' : 'No'}</p>
                </div>
              </div>

              {/* Actions */}
              <div className="flex items-center gap-2">
                <Link
                  to="/leave/policies/$id"
                  params={{ id: policy.id }}
                  className="flex items-center gap-1.5 text-sm font-semibold px-3 py-2 transition-opacity hover:opacity-70"
                  style={{
                    color: t.accent,
                  }}
                >
                  <Pencil size={14} />
                  Edit
                </Link>
                <button
                  onClick={() => handleDeactivate(policy.id)}
                  disabled={deactivateMutation.isPending}
                  className="flex items-center gap-1.5 text-sm font-semibold px-3 py-2 transition-opacity hover:opacity-70"
                  style={{
                    color: deletingId === policy.id ? '#D44040' : t.textMuted,
                  }}
                >
                  <Trash2 size={14} />
                  {deletingId === policy.id
                    ? deactivateMutation.isPending
                      ? 'Deleting...'
                      : 'Confirm?'
                    : 'Delete'}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Import Modal */}
      {showImportModal && (
        <ImportTemplatesModal onClose={() => setShowImportModal(false)} />
      )}
    </div>
  )
}

function PoliciesSkeleton() {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      {[1, 2].map((i) => (
        <div
          key={i}
          className="animate-pulse"
          style={{
            background: t.surface,
            borderRadius: 14,
            border: `1px solid ${t.border}`,
            padding: 20,
            height: 180,
          }}
        >
          <div style={{ background: t.surfaceHover, height: 20, width: '60%', borderRadius: 4 }} />
          <div style={{ background: t.surfaceHover, height: 12, width: '40%', borderRadius: 4, marginTop: 8 }} />
        </div>
      ))}
    </div>
  )
}

interface EmptyPoliciesProps {
  onImport: () => void
}

function EmptyPolicies({ onImport }: EmptyPoliciesProps) {
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
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
        <polyline points="14 2 14 8 20 8" />
        <line x1="12" y1="18" x2="12" y2="12" />
        <line x1="9" y1="15" x2="15" y2="15" />
      </svg>
      <p
        className="font-bold"
        style={{ fontSize: typography.h3.size, color: t.text }}
      >
        No leave policies yet
      </p>
      <p className="text-sm mt-1 mb-4" style={{ color: t.textMuted }}>
        Get started quickly by importing templates or create your own.
      </p>
      <div className="flex items-center gap-2">
        <button
          onClick={onImport}
          className="flex items-center gap-1.5 text-sm font-semibold px-4 py-2.5 transition-opacity hover:opacity-90"
          style={{
            background: t.accent,
            color: t.accentText,
            borderRadius: 12,
          }}
        >
          <Download size={16} />
          Import Templates
        </button>
        <Link
          to="/leave/policies/new"
          className="flex items-center gap-1.5 text-sm font-semibold px-4 py-2.5 transition-opacity hover:opacity-70"
          style={{
            background: t.surface,
            color: t.accent,
            borderRadius: 12,
            border: `1px solid ${t.border}`,
          }}
        >
          <Plus size={16} />
          Create Manually
        </Link>
      </div>
    </div>
  )
}
