import { useState } from 'react'
import { Check, X } from 'lucide-react'
import { colors } from '@/design/tokens'
import { RequestListItem, RequestListItemTheme, RequestData, RequestListItemConfig } from './RequestListItem'

export interface EmployeeRequestGroupActions {
  onApproveAll: (requests: RequestData[]) => Promise<void>
  onRejectAll: (requests: RequestData[], note: string) => Promise<void>
  onApprove: (id: string) => Promise<void>
  onReject: (id: string, note: string) => Promise<void>
  isPendingApprove?: boolean
  isPendingReject?: boolean
}

export interface EmployeeRequestGroupProps {
  employeeName: string
  requests: RequestData[]
  actions: EmployeeRequestGroupActions
  config: RequestListItemConfig
  theme: RequestListItemTheme
  // Optional: find balance/budget for each request
  findContextData?: (request: RequestData) => any
}

export function EmployeeRequestGroup({ 
  employeeName, 
  requests, 
  actions,
  config,
  theme,
  findContextData
}: EmployeeRequestGroupProps) {
  const [isExpanded, setIsExpanded] = useState(false)
  const [showRejectInput, setShowRejectInput] = useState(false)
  const [rejectReason, setRejectReason] = useState('')
  const [rejectError, setRejectError] = useState('')
  
  const requestCount = requests.length
  const summaryText = config.getSummaryText ? config.getSummaryText(requests) : `${requests.reduce((sum, r) => sum + (r.total_days || 0), 0)} days total`
  
  const handleApproveAll = async () => {
    try {
      await actions.onApproveAll(requests)
    } catch (error) {
      console.error('Failed to approve all requests:', error)
    }
  }
  
  const handleRejectAll = async () => {
    if (!rejectReason || rejectReason.trim().length < 10) {
      setRejectError('Rejection reason is required (minimum 10 characters)')
      return
    }
    
    try {
      await actions.onRejectAll(requests, rejectReason.trim())
      setShowRejectInput(false)
      setRejectReason('')
      setRejectError('')
    } catch (error) {
      console.error('Failed to reject all requests:', error)
    }
  }
  
  return (
    <div
      style={{
        background: theme.surface,
        borderRadius: 14,
        border: `1px solid ${theme.border}`,
        overflow: 'hidden',
      }}
    >
      {/* Collapsed Header */}
      <div
        className="flex items-center justify-between transition-all"
        style={{
          padding: '14px 18px',
          background: 'transparent',
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.background = theme.surfaceHover
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.background = 'transparent'
        }}
      >
        <div 
          className="flex-1 cursor-pointer"
          onClick={() => setIsExpanded(!isExpanded)}
        >
          <div className="flex items-center gap-2">
            <p className="font-bold text-sm" style={{ color: theme.text }}>
              {employeeName}
            </p>
            <span
              className="text-[10px] font-medium px-1.5 py-0.5 rounded"
              style={{
                background: colors.ink100,
                color: colors.ink500,
              }}
            >
              {requestCount} {requestCount === 1 ? 'request' : 'requests'}
            </span>
          </div>
          <p className="text-xs mt-0.5" style={{ color: theme.textMuted }}>
            {summaryText}
            {requests.length > 1 && ' • Click to see individual requests'}
          </p>
        </div>
        
        <div className="flex items-center gap-2">
          {!showRejectInput && (
            <>
              <button
                onClick={handleApproveAll}
                disabled={actions.isPendingApprove}
                className="flex items-center justify-center transition-all hover:scale-110 disabled:opacity-50"
                style={{
                  width: 32,
                  height: 32,
                  background: colors.ok,
                  color: '#FFFFFF',
                  borderRadius: 8,
                }}
                title={`Approve all ${requestCount} requests`}
              >
                <Check size={16} strokeWidth={3} />
              </button>
              
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
                title={`Reject all ${requestCount} requests`}
              >
                <X size={16} strokeWidth={3} />
              </button>
            </>
          )}
          
          {requestCount > 1 && (
            <button
              onClick={() => setIsExpanded(!isExpanded)}
              className="flex items-center justify-center transition-all hover:opacity-70"
              style={{
                width: 32,
                height: 32,
                color: theme.textMuted,
              }}
            >
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                style={{
                  transform: isExpanded ? 'rotate(180deg)' : 'rotate(0deg)',
                  transition: 'transform 0.2s',
                }}
              >
                <polyline points="6 9 12 15 18 9" />
              </svg>
            </button>
          )}
        </div>
      </div>
      
      {/* Reject All Input */}
      {showRejectInput && (
        <div
          style={{
            padding: '0 18px 14px 18px',
            borderTop: `1px solid ${theme.border}`,
          }}
        >
          <div className="pt-3">
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
              placeholder="Rejection reason for all requests (required, min 10 chars)..."
              autoFocus
            />
            {rejectError && (
              <p className="text-xs mt-1" style={{ color: colors.err }}>
                {rejectError}
              </p>
            )}
            <div className="flex items-center gap-2 mt-2">
              <button
                onClick={handleRejectAll}
                disabled={actions.isPendingReject}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold transition-opacity hover:opacity-90 disabled:opacity-50"
                style={{
                  background: colors.err,
                  color: '#FFFFFF',
                  borderRadius: 8,
                }}
              >
                <X size={12} />
                {actions.isPendingReject ? 'Rejecting...' : `Reject All ${requestCount}`}
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
        </div>
      )}
      
      {/* Expanded Individual Requests */}
      {isExpanded && (
        <div style={{ borderTop: `1px solid ${theme.border}` }}>
          {requests.map((request, idx) => {
            const contextData = findContextData ? findContextData(request) : undefined
            
            return (
              <RequestListItem
                key={request.id}
                request={{ ...request, ...contextData }}
                variant="approval"
                config={config}
                actions={{
                  onApprove: actions.onApprove,
                  onReject: actions.onReject,
                  isPendingApprove: actions.isPendingApprove,
                  isPendingReject: actions.isPendingReject,
                }}
                theme={theme}
                isLast={idx === requests.length - 1}
              />
            )
          })}
        </div>
      )}
    </div>
  )
}
