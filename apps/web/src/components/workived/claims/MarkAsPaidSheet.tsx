import { useState } from 'react'
import type { ClaimWithDetails } from '@/types/api'
import { colors, typography, radius, getAvatarColor } from '@/design/tokens'
import { formatClaimAmount } from './ClaimRequestConfig'

interface Props {
  claim: ClaimWithDetails
  onClose: () => void
  onConfirm: () => Promise<void>
}

export function MarkAsPaidSheet({ claim, onClose, onConfirm }: Props) {
  const [isPending, setIsPending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const avatarColor = getAvatarColor(claim.employee_id)
  const initials = claim.employee_name
    .split(' ')
    .map((n) => n[0] ?? '')
    .join('')
    .toUpperCase()
    .slice(0, 2)

  const approvedDate = claim.reviewed_at
    ? new Date(claim.reviewed_at).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      })
    : null

  async function handleConfirm() {
    setIsPending(true)
    setError(null)
    try {
      await onConfirm()
      onClose()
    } catch {
      setError('Payment could not be recorded. Try again.')
      setIsPending(false)
    }
  }

  return (
    <>
      {/* Backdrop */}
      <div
        data-testid="mark-paid-backdrop"
        onClick={onClose}
        style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(0,0,0,0.45)',
          zIndex: 50,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      />

      {/* Centered modal */}
      <div
        data-testid="mark-paid-sheet"
        style={{
          position: 'fixed',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          background: '#FFFFFF',
          borderRadius: radius['2xl'],
          zIndex: 51,
          padding: '28px 28px 24px',
          width: '90%',
          maxWidth: 440,
          boxShadow: '0 20px 60px rgba(0,0,0,0.18)',
        }}
      >
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
          <h2
            style={{
              fontSize: typography.h2.size,
              fontWeight: typography.h2.weight,
              letterSpacing: typography.h2.tracking,
              color: colors.ink900,
              margin: 0,
            }}
          >
            Confirm Payment
          </h2>
          <button
            onClick={onClose}
            disabled={isPending}
            style={{
              background: 'none',
              border: 'none',
              cursor: isPending ? 'not-allowed' : 'pointer',
              color: colors.ink300,
              padding: 4,
              lineHeight: 1,
              fontSize: 18,
            }}
            aria-label="Close"
          >
            ✕
          </button>
        </div>

        {/* Claim summary */}
        <div
          style={{
            background: colors.ink50,
            borderRadius: radius.lg,
            padding: 16,
            marginBottom: 20,
          }}
        >
          {/* Employee row */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
            <div
              data-testid="employee-avatar"
              style={{
                width: 36,
                height: 36,
                borderRadius: 10,
                background: avatarColor.bg,
                color: avatarColor.text,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 12,
                fontWeight: 700,
                flexShrink: 0,
              }}
            >
              {initials}
            </div>
            <div>
              <p style={{ fontSize: 14, fontWeight: 600, color: colors.ink900, margin: 0 }}>
                {claim.employee_name}
              </p>
              <p style={{ fontSize: 12, color: colors.ink500, margin: '2px 0 0' }}>
                {claim.category_name}
              </p>
            </div>
          </div>

          {/* Amount — hero number */}
          <p
            style={{
              fontSize: 32,
              fontWeight: 800,
              letterSpacing: '-0.04em',
              color: colors.ink900,
              textAlign: 'center',
              margin: '0 0 4px',
            }}
          >
            {formatClaimAmount(claim.amount, claim.currency_code)}
          </p>
          {approvedDate && (
            <p style={{ fontSize: 12, color: colors.ink500, textAlign: 'center', margin: 0 }}>
              Approved on {approvedDate}
            </p>
          )}
        </div>

        {/* Error banner */}
        {error && (
          <div
            data-testid="pay-error"
            style={{
              background: colors.errDim,
              color: colors.errText,
              borderRadius: radius.md,
              padding: '10px 12px',
              fontSize: 13,
              marginBottom: 16,
              display: 'flex',
              alignItems: 'center',
              gap: 8,
            }}
          >
            ⚠ {error}
          </div>
        )}

        {/* Actions */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <button
            data-testid="confirm-pay-btn"
            onClick={handleConfirm}
            disabled={isPending}
            style={{
              width: '100%',
              height: 48,
              background: isPending ? `${colors.ok}99` : colors.ok,
              color: '#FFFFFF',
              border: 'none',
              borderRadius: radius.lg,
              fontSize: 15,
              fontWeight: 700,
              cursor: isPending ? 'not-allowed' : 'pointer',
              transition: 'opacity 0.15s',
            }}
          >
            {isPending ? 'Processing…' : 'Confirm — Mark as Paid'}
          </button>

          <button
            data-testid="cancel-pay-btn"
            onClick={onClose}
            disabled={isPending}
            style={{
              width: '100%',
              height: 40,
              background: 'none',
              border: `1px solid ${colors.ink150}`,
              borderRadius: radius.lg,
              fontSize: 14,
              fontWeight: 500,
              color: colors.ink500,
              cursor: isPending ? 'not-allowed' : 'pointer',
            }}
          >
            Cancel
          </button>
        </div>
      </div>
    </>
  )
}
