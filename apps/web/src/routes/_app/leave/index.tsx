import { createFileRoute, Link } from '@tanstack/react-router'
import { Plus } from 'lucide-react'
import { useMyBalances } from '@/lib/hooks/useLeave'
import { useCanManageLeave } from '@/lib/hooks/useRole'
import { moduleBackgrounds, moduleThemes, typography, colors } from '@/design/tokens'

const t = moduleThemes.leave

export const Route = createFileRoute('/_app/leave/')({
  component: LeaveDashboard,
})

function LeaveDashboard() {
  const currentYear = new Date().getFullYear()
  const { data: balances, isLoading } = useMyBalances(currentYear)
  const canManageLeave = useCanManageLeave()

  const totalAvailable = balances?.reduce((sum, b) => {
    const available = b.entitled_days + b.carried_over_days - b.used_days - b.pending_days
    return sum + available
  }, 0) ?? 0

  return (
    <div
      className="min-h-screen px-6 py-8 md:px-11 md:py-10 pb-28"
      style={{ background: moduleBackgrounds.leave }}
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1
            className="font-extrabold"
            style={{
              fontSize: typography.display.size,
              letterSpacing: typography.display.tracking,
              color: t.text,
              lineHeight: typography.display.lineHeight,
            }}
          >
            Leave
          </h1>
          <p className="text-sm mt-2" style={{ color: t.textMuted }}>
            {totalAvailable} day{totalAvailable === 1 ? '' : 's'} available
          </p>
        </div>
        <Link
          to="/leave/requests/new"
          className="flex items-center gap-1.5 text-sm font-semibold px-4 py-2.5 transition-colors hover:opacity-90"
          style={{
            background: t.accent,
            color: t.accentText,
            borderRadius: 12,
          }}
        >
          <Plus size={16} />
          Request leave
        </Link>
      </div>

      {/* Balance Cards */}
      <div>
        <h2
          className="font-bold mb-4"
          style={{
            fontSize: typography.h2.size,
            letterSpacing: typography.h2.tracking,
            color: t.text,
          }}
        >
          Your Leave Balances
        </h2>

        {isLoading ? (
          <BalancesSkeleton />
        ) : !balances || balances.length === 0 ? (
          <EmptyBalances />
        ) : (
          <div
            style={{
              background: t.surface,
              borderRadius: 14,
              border: `1px solid ${t.border}`,
              overflow: 'hidden',
            }}
          >
            {/* Table Header */}
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: '2fr 1fr 1fr 1fr 1fr 1.2fr',
                gap: 16,
                padding: '14px 20px',
                background: t.surfaceHover,
                borderBottom: `1px solid ${t.border}`,
              }}
            >
              <div
                className="text-xs font-bold uppercase tracking-wide"
                style={{ color: t.textMuted }}
              >
                Policy
              </div>
              <div
                className="text-xs font-bold uppercase tracking-wide text-center"
                style={{ color: t.textMuted }}
              >
                Available
              </div>
              <div
                className="text-xs font-bold uppercase tracking-wide text-center"
                style={{ color: t.textMuted }}
              >
                Entitled
              </div>
              <div
                className="text-xs font-bold uppercase tracking-wide text-center"
                style={{ color: t.textMuted }}
              >
                Used
              </div>
              <div
                className="text-xs font-bold uppercase tracking-wide text-center"
                style={{ color: t.textMuted }}
              >
                Pending
              </div>
              <div
                className="text-xs font-bold uppercase tracking-wide text-right"
                style={{ color: t.textMuted }}
              >
                Status
              </div>
            </div>

            {/* Table Rows */}
            {balances.map((balance, idx) => {
              const available =
                balance.entitled_days +
                balance.carried_over_days -
                balance.used_days -
                balance.pending_days
              const total = balance.entitled_days + balance.carried_over_days
              const availablePercentage = total > 0 ? (available / total) * 100 : 0
              const pendingPercentage = total > 0 ? (balance.pending_days / total) * 100 : 0
              const isLowBalance = available < total * 0.2 && available > 0
              const isExhausted = available <= 0

              return (
                <div
                  key={balance.id}
                  style={{
                    display: 'grid',
                    gridTemplateColumns: '2fr 1fr 1fr 1fr 1fr 1.2fr',
                    gap: 16,
                    padding: '18px 20px',
                    borderBottom:
                      idx < balances.length - 1 ? `1px solid ${t.border}` : 'none',
                    transition: 'background 0.15s',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = t.surfaceHover
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = 'transparent'
                  }}
                >
                  {/* Policy Name + Progress Bar */}
                  <div className="flex flex-col justify-center">
                    <p
                      className="font-bold mb-2"
                      style={{
                        fontSize: typography.body.size,
                        color: t.text,
                      }}
                    >
                      {balance.policy_name}
                    </p>
                    <div
                      className="relative"
                      style={{
                        height: 6,
                        background: colors.ink100,
                        borderRadius: 3,
                        overflow: 'hidden',
                      }}
                    >
                      {/* Available - green fill */}
                      <div
                        className="absolute inset-y-0 left-0"
                        style={{
                          width: `${Math.min(availablePercentage, 100)}%`,
                          background: colors.ok,
                          borderTopLeftRadius: 3,
                          borderBottomLeftRadius: 3,
                          transition: 'width 0.3s ease',
                        }}
                      />
                      {/* Pending - striped yellow overlay */}
                      {pendingPercentage > 0 && (
                        <div
                          className="absolute inset-y-0"
                          style={{
                            left: `${availablePercentage}%`,
                            width: `${Math.min(pendingPercentage, 100 - availablePercentage)}%`,
                            background: `repeating-linear-gradient(
                              45deg,
                              ${colors.warn},
                              ${colors.warn} 3px,
                              ${colors.warnDim} 3px,
                              ${colors.warnDim} 6px
                            )`,
                            transition: 'width 0.3s ease, left 0.3s ease',
                          }}
                        />
                      )}
                    </div>
                  </div>

                  {/* Available */}
                  <div className="flex items-center justify-center">
                    {available === 999 ? (
                      <span
                        className="font-extrabold"
                        style={{
                          fontSize: 28,
                          color: t.accent,
                          letterSpacing: '-0.01em',
                        }}
                      >
                        ∞
                      </span>
                    ) : (
                      <span
                        className="font-extrabold"
                        style={{
                          fontSize: 24,
                          fontFamily: typography.fontMono,
                          color: available > 0 ? t.accent : colors.ink300,
                          letterSpacing: '-0.01em',
                        }}
                      >
                        {available.toFixed(1)}
                      </span>
                    )}
                  </div>

                  {/* Entitled */}
                  <div className="flex items-center justify-center">
                    <span
                      className="font-semibold"
                      style={{
                        fontSize: typography.body.size,
                        color: t.text,
                      }}
                    >
                      {balance.entitled_days === 999 ? '∞' : balance.entitled_days}
                      {balance.carried_over_days > 0 && balance.entitled_days !== 999 && (
                        <span
                          style={{
                            fontSize: 12,
                            color: t.textMuted,
                            marginLeft: 4,
                          }}
                        >
                          +{balance.carried_over_days}
                        </span>
                      )}
                    </span>
                  </div>

                  {/* Used */}
                  <div className="flex items-center justify-center">
                    <span
                      className="font-semibold"
                      style={{
                        fontSize: typography.body.size,
                        color: t.text,
                      }}
                    >
                      {balance.used_days}
                    </span>
                  </div>

                  {/* Pending */}
                  <div className="flex items-center justify-center">
                    <span
                      className="font-semibold"
                      style={{
                        fontSize: typography.body.size,
                        color:
                          balance.pending_days > 0 ? colors.warnText : t.textMuted,
                      }}
                    >
                      {balance.pending_days || '—'}
                    </span>
                  </div>

                  {/* Status Badge */}
                  <div className="flex items-center justify-end">
                    {isExhausted ? (
                      <span
                        className="px-3 py-1 text-xs font-semibold"
                        style={{
                          background: colors.errDim,
                          color: colors.errText,
                          borderRadius: 6,
                        }}
                      >
                        Exhausted
                      </span>
                    ) : isLowBalance ? (
                      <span
                        className="px-3 py-1 text-xs font-semibold"
                        style={{
                          background: colors.warnDim,
                          color: colors.warnText,
                          borderRadius: 6,
                        }}
                      >
                        Low
                      </span>
                    ) : (
                      <span
                        className="px-3 py-1 text-xs font-semibold"
                        style={{
                          background: colors.okDim,
                          color: colors.okText,
                          borderRadius: 6,
                        }}
                      >
                        Available
                      </span>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Quick Links */}
      <div className="mt-8 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
        <Link
          to="/leave/requests"
          className="p-4 transition-colors"
          style={{
            background: t.surface,
            borderRadius: 14,
            border: `1px solid ${t.border}`,
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = t.surfaceHover
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = t.surface
          }}
        >
          <p
            className="font-bold"
            style={{ fontSize: typography.h3.size, color: t.text }}
          >
            My Requests
          </p>
          <p className="text-sm mt-1" style={{ color: t.textMuted }}>
            View your leave request history
          </p>
        </Link>

        <Link
          to="/leave/requests/pending"
          className="p-4 transition-colors"
          style={{
            background: t.surface,
            borderRadius: 14,
            border: `1px solid ${t.border}`,
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = t.surfaceHover
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = t.surface
          }}
        >
          <p
            className="font-bold"
            style={{ fontSize: typography.h3.size, color: t.text }}
          >
            Pending Approvals
          </p>
          <p className="text-sm mt-1" style={{ color: t.textMuted }}>
            Review team leave requests
          </p>
        </Link>

        <Link
          to="/leave/calendar"
          className="p-4 transition-colors"
          style={{
            background: t.surface,
            borderRadius: 14,
            border: `1px solid ${t.border}`,
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = t.surfaceHover
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = t.surface
          }}
        >
          <p
            className="font-bold"
            style={{ fontSize: typography.h3.size, color: t.text }}
          >
            Calendar View
          </p>
          <p className="text-sm mt-1" style={{ color: t.textMuted }}>
            See team leave schedule
          </p>
        </Link>

        {canManageLeave && (
          <Link
            to="/leave/policies"
            className="p-4 transition-colors"
            style={{
              background: t.surface,
              borderRadius: 14,
              border: `1px solid ${t.border}`,
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = t.surfaceHover
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = t.surface
            }}
          >
            <p
              className="font-bold"
              style={{ fontSize: typography.h3.size, color: t.text }}
            >
              Leave Settings
            </p>
            <p className="text-sm mt-1" style={{ color: t.textMuted }}>
              Manage leave policies
            </p>
          </Link>
        )}
      </div>
    </div>
  )
}

function BalancesSkeleton() {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      {[1, 2].map((i) => (
        <div
          key={i}
          className="animate-pulse"
          style={{
            background: t.surface,
            borderRadius: 14,
            border: `1px solid ${t.border}`,
            padding: 20,
            height: 140,
          }}
        >
          <div style={{ background: t.surfaceHover, height: 20, width: '60%', borderRadius: 4 }} />
          <div style={{ background: t.surfaceHover, height: 12, width: '40%', borderRadius: 4, marginTop: 8 }} />
        </div>
      ))}
    </div>
  )
}

function EmptyBalances() {
  return (
    <div
      className="flex flex-col items-center justify-center text-center"
      style={{
        background: t.surface,
        borderRadius: 14,
        border: `1px solid ${t.border}`,
        padding: 48,
        minHeight: 240,
      }}
    >
      <svg
        width="48"
        height="48"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        style={{ color: '#B0AEBE', marginBottom: 12 }}
      >
        <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
        <line x1="16" y1="2" x2="16" y2="6" />
        <line x1="8" y1="2" x2="8" y2="6" />
        <line x1="3" y1="10" x2="21" y2="10" />
      </svg>
      <p
        className="font-bold"
        style={{ fontSize: typography.h3.size, color: t.text }}
      >
        No leave balances yet
      </p>
      <p className="text-sm mt-1" style={{ color: t.textMuted }}>
        Ask your HR admin to set up leave policies.
      </p>
    </div>
  )
}
