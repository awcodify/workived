import { ArrowRight } from 'lucide-react'
import type { LeaveRequestWithDetails } from '@/types/api'
import { StatusSquare } from '@/components/workived/layout/StatusSquare'
import { formatDateRange, canCancelRequest } from '@/lib/utils/leave'
import { useCancelRequest } from '@/lib/hooks/useLeave'
import { moduleThemes, typography } from '@/design/tokens'
import { useState } from 'react'

const t = moduleThemes.leave

interface RequestCardProps {
  request: LeaveRequestWithDetails
  variant?: 'my' | 'team' // 'my' shows cancel button, 'team' shows employee name
}

export function RequestCard({ request, variant = 'my' }: RequestCardProps) {
  const [showConfirm, setShowConfirm] = useState(false)
  const cancelMutation = useCancelRequest()

  const handleCancel = async () => {
    try {
      await cancelMutation.mutateAsync(request.id)
      setShowConfirm(false)
    } catch (error) {
      // Error is handled by mutation
    }
  }

  const dateRange = formatDateRange(request.start_date, request.end_date, request.total_days)

  return (
    <div
      className="transition-all duration-150"
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
      {/* Header: Status + Dates */}
      <div className="flex items-start justify-between mb-3">
        <StatusSquare status={request.status} />
        <span
          style={{
            fontFamily: typography.fontMono,
            fontSize: typography.mono.size,
            color: t.textMuted,
          }}
        >
          {dateRange}
        </span>
      </div>

      {/* Employee Name (for team variant) */}
      {variant === 'team' && (
        <p
          className="font-semibold mb-1"
          style={{ fontSize: typography.body.size, color: t.text }}
        >
          {request.employee_name}
        </p>
      )}

      {/* Policy Name */}
      <p
        className="font-semibold mb-1"
        style={{ fontSize: typography.label.size, color: t.text }}
      >
        {request.policy_name}
      </p>

      {/* Reason */}
      {request.reason && (
        <p
          className="mb-3 line-clamp-2"
          style={{ fontSize: typography.body.size, color: t.textMuted }}
        >
          Reason: {request.reason}
        </p>
      )}

      {/* Review Note (if rejected) */}
      {request.status === 'rejected' && request.review_note && (
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
            {request.review_note}
          </p>
        </div>
      )}

      {/* Actions */}
      {variant === 'my' && canCancelRequest(request.status) && (
        <div className="flex items-center gap-3 mt-4">
          {!showConfirm ? (
            <button
              onClick={() => setShowConfirm(true)}
              className="text-sm font-semibold transition-opacity hover:opacity-70"
              style={{ color: '#D44040' }} // err
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
