import type { LeaveBalanceWithPolicy } from '@/types/api'
import { calculateAvailableDays } from '@/lib/utils/leave'
import { moduleThemes, typography } from '@/design/tokens'

const t = moduleThemes.leave

interface BalanceCardProps {
  balance: LeaveBalanceWithPolicy
}

export function BalanceCard({ balance }: BalanceCardProps) {
  const available = calculateAvailableDays(balance)
  const total = balance.entitled_days + balance.carried_over_days
  const usedPercentage = total > 0 ? (balance.used_days / total) * 100 : 0
  const pendingPercentage = total > 0 ? ((balance.used_days + balance.pending_days) / total) * 100 : 0

  return (
    <div
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
      {/* Header: Policy Name + Available Days */}
      <div className="flex items-baseline justify-between mb-2">
        <h3
          className="font-bold"
          style={{
            fontSize: typography.h3.size,
            letterSpacing: typography.h3.tracking,
            color: t.text,
          }}
        >
          {balance.policy_name}
        </h3>
        <span
          className="font-extrabold"
          style={{
            fontSize: typography.h1.size,
            letterSpacing: typography.h1.tracking,
            color: t.accent,
          }}
        >
          {available}
        </span>
      </div>

      {/* Breakdown */}
      <p
        className="mb-3"
        style={{
          fontSize: typography.caption.size,
          fontWeight: typography.caption.weight,
          color: t.textMuted,
        }}
      >
        {balance.entitled_days} days granted
        {balance.carried_over_days > 0 && ` • ${balance.carried_over_days} carried over`}
      </p>

      {/* Progress Bar */}
      <div
        className="relative mb-2"
        style={{
          height: 8,
          background: '#EDECF4', // ink100
          borderRadius: 4,
        }}
      >
        {/* Used days (solid fill) */}
        <div
          className="absolute inset-y-0 left-0 transition-all duration-300"
          style={{
            width: `${Math.min(usedPercentage, 100)}%`,
            background: t.accent,
            borderRadius: 4,
          }}
        />
        {/* Pending days (overlay) */}
        {balance.pending_days > 0 && (
          <div
            className="absolute inset-y-0 left-0 transition-all duration-300"
            style={{
              width: `${Math.min(pendingPercentage, 100)}%`,
              background: 'rgba(201, 123, 42, 0.5)', // warn color with opacity
              borderRadius: 4,
            }}
          />
        )}
      </div>

      {/* Usage Details */}
      <div
        className="flex items-center justify-between"
        style={{
          fontSize: typography.caption.size,
          fontWeight: typography.caption.weight,
          color: t.textMuted,
        }}
      >
        <span>
          {balance.used_days} / {total} used
        </span>
        {balance.pending_days > 0 && (
          <span style={{ color: '#C97B2A' }}>
            {balance.pending_days} pending
          </span>
        )}
      </div>
    </div>
  )
}
