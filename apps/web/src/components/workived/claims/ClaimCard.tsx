import type { ClaimWithDetails, Category } from '@/types/api'
import { StatusSquare } from '@/components/workived/layout/StatusSquare'
import { useCancelClaim, useApproveClaim, useRejectClaim } from '@/lib/hooks/useClaims'
import { moduleThemes, typography, colors } from '@/design/tokens'
import { useState } from 'react'
import { Calendar, Receipt, CheckCircle, XCircle, ExternalLink } from 'lucide-react'

const t = moduleThemes.claims

interface ClaimCardProps {
  claim: ClaimWithDetails
  variant?: 'my' | 'team' | 'approval' // 'my' = cancel button, 'team' = employee name, 'approval' = inline approve/reject
  category?: Category // For approval variant - show budget context
  onView?: (id: string) => void
  onViewDetails?: () => void // For approval variant - open full dialog
}

export function ClaimCard({ claim, variant = 'my', category, onView, onViewDetails }: ClaimCardProps) {
  const [showConfirm, setShowConfirm] = useState(false)
  const [showRejectInput, setShowRejectInput] = useState(false)
  const [rejectReason, setRejectReason] = useState('')
  const [rejectError, setRejectError] = useState('')
  
  const cancelMutation = useCancelClaim()
  const approveMutation = useApproveClaim()
  const rejectMutation = useRejectClaim()

  const handleCancel = async () => {
    try {
      await cancelMutation.mutateAsync(claim.id)
      setShowConfirm(false)
    } catch (error) {
      // Error is handled by mutation
    }
  }

  const formatAmount = (amount: number, currencyCode: string) => {
    const formatter = new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currencyCode,
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    })
    return formatter.format(amount)
  }

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('en-GB', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    })
  }

  const canCancel = claim.status === 'pending'

  return (
    <div
      className="transition-all duration-150 cursor-pointer"
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
      onClick={() => onView?.(claim.id)}
    >
      {/* Header: Status + Amount */}
      <div className="flex items-start justify-between mb-3">
        <StatusSquare status={claim.status} />
        <span
          className="font-bold"
          style={{
            fontSize: typography.h3.size,
            color: t.text,
          }}
        >
          {formatAmount(claim.amount, claim.currency_code)}
        </span>
      </div>

      {/* Employee Name (for team variant) */}
      {variant === 'team' && (
        <p
          className="font-semibold mb-1"
          style={{ fontSize: typography.body.size, color: t.text }}
        >
          {claim.employee_name}
        </p>
      )}

      {/* Category */}
      <p
        className="font-semibold mb-1"
        style={{ fontSize: typography.label.size, color: t.text }}
      >
        {claim.category_name}
      </p>

      {/* Description */}
      <p
        className="mb-3 line-clamp-2"
        style={{ fontSize: typography.body.size, color: t.textMuted }}
      >
        {claim.description}
      </p>

      {/* Metadata Row */}
      <div className="flex items-center gap-4 mb-3">
        <div className="flex items-center gap-1.5">
          <Calendar size={14} style={{ color: t.textMuted }} />
          <span
            style={{
              fontSize: typography.caption.size,
              color: t.textMuted,
            }}
          >
            {formatDate(claim.claim_date)}
          </span>
        </div>
        {claim.receipt_url && (
          <div className="flex items-center gap-1.5">
            <Receipt size={14} style={{ color: t.textMuted }} />
            <span
              style={{
                fontSize: typography.caption.size,
                color: t.textMuted,
              }}
            >
              Receipt attached
            </span>
          </div>
        )}
      </div>

      {/* Review Note (if rejected) */}
      {claim.status === 'rejected' && claim.review_note && (
        <div
          className="mb-3 p-2"
          style={{
            background: '#FDECEC', // errDim
            border: '1px solid #D44040', // err
            borderRadius: 8,
          }}
        >
          <p
            className="text-xs font-semibold"
            style={{ color: '#AE2E2E' }} // errText
          >
            Rejection reason:
          </p>
          <p
            className="text-xs mt-1"
            style={{ color: '#72708A' }} // ink500
          >
            {claim.review_note}
          </p>
        </div>
      )}

      {/* Actions */}
      {variant === 'my' && canCancel && (
        <div className="flex items-center gap-3 mt-4" onClick={(e) => e.stopPropagation()}>
          {!showConfirm ? (
            <button
              onClick={() => setShowConfirm(true)}
              className="text-sm font-semibold transition-opacity hover:opacity-70"
              style={{ color: '#D44040' }} // err
            >
              Cancel claim
            </button>
          ) : (
            <>
              <button
                onClick={handleCancel}
                disabled={cancelMutation.isPending}
                className="text-sm font-semibold px-3 py-1.5 transition-opacity hover:opacity-90 disabled:opacity-50"
                style={{
                  background: '#D44040',
                  color: '#FFFFFF',
                  borderRadius: 8,
                }}
              >
                {cancelMutation.isPending ? 'Cancelling...' : 'Confirm cancel'}
              </button>
              <button
                onClick={() => setShowConfirm(false)}
                disabled={cancelMutation.isPending}
                className="text-sm font-semibold transition-opacity hover:opacity-70"
                style={{ color: t.textMuted }}
              >
                Nevermind
              </button>
            </>
          )}
        </div>
      )}
    </div>
  )
}
