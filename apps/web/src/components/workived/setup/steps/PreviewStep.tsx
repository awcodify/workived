import { useState, useRef, useEffect } from 'react'
import { Check, ArrowLeft, Send } from 'lucide-react'
import { colors } from '@/design/tokens'
import { formatMoney } from '@/lib/utils/money'
import type { WizardState } from '../SetupWizard'
import type { SetupTemplatesResponse } from '@/types/api'

interface PreviewStepProps {
  wizardState: WizardState
  templates: SetupTemplatesResponse
  onConfirm: () => void
  onBack: () => void
  isSubmitting: boolean
}

export function PreviewStep({ wizardState, templates, onConfirm, onBack, isSubmitting }: PreviewStepProps) {
  // Two-click confirmation state
  const [confirmingFinish, setConfirmingFinish] = useState(false)
  const confirmTimeoutRef = useRef<number | null>(null)

  // Clean up timeout on unmount
  useEffect(() => {
    return () => {
      if (confirmTimeoutRef.current) {
        clearTimeout(confirmTimeoutRef.current)
      }
    }
  }, [])

  const handleConfirm = () => {
    // First click: enter confirmation mode
    if (!confirmingFinish) {
      setConfirmingFinish(true)
      
      // Auto-reset after 3 seconds
      confirmTimeoutRef.current = setTimeout(() => {
        setConfirmingFinish(false)
      }, 3000) as unknown as number
      
      return
    }
    
    // Second click: actually submit
    onConfirm()
  }

  // Get selected work schedule name
  const workScheduleName = wizardState.selectedWorkScheduleTemplate
    ? wizardState.selectedWorkScheduleTemplate.name
    : wizardState.customSchedule
      ? wizardState.customSchedule.name || 'Custom Schedule'
      : 'Not selected'

  const dayNames = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
  const formatWorkDays = (workDays: number[]) =>
    workDays
      .sort((a, b) => a - b)
      .map((d) => dayNames[d - 1])
      .join(', ')

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="text-center">
        <div
          className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full"
          style={{ background: colors.accentDim }}
        >
          <Check size={32} style={{ color: colors.accent }} />
        </div>
        <h1 className="mb-2 text-3xl font-extrabold" style={{ color: colors.ink900 }}>
          Review Your Setup
        </h1>
        <p className="text-lg" style={{ color: colors.ink500 }}>
          Please review your selections before submitting
        </p>
      </div>

      {/* Preview Cards */}
      <div className="space-y-6">
        {/* Work Schedule */}
        <div
          className="rounded-lg border p-6"
          style={{ background: colors.ink0, borderColor: colors.ink150 }}
        >
          <h2 className="mb-4 text-xl font-bold" style={{ color: colors.ink900 }}>
            Work Schedule
          </h2>
          <div className="space-y-2">
            <p className="text-sm font-semibold" style={{ color: colors.ink500 }}>
              {workScheduleName}
            </p>
            {wizardState.customSchedule && (
              <div className="mt-3 space-y-2">
                <div className="flex justify-between text-sm">
                  <span style={{ color: colors.ink700 }}>Working Days</span>
                  <span style={{ color: colors.ink500 }}>
                    {formatWorkDays(wizardState.customSchedule.work_days)}
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span style={{ color: colors.ink700 }}>Hours</span>
                  <span style={{ color: colors.ink500 }}>
                    {wizardState.customSchedule.start_time} - {wizardState.customSchedule.end_time}
                  </span>
                </div>
              </div>
            )}
            {wizardState.selectedWorkScheduleTemplate && (
              <div className="mt-3 space-y-2">
                <div className="flex justify-between text-sm">
                  <span style={{ color: colors.ink700 }}>Working Days</span>
                  <span style={{ color: colors.ink500 }}>
                    {formatWorkDays(wizardState.selectedWorkScheduleTemplate.work_days)}
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span style={{ color: colors.ink700 }}>Hours</span>
                  <span style={{ color: colors.ink500 }}>
                    {wizardState.selectedWorkScheduleTemplate.start_time} - {wizardState.selectedWorkScheduleTemplate.end_time}
                  </span>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Leave Policies */}
        <div
          className="rounded-lg border p-6"
          style={{ background: colors.ink0, borderColor: colors.ink150 }}
        >
          <h2 className="mb-4 text-xl font-bold" style={{ color: colors.ink900 }}>
            Leave Policies
          </h2>
          {wizardState.selectedLeavePolicies.length > 0 ? (
            <div className="space-y-3">
              {wizardState.selectedLeavePolicies.map((policy) => {
                const customization = wizardState.leavePolicyCustomizations[policy.id]
                return (
                  <div key={policy.id} className="flex items-start justify-between">
                    <div>
                      <p className="font-semibold" style={{ color: colors.ink700 }}>
                        {policy.name}
                      </p>
                      <p className="text-sm" style={{ color: colors.ink500 }}>
                        {customization?.days_per_year ?? policy.entitled_days_per_year} days per year
                      </p>
                    </div>
                    <div
                      className="rounded-full px-3 py-1 text-xs font-bold"
                      style={{
                        background: colors.okDim,
                        color: colors.okText,
                      }}
                    >
                      Enabled
                    </div>
                  </div>
                )
              })}
            </div>
          ) : (
            <p className="text-sm" style={{ color: colors.ink500 }}>
              No leave policies selected
            </p>
          )}
        </div>

        {/* Claim Categories */}
        <div
          className="rounded-lg border p-6"
          style={{ background: colors.ink0, borderColor: colors.ink150 }}
        >
          <h2 className="mb-4 text-xl font-bold" style={{ color: colors.ink900 }}>
            Claim Categories
          </h2>
          {wizardState.selectedClaimCategories.length > 0 ? (
            <div className="space-y-3">
              {wizardState.selectedClaimCategories.map((category) => {
                const customization = wizardState.claimCategoryCustomizations[category.id]
                return (
                  <div key={category.id} className="flex items-start justify-between">
                    <div>
                      <p className="font-semibold" style={{ color: colors.ink700 }}>
                        {category.name}
                      </p>
                      <p className="text-sm" style={{ color: colors.ink500 }}>
                        {customization?.monthly_limit
                          ? `${formatMoney(customization.monthly_limit, category.currency_code!)} / ${category.budget_period === 'yearly' ? 'year' : 'month'}`
                          : category.monthly_limit
                            ? `${formatMoney(category.monthly_limit, category.currency_code!)} / ${category.budget_period === 'yearly' ? 'year' : 'month'}`
                            : 'No limit'}
                      </p>
                    </div>
                    <div
                      className="rounded-full px-3 py-1 text-xs font-bold"
                      style={{
                        background: colors.okDim,
                        color: colors.okText,
                      }}
                    >
                      Enabled
                    </div>
                  </div>
                )
              })}
            </div>
          ) : (
            <p className="text-sm" style={{ color: colors.ink500 }}>
              No claim categories selected
            </p>
          )}
        </div>
      </div>

      {/* Actions */}
      <div className="flex gap-4">
        <button
          onClick={onBack}
          disabled={isSubmitting}
          className="flex items-center gap-2 rounded-lg border px-6 py-3 font-semibold transition-colors hover:bg-gray-50 disabled:opacity-50"
          style={{
            color: colors.ink700,
            borderColor: colors.ink150,
          }}
        >
          <ArrowLeft size={20} />
          Back
        </button>
        <button
          onClick={handleConfirm}
          disabled={isSubmitting}
          className="flex flex-1 items-center justify-center gap-2 rounded-lg px-6 py-3 font-semibold transition-colors hover:opacity-90 disabled:opacity-50"
          style={{
            background: confirmingFinish ? colors.warn : colors.accent,
            color: '#FFFFFF',
          }}
        >
          {isSubmitting ? (
            <>
              <div className="h-5 w-5 animate-spin rounded-full border-2 border-white border-t-transparent" />
              Submitting...
            </>
          ) : (
            <>
              <Send size={20} />
              {confirmingFinish ? 'Sure?' : 'Finish!'}
            </>
          )}
        </button>
      </div>

      {/* Note */}
      <p className="text-center text-sm" style={{ color: colors.ink500 }}>
        You can always modify these settings later from your organization settings
      </p>
    </div>
  )
}
