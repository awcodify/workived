import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { AlertCircle, Settings, X, Upload } from 'lucide-react'
import { DateTime } from '@/components/workived/shared/DateTime'
import { 
  useMyClaimBalances, 
  useAllClaims, 
  useMyClaims,
  useApproveClaim,
  useRejectClaim,
  useCancelClaim,
  useSubmitClaim,
  useCategories,
} from '@/lib/hooks/useClaims'
import { useCanManageClaims, useRole } from '@/lib/hooks/useRole'
import { useOrganisation } from '@/lib/hooks/useOrganisation'
import { moduleBackgrounds, moduleThemes, typography, colors } from '@/design/tokens'
import type { ClaimBalanceWithCategory, ClaimWithDetails } from '@/types/api'
import { useState, useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { RequestListItem, EmployeeRequestGroup, type RequestData } from '@/components/workived/shared/requests'
import { createClaimRequestConfig, claimRequestTheme } from '@/components/workived/claims/ClaimRequestConfig'

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
  const { data: allClaims } = useAllClaims() // For approvals
  const { data: myClaimsResponse } = useMyClaims() // For "My Requests" tab
  
  const approveMutation = useApproveClaim()
  const rejectMutation = useRejectClaim()
  const cancelMutation = useCancelClaim()
  
  const [activeTab, setActiveTab] = useState<'approvals' | 'my-requests'>('my-requests')
  
  const [showNewClaimModal, setShowNewClaimModal] = useState(false)
  const [selectedCategoryId, setSelectedCategoryId] = useState<string>('')

  const pendingClaims = allClaims?.data?.filter((c: ClaimWithDetails) => c.status === 'pending') ?? []
  const myClaims = myClaimsResponse?.data ?? []
  const pendingCount = pendingClaims.length

  const totalSpent = balances?.reduce((sum: number, b: ClaimBalanceWithCategory) => sum + b.total_spent, 0) ?? 0
  const totalLimit = balances?.reduce((sum: number, b: ClaimBalanceWithCategory) => sum + (b.monthly_limit ?? 0), 0) ?? 0

  // Smart default: show approvals only if manager AND has pending items
  useEffect(() => {
    if (canManageClaims && pendingCount > 0) {
      setActiveTab('approvals')
    }
  }, [canManageClaims, pendingCount])

  return (
    <div
      className="min-h-screen px-6 py-8 md:px-11 md:py-10"
      style={{ background: moduleBackgrounds.claims, paddingBottom: '160px' }}
    >
      {/* Header */}
      <div className="mb-6">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
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
          
          <div className="flex items-center gap-4">
              <DateTime 
                textColor={t.text}
                textMutedColor={t.textMuted}
                borderColor={t.border}
              />
              {/* Notification Placeholder */}
              <div
                  style={{
                    minWidth: 36,
                    height: 36,
                    background: t.surface,
                    borderRadius: 10,
                    boxShadow: '0 1px 4px 0 rgba(0,0,0,0.04)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    padding: 0,
                    border: `1px solid ${t.border}`,
                  }}
                  title="No notifications"
                >
                  <svg width="18" height="18" fill="none" viewBox="0 0 24 24" style={{ color: colors.accent, flexShrink: 0 }}>
                    <path d="M18 16v-5a6 6 0 10-12 0v5a2 2 0 01-2 2h16a2 2 0 01-2-2z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                    <path d="M13.73 21a2 2 0 01-3.46 0" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </div>
            </div>
        </div>
      </div>

      {/* Two Column Layout - Left wider for visual bars */}
      <div className="grid grid-cols-1 lg:grid-cols-[1.5fr_1fr] gap-6">
        {/* LEFT COLUMN: Claim Balances */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <h2
              className="font-bold"
              style={{
                fontSize: typography.h2.size,
                letterSpacing: typography.h2.tracking,
                color: t.text,
              }}
            >
              Need to claim? Click a category to submit
            </h2>
            
            {/* Settings button for managers */}
            {canManageClaims && (
              <button
              onClick={() => navigate({ to: '/claims/categories' })}
              className="flex items-center gap-2 px-4 py-2 font-semibold text-sm transition-all hover:opacity-80"
              style={{
                background: t.surface,
                color: t.text,
                borderRadius: 10,
                border: `1px solid ${t.border}`,
              }}
              title="Manage claim categories"
            >
              <Settings size={16} />
              Settings
            </button>
            )}
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
              {balances.map((balance: ClaimBalanceWithCategory, idx: number) => {
                const limit = balance.monthly_limit ?? 0
                const remaining = balance.remaining ?? 0
                const remainingPercentage = limit > 0 ? (remaining / limit) * 100 : 0
                const isLowBalance = limit > 0 && remainingPercentage <= 20 && remainingPercentage > 0
                const isExhausted = remaining <= 0 && limit > 0

                // Format currency - compact version (K for thousands, M for millions)
                const formatMoney = (amount: number) => {
                  const absAmount = Math.abs(amount)
                  if (absAmount >= 1000000) {
                    return `Rp ${(amount / 1000000).toFixed(1)}M`
                  } else if (absAmount >= 1000) {
                    return `Rp ${Math.round(amount / 1000)}K`
                  }
                  return `Rp ${amount.toLocaleString('id-ID')}`
                }

                return (
                  <div
                    key={balance.id}
                    onClick={() => {
                      if (!isExhausted) {
                        setSelectedCategoryId(balance.category_id)
                        setShowNewClaimModal(true)
                      }
                    }}
                    className="transition-all"
                    style={{
                      padding: '16px 18px',
                      borderBottom: idx < balances.length - 1 ? `1px solid ${t.border}` : 'none',
                      cursor: isExhausted ? 'not-allowed' : 'pointer',
                      opacity: isExhausted ? 0.5 : 1,
                    }}
                    onMouseEnter={(e) => {
                      if (!isExhausted) {
                        e.currentTarget.style.background = t.surfaceHover
                      }
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background = 'transparent'
                    }}
                  >
                    {/* Header: Category name + Budget info */}
                    <div className="flex items-start justify-between mb-2">
                      <p
                        className="font-bold flex-1"
                        style={{
                          fontSize: typography.body.size,
                          color: t.text,
                        }}
                      >
                        {balance.category_name}
                      </p>

                      <div className="text-right">
                        {limit > 0 ? (
                          <div>
                            <p className="text-base font-bold" style={{ 
                              color: isExhausted
                                ? colors.err
                                : isLowBalance
                                  ? colors.warn
                                  : colors.ok,
                              fontFamily: typography.fontMono,
                              lineHeight: 1.2,
                            }}>
                              {formatMoney(remaining)} left
                            </p>
                            <p className="text-xs" style={{ color: t.textMuted, marginTop: 2 }}>
                              of {formatMoney(limit)}
                            </p>
                          </div>
                        ) : (
                          <p
                            className="text-2xl font-extrabold"
                            style={{ color: t.accent }}
                          >
                            ∞
                          </p>
                        )}
                      </div>
                    </div>

                    {/* Progress Bar + Status */}
                    {limit > 0 && (
                      <div className="flex items-center gap-3">
                        {/* Progress bar */}
                        <div
                          className="flex-1"
                          style={{
                            height: 6,
                            borderRadius: 3,
                            background: colors.ink100,
                            overflow: 'hidden',
                            position: 'relative',
                          }}
                        >
                          <div
                            style={{
                              position: 'absolute',
                              left: 0,
                              top: 0,
                              bottom: 0,
                              width: `${Math.min(remainingPercentage, 100)}%`,
                              background: isExhausted
                                ? colors.err
                                : isLowBalance
                                  ? colors.warn
                                  : colors.ok,
                              transition: 'width 0.3s ease',
                            }}
                          />
                        </div>
                        
                        {/* Percentage badge */}
                        <span
                          className="text-xs font-bold px-2 py-0.5"
                          style={{
                            color: isExhausted
                              ? colors.errText
                              : isLowBalance
                                ? colors.warnText
                                : colors.okText,
                            background: isExhausted
                              ? colors.errDim
                              : isLowBalance
                                ? colors.warnDim
                                : colors.okDim,
                            borderRadius: 6,
                            minWidth: 52,
                            textAlign: 'center',
                          }}
                        >
                          {Math.floor(remainingPercentage)}% left
                        </span>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* RIGHT COLUMN: Tabs (Approvals + My Requests) */}
        <div>
          {/* Tab Headers */}
          <div className="flex items-center gap-2 mb-4">
            {canManageClaims && pendingCount > 0 && (
              <button
                onClick={() => setActiveTab('approvals')}
                className="flex items-center gap-2 px-4 py-2 font-semibold text-sm transition-all"
                style={{
                  background: activeTab === 'approvals' ? t.surface : 'transparent',
                  color: activeTab === 'approvals' ? t.text : t.textMuted,
                  borderRadius: 10,
                  border: activeTab === 'approvals' ? `1px solid ${t.border}` : '1px solid transparent',
                }}
              >
                <AlertCircle size={16} style={{ color: colors.warn }} />
                Need Your Attention
                {pendingCount > 0 && (
                  <span
                    className="flex items-center justify-center min-w-[20px] h-5 px-1.5 text-[10px] font-bold"
                    style={{
                      background: colors.warn,
                      color: '#FFFFFF',
                      borderRadius: 10,
                    }}
                  >
                    {pendingCount}
                  </span>
                )}
              </button>
            )}
            <button
              onClick={() => setActiveTab('my-requests')}
              className="flex items-center gap-2 px-4 py-2 font-semibold text-sm transition-all"
              style={{
                background: activeTab === 'my-requests' ? t.surface : 'transparent',
                color: activeTab === 'my-requests' ? t.text : t.textMuted,
                borderRadius: 10,
                border: activeTab === 'my-requests' ? `1px solid ${t.border}` : '1px solid transparent',
              }}
            >
              My Requests
              {myClaims && myClaims.length > 0 && (
                <span className="text-xs" style={{ color: t.textMuted }}>
                  ({myClaims.length})
                </span>
              )}
            </button>
          </div>

          {/* Tab Content */}
          {activeTab === 'approvals' && canManageClaims && (
            <div>
              {pendingClaims.length === 0 ? (
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
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                  <p
                    className="font-bold"
                    style={{ fontSize: typography.h3.size, color: t.text }}
                  >
                    All caught up!
                  </p>
                  <p className="text-sm mt-1" style={{ color: t.textMuted }}>
                    No pending claims to review
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {(() => {
                    // Group claims by employee
                    const groupedByEmployee = pendingClaims.reduce((acc, claim) => {
                      const key = claim.employee_id
                      if (!acc[key]) {
                        acc[key] = {
                          employee_id: claim.employee_id,
                          employee_name: claim.employee_name,
                          requests: [],
                        }
                      }
                      acc[key].requests.push(claim)
                      return acc
                    }, {} as Record<string, { employee_id: string; employee_name: string; requests: ClaimWithDetails[] }>)

                    return Object.values(groupedByEmployee).map((group) => (
                      <EmployeeRequestGroup
                        key={group.employee_id}
                        employeeName={group.employee_name}
                        requests={group.requests as unknown as RequestData[]}
                        actions={{
                          onApproveAll: async (requests) => {
                            for (const request of requests) {
                              try {
                                await approveMutation.mutateAsync({ id: request.id })
                              } catch (error) {
                                console.error('Failed to approve claim:', request.id, error)
                              }
                            }
                          },
                          onRejectAll: async (requests, note) => {
                            for (const request of requests) {
                              try {
                                await rejectMutation.mutateAsync({ id: request.id, data: { review_note: note } })
                              } catch (error) {
                                console.error('Failed to reject claim:', request.id, error)
                              }
                            }
                          },
                          onApprove: async (id) => {
                            await approveMutation.mutateAsync({ id })
                          },
                          onReject: async (id, note) => {
                            await rejectMutation.mutateAsync({ id, data: { review_note: note } })
                          },
                          isPendingApprove: approveMutation.isPending,
                          isPendingReject: rejectMutation.isPending,
                        }}
                        config={createClaimRequestConfig()}
                        theme={claimRequestTheme}
                        findContextData={(request) => {
                          const claim = request as unknown as ClaimWithDetails
                          const balance = balances?.find(
                            (b) => b.category_id === claim.category_id
                          )
                          return balance ? { balance } : undefined
                        }}
                      />
                    ))
                  })()}
                </div>
              )}
            </div>
          )}

          {activeTab === 'my-requests' && (
            <div>
              {myClaims.length === 0 ? (
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
                    <path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z" />
                  </svg>
                  <p
                    className="font-bold"
                    style={{ fontSize: typography.h3.size, color: t.text }}
                  >
                    No requests yet
                  </p>
                  <p className="text-sm mt-1" style={{ color: t.textMuted }}>
                    Click a claim category to submit your first claim
                  </p>
                </div>
              ) : (
                <div
                  style={{
                    background: t.surface,
                    borderRadius: 14,
                    border: `1px solid ${t.border}`,
                    overflow: 'hidden',
                  }}
                >
                  {myClaims.map((claim, idx) => {
                    // Find matching balance for this claim
                    const matchedBalance = balances?.find(
                      (b) => b.category_id === claim.category_id
                    )

                    return (
                      <RequestListItem
                        key={claim.id}
                        request={claim as unknown as RequestData}
                        variant="my"
                        config={createClaimRequestConfig(matchedBalance)}
                        actions={{
                          onCancel: async (id) => {
                            await cancelMutation.mutateAsync(id)
                          },
                          isPendingCancel: cancelMutation.isPending,
                        }}
                        theme={claimRequestTheme}
                        isLast={idx === myClaims.length - 1}
                      />
                    )
                  })}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
      
      {/* New Claim Modal */}
      {showNewClaimModal && selectedCategoryId && (
        <NewClaimModal
          categoryId={selectedCategoryId}
          onClose={() => {
            setShowNewClaimModal(false)
            setSelectedCategoryId('')
          }}
        />
      )}
    </div>
  )
}

function BalancesSkeleton() {
  return (
    <div
      style={{
        background: t.surface,
        borderRadius: 14,
        border: `1px solid ${t.border}`,
        overflow: 'hidden',
      }}
    >
      {[1, 2, 3].map((i) => (
        <div
          key={i}
          className="animate-pulse"
          style={{
            padding: '14px 18px',
            borderBottom: i < 3 ? `1px solid ${t.border}` : 'none',
          }}
        >
          <div style={{ background: t.surfaceHover, height: 16, width: '40%', borderRadius: 4 }} />
          <div style={{ background: t.surfaceHover, height: 8, width: '100%', borderRadius: 4, marginTop: 12 }} />
        </div>
      ))}
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

// New Claim Modal Component
interface NewClaimModalProps {
  categoryId: string
  onClose: () => void
}

interface ClaimFormData {
  category_id: string
  amount: string
  description: string
  claim_date: string
}

function NewClaimModal({ categoryId, onClose }: NewClaimModalProps) {
  const role = useRole()
  const { data: org } = useOrganisation()
  const { data: categories } = useCategories()
  const submitMutation = useSubmitClaim()

  const [receipt, setReceipt] = useState<File | null>(null)
  const [receiptPreview, setReceiptPreview] = useState<string | null>(null)
  const [amountDisplay, setAmountDisplay] = useState<string>('')
  const [fileError, setFileError] = useState<string | null>(null)
  const [showOwnerConfirmation, setShowOwnerConfirmation] = useState(false)
  const [pendingFormData, setPendingFormData] = useState<ClaimFormData | null>(null)

  const {
    register,
    handleSubmit,
    formState: { errors },
    setValue,
    clearErrors,
  } = useForm<ClaimFormData>({
    defaultValues: {
      category_id: categoryId,
      claim_date: new Date().toISOString().split('T')[0],
    },
  })

  const selectedCategory = categories?.find((c) => c.id === categoryId)

  const formatNumberWithCommas = (value: string): string => {
    // Remove all non-digit characters
    const digitsOnly = value.replace(/\D/g, '')
    
    // Format with thousand separators
    return digitsOnly.replace(/\B(?=(\d{3})+(?!\d))/g, ',')
  }

  const handleAmountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const input = e.target.value
    const formatted = formatNumberWithCommas(input)
    setAmountDisplay(formatted)
    
    // Store raw number value for form submission
    const rawValue = input.replace(/\D/g, '')
    setValue('amount', rawValue)
    
    // Validate
    if (rawValue && parseInt(rawValue) > 0) {
      clearErrors('amount')
    }
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setFileError(null) // Clear previous errors

    // Validate file type
    const allowedTypes = ['image/jpeg', 'image/png', 'application/pdf']
    if (!allowedTypes.includes(file.type)) {
      setFileError('Only JPG, PNG, and PDF files are allowed')
      e.target.value = '' // Reset file input
      return
    }

    // Validate file size (10MB max)
    if (file.size > 10 * 1024 * 1024) {
      setFileError('File size must be less than 10MB')
      e.target.value = '' // Reset file input
      return
    }

    setReceipt(file)

    // Generate preview for images
    if (file.type.startsWith('image/')) {
      const reader = new FileReader()
      reader.onloadend = () => {
        setReceiptPreview(reader.result as string)
      }
      reader.readAsDataURL(file)
    } else {
      setReceiptPreview(null)
    }
  }

  const removeFile = () => {
    setReceipt(null)
    setReceiptPreview(null)
    setFileError(null) // Clear file error when removing file
  }

  const onSubmit = async (data: ClaimFormData) => {
    if (!org) return

    // Check if receipt is required
    if (selectedCategory?.requires_receipt && !receipt) {
      setFileError('Receipt is required for this category')
      return
    }

    // If owner and not yet confirmed, show confirmation first
    if (role === 'owner' && !showOwnerConfirmation) {
      setPendingFormData(data)
      setShowOwnerConfirmation(true)
      return
    }

    const payload = {
      category_id: data.category_id,
      amount: parseInt(data.amount, 10),
      currency_code: org.currency_code,
      description: data.description.trim(),
      claim_date: data.claim_date,
    }

    try {
      await submitMutation.mutateAsync({ data: payload, receipt: receipt || undefined })
      setFileError(null)
      onClose()
    } catch (error) {
      // Error handled by mutation
    }
  }

  const handleConfirmSubmit = async () => {
    if (!org || !pendingFormData) return

    setShowOwnerConfirmation(false)

    const payload = {
      category_id: pendingFormData.category_id,
      amount: parseInt(pendingFormData.amount, 10),
      currency_code: org.currency_code,
      description: pendingFormData.description.trim(),
      claim_date: pendingFormData.claim_date,
    }

    try {
      await submitMutation.mutateAsync({ data: payload, receipt: receipt || undefined })
      setFileError(null)
      onClose()
    } catch (error) {
      // Error handled by mutation
    }
  }

  const handleCancelConfirmation = () => {
    setShowOwnerConfirmation(false)
    setPendingFormData(null)
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-2"
      style={{ background: 'rgba(0, 0, 0, 0.5)' }}
      onClick={onClose}
    >
      <div
        className="relative max-w-xl w-full"
        style={{
          background: t.surface,
          borderRadius: 16,
          border: `1px solid ${t.border}`,
          maxHeight: '90vh',
          overflow: 'auto',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 transition-opacity hover:opacity-70 z-10"
          style={{ color: t.textMuted }}
        >
          <X size={20} />
        </button>

        {/* Header */}
        <div style={{ padding: '24px 24px 20px' }}>
          <h3
            className="font-bold"
            style={{ fontSize: typography.h2.size, color: t.text }}
          >
            New <span style={{ color: t.accent }}>
              {selectedCategory?.name || 'Claim'}
            </span> Request
          </h3>
        </div>

        {/* Error Display */}
        {submitMutation.error && (
          <div
            className="mx-6 mb-4 p-3"
            style={{
              background: colors.errDim,
              border: `1px solid ${colors.err}`,
              borderRadius: 10,
            }}
          >
            <p className="text-xs font-semibold" style={{ color: colors.errText }}>
              {(() => {
                const errorCode = (submitMutation.error as any)?.response?.data?.error?.code
                switch (errorCode) {
                  case 'INSUFFICIENT_CLAIM_BUDGET': return 'Budget Exceeded'
                  case 'CATEGORY_INACTIVE': return 'Category Inactive'
                  case 'RECEIPT_REQUIRED': return 'Receipt Required'
                  case 'CURRENCY_MISMATCH': return 'Currency Mismatch'
                  case 'INVALID_CLAIM_AMOUNT': return 'Invalid Amount'
                  case 'INVALID_CLAIM_DATE': return 'Invalid Date'
                  default: return 'Failed to Submit Claim'
                }
              })()}(
            </p>
            <p className="text-xs mt-1" style={{ color: colors.errText }}>
              {(submitMutation.error as any)?.response?.data?.error?.message || 
                submitMutation.error.message || 
                'Please check your input and try again'}
            </p>
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit(onSubmit)} style={{ padding: '0 24px 24px' }}>
          {/* Amount */}
          <div className="mb-4">
            <label
              htmlFor="amount"
              className="block mb-2 text-sm font-semibold"
              style={{ color: t.text }}
            >
              Amount ({org?.currency_code}) *
            </label>
            <input
              id="amount"
              type="text"
              inputMode="numeric"
              value={amountDisplay}
              onChange={handleAmountChange}
              placeholder="0"
              autoFocus
              className="w-full px-3 py-2.5 text-sm focus:outline-none focus:ring-2"
              style={{
                background: t.input,
                border: errors.amount ? `2px solid ${colors.err}` : `1px solid ${t.inputBorder}`,
                borderRadius: 10,
                color: t.text,
              }}
            />
            <input
              type="hidden"
              {...register('amount', { 
                required: 'Amount is required', 
                validate: (value) => {
                  const num = parseInt(value)
                  if (!value || isNaN(num)) return 'Amount is required'
                  if (num < 1) return 'Amount must be at least 1'
                  return true
                }
              })}
            />
            {errors.amount && (
              <p className="text-xs mt-1" style={{ color: colors.errText }}>
                {errors.amount.message}
              </p>
            )}
          </div>

          {/* Claim Date */}
          <div className="mb-4">
            <label
              htmlFor="claim_date"
              className="block mb-2 text-sm font-semibold"
              style={{ color: t.text }}
            >
              Claim Date *
            </label>
            <input
              id="claim_date"
              type="date"
              max={new Date().toISOString().split('T')[0]}
              {...register('claim_date', { 
                required: 'Claim date is required',
                validate: (value) => {
                  const selectedDate = new Date(value)
                  const today = new Date()
                  today.setHours(23, 59, 59, 999)
                  return selectedDate <= today || 'Claim date cannot be in the future'
                }
              })}
              className="w-full px-3 py-2.5 text-sm focus:outline-none focus:ring-2"
              style={{
                background: t.input,
                border: errors.claim_date ? `2px solid ${colors.err}` : `1px solid ${t.inputBorder}`,
                borderRadius: 10,
                color: t.text,
              }}
            />
            {errors.claim_date && (
              <p className="text-xs mt-1" style={{ color: colors.errText }}>
                {errors.claim_date.message}
              </p>
            )}
          </div>

          {/* Description */}
          <div className="mb-4">
            <label
              htmlFor="description"
              className="block mb-2 text-sm font-semibold"
              style={{ color: t.text }}
            >
              Description *
            </label>
            <textarea
              id="description"
              {...register('description', { 
                required: 'Description is required', 
                maxLength: { value: 500, message: 'Description must not exceed 500 characters' }
              })}
              rows={3}
              placeholder="Describe the expense..."
              className="w-full px-3 py-2.5 text-sm focus:outline-none focus:ring-2 resize-none"
              style={{
                background: t.input,
                border: errors.description ? `2px solid ${colors.err}` : `1px solid ${t.inputBorder}`,
                borderRadius: 10,
                color: t.text,
              }}
            />
            {errors.description && (
              <p className="text-xs mt-1" style={{ color: colors.errText }}>
                {errors.description.message}
              </p>
            )}
          </div>

          {/* Receipt Upload */}
          <div className="mb-5">
            <label
              className="block mb-2 text-sm font-semibold"
              style={{ color: t.text }}
            >
              Receipt {selectedCategory?.requires_receipt && '*'}
            </label>

            {!receipt ? (
              <label
                htmlFor="receipt-upload"
                className="flex flex-col items-center justify-center cursor-pointer transition-all hover:opacity-80"
                style={{
                  background: t.input,
                  border: `2px dashed ${t.inputBorder}`,
                  borderRadius: 10,
                  padding: '24px 16px',
                }}
              >
                <Upload size={28} style={{ color: t.textMuted, marginBottom: 8 }} />
                <p className="text-sm font-medium mb-1" style={{ color: t.text }}>
                  Click to upload receipt
                </p>
                <p className="text-xs" style={{ color: t.textMuted }}>
                  JPG, PNG, or PDF (max 10MB)
                </p>
                <input
                  id="receipt-upload"
                  type="file"
                  accept="image/jpeg,image/png,application/pdf"
                  onChange={handleFileChange}
                  className="hidden"
                />
              </label>
            ) : (
              <div
                className="relative"
                style={{
                  background: t.input,
                  border: `1px solid ${t.inputBorder}`,
                  borderRadius: 10,
                  padding: 12,
                }}
              >
                {receiptPreview && (
                  <img
                    src={receiptPreview}
                    alt="Receipt preview"
                    className="w-full h-32 object-contain mb-2"
                    style={{ borderRadius: 8 }}
                  />
                )}
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium" style={{ color: t.text }}>
                      {receipt.name}
                    </p>
                    <p className="text-xs" style={{ color: t.textMuted }}>
                      {(receipt.size / 1024).toFixed(1)} KB
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={removeFile}
                    className="p-1.5 transition-opacity hover:opacity-70"
                    style={{ color: colors.err }}
                  >
                    <X size={18} />
                  </button>
                </div>
              </div>
            )}
            {selectedCategory?.requires_receipt && (
              <p className="text-xs mt-1" style={{ color: t.textMuted }}>
                Receipt required for this category
              </p>
            )}
            {fileError && (
              <p className="text-xs mt-1" style={{ color: colors.errText }}>
                {fileError}
              </p>
            )}
          </div>

          {/* Submit Button */}
          {showOwnerConfirmation ? (
            <div className="flex gap-2">
              <button
                type="button"
                onClick={handleConfirmSubmit}
                disabled={submitMutation.isPending}
                className="flex-1 font-semibold text-sm py-3 transition-opacity hover:opacity-90 disabled:opacity-50"
                style={{
                  background: '#3b82f6',
                  color: 'white',
                  borderRadius: 12,
                }}
              >
                {submitMutation.isPending ? 'Submitting...' : '✓ Owner, proceed auto-approve!'}
              </button>
              <button
                type="button"
                onClick={handleCancelConfirmation}
                disabled={submitMutation.isPending}
                className="px-6 py-3 font-medium text-sm transition-opacity hover:opacity-70"
                style={{ color: t.textMuted }}
              >
                Back
              </button>
            </div>
          ) : (
            <button
              type="submit"
              disabled={submitMutation.isPending}
              className="w-full font-semibold text-sm py-3 transition-opacity hover:opacity-90 disabled:opacity-50"
              style={{
                background: t.accent,
                color: t.accentText,
                borderRadius: 12,
              }}
            >
              {submitMutation.isPending ? 'Submitting...' : 'Submit Claim'}
            </button>
          )}
        </form>
      </div>
    </div>
  )
}
