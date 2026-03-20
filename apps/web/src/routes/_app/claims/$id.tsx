import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useState } from 'react'
import { ArrowLeft, Calendar, DollarSign, FileText, User, CheckCircle, XCircle } from 'lucide-react'
import { useClaim, useApproveClaim, useRejectClaim } from '@/lib/hooks/useClaims'
import { useCanManageClaims } from '@/lib/hooks/useRole'
import { moduleBackgrounds, moduleThemes, typography } from '@/design/tokens'

const t = moduleThemes.claims

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  })
}

export const Route = createFileRoute('/_app/claims/$id')({
  component: ClaimDetailPage,
})

function ClaimDetailPage() {
  const { id } = Route.useParams()
  const navigate = useNavigate()
  const canManage = useCanManageClaims()

  const { data: claim, isLoading } = useClaim(id)
  const approveMutation = useApproveClaim()
  const rejectMutation = useRejectClaim()

  const [showApproveModal, setShowApproveModal] = useState(false)
  const [showRejectModal, setShowRejectModal] = useState(false)
  const [rejectNote, setRejectNote] = useState('')

  if (isLoading) {
    return <ClaimDetailSkeleton />
  }

  if (!claim) {
    return (
      <div
        className="min-h-screen px-6 py-8 md:px-11 md:py-10"
        style={{ background: moduleBackgrounds.claims }}
      >
        <div
          className="flex flex-col items-center justify-center"
          style={{
            background: t.surface,
            borderRadius: 14,
            border: `1px solid ${t.border}`,
            padding: 48,
            minHeight: 300,
          }}
        >
          <p className="font-semibold" style={{ color: t.text }}>
            Claim not found
          </p>
        </div>
      </div>
    )
  }

  const isPending = claim.status === 'pending'
  const canApprove = canManage && isPending

  const handleApprove = async () => {
    try {
      await approveMutation.mutateAsync({ id })
      setShowApproveModal(false)
      navigate({ to: '/claims' })
    } catch (error) {
      console.error('Failed to approve claim:', error)
    }
  }

  const handleReject = async () => {
    if (!rejectNote.trim()) {
      alert('Please provide a reason for rejection')
      return
    }

    try {
      await rejectMutation.mutateAsync({ 
        id, 
        data: { review_note: rejectNote }
      })
      setShowRejectModal(false)
      navigate({ to: '/claims' })
    } catch (error) {
      console.error('Failed to reject claim:', error)
    }
  }

  const statusColor = {
    pending: '#F59E0B',
    approved: '#10B981',
    rejected: '#EF4444',
    cancelled: '#6B7280',
  }[claim.status]

  return (
    <div
      className="min-h-screen px-6 py-8 md:px-11 md:py-10 pb-28"
      style={{ background: moduleBackgrounds.claims }}
    >
      {/* Header */}
      <div className="mb-6">
        <button
          onClick={() => navigate({ to: '/claims' })}
          className="flex items-center gap-2 mb-4 transition-opacity hover:opacity-70"
          style={{ color: t.textMuted }}
        >
          <ArrowLeft size={18} />
          <span className="text-sm font-medium">Back to Claims</span>
        </button>

        <div className="flex items-start justify-between">
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
              Claim Details
            </h1>
            <div className="flex items-center gap-2 mt-2">
              <span
                className="text-xs font-bold uppercase px-2.5 py-1"
                style={{
                  background: `${statusColor}20`,
                  color: statusColor,
                  borderRadius: 6,
                }}
              >
                {claim.status}
              </span>
              <span className="text-sm" style={{ color: t.textMuted }}>
                #{claim.id.slice(0, 8)}
              </span>
            </div>
          </div>

          {canApprove && (
            <div className="flex gap-2">
              <button
                onClick={() => setShowRejectModal(true)}
                className="flex items-center gap-2 px-4 py-2 text-sm font-semibold transition-opacity hover:opacity-90"
                style={{
                  background: '#EF4444',
                  color: '#FFFFFF',
                  borderRadius: 10,
                }}
              >
                <XCircle size={16} />
                Reject
              </button>
              <button
                onClick={() => setShowApproveModal(true)}
                className="flex items-center gap-2 px-4 py-2 text-sm font-semibold transition-opacity hover:opacity-90"
                style={{
                  background: t.accent,
                  color: t.accentText,
                  borderRadius: 10,
                }}
              >
                <CheckCircle size={16} />
                Approve
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Claim Info */}
      <div
        style={{
          background: t.surface,
          borderRadius: 14,
          border: `1px solid ${t.border}`,
          padding: 24,
        }}
      >
        <div className="grid gap-6">
          {/* Employee */}
          <div className="flex items-start gap-3">
            <User size={20} style={{ color: t.accent, marginTop: 2 }} />
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: t.textMuted }}>
                Employee
              </p>
              <p className="text-sm font-semibold mt-1" style={{ color: t.text }}>
                {claim.employee_name}
              </p>
            </div>
          </div>

          {/* Category */}
          <div className="flex items-start gap-3">
            <FileText size={20} style={{ color: t.accent, marginTop: 2 }} />
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: t.textMuted }}>
                Category
              </p>
              <p className="text-sm font-semibold mt-1" style={{ color: t.text }}>
                {claim.category_name}
              </p>
            </div>
          </div>

          {/* Amount */}
          <div className="flex items-start gap-3">
            <DollarSign size={20} style={{ color: t.accent, marginTop: 2 }} />
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: t.textMuted }}>
                Amount
              </p>
              <p className="text-lg font-bold mt-1" style={{ color: t.text }}>
                {claim.currency_code} {new Intl.NumberFormat('id-ID').format(claim.amount)}
              </p>
            </div>
          </div>

          {/* Date */}
          <div className="flex items-start gap-3">
            <Calendar size={20} style={{ color: t.accent, marginTop: 2 }} />
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: t.textMuted }}>
                Claim Date
              </p>
              <p className="text-sm font-semibold mt-1" style={{ color: t.text }}>
                {formatDate(claim.claim_date)}
              </p>
            </div>
          </div>

          {/* Description */}
          {claim.description && (
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide mb-2" style={{ color: t.textMuted }}>
                Description
              </p>
              <p className="text-sm leading-relaxed" style={{ color: t.text }}>
                {claim.description}
              </p>
            </div>
          )}

          {/* Receipt */}
          {claim.receipt_url && (
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide mb-2" style={{ color: t.textMuted }}>
                Receipt
              </p>
              <a
                href={claim.receipt_url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm font-semibold hover:underline"
                style={{ color: t.accent }}
              >
                View Receipt →
              </a>
            </div>
          )}

          {/* Review Info */}
          {claim.reviewed_at && (
            <div
              style={{
                borderTop: `1px solid ${t.border}`,
                paddingTop: 16,
                marginTop: 8,
              }}
            >
              <p className="text-xs font-semibold uppercase tracking-wide mb-2" style={{ color: t.textMuted }}>
                Review
              </p>
              <p className="text-sm" style={{ color: t.text }}>
                {claim.status === 'approved' ? 'Approved' : 'Rejected'} by {claim.reviewer_name || 'Manager'}
              </p>
              <p className="text-xs mt-1" style={{ color: t.textMuted }}>
                {formatDate(claim.reviewed_at)}
              </p>
              {claim.review_note && (
                <p className="text-sm mt-2 italic" style={{ color: t.text }}>
                  "{claim.review_note}"
                </p>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Approve Modal */}
      {showApproveModal && (
        <Modal onClose={() => setShowApproveModal(false)}>
          <div className="text-center">
            <CheckCircle size={48} style={{ color: '#10B981', margin: '0 auto 16px' }} />
            <h2 className="text-xl font-bold mb-2" style={{ color: t.text }}>
              Approve Claim?
            </h2>
            <p className="text-sm mb-6" style={{ color: t.textMuted }}>
              This will approve the claim for {claim.currency_code} {new Intl.NumberFormat('id-ID').format(claim.amount)}
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setShowApproveModal(false)}
                className="flex-1 px-4 py-2.5 text-sm font-semibold transition-opacity hover:opacity-70"
                style={{
                  background: t.surfaceHover,
                  color: t.text,
                  borderRadius: 10,
                }}
              >
                Cancel
              </button>
              <button
                onClick={handleApprove}
                disabled={approveMutation.isPending}
                className="flex-1 px-4 py-2.5 text-sm font-semibold transition-opacity hover:opacity-90 disabled:opacity-50"
                style={{
                  background: '#10B981',
                  color: '#FFFFFF',
                  borderRadius: 10,
                }}
              >
                {approveMutation.isPending ? 'Approving...' : 'Confirm Approval'}
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* Reject Modal */}
      {showRejectModal && (
        <Modal onClose={() => setShowRejectModal(false)}>
          <div>
            <XCircle size={48} style={{ color: '#EF4444', margin: '0 auto 16px' }} />
            <h2 className="text-xl font-bold mb-2 text-center" style={{ color: t.text }}>
              Reject Claim?
            </h2>
            <p className="text-sm mb-4 text-center" style={{ color: t.textMuted }}>
              Please provide a reason for rejection
            </p>
            <textarea
              value={rejectNote}
              onChange={(e) => setRejectNote(e.target.value)}
              placeholder="e.g., Receipt is unclear, amount exceeds policy, etc."
              rows={4}
              className="w-full px-3 py-2.5 text-sm mb-4"
              style={{
                background: t.surfaceHover,
                border: `1px solid ${t.border}`,
                borderRadius: 8,
                color: t.text,
                resize: 'none',
              }}
            />
            <div className="flex gap-3">
              <button
                onClick={() => setShowRejectModal(false)}
                className="flex-1 px-4 py-2.5 text-sm font-semibold transition-opacity hover:opacity-70"
                style={{
                  background: t.surfaceHover,
                  color: t.text,
                  borderRadius: 10,
                }}
              >
                Cancel
              </button>
              <button
                onClick={handleReject}
                disabled={rejectMutation.isPending || !rejectNote.trim()}
                className="flex-1 px-4 py-2.5 text-sm font-semibold transition-opacity hover:opacity-90 disabled:opacity-50"
                style={{
                  background: '#EF4444',
                  color: '#FFFFFF',
                  borderRadius: 10,
                }}
              >
                {rejectMutation.isPending ? 'Rejecting...' : 'Confirm Rejection'}
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  )
}

function Modal({ children, onClose }: { children: React.ReactNode; onClose: () => void }) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(0, 0, 0, 0.6)' }}
      onClick={onClose}
    >
      <div
        className="max-w-md w-full"
        style={{
          background: t.surface,
          borderRadius: 16,
          border: `1px solid ${t.border}`,
          padding: 24,
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {children}
      </div>
    </div>
  )
}

function ClaimDetailSkeleton() {
  return (
    <div
      className="min-h-screen px-6 py-8 md:px-11 md:py-10"
      style={{ background: moduleBackgrounds.claims }}
    >
      <div className="animate-pulse">
        <div style={{ background: t.surfaceHover, height: 32, width: 200, borderRadius: 8, marginBottom: 24 }} />
        <div
          style={{
            background: t.surface,
            borderRadius: 14,
            border: `1px solid ${t.border}`,
            padding: 24,
          }}
        >
          <div style={{ background: t.surfaceHover, height: 20, width: '40%', borderRadius: 4, marginBottom: 16 }} />
          <div style={{ background: t.surfaceHover, height: 16, width: '60%', borderRadius: 4, marginBottom: 12 }} />
          <div style={{ background: t.surfaceHover, height: 16, width: '50%', borderRadius: 4 }} />
        </div>
      </div>
    </div>
  )
}
