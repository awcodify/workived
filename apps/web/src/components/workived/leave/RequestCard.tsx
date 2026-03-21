import type { LeaveRequestWithDetails, LeaveBalanceWithPolicy } from '@/types/api'
import { StatusSquare } from '@/components/workived/layout/StatusSquare'
import { canCancelRequest } from '@/lib/utils/leave'
import { useCancelRequest, useApproveRequest, useRejectRequest } from '@/lib/hooks/useLeave'
import { moduleThemes, typography, colors } from '@/design/tokens'
import { useState } from 'react'
import { CheckCircle, XCircle, ExternalLink } from 'lucide-react'

const t = moduleThemes.leave

interface RequestCardProps {
  request: LeaveRequestWithDetails
  variant?: 'my' | 'team' | 'approval' // 'my' = cancel button, 'team' = employee name, 'approval' = inline approve/reject
  balance?: LeaveBalanceWithPolicy // For approval variant - show balance impact
  onViewDetails?: () => void // For approval variant - open full dialog
}

export function RequestCard({ request, variant = 'my', balance, onViewDetails }: RequestCardProps) {
  const [showConfirm, setShowConfirm] = useState(false)
  const [showRejectInput, setShowRejectInput] = useState(false)
  const [rejectReason, setRejectReason] = useState('')
  const [rejectError, setRejectError] = useState('')
  
  const cancelMutation = useCancelRequest()
  const approveMutation = useApproveRequest()
  const rejectMutation = useRejectRequest()

  const handleCancel = async () => {
    try {
      await cancelMutation.mutateAsync(request.id)
      setShowConfirm(false)
    } catch (error) {
      // Error is handled by mutation
    }
  }

  const handleApprove = async () => {
    try {
      await approveMutation.mutateAsync({ id: request.id })
    } catch (error) {
      // Error is handled by mutation
    }
  }

  const handleReject = async () => {
    // Validate reason
    if (!rejectReason || rejectReason.trim().length < 10) {
      setRejectError('Rejection reason is required (minimum 10 characters)')
      return
    }
    
    try {
      await rejectMutation.mutateAsync({ id: request.id, note: rejectReason.trim() })
      setShowRejectInput(false)
      setRejectReason('')
      setRejectError('')
    } catch (error) {
      // Error is handled by mutation
    }
  }

  // Calculate balance impact preview (for approval variant)
  const balanceImpact = balance ? {
    current: balance.entitled_days + balance.carried_over_days - balance.used_days - balance.pending_days,
    after: balance.entitled_days + balance.carried_over_days - balance.used_days - balance.pending_days - request.total_days,
  } : null

  // Dynamic card styling based on status
  const getCardStyle = () => {
    const baseStyle = {
      borderRadius: 14,
      padding: '14px 16px', // Reduced padding
      transition: 'all 0.15s',
    }

    if (variant === 'approval' && request.status === 'pending') {
      return {
        ...baseStyle,
        background: colors.warnDim,
        border: `2px solid ${colors.warn}`,
        boxShadow: '0 0 20px rgba(201, 123, 42, 0.15)',
      }
    }

    if (request.status === 'approved') {
      return {
        ...baseStyle,
        background: t.surface,
        border: `1px solid ${colors.ok}`,
      }
    }

    if (request.status === 'rejected') {
      return {
        ...baseStyle,
        background: colors.errDim,
        border: `1px solid ${colors.err}`,
      }
    }

    return {
      ...baseStyle,
      background: t.surface,
      border: `1px solid ${t.border}`,
    }
  }

  return (
    <div
      className="transition-all duration-150"
      style={getCardStyle()}
      onMouseEnter={(e) => {
        if (variant !== 'approval' || request.status !== 'pending') {
          e.currentTarget.style.background = t.surfaceHover
        }
      }}
      onMouseLeave={(e) => {
        if (variant !== 'approval' || request.status !== 'pending') {
          e.currentTarget.style.background = t.surface
        }
      }}
    >
      {/* Main Info: Employee + Type + Dates (Compact) */}
      <div className="flex items-start justify-between mb-2">
        <div className="flex-1">
          {/* Employee Name + Status (for team and approval variants) */}
          {(variant === 'team' || variant === 'approval') && (
            <div className="flex items-center gap-2 mb-1">
              <p
                className="font-bold"
                style={{ fontSize: typography.h3.size, color: t.text }}
              >
                {request.employee_name}
              </p>
              <StatusSquare status={request.status} />
            </div>
          )}
          
          {/* Status only (for my variant) */}
          {variant === 'my' && (
            <div className="mb-1">
              <StatusSquare status={request.status} />
            </div>
          )}

          {/* Policy Name (Emphasized) */}
          <p
            className="font-bold mb-0.5"
            style={{ 
              fontSize: typography.h3.size, 
              color: t.text,
              lineHeight: 1.3,
            }}
          >
            {request.policy_name}
          </p>

          {/* Reason (De-emphasized, smaller) */}
          {request.reason && (
            <p
              className="line-clamp-1 mt-1"
              style={{ fontSize: typography.caption.size, color: t.textMuted }}
            >
              {request.reason}
            </p>
          )}
        </div>

        {/* Dates + Days (Emphasized) */}
        <div className="text-right ml-4">
          <p
            className="font-bold mb-0.5"
            style={{
              fontSize: typography.h3.size,
              color: request.status === 'pending' && variant === 'approval' ? colors.warnText : t.text,
            }}
          >
            {request.total_days} {request.total_days === 1 ? 'day' : 'days'}
          </p>
          <p
            style={{
              fontFamily: typography.fontMono,
              fontSize: typography.caption.size,
              color: t.textMuted,
              whiteSpace: 'nowrap',
            }}
          >
            {new Date(request.start_date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })}
            {' – '}
            {new Date(request.end_date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })}
          </p>
        </div>
      </div>

      {/* Balance Impact Preview (approval variant only) */}
      {variant === 'approval' && request.status === 'pending' && balanceImpact && (
        <div
          className="mt-2 mb-3 p-2 rounded-lg text-xs"
          style={{
            background: 'rgba(99, 87, 232, 0.05)',
            border: `1px solid ${t.border}`,
            color: t.textMuted,
          }}
        >
          Balance: <strong style={{ color: t.text }}>{balanceImpact.current} → {balanceImpact.after} days</strong>
        </div>
      )}

      {/* Review Note (if rejected) */}
      {request.status === 'rejected' && request.review_note && (
        <div
          className="mt-2 p-2 rounded-lg"
          style={{
            background: colors.errDim,
            border: `1px solid ${colors.err}`,
          }}
        >
          <p
            className="text-xs font-semibold mb-0.5"
            style={{ color: colors.errText }}
          >
            Rejected:
          </p>
          <p
            className="text-xs line-clamp-2"
            style={{ color: colors.ink500 }}
          >
            {request.review_note}
          </p>
        </div>
      )}

      {/* Inline Reject Reason Input (approval variant, when rejecting) */}
      {variant === 'approval' && showRejectInput && (
        <div className="mt-3 mb-3">
          <textarea
            id="reject-reason"
            value={rejectReason}
            onChange={(e) => {
              setRejectReason(e.target.value)
              setRejectError('')
            }}
            rows={2}
            className="w-full px-3 py-2 text-sm focus:outline-none focus:ring-2 resize-none"
            style={{
              background: t.input,
              border: `1px solid ${rejectError ? colors.err : t.inputBorder}`,
              borderRadius: 10,
              color: t.text,
            }}
            placeholder="Rejection reason (required, min 10 chars)..."
            autoFocus
          />
          {rejectError && (
            <p className="text-xs mt-1" style={{ color: colors.err }}>
              {rejectError}
            </p>
          )}
        </div>
      )}

      {/* Inline Approval Actions (approval variant, pending status) */}
      {variant === 'approval' && request.status === 'pending' && !showRejectInput && (
        <div className="flex items-center gap-2 mt-3">
          <button
            onClick={handleApprove}
            disabled={approveMutation.isPending}
            className="flex-1 flex items-center justify-center gap-1.5 py-2.5 font-semibold text-sm transition-opacity hover:opacity-90 disabled:opacity-50"
            style={{
              background: colors.ok,
              color: '#FFFFFF',
              borderRadius: 10,
              minHeight: 40,
            }}
          >
            <CheckCircle size={15} />
            {approveMutation.isPending ? 'Approving...' : 'Approve'}
          </button>
          <button
            onClick={() => setShowRejectInput(true)}
            disabled={rejectMutation.isPending}
            className="flex-1 flex items-center justify-center gap-1.5 py-2.5 font-semibold text-sm transition-opacity hover:opacity-90 disabled:opacity-50"
            style={{
              background: colors.err,
              color: '#FFFFFF',
              borderRadius: 10,
              minHeight: 40,
            }}
          >
            <XCircle size={15} />
            Reject
          </button>
          {onViewDetails && (
            <button
              onClick={onViewDetails}
              className="flex items-center justify-center px-3 py-2.5 font-medium text-sm transition-opacity hover:opacity-90"
              style={{
                background: t.surfaceHover,
                color: t.textMuted,
                borderRadius: 10,
                border: `1px solid ${t.border}`,
                minHeight: 40,
              }}
            >
              <ExternalLink size={15} />
            </button>
          )}
        </div>
      )}

      {/* Inline Reject Confirmation Actions */}
      {variant === 'approval' && showRejectInput && (
        <div className="flex items-center gap-2">
          <button
            onClick={handleReject}
            disabled={rejectMutation.isPending}
            className="flex-1 py-2.5 font-semibold text-sm transition-opacity hover:opacity-90 disabled:opacity-50"
            style={{
              background: colors.err,
              color: '#FFFFFF',
              borderRadius: 10,
              minHeight: 40,
            }}
          >
            {rejectMutation.isPending ? 'Rejecting...' : 'Confirm Reject'}
          </button>
          <button
            onClick={() => {
              setShowRejectInput(false)
              setRejectReason('')
              setRejectError('')
            }}
            disabled={rejectMutation.isPending}
            className="px-3 py-2.5 font-medium text-sm transition-opacity hover:opacity-70"
            style={{ color: t.textMuted }}
          >
            Cancel
          </button>
        </div>
      )}

      {/* Cancel Request Action (my variant) */}
      {variant === 'my' && canCancelRequest(request.status) && (
        <div className="flex items-center gap-2 mt-3 pt-2" style={{ borderTop: `1px solid ${t.border}` }}>
          {!showConfirm ? (
            <button
              onClick={() => setShowConfirm(true)}
              className="text-sm font-medium transition-opacity hover:opacity-70"
              style={{ color: colors.err }}
            >
              Cancel request
            </button>
          ) : (
            <>
              <button
                onClick={handleCancel}
                disabled={cancelMutation.isPending}
                className="text-sm font-semibold px-3 py-1.5 transition-opacity hover:opacity-90 disabled:opacity-50"
                style={{
                  background: colors.err,
                  color: '#FFFFFF',
                  borderRadius: 8,
                }}
              >
                {cancelMutation.isPending ? 'Cancelling...' : 'Confirm'}
              </button>
              <button
                onClick={() => setShowConfirm(false)}
                disabled={cancelMutation.isPending}
                className="text-sm font-medium transition-opacity hover:opacity-70"
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
