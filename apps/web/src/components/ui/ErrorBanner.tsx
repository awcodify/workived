import { colors } from '@/design/tokens'
import type { ApiErrorDetails } from '@/lib/utils/errors'

interface ErrorBannerProps {
  /** Simple error message (backward compatible) */
  message?: string
  /** Rich error with details */
  error?: ApiErrorDetails
}

/**
 * Displays API error messages with optional contextual details.
 * Supports both simple string errors and rich error objects with Details field.
 */
export function ErrorBanner({ message, error }: ErrorBannerProps) {
  const errorMessage = error?.message || message
  const errorDetails = error?.details

  if (!errorMessage) return null

  return (
    <div
      role="alert"
      aria-live="polite"
      className="px-4 py-3 rounded-xl"
      style={{ background: colors.errDim, border: `1px solid ${colors.err}` }}
    >
      <p style={{ fontSize: 14, color: colors.errText, fontWeight: 500 }}>
        {errorMessage}
      </p>
      {errorDetails && Object.keys(errorDetails).length > 0 && (
        <div style={{ marginTop: 8, paddingTop: 8, borderTop: `1px solid ${colors.err}` }}>
          <p style={{ fontSize: 12, color: colors.errText, opacity: 0.8, marginBottom: 4 }}>
            Details:
          </p>
          <dl style={{ fontSize: 12, color: colors.errText, opacity: 0.9 }}>
            {Object.entries(errorDetails).map(([key, value]) => (
              <div key={key} style={{ display: 'flex', gap: 8, marginTop: 2 }}>
                <dt style={{ fontWeight: 500, textTransform: 'capitalize' }}>
                  {key.replace(/_/g, ' ')}:
                </dt>
                <dd>{formatDetailValue(value)}</dd>
              </div>
            ))}
          </dl>
        </div>
      )}
    </div>
  )
}

function formatDetailValue(value: any): string {
  if (value === null || value === undefined) return '-'
  if (typeof value === 'boolean') return value ? 'Yes' : 'No'
  if (typeof value === 'number') {
    // Format large numbers with thousand separators
    return value.toLocaleString()
  }
  if (typeof value === 'object') return JSON.stringify(value, null, 2)
  return String(value)
}
