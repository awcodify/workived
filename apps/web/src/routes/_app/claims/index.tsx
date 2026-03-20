import { createFileRoute, Link, useNavigate } from '@tanstack/react-router'
import { Clock, FileText, Settings } from 'lucide-react'
import { useMyClaimBalances, useAllClaims } from '@/lib/hooks/useClaims'
import { useCanManageClaims } from '@/lib/hooks/useRole'
import { moduleBackgrounds, moduleThemes, typography, colors } from '@/design/tokens'
import type { ClaimBalanceWithCategory, Claim } from '@/types/api'

const t = moduleThemes.claims

export const Route = createFileRoute('/_app/claims/')({
  component: ClaimsDashboard,
})

function ClaimsDashboard() {
  const navigate = useNavigate()
  const canManageClaims = useCanManageClaims()

  // Get current year and month for balances
  const now = new Date()
  const currentYear = now.getFullYear()
  const currentMonth = now.getMonth() + 1

  const { data: balances, isLoading } = useMyClaimBalances(currentYear, currentMonth)
  const { data: allClaims } = useAllClaims()

  const pendingCount = allClaims?.data?.filter((c: Claim) => c.status === 'pending').length ?? 0

  const totalSpent = balances?.reduce((sum: number, b: ClaimBalanceWithCategory) => sum + b.total_spent, 0) ?? 0
  const totalLimit = balances?.reduce((sum: number, b: ClaimBalanceWithCategory) => sum + (b.monthly_limit ?? 0), 0) ?? 0

  return (
    <div
      className="min-h-screen px-6 py-8 md:px-11 md:py-10 pb-28"
      style={{ background: moduleBackgrounds.claims }}
    >
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-4">
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
              Claims
            </h1>
            <p className="text-sm mt-2" style={{ color: t.textMuted }}>
              {totalLimit > 0
                ? `${new Intl.NumberFormat('id-ID').format(totalLimit - totalSpent)} remaining this month`
                : 'Track your expenses'}
            </p>
          </div>
        </div>

        {/* Action Toolbar */}
        <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
          <Link
            to="/claims/requests/pending"
            className="relative flex items-center gap-2 px-4 py-3 transition-all hover:scale-[1.02]"
            style={{
              background: t.surface,
              borderRadius: 12,
              border: `1px solid ${t.border}`,
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = t.surfaceHover
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = t.surface
            }}
          >
            <Clock size={18} style={{ color: t.accent }} />
            <span className="text-sm font-semibold" style={{ color: t.text }}>
              Pending Approvals
            </span>
            {pendingCount > 0 && (
              <span
                className="absolute -top-1.5 -right-1.5 flex items-center justify-center min-w-[20px] h-5 px-1.5 text-[10px] font-bold animate-pulse"
                style={{
                  background: '#D44040',
                  color: '#FFFFFF',
                  borderRadius: 10,
                  border: `2px solid ${moduleBackgrounds.claims}`,
                  boxShadow: '0 2px 8px rgba(212, 64, 64, 0.4)',
                  animationDuration: '2s',
                }}
              >
                {pendingCount > 99 ? '99+' : pendingCount}
              </span>
            )}
          </Link>

          <Link
            to="/claims/requests"
            className="flex items-center gap-2 px-4 py-3 transition-all hover:scale-[1.02]"
            style={{
              background: t.surface,
              borderRadius: 12,
              border: `1px solid ${t.border}`,
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = t.surfaceHover
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = t.surface
            }}
          >
            <FileText size={18} style={{ color: t.accent }} />
            <span className="text-sm font-semibold" style={{ color: t.text }}>
              My Requests
            </span>
          </Link>

          {canManageClaims && (
            <Link
              to="/claims/categories"
              className="flex items-center gap-2 px-4 py-3 transition-all hover:scale-[1.02]"
              style={{
                background: t.surface,
                borderRadius: 12,
                border: `1px solid ${t.border}`,
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = t.surfaceHover
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = t.surface
              }}
            >
              <Settings size={18} style={{ color: t.accent }} />
              <span className="text-sm font-semibold" style={{ color: t.text }}>
                Categories
              </span>
            </Link>
          )}
        </div>
      </div>

      {/* Balance Cards */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2
            className="font-bold"
            style={{
              fontSize: typography.h2.size,
              letterSpacing: typography.h2.tracking,
              color: t.text,
            }}
          >
            Your Claim Balances
          </h2>
          <p className="text-xs font-semibold" style={{ color: t.textMuted }}>
            Click a balance to create a claim
          </p>
        </div>

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
                gridTemplateColumns: '2fr 1.2fr 1.2fr 1.2fr',
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
                Category
              </div>
              <div
                className="text-xs font-bold uppercase tracking-wide text-center"
                style={{ color: t.textMuted }}
              >
                Monthly Limit
              </div>
              <div
                className="text-xs font-bold uppercase tracking-wide text-center"
                style={{ color: t.textMuted }}
              >
                Spent
              </div>
              <div
                className="text-xs font-bold uppercase tracking-wide text-center"
                style={{ color: t.textMuted }}
              >
                Remaining
              </div>
            </div>

            {/* Table Rows */}
            {balances.map((balance: ClaimBalanceWithCategory, idx: number) => {
              const limit = balance.monthly_limit ?? 0
              const spent = balance.total_spent
              const remaining = balance.remaining ?? 0
              const remainingPercentage = limit > 0 ? (remaining / limit) * 100 : 0
              const isLowBalance = limit > 0 && remainingPercentage <= 20 && remainingPercentage > 0
              const isExhausted = remaining <= 0 && limit > 0

              // Format currency
              const formatMoney = (amount: number) => {
                return new Intl.NumberFormat('id-ID', {
                  style: 'currency',
                  currency: balance.currency_code || 'IDR',
                  minimumFractionDigits: 0,
                  maximumFractionDigits: 0,
                }).format(amount)
              }

              return (
                <div
                  key={balance.id}
                  onClick={() => {
                    if (!isExhausted) {
                      navigate({
                        to: '/claims/new',
                        search: { categoryId: balance.category_id },
                      })
                    }
                  }}
                  style={{
                    display: 'grid',
                    gridTemplateColumns: '2fr 1.2fr 1.2fr 1.2fr',
                    gap: 16,
                    padding: '18px 20px',
                    borderBottom:
                      idx < balances.length - 1 ? `1px solid ${t.border}` : 'none',
                    transition: 'background 0.15s, transform 0.15s',
                    cursor: isExhausted ? 'not-allowed' : 'pointer',
                    opacity: isExhausted ? 0.5 : 1,
                  }}
                  onMouseEnter={(e) => {
                    if (!isExhausted) {
                      e.currentTarget.style.background = t.surfaceHover
                      e.currentTarget.style.transform = 'translateX(4px)'
                    }
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = 'transparent'
                    e.currentTarget.style.transform = 'translateX(0)'
                  }}
                >
                  {/* Category Name + Progress Bar */}
                  <div className="flex flex-col justify-center">
                    <p
                      className="font-bold mb-2"
                      style={{
                        fontSize: typography.body.size,
                        color: t.text,
                      }}
                    >
                      {balance.category_name}
                    </p>
                    {limit > 0 && (
                      <div
                        className="relative"
                        style={{
                          height: 8,
                          background: colors.ink100,
                          borderRadius: 4,
                          overflow: 'hidden',
                        }}
                      >
                        {/* Remaining - green fill showing available budget */}
                        <div
                          className="absolute inset-y-0 left-0"
                          style={{
                            width: `${Math.min(remainingPercentage, 100)}%`,
                            background: isExhausted
                              ? colors.err
                              : isLowBalance
                                ? colors.warn
                                : colors.ok,
                            borderTopLeftRadius: 4,
                            borderBottomLeftRadius: 4,
                            transition: 'width 0.3s ease, background 0.3s ease',
                          }}
                        />
                      </div>
                    )}
                  </div>

                  {/* Monthly Limit */}
                  <div className="flex items-center justify-center">
                    {limit > 0 ? (
                      <span
                        className="font-semibold"
                        style={{
                          fontSize: 14,
                          color: t.textMuted,
                        }}
                      >
                        {formatMoney(limit)}
                      </span>
                    ) : (
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
                    )}
                  </div>

                  {/* Spent */}
                  <div className="flex items-center justify-center">
                    <span
                      className="font-bold"
                      style={{
                        fontSize: 16,
                        fontFamily: typography.fontMono,
                        color: spent > 0 ? t.text : colors.ink300,
                        letterSpacing: '-0.01em',
                      }}
                    >
                      {formatMoney(spent)}
                    </span>
                  </div>

                  {/* Remaining */}
                  <div className="flex items-center justify-center">
                    {limit > 0 ? (
                      <span
                        className="font-extrabold"
                        style={{
                          fontSize: 24,
                          fontFamily: typography.fontMono,
                          color: isExhausted
                            ? colors.err
                            : isLowBalance
                              ? colors.warn
                              : colors.ok,
                          letterSpacing: '-0.01em',
                        }}
                      >
                        {formatMoney(remaining)}
                      </span>
                    ) : (
                      <span
                        className="font-extrabold"
                        style={{
                          fontSize: 28,
                          color: colors.ok,
                          letterSpacing: '-0.01em',
                        }}
                      >
                        ∞
                      </span>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}

function BalancesSkeleton() {
  return (
    <div
      className="animate-pulse"
      style={{
        background: t.surface,
        borderRadius: 14,
        border: `1px solid ${t.border}`,
        padding: 20,
        height: 180,
      }}
    >
      <div style={{ background: t.surfaceHover, height: 16, width: '40%', borderRadius: 4 }} />
      <div style={{ background: t.surfaceHover, height: 12, width: '60%', borderRadius: 4, marginTop: 12 }} />
      <div style={{ background: t.surfaceHover, height: 12, width: '50%', borderRadius: 4, marginTop: 8 }} />
    </div>
  )
}

function EmptyBalances() {
  const navigate = useNavigate()
  const canManageClaims = useCanManageClaims()

  return (
    <div
      className="flex flex-col items-center justify-center text-center"
      style={{
        background: t.surface,
        borderRadius: 14,
        border: `1px solid ${t.border}`,
        padding: 48,
        minHeight: 180,
      }}
    >
      <p
        className="font-semibold mb-1"
        style={{ fontSize: typography.body.size, color: t.text }}
      >
        No claim categories configured
      </p>
      <p
        className="mb-4"
        style={{ fontSize: typography.label.size, color: t.textMuted }}
      >
        {canManageClaims 
          ? 'Set up claim categories to start tracking expenses'
          : 'Contact your admin to set up claim categories'}
      </p>
      {canManageClaims && (
        <button
          onClick={() => navigate({ to: '/claims/categories' })}
          className="font-semibold text-sm px-4 py-2 transition-opacity hover:opacity-90"
          style={{
            background: t.accent,
            color: t.accentText,
            borderRadius: 10,
          }}
        >
          Set Up Categories
        </button>
      )}
    </div>
  )
}
