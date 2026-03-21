import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { AlertCircle, Check, X, Settings } from 'lucide-react'
import { useMyBalances, useAllRequests, useMyRequests, useAllBalances, useApproveRequest, useRejectRequest, useCancelRequest, useSubmitRequest, usePolicies } from '@/lib/hooks/useLeave'
import { useCanManageLeave } from '@/lib/hooks/useRole'
import { useOrganisation } from '@/lib/hooks/useOrganisation'
import { moduleBackgrounds, moduleThemes, typography, colors } from '@/design/tokens'
import { useState, useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { submitRequestSchema, type SubmitRequestFormData } from '@/lib/validations/leave'
import { calculateWorkingDays, calculateAvailableDays } from '@/lib/utils/leave'

const t = moduleThemes.leave

export const Route = createFileRoute('/_app/leave/')({
  component: LeaveDashboard,
})

function LeaveDashboard() {
  const navigate = useNavigate()
  const currentYear = new Date().getFullYear()
  const { data: balances, isLoading } = useMyBalances(currentYear)
  const { data: allBalances } = useAllBalances(currentYear) // For approval balance context
  const { data: pendingRequests } = useAllRequests({ status: 'pending' })
  const { data: myRequests } = useMyRequests()
  const canManageLeave = useCanManageLeave()
  
  const [activeTab, setActiveTab] = useState<'approvals' | 'my-requests'>(
    canManageLeave && (pendingRequests?.length ?? 0) > 0 ? 'approvals' : 'my-requests'
  )
  
  const [showNewRequestModal, setShowNewRequestModal] = useState(false)
  const [selectedPolicyId, setSelectedPolicyId] = useState<string>('')
  
  const pendingCount = pendingRequests?.length ?? 0

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
      <div className="mb-6">
        <div className="flex items-center justify-between">
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
          
          {/* Settings button for HR managers */}
          {canManageLeave && (
            <button
              onClick={() => navigate({ to: '/leave/policies' })}
              className="flex items-center gap-2 px-4 py-2 font-semibold text-sm transition-all hover:opacity-80"
              style={{
                background: t.surface,
                color: t.text,
                borderRadius: 10,
                border: `1px solid ${t.border}`,
              }}
              title="Manage leave policies"
            >
              <Settings size={16} />
              Policies
            </button>
          )}
        </div>
      </div>

      {/* Two Column Layout - Left wider for visual bars */}
      <div className="grid grid-cols-1 lg:grid-cols-[1.5fr_1fr] gap-6">
        {/* LEFT COLUMN: Leave Balances + My Requests */}
        <div className="space-y-4">
          {/* Leave Balances */}
          <div>
            <h2
              className="font-bold mb-3"
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
                {balances.map((balance, idx) => {
                  const available =
                    balance.entitled_days +
                    balance.carried_over_days -
                    balance.used_days -
                    balance.pending_days
                  const total = balance.entitled_days + balance.carried_over_days

                  return (
                    <div
                      key={balance.id}
                      onClick={() => {
                        setSelectedPolicyId(balance.leave_policy_id)
                        setShowNewRequestModal(true)
                      }}
                      className="transition-all cursor-pointer"
                      style={{
                        padding: '14px 18px',
                        borderBottom: idx < balances.length - 1 ? `1px solid ${t.border}` : 'none',
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.background = t.surfaceHover
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.background = 'transparent'
                      }}
                    >
                      <div className="flex items-center justify-between">
                        {/* Left: Policy name */}
                        <div className="flex-1">
                          <p
                            className="font-bold"
                            style={{
                              fontSize: typography.body.size,
                              color: t.text,
                            }}
                          >
                            {balance.policy_name}
                          </p>
                          {balance.policy_description && (
                            <p
                              className="text-xs mt-0.5"
                              style={{ color: t.textMuted }}
                            >
                              {balance.policy_description}
                            </p>
                          )}
                        </div>

                        {/* Right: Available days (big number) */}
                        <div className="text-right">
                          {balance.entitled_days === 999 ? (
                            <span
                              className="font-extrabold"
                              style={{
                                fontSize: 32,
                                color: t.accent,
                                lineHeight: 1,
                              }}
                            >
                              ∞
                            </span>
                          ) : (
                            <>
                              <span
                                className="font-extrabold"
                                style={{
                                  fontSize: 32,
                                  fontFamily: typography.fontMono,
                                  color: available > 0 ? t.accent : colors.ink300,
                                  lineHeight: 1,
                                }}
                              >
                                {available.toFixed(0)}
                              </span>
                              <span
                                className="text-xs ml-1"
                                style={{ color: t.textMuted }}
                              >
                                / {total}
                              </span>
                            </>
                          )}
                          <div className="flex items-center gap-2 mt-1 text-xs justify-end" style={{ color: t.textMuted }}>
                            <span>Used: {balance.used_days}</span>
                            {balance.pending_days > 0 && (
                              <span style={{ color: colors.warnText }}>• Pending: {balance.pending_days}</span>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Visual Progress Bar - Green for available */}
                      {balance.entitled_days !== 999 && (
                        <div className="mt-3">
                          <div
                            style={{
                              height: 6,
                              borderRadius: 3,
                              background: colors.ink100,
                              overflow: 'hidden',
                              position: 'relative',
                            }}
                          >
                            {/* Available portion (green) */}
                            <div
                              style={{
                                position: 'absolute',
                                left: 0,
                                top: 0,
                                bottom: 0,
                                width: `${(available / total) * 100}%`,
                                background: colors.ok,
                              }}
                            />
                            {/* Pending portion (amber) */}
                            <div
                              style={{
                                position: 'absolute',
                                left: `${(available / total) * 100}%`,
                                top: 0,
                                bottom: 0,
                                width: `${(balance.pending_days / total) * 100}%`,
                                background: colors.warn,
                              }}
                            />
                          </div>
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </div>

          {/* Expandable: My Requests - REMOVED */}
        </div>

        {/* RIGHT COLUMN: Tabs (Approvals + My Requests) */}
        <div>
          {/* Tab Headers */}
          <div className="flex items-center gap-2 mb-4">
            {canManageLeave && pendingCount > 0 && (
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
              {myRequests && myRequests.length > 0 && (
                <span className="text-xs" style={{ color: t.textMuted }}>
                  ({myRequests.length})
                </span>
              )}
            </button>
          </div>

          {/* Tab Content */}
          {activeTab === 'approvals' && canManageLeave && (
            <div>
              {!pendingRequests || pendingRequests.length === 0 ? (
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
                    No pending approvals
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {(() => {
                    // Group requests by employee
                    const groupedByEmployee = pendingRequests.reduce((acc, request) => {
                      const key = request.employee_id
                      if (!acc[key]) {
                        acc[key] = {
                          employee_id: request.employee_id,
                          employee_name: request.employee_name,
                          requests: [],
                        }
                      }
                      acc[key].requests.push(request)
                      return acc
                    }, {} as Record<string, { employee_id: string; employee_name: string; requests: any[] }>)

                    return Object.values(groupedByEmployee).map((group) => (
                      <EmployeeRequestGroup
                        key={group.employee_id}
                        employeeName={group.employee_name}
                        requests={group.requests}
                        allBalances={allBalances}
                      />
                    ))
                  })()}
                </div>
              )}
            </div>
          )}

          {activeTab === 'my-requests' && (
            <div>
              {!myRequests || myRequests.length === 0 ? (
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
                    <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
                  </svg>
                  <p
                    className="font-bold"
                    style={{ fontSize: typography.h3.size, color: t.text }}
                  >
                    No requests yet
                  </p>
                  <p className="text-sm mt-1" style={{ color: t.textMuted }}>
                    Click a leave balance to create your first request
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
                  {myRequests.map((request, idx) => {
                    // Find matching balance for this request
                    const matchedBalance = balances?.find(
                      (b) => b.leave_policy_id === request.leave_policy_id
                    )
                    return (
                      <RequestListItem
                        key={request.id}
                        request={request}
                        variant="my"
                        balance={matchedBalance}
                        isLast={idx === myRequests.length - 1}
                      />
                    )
                  })}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
      
      {/* New Request Modal */}
      {showNewRequestModal && selectedPolicyId && (
        <NewRequestModal
          policyId={selectedPolicyId}
          onClose={() => {
            setShowNewRequestModal(false)
            setSelectedPolicyId('')
          }}
        />
      )}
    </div>
  )
}

// New Request Modal Component
interface NewRequestModalProps {
  policyId: string
  onClose: () => void
}

function NewRequestModal({ policyId, onClose }: NewRequestModalProps) {
  const { data: org } = useOrganisation()
  const { data: policies } = usePolicies()
  const currentYear = new Date().getFullYear()
  const { data: balances } = useMyBalances(currentYear)
  const submitMutation = useSubmitRequest()

  const [startDate, setStartDate] = useState<string>('')
  const [endDate, setEndDate] = useState<string>('')
  const [workingDays, setWorkingDays] = useState<number>(0)
  const [availableDays, setAvailableDays] = useState<number | null>(null)
  const [hasInsufficientBalance, setHasInsufficientBalance] = useState(false)

  const {
    register,
    handleSubmit,
    setValue,
    formState: { errors },
  } = useForm<SubmitRequestFormData>({
    resolver: zodResolver(submitRequestSchema),
    defaultValues: {
      leave_policy_id: policyId,
      start_date: '',
      end_date: '',
      reason: '',
    },
  })

  // Sync form values with state
  useEffect(() => {
    setValue('start_date', startDate)
    setValue('end_date', endDate)
  }, [startDate, endDate, setValue])

  // Calculate working days when dates change
  useEffect(() => {
    if (startDate && endDate && org) {
      try {
        const days = calculateWorkingDays({
          startDate,
          endDate,
          workDays: org.work_days,
          publicHolidays: [],
        })
        setWorkingDays(days)
      } catch {
        setWorkingDays(0)
      }
    } else {
      setWorkingDays(0)
    }
  }, [startDate, endDate, org])

  // Check available balance
  useEffect(() => {
    if (policyId && balances && workingDays > 0) {
      const balance = balances.find((b) => b.leave_policy_id === policyId)
      if (balance) {
        const available = calculateAvailableDays(balance)
        setAvailableDays(available)
        setHasInsufficientBalance(workingDays > available)
      } else {
        setAvailableDays(null)
        setHasInsufficientBalance(false)
      }
    } else {
      setAvailableDays(null)
      setHasInsufficientBalance(false)
    }
  }, [policyId, balances, workingDays])

  const onSubmit = async (data: SubmitRequestFormData) => {
    try {
      const payload: any = {
        leave_policy_id: data.leave_policy_id,
        start_date: data.start_date,
        end_date: data.end_date,
      }
      if (data.reason?.trim()) {
        payload.reason = data.reason.trim()
      }
      await submitMutation.mutateAsync(payload)
      onClose()
    } catch (error) {
      // Error handled by mutation
    }
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
          height: '80vh',
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
              {policies?.find((p) => p.id === policyId)?.name || 'Leave'}
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
              {(submitMutation.error as any)?.response?.data?.error?.message ||
                submitMutation.error.message ||
                'Failed to submit request'}
            </p>
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit(onSubmit)} style={{ padding: '0 24px 24px' }}>
          {/* Date Range Picker */}
          <DateRangePicker
            startDate={startDate}
            endDate={endDate}
            onStartDateChange={setStartDate}
            onEndDateChange={setEndDate}
            error={errors.start_date?.message || errors.end_date?.message}
            workingDays={workingDays}
            availableDays={availableDays}
            hasInsufficientBalance={hasInsufficientBalance}
          />

          {/* Reason */}
          <div className="mb-5">
            <label
              htmlFor="modal-reason"
              className="block mb-2 text-sm font-semibold"
              style={{ color: t.text }}
            >
              Reason (optional)
            </label>
            <textarea
              id="modal-reason"
              {...register('reason')}
              rows={1}
              className="w-full px-3 py-2.5 text-sm focus:outline-none focus:ring-2 resize-none"
              style={{
                background: t.input,
                border: errors.reason ? `2px solid ${colors.err}` : `1px solid ${t.inputBorder}`,
                borderRadius: 10,
                color: t.text,
              }}
              placeholder="Please provide a reason for your leave..."
            />
            {errors.reason && (
              <p className="text-xs mt-1" style={{ color: colors.err }}>
                {errors.reason.message}
              </p>
            )}
          </div>

          {/* Buttons */}
          <div className="flex items-center gap-3">
            <button
              type="submit"
              disabled={submitMutation.isPending || hasInsufficientBalance || workingDays === 0}
              className="flex-1 font-semibold py-3 transition-opacity hover:opacity-90 disabled:opacity-50"
              style={{
                background: t.accent,
                color: t.accentText,
                borderRadius: 10,
                fontSize: typography.body.size,
              }}
            >
              {submitMutation.isPending ? 'Submitting...' : 'Submit Request'}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-3 font-medium transition-opacity hover:opacity-70"
              style={{ color: t.textMuted, fontSize: typography.body.size }}
            >
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// Date Range Picker Component
interface DateRangePickerProps {
  startDate: string
  endDate: string
  onStartDateChange: (date: string) => void
  onEndDateChange: (date: string) => void
  error?: string
  workingDays?: number
  availableDays?: number | null
  hasInsufficientBalance?: boolean
}

function DateRangePicker({ startDate, endDate, onStartDateChange, onEndDateChange, error, workingDays = 0, availableDays = null, hasInsufficientBalance = false }: DateRangePickerProps) {
  const [currentMonth, setCurrentMonth] = useState(new Date())
  const [selectingStart, setSelectingStart] = useState(true)
  const [tempStartDate, setTempStartDate] = useState<Date | null>(startDate ? new Date(startDate) : null)
  const [tempEndDate, setTempEndDate] = useState<Date | null>(endDate ? new Date(endDate) : null)

  const handleDateClick = (date: Date) => {
    const isoDate = date.toISOString().split('T')[0]
    if (!isoDate) return
    
    if (selectingStart) {
      // First click - set start date
      setTempStartDate(date)
      onStartDateChange(isoDate)
      
      // If clicking same date again, set as single day
      if (tempStartDate && tempStartDate.toDateString() === date.toDateString()) {
        setTempEndDate(date)
        onEndDateChange(isoDate)
        setSelectingStart(true)
      } else {
        // Clear end date and wait for second selection
        setTempEndDate(null)
        onEndDateChange('')
        setSelectingStart(false)
      }
    } else {
      // Second click - set end date
      if (tempStartDate && date < tempStartDate) {
        // If end date is before start, swap them
        const startIso = tempStartDate.toISOString().split('T')[0]
        setTempEndDate(tempStartDate)
        setTempStartDate(date)
        if (startIso) onEndDateChange(startIso)
        onStartDateChange(isoDate)
      } else {
        setTempEndDate(date)
        onEndDateChange(isoDate)
      }
      setSelectingStart(true)
    }
  }

  const formatDisplayDate = (date: string) => {
    if (!date) return ''
    return new Date(date).toLocaleDateString('en-GB', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    })
  }

  const getDaysInMonth = (date: Date) => {
    const year = date.getFullYear()
    const month = date.getMonth()
    const firstDay = new Date(year, month, 1)
    const lastDay = new Date(year, month + 1, 0)
    const daysInMonth = lastDay.getDate()
    const startingDayOfWeek = firstDay.getDay()

    const days: (Date | null)[] = []

    // Add empty slots for days before month starts
    for (let i = 0; i < startingDayOfWeek; i++) {
      days.push(null)
    }

    // Add actual days
    for (let day = 1; day <= daysInMonth; day++) {
      days.push(new Date(year, month, day))
    }

    return days
  }

  const isDateInRange = (date: Date) => {
    if (!tempStartDate || !tempEndDate) return false
    return date >= tempStartDate && date <= tempEndDate
  }

  const isDateSelected = (date: Date) => {
    if (tempStartDate && date.toDateString() === tempStartDate.toDateString()) return true
    if (tempEndDate && date.toDateString() === tempEndDate.toDateString()) return true
    return false
  }

  const days = getDaysInMonth(currentMonth)
  const monthYear = currentMonth.toLocaleDateString('en-GB', {
    month: 'long',
    year: 'numeric',
  })

  return (
    <div className="mb-5">
      {/* Calendar - Always visible, not popup */}
      <div
        style={{
          background: t.surface,
          border: `1px solid ${t.border}`,
          borderRadius: 12,
          padding: 16,
        }}
      >
        {/* Month Navigation */}
        <div className="flex items-center justify-between mb-3">
          <button
            type="button"
            onClick={() => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1))}
            className="p-1 transition-opacity hover:opacity-70"
            style={{ color: t.text }}
          >
            ←
          </button>
          <span className="font-semibold text-sm" style={{ color: t.text }}>
            {monthYear}
          </span>
          <button
            type="button"
            onClick={() => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1))}
            className="p-1 transition-opacity hover:opacity-70"
            style={{ color: t.text }}
          >
            →
          </button>
        </div>

        {/* Day Headers */}
        <div className="grid grid-cols-7 gap-1 mb-2">
          {['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].map((day) => (
            <div
              key={day}
              className="text-center text-xs font-semibold"
              style={{ color: t.textMuted, padding: '4px 0' }}
            >
              {day}
            </div>
          ))}
        </div>

        {/* Calendar Grid */}
        <div className="grid grid-cols-7 gap-1">
          {days.map((date, idx) => {
            if (!date) {
              return <div key={`empty-${idx}`} />
            }

            const isSelected = isDateSelected(date)
            const isInRange = isDateInRange(date)
            const isToday = date.toDateString() === new Date().toDateString()

            return (
              <button
                key={idx}
                type="button"
                onClick={() => handleDateClick(date)}
                className="text-center text-sm transition-all hover:opacity-80"
                style={{
                  padding: '8px 4px',
                  borderRadius: 6,
                  background: isSelected ? t.accent : isInRange ? t.surfaceHover : 'transparent',
                  color: isSelected ? t.accentText : isToday ? t.accent : t.text,
                  fontWeight: isToday || isSelected ? 600 : 400,
                }}
              >
                {date.getDate()}
              </button>
            )
          })}
        </div>

        {/* Selected dates display */}
        {(startDate || endDate) && (
          <div className="mt-3 pt-3 border-t" style={{ borderColor: t.border }}>
            <p className="text-xs font-semibold mb-1" style={{ color: t.textMuted }}>
              Selected:
            </p>
            <p className="text-sm font-bold" style={{ color: t.text }}>
              {startDate && endDate ? (
                <>
                  {formatDisplayDate(startDate)}
                  {startDate !== endDate && ` – ${formatDisplayDate(endDate)}`}
                </>
              ) : startDate ? (
                <>{formatDisplayDate(startDate)} (select end date)</>
              ) : (
                'Select dates'
              )}
            </p>

            {/* Working Days Info */}
            {workingDays > 0 && (
              <div
                className="mt-2 p-2.5"
                style={{
                  background: hasInsufficientBalance ? colors.warnDim : colors.okDim,
                  border: hasInsufficientBalance ? `1px solid ${colors.warn}` : `1px solid ${colors.ok}`,
                  borderRadius: 8,
                }}
              >
                <div className="flex items-center gap-2 text-xs font-semibold" style={{ color: hasInsufficientBalance ? colors.warnText : colors.okText }}>
                  <span>{hasInsufficientBalance ? '⚠' : '✓'}</span>
                  <span>Working days: {workingDays} day{workingDays === 1 ? '' : 's'}</span>
                </div>
                {availableDays !== null && (
                  <p className="text-xs mt-0.5" style={{ color: t.textMuted }}>
                    Available: {availableDays} day{availableDays === 1 ? '' : 's'}
                    {hasInsufficientBalance && ' (insufficient)'}
                  </p>
                )}
              </div>
            )}
          </div>
        )}

        {/* Helper Text */}
        <p className="text-xs mt-3 text-center" style={{ color: t.textMuted }}>
          {selectingStart ? 'Select start date (or click same date twice for single day)' : 'Select end date'}
        </p>
      </div>

      {error && (
        <p className="text-xs mt-2" style={{ color: colors.err }}>
          {error}
        </p>
      )}
    </div>
  )
}

// Request Details Modal
interface RequestDetailsModalProps {
  request: any
  onClose: () => void
}

function RequestDetailsModal({ request, onClose }: RequestDetailsModalProps) {
  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('en-GB', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    })
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ background: 'rgba(0, 0, 0, 0.5)' }}
      onClick={onClose}
    >
      <div
        className="relative max-w-lg w-full mx-4"
        style={{
          background: t.surface,
          borderRadius: 16,
          border: `1px solid ${t.border}`,
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
          style={{ color: t.textMuted }}
        >
          <X size={20} />
        </button>

        {/* Header */}
        <h3
          className="font-bold mb-4"
          style={{ fontSize: typography.h2.size, color: t.text }}
        >
          Leave Request Details
        </h3>

        {/* Content */}
        <div className="space-y-3">
          {request.employee_name && (
            <div>
              <p className="text-xs font-semibold" style={{ color: t.textMuted }}>
                Employee
              </p>
              <p className="text-sm font-bold" style={{ color: t.text }}>
                {request.employee_name}
              </p>
            </div>
          )}

          <div>
            <p className="text-xs font-semibold" style={{ color: t.textMuted }}>
              Leave Type
            </p>
            <p className="text-sm font-bold" style={{ color: t.text }}>
              {request.policy_name}
            </p>
          </div>

          <div>
            <p className="text-xs font-semibold" style={{ color: t.textMuted }}>
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
            <p className="text-xs font-semibold" style={{ color: t.textMuted }}>
              Dates
            </p>
            <p className="text-sm font-bold" style={{ color: t.text }}>
              {formatDate(request.start_date)} – {formatDate(request.end_date)}
            </p>
            <p className="text-xs mt-1" style={{ color: t.textMuted }}>
              {request.total_days} {request.total_days === 1 ? 'day' : 'days'}
            </p>
          </div>

          {request.reason && (
            <div>
              <p className="text-xs font-semibold" style={{ color: t.textMuted }}>
                Reason
              </p>
              <p className="text-sm" style={{ color: t.text }}>
                {request.reason}
              </p>
            </div>
          )}

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

          {(request.reviewed_by_name || request.reviewed_by) && (
            <div>
              <p className="text-xs font-semibold" style={{ color: t.textMuted }}>
                Reviewed By
              </p>
              <p className="text-sm" style={{ color: t.text }}>
                {request.reviewed_by_name || request.reviewed_by}
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// Employee Request Group Component (for approvals)
interface EmployeeRequestGroupProps {
  employeeName: string
  requests: any[]
  allBalances?: any[]
}

function EmployeeRequestGroup({ employeeName, requests, allBalances }: EmployeeRequestGroupProps) {
  const [isExpanded, setIsExpanded] = useState(false)
  const [showRejectInput, setShowRejectInput] = useState(false)
  const [rejectReason, setRejectReason] = useState('')
  const [rejectError, setRejectError] = useState('')
  
  const approveMutation = useApproveRequest()
  const rejectMutation = useRejectRequest()
  
  const totalDays = requests.reduce((sum, r) => sum + r.total_days, 0)
  const requestCount = requests.length
  
  const handleApproveAll = async () => {
    // Approve all requests sequentially
    for (const request of requests) {
      try {
        await approveMutation.mutateAsync({ id: request.id })
      } catch (error) {
        // Continue even if one fails
        console.error('Failed to approve request:', request.id, error)
      }
    }
  }
  
  const handleRejectAll = async () => {
    if (!rejectReason || rejectReason.trim().length < 10) {
      setRejectError('Rejection reason is required (minimum 10 characters)')
      return
    }
    
    // Reject all requests sequentially with the same reason
    for (const request of requests) {
      try {
        await rejectMutation.mutateAsync({ id: request.id, note: rejectReason.trim() })
      } catch (error) {
        console.error('Failed to reject request:', request.id, error)
      }
    }
    
    setShowRejectInput(false)
    setRejectReason('')
    setRejectError('')
  }
  
  return (
    <div
      style={{
        background: t.surface,
        borderRadius: 14,
        border: `1px solid ${t.border}`,
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
          e.currentTarget.style.background = t.surfaceHover
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
            <p className="font-bold text-sm" style={{ color: t.text }}>
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
          <p className="text-xs mt-0.5" style={{ color: t.textMuted }}>
            {totalDays} {totalDays === 1 ? 'day' : 'days'} total
            {requests.length > 1 && ' • Click to see individual requests'}
          </p>
        </div>
        
        <div className="flex items-center gap-2">
          {!showRejectInput && (
            <>
              <button
                onClick={handleApproveAll}
                disabled={approveMutation.isPending}
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
                color: t.textMuted,
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
            borderTop: `1px solid ${t.border}`,
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
                background: t.input,
                border: `1px solid ${rejectError ? colors.err : t.inputBorder}`,
                borderRadius: 8,
                color: t.text,
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
                disabled={rejectMutation.isPending}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold transition-opacity hover:opacity-90 disabled:opacity-50"
                style={{
                  background: colors.err,
                  color: '#FFFFFF',
                  borderRadius: 8,
                }}
              >
                <X size={12} />
                {rejectMutation.isPending ? 'Rejecting...' : `Reject All ${requestCount}`}
              </button>
              <button
                onClick={() => {
                  setShowRejectInput(false)
                  setRejectReason('')
                  setRejectError('')
                }}
                className="px-3 py-1.5 text-xs font-medium transition-opacity hover:opacity-70"
                style={{ color: t.textMuted }}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
      
      {/* Expanded Individual Requests */}
      {isExpanded && (
        <div style={{ borderTop: `1px solid ${t.border}` }}>
          {requests.map((request, idx) => {
            const balance = allBalances?.find(
              (b) => b.employee_id === request.employee_id && b.leave_policy_id === request.leave_policy_id
            )
            
            return (
              <RequestListItem
                key={request.id}
                request={request}
                variant="approval"
                balance={balance}
                isLast={idx === requests.length - 1}
              />
            )
          })}
        </div>
      )}
    </div>
  )
}

// Request List Item Component (replaces card)
interface RequestListItemProps {
  request: any // LeaveRequestWithDetails
  variant: 'my' | 'approval'
  balance?: any // LeaveBalanceWithPolicy
  isLast?: boolean
}

function RequestListItem({ request, variant, balance, isLast = false }: RequestListItemProps) {
  const [showRejectInput, setShowRejectInput] = useState(false)
  const [rejectReason, setRejectReason] = useState('')
  const [rejectError, setRejectError] = useState('')
  const [showDetails, setShowDetails] = useState(false)
  
  const approveMutation = useApproveRequest()
  const rejectMutation = useRejectRequest()
  const cancelMutation = useCancelRequest()

  const handleApprove = async () => {
    try {
      await approveMutation.mutateAsync({ id: request.id })
    } catch (error) {
      // Error is handled by mutation
    }
  }

  const handleReject = async () => {
    if (!rejectReason || rejectReason.trim().length < 10) {
      setRejectError('Rejection reason is required (minimum 10 characters)')
      return
    }
    
    try {
      await rejectMutation.mutateAsync({ id: request.id, note: rejectReason.trim() })
      setShowRejectInput(false)
      setRejectReason('')
      setRejectError('')
    } catch (error) {
      // Error is handled by mutation
    }
  }

  const handleCancel = async () => {
    try {
      await cancelMutation.mutateAsync(request.id)
    } catch (error) {
      // Error is handled by mutation
    }
  }

  // Calculate balance impact
  const balanceImpact = balance ? {
    current: balance.entitled_days + balance.carried_over_days - balance.used_days - balance.pending_days,
    after: balance.entitled_days + balance.carried_over_days - balance.used_days - balance.pending_days - request.total_days,
  } : null

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('en-GB', {
      day: '2-digit',
      month: 'short',
    })
  }

  return (
    <>
      {showDetails && (
        <RequestDetailsModal request={request} onClose={() => setShowDetails(false)} />
      )}
      
      <div
        className="transition-all"
        style={{
          padding: '12px 18px',
          borderBottom: !isLast ? `1px solid ${t.border}` : 'none',
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.background = t.surfaceHover
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.background = 'transparent'
        }}
      >
        <div className="flex items-center justify-between">
          {/* Left: Name + Policy - Clickable for details */}
          <div 
            className="flex-1 mr-4 cursor-pointer"
            onClick={() => setShowDetails(true)}
          >
            {variant === 'approval' && (
              <p className="font-bold text-sm mb-0.5" style={{ color: t.text }}>
                {request.employee_name}
              </p>
            )}
            <div className="flex items-center gap-2">
              <p className="font-semibold text-sm" style={{ color: t.text }}>
                {request.policy_name}
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
            {/* Balance Impact (my variant only) */}
            {variant === 'my' && balanceImpact && (
              <p className="text-xs mt-1" style={{ color: t.textMuted }}>
                Balance: <strong style={{ color: t.text }}>{balanceImpact.current} → {balanceImpact.after}</strong>
              </p>
            )}
          </div>

        {/* Right: Dates + Days + Actions */}
        <div className="flex items-center gap-3">
          <div className="text-right">
            <p className="text-xs" style={{ color: t.textMuted }}>
              {formatDate(request.start_date)} – {formatDate(request.end_date)}
            </p>
            <p className="text-xs font-bold mt-0.5" style={{ color: t.text }}>
              {request.total_days} {request.total_days === 1 ? 'day' : 'days'}
            </p>
          </div>

          {/* Action Buttons (approval variant, icon-only) */}
          {variant === 'approval' && request.status === 'pending' && !showRejectInput && (
            <div className="flex items-center gap-1.5">
              <button
                onClick={handleApprove}
                disabled={approveMutation.isPending}
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
            </div>
          )}

          {/* Cancel button (my variant, icon) */}
          {variant === 'my' && request.status === 'pending' && (
            <button
              onClick={handleCancel}
              disabled={cancelMutation.isPending}
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
              background: t.input,
              border: `1px solid ${rejectError ? colors.err : t.inputBorder}`,
              borderRadius: 8,
              color: t.text,
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
              disabled={rejectMutation.isPending}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold transition-opacity hover:opacity-90 disabled:opacity-50"
              style={{
                background: colors.err,
                color: '#FFFFFF',
                borderRadius: 8,
              }}
            >
              <X size={12} />
              {rejectMutation.isPending ? 'Rejecting...' : 'Confirm Reject'}
            </button>
            <button
              onClick={() => {
                setShowRejectInput(false)
                setRejectReason('')
                setRejectError('')
              }}
              className="px-3 py-1.5 text-xs font-medium transition-opacity hover:opacity-70"
              style={{ color: t.textMuted }}
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
      {[1, 2, 3].map((i, idx) => (
        <div
          key={i}
          className="animate-pulse"
          style={{
            padding: '14px 18px',
            borderBottom: idx < 2 ? `1px solid ${t.border}` : 'none',
          }}
        >
          <div className="flex items-center justify-between">
            <div style={{ background: t.surfaceHover, height: 16, width: '40%', borderRadius: 4 }} />
            <div style={{ background: t.surfaceHover, height: 32, width: '60px', borderRadius: 4 }} />
          </div>
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
