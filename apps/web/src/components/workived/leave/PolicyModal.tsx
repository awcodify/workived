import { useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { X, Info } from 'lucide-react'
import { createPolicySchema, type CreatePolicyFormData } from '@/lib/validations/leave'
import { useCreatePolicy, useUpdatePolicy } from '@/lib/hooks/useLeave'
import { useBodyScrollLock } from '@/lib/hooks/useBodyScrollLock'
import { moduleThemes, typography } from '@/design/tokens'
import type { LeavePolicy, PolicyTemplate } from '@/types/api'

const t = moduleThemes.leave

type EmpType = 'full_time' | 'part_time' | 'contract' | 'intern'

interface PolicyModalProps {
  policy?: LeavePolicy  // If provided, edit mode
  template?: PolicyTemplate  // If provided, create mode with template defaults
  onClose: () => void
  onSuccess: () => void
}

export function PolicyModal({ policy, template, onClose, onSuccess }: PolicyModalProps) {
  const createMutation = useCreatePolicy()
  const updateMutation = useUpdatePolicy(policy?.id ?? '')

  const isEditMode = !!policy

  // Lock body scroll when modal is open
  useBodyScrollLock()

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
          description: policy.description ?? null,
          days_per_year: policy.days_per_year,
          carry_over_days: policy.carry_over_days,
          min_tenure_days: policy.min_tenure_days,
          requires_approval: policy.requires_approval,
          is_unlimited: policy.is_unlimited,
          gender_eligibility: policy.gender_eligibility ?? null,
          eligible_employment_types: (policy.eligible_employment_types ?? []) as EmpType[],
          probation_eligible: policy.probation_eligible ?? true,
          max_lifetime_uses: policy.max_lifetime_uses ?? null,
        }
      : template
      ? {
          name: template.name,
          description: template.description ?? null,
          days_per_year: template.entitled_days_per_year,
          carry_over_days: template.max_carry_over_days ?? 0,
          min_tenure_days: 0,
          requires_approval: template.requires_approval,
          is_unlimited: template.is_unlimited,
          gender_eligibility: template.gender_eligibility === 'all' ? null : template.gender_eligibility,
          eligible_employment_types: ['full_time'],
          probation_eligible: true,
          max_lifetime_uses: template.max_lifetime_uses ?? null,
        }
      : {
          name: '',
          description: null,
          days_per_year: 12,
          carry_over_days: 0,
          min_tenure_days: 0,
          requires_approval: true,
          is_unlimited: false,
          gender_eligibility: null,
          eligible_employment_types: ['full_time'],
          probation_eligible: true,
          max_lifetime_uses: null,
        },
  })

  const requiresApproval = watch('requires_approval')
  const isUnlimited = watch('is_unlimited')
  const genderEligibility = watch('gender_eligibility')
  const eligibleTypes = watch('eligible_employment_types') ?? []
  const maxLifetimeUses = watch('max_lifetime_uses')

  // Close on Escape key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', handleEscape)
    return () => document.removeEventListener('keydown', handleEscape)
  }, [onClose])

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
      className="fixed inset-0 z-[100] flex items-center justify-center p-4"
      data-testid="policy-modal-backdrop"
      style={{ background: 'rgba(0, 0, 0, 0.5)' }}
      onClick={onClose}
    >
      <div
        className="w-full max-w-3xl max-h-[90vh] overflow-y-auto relative"
        data-testid="policy-modal"
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
            data-testid="policy-modal-close-btn"
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
        <form onSubmit={handleSubmit(onSubmit)} className="px-6 py-5 space-y-4" data-testid="policy-modal-form">
          {/* Policy Name */}
          <div>
            <label
              className="flex items-center gap-1.5 mb-1.5"
              style={{
                fontSize: typography.label.size,
                fontWeight: 600,
                color: t.text,
              }}
            >
              Policy Name
              <div className="relative inline-block">
                <Info
                  size={14}
                  className="cursor-help peer"
                  style={{ color: t.accent }}
                />
                <div
                  className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-2 text-xs rounded-lg whitespace-nowrap opacity-0 pointer-events-none peer-hover:opacity-100 transition-opacity"
                  style={{
                    background: t.text,
                    color: t.surface,
                    boxShadow: '0 4px 6px rgba(0,0,0,0.1)',
                      zIndex: 9999,
                  }}
                >
                  Name of the leave policy (e.g., Annual Leave)
                </div>
              </div>
            </label>
            <input
              type="text"
              {...register('name')}
              placeholder="e.g. Annual Leave, Sick Leave"
              required
              data-testid="policy-name-input"
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

          {/* Description */}
          <div>
            <label
              className="flex items-center gap-1.5 mb-1.5"
              style={{
                fontSize: typography.label.size,
                fontWeight: 600,
                color: t.text,
              }}
            >
              Description
              <div className="relative inline-block">
                <Info
                  size={14}
                  className="cursor-help peer"
                  style={{ color: t.accent }}
                />
                <div
                  className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-2 text-xs rounded-lg opacity-0 pointer-events-none peer-hover:opacity-100 transition-opacity"
                  style={{
                    background: t.text,
                    color: t.surface,
                    boxShadow: '0 4px 6px rgba(0,0,0,0.1)',
                      zIndex: 9999,
                    width: '200px',
                    whiteSpace: 'normal',
                  }}
                >
                  Explain when and how employees can use this leave
                </div>
              </div>
            </label>
            <textarea
              {...register('description')}
              placeholder="Describe when and how this leave can be used (optional)"
              rows={2}
              data-testid="policy-description-input"
              className="w-full px-3 py-2.5 text-sm focus:outline-none focus:ring-2 resize-none"
              style={{
                background: t.input,
                border: `1px solid ${errors.description ? '#EF4444' : t.inputBorder}`,
                borderRadius: 10,
                color: t.text,
                caretColor: t.accent,
              }}
            />
            {errors.description && (
              <p className="text-xs mt-1" style={{ color: '#EF4444' }}>
                {errors.description.message}
              </p>
            )}
          </div>

          {/* Unlimited Leave */}
          <div className="flex items-center gap-3 pt-2">
            <input
              id="is-unlimited"
              type="checkbox"
              {...register('is_unlimited')}
              data-testid="policy-unlimited-checkbox"
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
              className="cursor-pointer select-none flex items-center gap-1.5"
              style={{
                fontSize: typography.body.size,
                color: t.text,
              }}
            >
              Unlimited leave
              <div className="relative inline-block">
                <Info
                  size={14}
                  className="cursor-help peer"
                  style={{ color: t.accent }}
                />
                <div
                  className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-2 text-xs rounded-lg opacity-0 pointer-events-none peer-hover:opacity-100 transition-opacity"
                  style={{
                    background: t.text,
                    color: t.surface,
                    boxShadow: '0 4px 6px rgba(0,0,0,0.1)',
                      zIndex: 9999,
                    width: '200px',
                    whiteSpace: 'normal',
                  }}
                >
                  No day limit — employees can take as much as needed (e.g., sick leave)
                </div>
              </div>
            </label>
          </div>

          {/* Days Configuration - 3 Column Grid */}
          <div className="grid grid-cols-3 gap-3">
            {/* Days Per Year */}
            <div>
              <label
                className="flex items-center gap-1.5 mb-1.5 group"
                style={{
                  fontSize: typography.label.size,
                  fontWeight: 600,
                  color: t.text,
                }}
              >
                Days Per Year
                <div className="relative inline-block">
                  <Info
                    size={14}
                    className="cursor-help peer"
                    style={{ color: t.accent }}
                  />
                  <div
                  className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-2 text-xs rounded-lg whitespace-nowrap opacity-0 pointer-events-none peer-hover:opacity-100 transition-opacity"
                  style={{
                    background: t.text,
                    color: t.surface,
                    boxShadow: '0 4px 6px rgba(0,0,0,0.1)',
                    zIndex: 9999,
                    }}
                  >
                    Leave days granted annually
                  </div>
                </div>
              </label>
              <input
                type="text"
                value={isUnlimited ? '∞' : undefined}
                {...(!isUnlimited && register('days_per_year', { 
                  valueAsNumber: true,
                  min: { value: 1, message: 'Days per year must be at least 1' }
                }))}
                min="1"
                disabled={isUnlimited}
                data-testid="policy-days-input"
                className="w-full px-3 py-2.5 text-sm focus:outline-none focus:ring-2 text-center"
                style={{
                  background: isUnlimited ? t.surfaceHover : t.input,
                  border: `1px solid ${errors.days_per_year ? '#EF4444' : t.inputBorder}`,
                  borderRadius: 10,
                  color: t.text,
                  caretColor: t.accent,
                  cursor: isUnlimited ? 'not-allowed' : 'text',
                  opacity: isUnlimited ? 0.7 : 1,
                }}
              />
              {errors.days_per_year && !isUnlimited && (
                <p className="text-xs mt-1" style={{ color: '#EF4444' }}>
                  {errors.days_per_year.message}
                </p>
              )}
            </div>

              {/* Carry Over Days */}
              <div>
                <label
                  className="flex items-center gap-1.5 mb-1.5 group"
                  style={{
                    fontSize: typography.label.size,
                    fontWeight: 600,
                    color: t.text,
                  }}
                >
                  Carry Over
                  <div className="relative inline-block">
                    <Info
                      size={14}
                      className="cursor-help peer"
                      style={{ color: t.accent }}
                    />
                    <div
                      className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-2 text-xs rounded-lg whitespace-nowrap opacity-0 pointer-events-none peer-hover:opacity-100 transition-opacity"
                      style={{
                        background: t.text,
                        color: t.surface,
                        boxShadow: '0 4px 6px rgba(0,0,0,0.1)',
                      zIndex: 9999,
                        zIndex: 9999,
                      }}
                    >
                      Days that can roll to next year
                    </div>
                  </div>
                </label>
                <input
                  type="number"
                  {...register('carry_over_days', { valueAsNumber: true })}
                  min="0"
                  data-testid="policy-carryover-input"
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
                  className="flex items-center gap-1.5 mb-1.5 group"
                  style={{
                    fontSize: typography.label.size,
                    fontWeight: 600,
                    color: t.text,
                  }}
                >
                  Min Tenure
                  <div className="relative inline-block">
                    <Info
                      size={14}
                      className="cursor-help peer"
                      style={{ color: t.accent }}
                    />
                    <div
                      className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-2 text-xs rounded-lg opacity-0 pointer-events-none peer-hover:opacity-100 transition-opacity"
                      style={{
                        background: t.text,
                        color: t.surface,
                        boxShadow: '0 4px 6px rgba(0,0,0,0.1)',
                      zIndex: 9999,
                        width: '200px',
                        whiteSpace: 'normal',
                        zIndex: 9999,
                      }}
                    >
                      Days employee must work before eligible (0 = immediate)
                    </div>
                  </div>
                </label>
                <input
                  type="number"
                  {...register('min_tenure_days', { valueAsNumber: true })}
                  min="0"
                  data-testid="policy-tenure-input"
                  className="w-full px-3 py-2.5 text-sm focus:outline-none focus:ring-2"
                  style={{
                    background: t.input,
                    border: `1px solid ${errors.min_tenure_days ? '#EF4444' : t.inputBorder}`,
                    borderRadius: 10,
                    color: t.text,
                    caretColor: t.accent,
                  }}
                />
                {errors.min_tenure_days && (
                  <p className="text-xs mt-1" style={{ color: '#EF4444' }}>
                    {errors.min_tenure_days.message}
                  </p>
                )}
              </div>
            </div>

          {/* Requires Approval */}
          <div className="flex items-center gap-3 pt-2">
            <input
              id="requires-approval"
              type="checkbox"
              {...register('requires_approval')}
              data-testid="policy-approval-checkbox"
              className="w-5 h-5 rounded transition-colors cursor-pointer"
              style={{ accentColor: t.accent }}
            />
            <label
              htmlFor="requires-approval"
              className="cursor-pointer select-none flex items-center gap-1.5"
              style={{
                fontSize: typography.body.size,
                color: t.text,
              }}
            >
              Requires approval
              <div className="relative inline-block">
                <Info
                  size={14}
                  className="cursor-help peer"
                  style={{ color: t.accent }}
                />
                <div
                  className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-2 text-xs rounded-lg opacity-0 pointer-events-none peer-hover:opacity-100 transition-opacity"
                  style={{
                    background: t.text,
                    color: t.surface,
                    boxShadow: '0 4px 6px rgba(0,0,0,0.1)',
                      zIndex: 9999,
                    width: '220px',
                    whiteSpace: 'normal',
                  }}
                >
                  If checked, employees need manager/admin approval before taking leave
                </div>
              </div>
            </label>
          </div>

          {/* Gender Eligibility */}
          <div className="pt-2">
            <label
              className="flex items-center gap-1.5 mb-1.5"
              style={{
                fontSize: typography.label.size,
                fontWeight: 600,
                color: t.text,
              }}
            >
              Eligible Gender
              <div className="relative inline-block">
                <Info
                  size={14}
                  className="cursor-help peer"
                  style={{ color: t.accent }}
                />
                <div
                  className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-2 text-xs rounded-lg opacity-0 pointer-events-none peer-hover:opacity-100 transition-opacity"
                  style={{
                    background: t.text,
                    color: t.surface,
                    boxShadow: '0 4px 6px rgba(0,0,0,0.1)',
                      zIndex: 9999,
                    width: '200px',
                    whiteSpace: 'normal',
                  }}
                >
                  Restrict policy to specific gender (e.g., maternity, paternity)
                </div>
              </div>
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
                  data-testid={`policy-gender-${option.value ?? 'all'}-btn`}
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
          </div>

          {/* Eligible Employment Types */}
          <div className="pt-2">
            <label
              className="flex items-center gap-1.5 mb-1.5"
              style={{
                fontSize: typography.label.size,
                fontWeight: 600,
                color: t.text,
              }}
            >
              Eligible Employment Types
              <div className="relative inline-block">
                <Info
                  size={14}
                  className="cursor-help peer"
                  style={{ color: t.accent }}
                />
                <div
                  className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-2 text-xs rounded-lg opacity-0 pointer-events-none peer-hover:opacity-100 transition-opacity"
                  style={{
                    background: t.text,
                    color: t.surface,
                    boxShadow: '0 4px 6px rgba(0,0,0,0.1)',
                      zIndex: 9999,
                    width: '220px',
                    whiteSpace: 'normal',
                  }}
                >
                  Leave empty for all types or select specific employment types
                </div>
              </div>
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
                    data-testid={`policy-type-${option.value}-btn`}
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
          </div>

          {/* Probation Eligibility */}
          <div className="pt-2">
            <div className="flex items-center gap-3">
              <input
                id="probation-eligible"
                type="checkbox"
                {...register('probation_eligible')}
                data-testid="policy-probation-eligible-checkbox"
                className="w-5 h-5 rounded transition-colors cursor-pointer"
                style={{ accentColor: t.accent }}
              />
              <label
                htmlFor="probation-eligible"
                className="cursor-pointer select-none"
                style={{ fontSize: typography.body.size, color: t.text, fontWeight: 500 }}
              >
                Available during probation
              </label>
            </div>
            <p className="mt-1 ml-8" style={{ fontSize: '12px', color: t.textMuted }}>
              Uncheck to block employees currently on probation from requesting this leave
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
                data-testid="policy-lifetime-checkbox"
                className="w-5 h-5 rounded transition-colors cursor-pointer"
                style={{ accentColor: t.accent }}
              />
              <label
                htmlFor="has-lifetime-limit"
                className="cursor-pointer select-none flex items-center gap-1.5"
                style={{
                  fontSize: typography.body.size,
                  color: t.text,
                }}
              >
                Lifetime limit
                <div className="relative inline-block">
                  <Info
                    size={14}
                    className="cursor-help peer"
                    style={{ color: t.accent }}
                  />
                  <div
                    className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-2 text-xs rounded-lg opacity-0 pointer-events-none peer-hover:opacity-100 transition-opacity"
                    style={{
                      background: t.text,
                      color: t.surface,
                      boxShadow: '0 4px 6px rgba(0,0,0,0.1)',
                      zIndex: 9999,
                      width: '200px',
                      whiteSpace: 'normal',
                      zIndex: 9999,
                    }}
                  >
                    Limit how many times an employee can use this leave in their lifetime (e.g., Hajj)
                  </div>
                </div>
              </label>
            </div>
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
                  data-testid="policy-lifetime-input"
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
              data-testid="policy-error"
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
              data-testid="policy-cancel-btn"
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
              data-testid="policy-submit-btn"
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
