import type { LeaveBalanceWithPolicy } from '@/types/api'
import { calculateAvailableDays } from '@/lib/utils/leave'
import { moduleThemes, typography, colors } from '@/design/tokens'
import { Calendar, TrendingUp, Clock, AlertCircle, ArrowRight } from 'lucide-react'
import { Link } from '@tanstack/react-router'

const t = moduleThemes.leave

interface BalanceCardProps {
  balance: LeaveBalanceWithPolicy
  variant?: 'default' | 'compact' | 'overview'
  showActions?: boolean
}

export function BalanceCard({ 
  balance, 
  variant = 'default',
  showActions = false 
}: BalanceCardProps) {
  const available = calculateAvailableDays(balance)
  const total = balance.entitled_days + balance.carried_over_days
  const usedPercentage = total > 0 ? (balance.used_days / total) * 100 : 0
  const pendingPercentage = total > 0 ? (balance.pending_days / total) * 100 : 0

  // Status indicators
  const isLowBalance = available < total * 0.2 && available > 0
  const isExhausted = available <= 0
  const hasPending = balance.pending_days > 0

  // Icon mapping for common leave types
  const getIcon = (policyName: string) => {
    const name = policyName.toLowerCase()
    if (name.includes('annual') || name.includes('vacation')) {
      return <Calendar size={18} style={{ color: t.accent }} />
    }
    if (name.includes('sick') || name.includes('medical')) {
      return <AlertCircle size={18} style={{ color: colors.warn }} />
    }
    if (name.includes('maternity') || name.includes('paternity')) {
      return <Clock size={18} style={{ color: colors.ok }} />
    }
    return <TrendingUp size={18} style={{ color: t.accent }} />
  }

  const isOverview = variant === 'overview'
  const isCompact = variant === 'compact'

  return (
    <div
      className="group relative transition-all duration-200 hover:-translate-y-1"
      style={{
        background: isOverview ? 'rgba(255,255,255,0.06)' : t.surface,
        borderRadius: isOverview ? 14 : (isCompact ? 12 : 16),
        border: `1px solid ${isOverview ? 'rgba(255,255,255,0.10)' : t.border}`,
        padding: isCompact ? 14 : 20,
        boxShadow: isCompact ? '0 1px 2px rgba(0, 0, 0, 0.04)' : '0 1px 3px rgba(0, 0, 0, 0.05)',
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.background = isOverview ? 'rgba(255,255,255,0.08)' : t.surfaceHover
        e.currentTarget.style.boxShadow = isCompact ? '0 4px 8px rgba(0, 0, 0, 0.06)' : '0 8px 16px rgba(0, 0, 0, 0.08)'
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.background = isOverview ? 'rgba(255,255,255,0.06)' : t.surface
        e.currentTarget.style.boxShadow = isCompact ? '0 1px 2px rgba(0, 0, 0, 0.04)' : '0 1px 3px rgba(0, 0, 0, 0.05)'
      }}
    >
      {/* Header: Policy name with icon + Status badges */}
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-2">
          {!isCompact && (
            <div
              className="flex items-center justify-center flex-shrink-0"
              style={{
                width: 36,
                height: 36,
                borderRadius: 10,
                background: isOverview ? 'rgba(255,255,255,0.08)' : t.surfaceHover,
              }}
            >
              {getIcon(balance.policy_name)}
            </div>
          )}
          <div>
            <h3
              className="font-bold leading-tight"
              style={{
                fontSize: isCompact ? 14 : typography.body.size,
                letterSpacing: typography.h3.tracking,
                color: isOverview ? 'rgba(255,255,255,0.90)' : t.text,
              }}
            >
              {balance.policy_name}
            </h3>
            {!isCompact && (
              <p
                className="mt-0.5"
                style={{
                  fontSize: 12,
                  color: isOverview ? 'rgba(255,255,255,0.50)' : t.textMuted,
                  fontWeight: 500,
                }}
              >
                {balance.year}
              </p>
            )}
          </div>
        </div>

        {/* Status badges */}
        <div className="flex flex-col items-end gap-1.5">
          {hasPending && (
            <span
              className="px-1.5 py-0.5 text-xs font-semibold"
              style={{
                background: isOverview ? 'rgba(201, 123, 42, 0.15)' : colors.warnDim,
                color: isOverview ? '#FFB347' : colors.warnText,
                borderRadius: 4,
                fontSize: isCompact ? 10 : 12,
              }}
            >
              {balance.pending_days} pending
            </span>
          )}
          {isExhausted && (
            <span
              className="px-1.5 py-0.5 text-xs font-semibold"
              style={{
                background: isOverview ? 'rgba(212, 64, 64, 0.15)' : colors.errDim,
                color: isOverview ? '#FF6B6B' : colors.errText,
                borderRadius: 4,
                fontSize: isCompact ? 10 : 12,
              }}
            >
              Exhausted
            </span>
          )}
          {isLowBalance && !isExhausted && (
            <span
              className="px-1.5 py-0.5 text-xs font-semibold"
              style={{
                background: isOverview ? 'rgba(201, 123, 42, 0.15)' : colors.warnDim,
                color: isOverview ? '#FFB347' : colors.warnText,
                borderRadius: 4,
                fontSize: isCompact ? 10 : 12,
              }}
            >
              Low
            </span>
          )}
        </div>
      </div>

      {/* Available days - hero number */}
      <div className="mb-3">
        <div className="flex items-baseline gap-2">
          <span
            className="font-extrabold leading-none"
            style={{
              fontSize: isCompact ? 28 : 42,
              letterSpacing: '-0.02em',
              color: isOverview 
                ? (available > 0 ? colors.ok : 'rgba(255,255,255,0.30)')
                : (available > 0 ? t.accent : colors.ink300),
              fontFamily: typography.fontMono,
            }}
          >
            {available.toFixed(1)}
          </span>
          <span
            className="font-semibold"
            style={{
              fontSize: isCompact ? 11 : 14,
              color: isOverview ? 'rgba(255,255,255,0.50)' : t.textMuted,
            }}
          >
            days available
          </span>
        </div>
      </div>

      {/* Enhanced progress bar with segments */}
      <div className="mb-3">
        {/* Label */}
        <div className="flex items-center justify-between mb-1.5">
          <span
            className="text-xs font-semibold uppercase tracking-wide"
            style={{ 
              color: isOverview ? 'rgba(255,255,255,0.40)' : t.textMuted,
              fontSize: isCompact ? 9 : 10,
            }}
          >
            Usage
          </span>
          <span
            className="text-xs font-semibold"
            style={{ 
              color: isOverview ? 'rgba(255,255,255,0.50)' : t.textMuted,
              fontSize: isCompact ? 10 : 11,
            }}
          >
            {((usedPercentage + pendingPercentage)).toFixed(0)}%
          </span>
        </div>

        {/* Segmented bar */}
        <div
          className="relative"
          style={{
            height: isCompact ? 6 : 10,
            background: isOverview ? 'rgba(255,255,255,0.08)' : colors.ink100,
            borderRadius: isCompact ? 3 : 6,
            overflow: 'hidden',
          }}
        >
          {/* Used days - solid fill */}
          {usedPercentage > 0 && (
            <div
              className="absolute inset-y-0 left-0 transition-all duration-500 ease-out"
              style={{
                width: `${Math.min(usedPercentage, 100)}%`,
                background: isOverview ? 'rgba(18, 160, 92, 0.8)' : colors.ok,
                borderTopLeftRadius: 6,
                borderBottomLeftRadius: 6,
              }}
            />
          )}
          
          {/* Pending days - striped pattern */}
          {pendingPercentage > 0 && (
            <div
              className="absolute inset-y-0 transition-all duration-500 ease-out"
              style={{
                left: `${usedPercentage}%`,
                width: `${Math.min(pendingPercentage, 100 - usedPercentage)}%`,
                background: isOverview 
                  ? `repeating-linear-gradient(
                      45deg,
                      rgba(201, 123, 42, 0.6),
                      rgba(201, 123, 42, 0.6) 4px,
                      rgba(201, 123, 42, 0.3) 4px,
                      rgba(201, 123, 42, 0.3) 8px
                    )`
                  : `repeating-linear-gradient(
                      45deg,
                      ${colors.warn},
                      ${colors.warn} 4px,
                      ${colors.warnDim} 4px,
                      ${colors.warnDim} 8px
                    )`,
              }}
            />
          )}
        </div>

        {/* Legend */}
        {!isCompact && (
          <div className="flex items-center gap-4 mt-2">
            <div className="flex items-center gap-1.5">
              <div
                style={{
                  width: 10,
                  height: 10,
                  borderRadius: 2,
                  background: isOverview ? 'rgba(18, 160, 92, 0.8)' : colors.ok,
                }}
              />
              <span
                className="text-xs font-medium"
                style={{ color: isOverview ? 'rgba(255,255,255,0.50)' : t.textMuted }}
              >
                Used
              </span>
            </div>
            <div className="flex items-center gap-1.5">
              <div
                style={{
                  width: 10,
                  height: 10,
                  borderRadius: 2,
                  background: isOverview ? 'rgba(201, 123, 42, 0.6)' : colors.warn,
                }}
              />
              <span
                className="text-xs font-medium"
                style={{ color: isOverview ? 'rgba(255,255,255,0.50)' : t.textMuted }}
              >
                Pending
              </span>
            </div>
            <div className="flex items-center gap-1.5">
              <div
                style={{
                  width: 10,
                  height: 10,
                  borderRadius: 2,
                  background: isOverview ? 'rgba(255,255,255,0.08)' : colors.ink100,
                }}
              />
              <span
                className="text-xs font-medium"
                style={{ color: isOverview ? 'rgba(255,255,255,0.50)' : t.textMuted }}
              >
                Available
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Stats breakdown */}
      {!isCompact && (
        <div
          className="grid grid-cols-3 gap-3 py-3 mb-3"
          style={{
            borderTop: `1px solid ${isOverview ? 'rgba(255,255,255,0.08)' : colors.ink100}`,
            borderBottom: `1px solid ${isOverview ? 'rgba(255,255,255,0.08)' : colors.ink100}`,
          }}
        >
          <div>
            <p
              className="text-xs font-semibold uppercase mb-1"
              style={{ color: isOverview ? 'rgba(255,255,255,0.40)' : t.textMuted }}
            >
              Entitled
            </p>
            <p
              className="font-bold"
              style={{
                fontSize: typography.body.size,
                color: isOverview ? 'rgba(255,255,255,0.80)' : t.text,
              }}
            >
              {balance.entitled_days}
            </p>
          </div>
          <div>
            <p
              className="text-xs font-semibold uppercase mb-1"
              style={{ color: isOverview ? 'rgba(255,255,255,0.40)' : t.textMuted }}
            >
              Used
            </p>
            <p
              className="font-bold"
              style={{
                fontSize: typography.body.size,
                color: isOverview ? 'rgba(255,255,255,0.80)' : t.text,
              }}
            >
              {balance.used_days}
            </p>
          </div>
          <div>
            <p
              className="text-xs font-semibold uppercase mb-1"
              style={{ color: isOverview ? 'rgba(255,255,255,0.40)' : t.textMuted }}
            >
              {balance.carried_over_days > 0 ? 'Carried' : 'Pending'}
            </p>
            <p
              className="font-bold"
              style={{
                fontSize: typography.body.size,
                color: isOverview ? 'rgba(255,255,255,0.80)' : t.text,
              }}
            >
              {balance.carried_over_days > 0 ? balance.carried_over_days : balance.pending_days}
            </p>
          </div>
        </div>
      )}

      {/* Compact stats (inline) */}
      {isCompact && (
        <div
          className="flex items-center justify-between text-xs py-2"
          style={{
            borderTop: `1px solid ${colors.ink100}`,
            color: t.textMuted,
            fontWeight: 500,
          }}
        >
          <span>
            Entitled: <strong style={{ color: t.text }}>{balance.entitled_days}</strong>
          </span>
          <span>
            Used: <strong style={{ color: t.text }}>{balance.used_days}</strong>
          </span>
          {balance.pending_days > 0 && (
            <span>
              Pending: <strong style={{ color: colors.warnText }}>{balance.pending_days}</strong>
            </span>
          )}
        </div>
      )}

      {/* Quick action */}
      {showActions && (
        <Link
          to="/leave"
          className="group/btn flex items-center justify-center gap-2 py-2.5 px-4 font-semibold text-sm transition-all hover:gap-3"
          style={{
            background: isOverview ? 'rgba(255,255,255,0.10)' : t.accent,
            color: isOverview ? 'rgba(255,255,255,0.90)' : t.accentText,
            borderRadius: 10,
            border: isOverview ? '1px solid rgba(255,255,255,0.15)' : 'none',
          }}
        >
          Request Leave
          <ArrowRight size={16} className="transition-transform group-hover/btn:translate-x-0.5" />
        </Link>
      )}
    </div>
  )
}
