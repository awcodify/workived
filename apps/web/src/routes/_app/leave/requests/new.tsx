import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useState, useEffect } from 'react'
import { ArrowLeft } from 'lucide-react'
import { useSubmitRequest, useMyBalances, usePolicies } from '@/lib/hooks/useLeave'
import { useOrganisation } from '@/lib/hooks/useOrganisation'
import { submitRequestSchema, type SubmitRequestFormData } from '@/lib/validations/leave'
import { calculateWorkingDays, calculateAvailableDays } from '@/lib/utils/leave'
import { moduleBackgrounds, moduleThemes, typography } from '@/design/tokens'
import { z } from 'zod'

const t = moduleThemes.leave

const newRequestSearchSchema = z.object({
  policyId: z.string().optional(),
})

export const Route = createFileRoute('/_app/leave/requests/new')({
  component: NewRequestPage,
  validateSearch: newRequestSearchSchema,
})

function NewRequestPage() {
  const navigate = useNavigate()
  const { policyId: preselectedPolicyId } = Route.useSearch()
  const { data: org } = useOrganisation()
  const { data: policies } = usePolicies()
  const currentYear = new Date().getFullYear()
  const { data: balances } = useMyBalances(currentYear)
  const submitMutation = useSubmitRequest()

  const [workingDays, setWorkingDays] = useState<number>(0)
  const [availableDays, setAvailableDays] = useState<number | null>(null)
  const [hasInsufficientBalance, setHasInsufficientBalance] = useState(false)

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors },
  } = useForm<SubmitRequestFormData>({
    resolver: zodResolver(submitRequestSchema),
  })

  // Pre-select policy if provided via search params
  useEffect(() => {
    if (preselectedPolicyId && policies) {
      setValue('leave_policy_id', preselectedPolicyId)
    }
  }, [preselectedPolicyId, policies, setValue])

  const policyId = watch('leave_policy_id')
  const startDate = watch('start_date')
  const endDate = watch('end_date')

  // Calculate working days when dates change
  useEffect(() => {
    if (startDate && endDate && org) {
      try {
        const days = calculateWorkingDays({
          startDate,
          endDate,
          workDays: org.work_days,
          publicHolidays: [], // TODO: Fetch from API if needed
        })
        setWorkingDays(days)
      } catch {
        setWorkingDays(0)
      }
    } else {
      setWorkingDays(0)
    }
  }, [startDate, endDate, org])

  // Check available balance when policy or working days change
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
      // Clean up empty optional fields - remove undefined to omit from JSON
      const payload: any = {
        leave_policy_id: data.leave_policy_id,
        start_date: data.start_date,
        end_date: data.end_date,
      }
      if (data.reason?.trim()) {
        payload.reason = data.reason.trim()
      }
      console.log('Submitting leave request:', payload)
      await submitMutation.mutateAsync(payload)
      navigate({ to: '/leave/requests' })
    } catch (error: any) {
      console.error('Leave request error:', error)
      console.error('Error response:', error?.response?.data)
      // Error handled by mutation
    }
  }

  return (
    <div
      className="min-h-screen px-6 py-8 md:px-11 md:py-10 pb-28"
      style={{ background: moduleBackgrounds.leave }}
    >
      {/* Header */}
      <div className="mb-6">
        <button
          onClick={() => navigate({ to: '/leave' })}
          className="flex items-center gap-2 mb-3 transition-opacity hover:opacity-70"
          style={{ color: t.textMuted }}
        >
          <ArrowLeft size={16} />
          <span className="text-sm font-medium">Back</span>
        </button>
        <h1
          className="font-extrabold"
          style={{
            fontSize: typography.display.size,
            letterSpacing: typography.display.tracking,
            color: t.text,
            lineHeight: typography.display.lineHeight,
          }}
        >
          Submit Leave Request
        </h1>
      </div>

      {/* API Error Display */}
      {submitMutation.error && (
        <div
          className="mb-6 p-4"
          style={{
            background: '#FDF2E3',
            border: '1px solid #C97B2A',
            borderRadius: 14,
          }}
        >
          <p className="text-sm font-semibold" style={{ color: '#A0601A' }}>
            Failed to submit request
          </p>
          <p className="text-xs mt-1" style={{ color: '#72708A' }}>
            {(submitMutation.error as any)?.response?.data?.error?.message || 
              submitMutation.error.message || 
              'Please check your input and try again'}
          </p>
        </div>
      )}

      {/* Form */}
      <form onSubmit={handleSubmit(onSubmit)} className="max-w-2xl">
        <div
          className="p-6"
          style={{
            background: t.surface,
            borderRadius: 14,
            border: `1px solid ${t.border}`,
          }}
        >
          {/* Leave Type */}
          <div className="mb-5">
            <label
              htmlFor="leave_policy_id"
              className="block mb-2"
              style={{
                fontSize: typography.label.size,
                fontWeight: typography.label.weight,
                color: t.text,
              }}
            >
              Leave Type *
            </label>
            <select
              id="leave_policy_id"
              {...register('leave_policy_id')}
              required
              className="w-full px-3 py-2.5 text-sm focus:outline-none focus:ring-2"
              style={{
                background: t.input,
                border: errors.leave_policy_id ? '2px solid #D44040' : `1px solid ${t.inputBorder}`,
                borderRadius: 10,
                color: t.text,
              }}
            >
              <option value="">Select leave type</option>
              {policies
                ?.filter((p) => p.is_active)
                .map((policy) => (
                  <option key={policy.id} value={policy.id}>
                    {policy.name}
                  </option>
                ))}
            </select>
            {errors.leave_policy_id && (
              <p className="text-xs mt-1" style={{ color: '#D44040' }}>
                {errors.leave_policy_id.message}
              </p>
            )}
          </div>

          {/* Start Date */}
          <div className="mb-5">
            <label
              htmlFor="start_date"
              className="block mb-2"
              style={{
                fontSize: typography.label.size,
                fontWeight: typography.label.weight,
                color: t.text,
              }}
            >
              Start Date *
            </label>
            <input
              id="start_date"
              type="date"
              {...register('start_date')}
              required
              className="w-full px-3 py-2.5 text-sm focus:outline-none focus:ring-2"
              style={{
                background: t.input,
                border: errors.start_date ? '2px solid #D44040' : `1px solid ${t.inputBorder}`,
                borderRadius: 10,
                color: t.text,
              }}
            />
            {errors.start_date && (
              <p className="text-xs mt-1" style={{ color: '#D44040' }}>
                {errors.start_date.message}
              </p>
            )}
          </div>

          {/* End Date */}
          <div className="mb-5">
            <label
              htmlFor="end_date"
              className="block mb-2"
              style={{
                fontSize: typography.label.size,
                fontWeight: typography.label.weight,
                color: t.text,
              }}
            >
              End Date *
            </label>
            <input
              id="end_date"
              type="date"
              {...register('end_date')}
              required
              className="w-full px-3 py-2.5 text-sm focus:outline-none focus:ring-2"
              style={{
                background: t.input,
                border: errors.end_date ? '2px solid #D44040' : `1px solid ${t.inputBorder}`,
                borderRadius: 10,
                color: t.text,
              }}
            />
            {errors.end_date && (
              <p className="text-xs mt-1" style={{ color: '#D44040' }}>
                {errors.end_date.message}
              </p>
            )}
          </div>

          {/* Working Days Calculation */}
          {workingDays > 0 && (
            <div
              className="mb-5 p-3"
              style={{
                background: hasInsufficientBalance ? '#FDF2E3' : '#E8F7EE',
                border: hasInsufficientBalance ? '1px solid #C97B2A' : '1px solid #12A05C',
                borderRadius: 10,
              }}
            >
              <div className="flex items-center gap-2 text-sm font-semibold" style={{ color: hasInsufficientBalance ? '#A0601A' : '#0D7A45' }}>
                <span>{hasInsufficientBalance ? '⚠' : '✓'}</span>
                <span>Working days: {workingDays} day{workingDays === 1 ? '' : 's'}</span>
              </div>
              {availableDays !== null && (
                <p className="text-xs mt-1" style={{ color: '#72708A' }}>
                  Available balance: {availableDays} day{availableDays === 1 ? '' : 's'}
                  {hasInsufficientBalance && ' (insufficient)'}
                </p>
              )}
            </div>
          )}
          {workingDays === 0 && startDate && endDate && (
            <div
              className="mb-5 p-3"
              style={{
                background: '#FDF2E3',
                border: '1px solid #C97B2A',
                borderRadius: 10,
              }}
            >
              <div className="flex items-center gap-2 text-sm font-semibold" style={{ color: '#A0601A' }}>
                <span>⚠</span>
                <span>No working days in selected range</span>
              </div>
              <p className="text-xs mt-1" style={{ color: '#72708A' }}>
                The selected dates fall on weekends or public holidays. Please choose different dates.
              </p>
            </div>
          )}

          {/* Reason */}
          <div className="mb-5">
            <label
              htmlFor="reason"
              className="block mb-2"
              style={{
                fontSize: typography.label.size,
                fontWeight: typography.label.weight,
                color: t.text,
              }}
            >
              Reason (optional)
            </label>
            <textarea
              id="reason"
              {...register('reason')}
              rows={3}
              className="w-full px-3 py-2.5 text-sm focus:outline-none focus:ring-2 resize-none"
              style={{
                background: t.input,
                border: errors.reason ? '2px solid #D44040' : `1px solid ${t.inputBorder}`,
                borderRadius: 10,
                color: t.text,
              }}
              placeholder="Please provide a reason for your leave request..."
            />
            {errors.reason && (
              <p className="text-xs mt-1" style={{ color: '#D44040' }}>
                {errors.reason.message}
              </p>
            )}
          </div>

          {/* Submit Button */}
          <div className="flex items-center gap-3">
            <button
              type="submit"
              disabled={submitMutation.isPending || hasInsufficientBalance || workingDays === 0}
              className="font-semibold px-5 py-3 transition-opacity hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed"
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
              onClick={() => navigate({ to: '/leave' })}
              className="font-semibold px-5 py-3 transition-opacity hover:opacity-70"
              style={{ color: t.textMuted, fontSize: typography.body.size }}
            >
              Cancel
            </button>
          </div>
        </div>
      </form>
    </div>
  )
}
