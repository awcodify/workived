import { X } from 'lucide-react'
import { colors, typography } from '@/design/tokens'
import { RequestListItemTheme, RequestData } from './RequestListItem'

export interface RequestDetailsField {
  label: string
  value: React.ReactNode
  show: boolean
}

export interface RequestDetailsModalConfig {
  title: string
  getFields: (request: RequestData) => RequestDetailsField[]
}

export interface RequestDetailsModalProps {
  request: RequestData
  config: RequestDetailsModalConfig
  theme: RequestListItemTheme
  onClose: () => void
}

export function RequestDetailsModal({ request, config, theme, onClose }: RequestDetailsModalProps) {
  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('en-GB', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    })
  }

  const fields = config.getFields(request)

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ background: 'rgba(0, 0, 0, 0.5)' }}
      onClick={onClose}
    >
      <div
        className="relative max-w-lg w-full mx-4"
        style={{
          background: theme.surface,
          borderRadius: 16,
          border: `1px solid ${theme.border}`,
          padding: 24,
          maxHeight: '80vh',
          overflow: 'auto',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 transition-opacity hover:opacity-70"
          style={{ color: theme.textMuted }}
        >
          <X size={20} />
        </button>

        {/* Header */}
        <h3
          className="font-bold mb-4"
          style={{ fontSize: typography.h2.size, color: theme.text }}
        >
          {config.title}
        </h3>

        {/* Common Fields: Status */}
        <div className="space-y-3">
          <div>
            <p className="text-xs font-semibold" style={{ color: theme.textMuted }}>
              Status
            </p>
            <span
              className="inline-block text-xs font-semibold px-2 py-1 rounded mt-1"
              style={{
                background: request.status === 'pending' ? colors.warnDim : 
                           request.status === 'approved' ? colors.okDim :
                           request.status === 'rejected' ? colors.errDim : colors.ink100,
                color: request.status === 'pending' ? colors.warnText :
                       request.status === 'approved' ? colors.okText :
                       request.status === 'rejected' ? colors.errText : colors.ink500,
              }}
            >
              {request.status.toUpperCase()}
            </span>
          </div>

          <div>
            <p className="text-xs font-semibold" style={{ color: theme.textMuted }}>
              Dates
            </p>
            <p className="text-sm font-bold" style={{ color: theme.text }}>
              {formatDate(request.start_date)} – {formatDate(request.end_date)}
            </p>
            <p className="text-xs mt-1" style={{ color: theme.textMuted }}>
              {request.total_days} {request.total_days === 1 ? 'day' : 'days'}
            </p>
          </div>

          {/* Module-specific fields */}
          {fields.map((field, idx) => (
            field.show && (
              <div key={idx}>
                <p className="text-xs font-semibold" style={{ color: theme.textMuted }}>
                  {field.label}
                </p>
                <div className="text-sm" style={{ color: theme.text }}>
                  {field.value}
                </div>
              </div>
            )
          ))}

          {/* Common: Reason */}
          {request.reason && (
            <div>
              <p className="text-xs font-semibold" style={{ color: theme.textMuted }}>
                Reason
              </p>
              <p className="text-sm" style={{ color: theme.text }}>
                {request.reason}
              </p>
            </div>
          )}

          {/* Common: Rejection Note */}
          {request.status === 'rejected' && request.review_note && (
            <div>
              <p className="text-xs font-semibold" style={{ color: colors.errText }}>
                Rejection Reason
              </p>
              <p
                className="text-sm p-2 rounded mt-1"
                style={{
                  background: colors.errDim,
                  color: colors.errText,
                }}
              >
                {request.review_note}
              </p>
            </div>
          )}

          {/* Common: Reviewed By */}
          {(request.reviewed_by_name || request.reviewed_by) && (
            <div>
              <p className="text-xs font-semibold" style={{ color: theme.textMuted }}>
                Reviewed By
              </p>
              <p className="text-sm" style={{ color: theme.text }}>
                {request.reviewed_by_name || request.reviewed_by}
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
