import { useState } from 'react'
import { Check, X } from 'lucide-react'
import { colors } from '@/design/tokens'

export interface RequestListItemTheme {
  text: string
  textMuted: string
  surface: string
  surfaceHover: string
  border: string
  input: string
  inputBorder: string
}

export interface RequestData {
  id: string
  status: 'pending' | 'approved' | 'rejected' | 'cancelled'
  start_date: string
  end_date: string
  total_days: number
  reason?: string
  review_note?: string
  reviewed_by_name?: string
  reviewed_by?: string
  // Module-specific fields will be in here too
  [key: string]: any
}

export interface RequestListItemActions {
  onApprove?: (id: string) => Promise<void>
  onReject?: (id: string, note: string) => Promise<void>
  onCancel?: (id: string) => Promise<void>
  isPendingApprove?: boolean
  isPendingReject?: boolean
  isPendingCancel?: boolean
}

export interface RequestListItemConfig {
  // What to display as the main title
  getTitle: (request: RequestData) => string
  // Optional subtitle (e.g., employee name for approvals)
  getSubtitle?: (request: RequestData) => string | null
  // Optional extra info below title (e.g., balance impact)
  getExtraInfo?: (request: RequestData, variant: 'my' | 'approval') => React.ReactNode
  // Summary text for grouped requests (e.g., "5 days total" or "Rp 500K total")
  getSummaryText?: (requests: RequestData[]) => string
  // Optional custom content for right side (defaults to date + days)
  getRightContent?: (request: RequestData, variant: 'my' | 'approval') => React.ReactNode
  // Custom details modal component
  DetailsModal: React.ComponentType<{ request: RequestData; onClose: () => void }>
}

export interface RequestListItemProps {
  request: RequestData
  variant: 'my' | 'approval'
  config: RequestListItemConfig
  actions: RequestListItemActions
  theme: RequestListItemTheme
  isLast?: boolean
}

