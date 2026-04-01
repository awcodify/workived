import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { X } from 'lucide-react'
import { createPolicySchema, type CreatePolicyFormData } from '@/lib/validations/leave'
import { useCreatePolicy, useUpdatePolicy } from '@/lib/hooks/useLeave'
import { moduleThemes, typography } from '@/design/tokens'
import type { LeavePolicy } from '@/types/api'

const t = moduleThemes.leave

type EmpType = 'full_time' | 'part_time' | 'contract' | 'intern'

interface PolicyModalProps {
  policy?: LeavePolicy  // If provided, edit mode; otherwise create mode
  onClose: () => void
  onSuccess: () => void
}

export function PolicyModal({ policy, onClose, onSuccess }: PolicyModalProps) {
  const createMutation = useCreatePolicy()
  const updateMutation = useUpdatePolicy(policy?.id ?? '')

  const isEditMode = !!policy

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors },
  } = useForm<CreatePolicyFormData>({
    resolver: zodResolver(createPolicySchema),
    defaultValues: isEditMode
      ? {
          name: policy.name,
          days_per_year: policy.days_per_year,
          carry_over_days: policy.carry_over_days,
          min_tenure_days: policy.min_tenure_days,
          requires_approval: policy.requires_approval,
          is_unlimited: policy.is_unlimited,
          gender_eligibility: policy.gender_eligibility ?? null,
          eligible_employment_types: (policy.eligible_employment_types ?? []) as EmpType[],
          max_lifetime_uses: policy.max_lifetime_uses ?? null,
        }
      : {
          name: '',
          days_per_year: 12,
          carry_over_days: 0,
          min_tenure_days: 0,
          requires_approval: true,
          is_unlimited: false,
          gender_eligibility: null,
          eligible_employment_types: [],
          max_lifetime_uses: null,
        },
  })

  const requiresApproval = watch('requires_approval')
  const isUnlimited = watch('is_unlimited')
  const genderEligibility = watch('gender_eligibility')
  const eligibleTypes = watch('eligible_employment_types') ?? []
  const maxLifetimeUses = watch('max_lifetime_uses')

  const toggleEmploymentType = (type: EmpType) => {
    if (eligibleTypes.includes(type)) {
      setValue('eligible_employment_types', eligibleTypes.filter((t) => t !== type))
    } else {
      setValue('eligible_employment_types', [...eligibleTypes, type])
    }
  }

  const onSubmit = async (data: CreatePolicyFormData) => {
    try {
      if (isEditMode) {
        await updateMutation.mutateAsync(data)
      } else {
        await createMutation.mutateAsync(data)
      }
      onSuccess()
    } catch (error) {
      // Error handled by mutation
    }
  }

  const mutation = isEditMode ? updateMutation : createMutation

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(0, 0, 0, 0.5)' }}
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg max-h-[90vh] overflow-y-auto"
        style={{
          background: t.surface,
          borderRadius: 16,
          border: `1px solid ${t.border}`,
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between px-6 py-4 sticky top-0"
          style={{
            borderBottom: `1px solid ${t.border}`,
            background: t.surface,
            borderRadius: '16px 16px 0 0',
          }}
        >
          <h2
            className="font-bold"
            style={{
              fontSize: typography.h1.size,
              letterSpacing: typography.h1.tracking,
              color: t.text,
            }}
          >
            {isEditMode ? 'Edit Policy' : 'New Policy'}
          </h2>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-lg transition-colors"
            style={{ color: t.textMuted }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = t.surfaceHover
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'transparent'
            }}
          >
            <X size={20} />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit(onSubmit)} className="px-6 py-5 space-y-4">
          {/* Policy Name */}
          <div>
            <label
              className="block mb-1.5"
              style={{
                fontSize: typography.label.size,
                fontWeight: 600,
                color: t.text,
              }}
            >
              Policy Name
            </label>
            <input
              type="text"
              {...register('name')}
              placeholder="e.g. Annual Leave, Sick Leave"
              className="w-full px-3 py-2.5 text-sm focus:outline-none focus:ring-2"
              style={{
                background: t.input,
                border: `1px solid ${errors.name ? '#EF4444' : t.inputBorder}`,
                borderRadius: 10,
                color: t.text,
                caretColor: t.accent,
              }}
            />
            {errors.name && (
              <p className="text-xs mt-1" style={{ color: '#EF4444' }}>
                {errors.name.message}
              </p>
            )}
          </div>

          {/* Unlimited Leave */}
          <div className="flex items-center gap-3 pt-2">
            <input
              id="is-unlimited"
              type="checkbox"
              {...register('is_unlimited')}
              className="w-5 h-5 rounded transition-colors cursor-pointer"
              style={{ accentColor: t.accent }}
              onChange={(e) => {
                setValue('is_unlimited', e.target.checked)
                if (e.target.checked) {
                  setValue('days_per_year', 365)
                }
              }}
            />
            <label
              htmlFor="is-unlimited"
              className="cursor-pointer select-none"
              style={{
                fontSize: typography.body.size,
                color: t.text,
              }}
            >
              Unlimited leave
            </label>
          </div>
          <p className="text-xs -mt-2 ml-8" style={{ color: t.textMuted }}>
            {isUnlimited
              ? 'No day limit — employees can take as much as needed (e.g. sick leave)'
              : 'Set a specific number of days per year'}
          </p>

          {/* Days Per Year */}
          {!isUnlimited && (
            <div>
              <label
                className="block mb-1.5"
                style={{
                  fontSize: typography.label.size,
                  fontWeight: 600,
                  color: t.text,
                }}
              >
                Days Per Year
              </label>
              <input
                type="number"
                {...register('days_per_year', { valueAsNumber: true })}
                min="0"
                className="w-full px-3 py-2.5 text-sm focus:outline-none focus:ring-2"
                style={{
                  background: t.input,
                  border: `1px solid ${errors.days_per_year ? '#EF4444' : t.inputBorder}`,
                  borderRadius: 10,
                  color: t.text,
                  caretColor: t.accent,
                }}
              />
              {errors.days_per_year && (
                <p className="text-xs mt-1" style={{ color: '#EF4444' }}>
                  {errors.days_per_year.message}
                </p>
              )}
            </div>
          )}

          {/* Carry Over Days */}
          <div>
            <label
              className="block mb-1.5"
              style={{
                fontSize: typography.label.size,
                fontWeight: 600,
                color: t.text,
              }}
            >
              Carry Over Days
            </label>
            <input
              type="number"
              {...register('carry_over_days', { valueAsNumber: true })}
              min="0"
              className="w-full px-3 py-2.5 text-sm focus:outline-none focus:ring-2"
              style={{
                background: t.input,
                border: `1px solid ${errors.carry_over_days ? '#EF4444' : t.inputBorder}`,
                borderRadius: 10,
                color: t.text,
                caretColor: t.accent,
              }}
            />
            {errors.carry_over_days && (
              <p className="text-xs mt-1" style={{ color: '#EF4444' }}>
                {errors.carry_over_days.message}
              </p>
            )}
          </div>

          {/* Min Tenure Days */}
          <div>
            <label
              className="block mb-1.5"
              style={{
                fontSize: typography.label.size,
                fontWeight: 600,
                color: t.text,
              }}
            >
              Minimum Tenure (Days)
            </label>
            <input
              type="number"
              {...register('min_tenure_days', { valueAsNumber: true })}
              min="0"
              className="w-full px-3 py-2.5 text-sm focus:outline-none focus:ring-2"
              style={{
                background: t.input,
                border: `1px solid ${errors.min_tenure_days ? '#EF4444' : t.inputBorder}`,
                borderRadius: 10,
                color: t.text,
                caretColor: t.accent,
              }}
            />
            <p className="text-xs mt-1" style={{ color: t.textMuted }}>
              Employees must work this many days before eligibility. Use 0 for immediate eligibility.
            </p>
            {errors.min_tenure_days && (
              <p className="text-xs mt-1" style={{ color: '#EF4444' }}>
                {errors.min_tenure_days.message}
              </p>
            )}
          </div>

          {/* Requires Approval */}
          <div className="flex items-center gap-3 pt-2">
            <input
              id="requires-approval"
              type="checkbox"
              {...register('requires_approval')}
              className="w-5 h-5 rounded transition-colors cursor-pointer"
              style={{ accentColor: t.accent }}
            />
            <label
              htmlFor="requires-approval"
              className="cursor-pointer select-none"
              style={{
                fontSize: typography.body.size,
                color: t.text,
              }}
            >
              Requires approval
            </label>
          </div>
          <p className="text-xs -mt-2 ml-8" style={{ color: t.textMuted }}>
            {requiresApproval
              ? 'Employees need manager/admin approval to take leave'
              : 'Employees can take leave immediately without approval'}
          </p>

          {/* Gender Eligibility */}
          <div className="pt-2">
            <label
              className="block mb-1.5"
              style={{
                fontSize: typography.label.size,
                fontWeight: 600,
                color: t.text,
              }}
            >
              Eligible Gender
            </label>
            <div className="flex gap-2">
              {([
                { value: null, label: 'All' },
                { value: 'male' as const, label: 'Male' },
                { value: 'female' as const, label: 'Female' },
              ] as const).map((option) => (
                <button
                  key={option.label}
                  type="button"
                  onClick={() => setValue('gender_eligibility', option.value)}
                  className="px-4 py-2 text-sm font-semibold transition-all"
                  style={{
                    background: genderEligibility === option.value ? t.accent : t.input,
                    color: genderEligibility === option.value ? t.accentText : t.text,
                    border: `1px solid ${genderEligibility === option.value ? t.accent : t.inputBorder}`,
                    borderRadius: 10,
                  }}
                >
                  {option.label}
                </button>
              ))}
            </div>
            <p className="text-xs mt-1" style={{ color: t.textMuted }}>
              Restrict this leave type to a specific gender (e.g., maternity, paternity)
            </p>
          </div>

          {/* Eligible Employment Types */}
          <div className="pt-2">
            <label
              className="block mb-1.5"
              style={{
                fontSize: typography.label.size,
                fontWeight: 600,
                color: t.text,
              }}
            >
              Eligible Employment Types
            </label>
            <div className="flex flex-wrap gap-2">
              {([
                { value: 'full_time' as const, label: 'Full-time' },
                { value: 'part_time' as const, label: 'Part-time' },
                { value: 'contract' as const, label: 'Contract' },
                { value: 'intern' as const, label: 'Intern' },
              ]).map((option) => {
                const isSelected = eligibleTypes.includes(option.value)
                return (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => toggleEmploymentType(option.value)}
                    className="px-4 py-2 text-sm font-semibold transition-all"
                    style={{
                      background: isSelected ? t.accent : t.input,
                      color: isSelected ? t.accentText : t.text,
                      border: `1px solid ${isSelected ? t.accent : t.inputBorder}`,
                      borderRadius: 10,
                    }}
                  >
                    {option.label}
                  </button>
                )
              })}
            </div>
            <p className="text-xs mt-1" style={{ color: t.textMuted }}>
              Leave empty for all types. Select specific types to restrict eligibility.
            </p>
          </div>

          {/* Lifetime Limit */}
          <div className="pt-2">
            <div className="flex items-center gap-3">
              <input
                id="has-lifetime-limit"
                type="checkbox"
                checked={maxLifetimeUses != null}
                onChange={(e) => {
                  setValue('max_lifetime_uses', e.target.checked ? 1 : null)
                }}
                className="w-5 h-5 rounded transition-colors cursor-pointer"
                style={{ accentColor: t.accent }}
              />
              <label
                htmlFor="has-lifetime-limit"
                className="cursor-pointer select-none"
                style={{
                  fontSize: typography.body.size,
                  color: t.text,
                }}
              >
                Lifetime limit
              </label>
            </div>
            <p className="text-xs mt-1 ml-8" style={{ color: t.textMuted }}>
              {maxLifetimeUses != null
                ? 'This leave can only be used a limited number of times per employment (e.g. Hajj)'
                : 'No lifetime limit — employees can use this leave every year'}
            </p>
            {maxLifetimeUses != null && (
              <div className="mt-2 ml-8">
                <label
                  className="block mb-1.5"
                  style={{
                    fontSize: typography.label.size,
                    fontWeight: 600,
                    color: t.text,
                  }}
                >
                  Maximum uses per employment
                </label>
                <input
                  type="number"
                  {...register('max_lifetime_uses', { valueAsNumber: true })}
                  min="1"
                  className="w-32 px-3 py-2.5 text-sm focus:outline-none focus:ring-2"
                  style={{
                    background: t.input,
                    border: `1px solid ${errors.max_lifetime_uses ? '#EF4444' : t.inputBorder}`,
                    borderRadius: 10,
                    color: t.text,
                    caretColor: t.accent,
                  }}
                />
                {errors.max_lifetime_uses && (
                  <p className="text-xs mt-1" style={{ color: '#EF4444' }}>
                    {errors.max_lifetime_uses.message}
                  </p>
                )}
              </div>
            )}
          </div>

          {/* Error Message */}
          {mutation.isError && (
            <div
              className="px-4 py-3 rounded-lg"
              style={{
                background: '#FEE2E2',
                border: '1px solid #FECACA',
                color: '#991B1B',
              }}
            >
              <p className="text-sm">
                {mutation.error instanceof Error
                  ? mutation.error.message
                  : 'Failed to save policy. Please try again.'}
              </p>
            </div>
          )}

          {/* Actions */}
          <div className="flex items-center gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2.5 text-sm font-semibold transition-opacity hover:opacity-70"
              style={{
                background: t.surfaceHover,
                color: t.text,
                borderRadius: 10,
              }}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={mutation.isPending}
              className="flex-1 px-4 py-2.5 text-sm font-semibold transition-opacity hover:opacity-90 disabled:opacity-50"
              style={{
                background: t.accent,
                color: t.accentText,
                borderRadius: 10,
              }}
            >
              {mutation.isPending
                ? 'Saving...'
                : isEditMode
                  ? 'Save Changes'
                  : 'Create Policy'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