export function RequestListItem({ 
  request, 
  variant, 
  config,
  actions,
  theme,
  isLast = false 
}: RequestListItemProps) {
  const [showRejectInput, setShowRejectInput] = useState(false)
  const [rejectReason, setRejectReason] = useState('')
  const [rejectError, setRejectError] = useState('')
  const [showDetails, setShowDetails] = useState(false)

  const handleApprove = async () => {
    if (!actions.onApprove) return
    try {
      await actions.onApprove(request.id)
    } catch (error) {
      // Error handled by caller
    }
  }

  const handleReject = async () => {
    if (!actions.onReject) return
    
    if (!rejectReason || rejectReason.trim().length < 10) {
      setRejectError('Rejection reason is required (minimum 10 characters)')
      return
    }
    
    try {
      await actions.onReject(request.id, rejectReason.trim())
      setShowRejectInput(false)
      setRejectReason('')
      setRejectError('')
    } catch (error) {
      // Error handled by caller
    }
  }

  const handleCancel = async () => {
    if (!actions.onCancel) return
    try {
      await actions.onCancel(request.id)
    } catch (error) {
      // Error handled by caller
    }
  }

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('en-GB', {
      day: '2-digit',
      month: 'short',
    })
  }

  const DetailsModal = config.DetailsModal

  return (
    <>
      {showDetails && (
        <DetailsModal request={request} onClose={() => setShowDetails(false)} />
      )}
      
      <div
        className="transition-all"
        style={{
          padding: '12px 18px',
          borderBottom: !isLast ? `1px solid ${theme.border}` : 'none',
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.background = theme.surfaceHover
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.background = 'transparent'
        }}
      >
        <div className="flex items-center justify-between">
          {/* Left: Name + Title - Clickable for details */}
          <div 
            className="flex-1 mr-4 cursor-pointer"
            onClick={() => setShowDetails(true)}
          >
            {config.getSubtitle && config.getSubtitle(request) && (
              <p className="font-bold text-sm mb-0.5" style={{ color: theme.text }}>
                {config.getSubtitle(request)}
              </p>
            )}
            <div className="flex items-center gap-2">
              <p className="font-semibold text-sm" style={{ color: theme.text }}>
                {config.getTitle(request)}
              </p>
              {/* Only show status badge for 'my' variant or non-pending statuses */}
              {(variant === 'my' || request.status !== 'pending') && (
                <span
                  className="text-[10px] font-semibold px-1.5 py-0.5 rounded uppercase"
                  style={{
                    background: request.status === 'pending' ? colors.warnDim : 
                               request.status === 'approved' ? colors.okDim :
                               request.status === 'rejected' ? colors.errDim : colors.ink100,
                    color: request.status === 'pending' ? colors.warnText :
                           request.status === 'approved' ? colors.okText :
                           request.status === 'rejected' ? colors.errText : colors.ink500,
                  }}
                >
                  {request.status}
                </span>
              )}
            </div>
            {/* Extra Info (e.g., balance impact) */}
            {config.getExtraInfo && config.getExtraInfo(request, variant)}
          </div>

          {/* Right: Custom Content or Dates + Days + Actions */}
          <div className="flex items-center gap-3">
            {config.getRightContent ? (
              config.getRightContent(request, variant)
            ) : (
              <div className="text-right">
                <p className="text-xs" style={{ color: theme.textMuted }}>
                  {formatDate(request.start_date)} – {formatDate(request.end_date)}
                </p>
                <p className="text-xs font-bold mt-0.5" style={{ color: theme.text }}>
                  {request.total_days} {request.total_days === 1 ? 'day' : 'days'}
                </p>
              </div>
            )}

            {/* Action Buttons (approval variant, icon-only) */}
            {variant === 'approval' && request.status === 'pending' && !showRejectInput && (
              <div className="flex items-center gap-1.5">
                {actions.onApprove && (
                  <button
                    onClick={handleApprove}
                    disabled={actions.isPendingApprove}
                    className="flex items-center justify-center transition-all hover:scale-110 disabled:opacity-50"
                    style={{
                      width: 32,
                      height: 32,
                      background: colors.ok,
                      color: '#FFFFFF',
                      borderRadius: 8,
                    }}
                    title="Approve"
                  >
                    <Check size={16} strokeWidth={3} />
                  </button>
                )}
                {actions.onReject && (
                  <button
                    onClick={() => setShowRejectInput(true)}
                    className="flex items-center justify-center transition-all hover:scale-110"
                    style={{
                      width: 32,
                      height: 32,
                      background: colors.err,
                      color: '#FFFFFF',
                      borderRadius: 8,
                    }}
                    title="Reject"
                  >
                    <X size={16} strokeWidth={3} />
                  </button>
                )}
              </div>
            )}

            {/* Cancel button (my variant, icon) */}
            {variant === 'my' && request.status === 'pending' && actions.onCancel && (
              <button
                onClick={handleCancel}
                disabled={actions.isPendingCancel}
                className="flex items-center justify-center transition-all hover:scale-110 disabled:opacity-50"
                style={{
                  width: 32,
                  height: 32,
                  background: colors.err,
                  color: '#FFFFFF',
                  borderRadius: 8,
                }}
                title="Cancel request"
              >
                <X size={16} strokeWidth={3} />
              </button>
            )}
          </div>
        </div>

        {/* Rejection Note (if rejected) */}
        {request.status === 'rejected' && request.review_note && (
          <div
            className="text-xs p-2 rounded mt-2"
            style={{
              background: colors.errDim,
              color: colors.errText,
            }}
          >
            <strong>Rejected:</strong> {request.review_note}
          </div>
        )}

        {/* Inline Reject Input */}
        {variant === 'approval' && showRejectInput && (
          <div className="mt-2">
            <textarea
              value={rejectReason}
              onChange={(e) => {
                setRejectReason(e.target.value)
                setRejectError('')
              }}
              rows={2}
              className="w-full px-2 py-1.5 text-xs focus:outline-none focus:ring-1 resize-none"
              style={{
                background: theme.input,
                border: `1px solid ${rejectError ? colors.err : theme.inputBorder}`,
                borderRadius: 8,
                color: theme.text,
              }}
              placeholder="Rejection reason (required, min 10 chars)..."
              autoFocus
            />
            {rejectError && (
              <p className="text-xs mt-1" style={{ color: colors.err }}>
                {rejectError}
              </p>
            )}
            <div className="flex items-center gap-2 mt-2">
              <button
                onClick={handleReject}
                disabled={actions.isPendingReject}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold transition-opacity hover:opacity-90 disabled:opacity-50"
                style={{
                  background: colors.err,
                  color: '#FFFFFF',
                  borderRadius: 8,
                }}
              >
                <X size={12} />
                {actions.isPendingReject ? 'Rejecting...' : 'Confirm Reject'}
              </button>
              <button
                onClick={() => {
                  setShowRejectInput(false)
                  setRejectReason('')
                  setRejectError('')
                }}
                className="px-3 py-1.5 text-xs font-medium transition-opacity hover:opacity-70"
                style={{ color: theme.textMuted }}
              >
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>
    </>
  )
}
