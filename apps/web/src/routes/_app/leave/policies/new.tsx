import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { ArrowLeft } from 'lucide-react'
import { createPolicySchema, type CreatePolicyFormData } from '@/lib/validations/leave'
import { useCreatePolicy } from '@/lib/hooks/useLeave'
import { moduleBackgrounds, moduleThemes, typography } from '@/design/tokens'

const t = moduleThemes.leave

export const Route = createFileRoute('/_app/leave/policies/new')({
  component: NewPolicyPage,
})

function NewPolicyPage() {
  const navigate = useNavigate()
  const createMutation = useCreatePolicy()

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<CreatePolicyFormData>({
    resolver: zodResolver(createPolicySchema),
    defaultValues: {
      name: '',
      days_per_year: 12,
      carry_over_days: 0,
      min_tenure_days: 0,
      requires_approval: true,
    },
  })

  const requiresApproval = watch('requires_approval')

  const onSubmit = async (data: CreatePolicyFormData) => {
    try {
      await createMutation.mutateAsync(data)
      navigate({ to: '/leave/policies' })
    } catch (error) {
      // Error handled by mutation
    }
  }

  return (
    <div
      className="min-h-screen px-6 py-8 md:px-11 md:py-10 pb-28"
      style={{ background: moduleBackgrounds.leave }}
    >
      {/* Header */}
      <button
        onClick={() => navigate({ to: '/leave/policies' })}
        className="flex items-center gap-1.5 text-sm font-semibold mb-6 transition-opacity hover:opacity-70"
        style={{ color: t.accent }}
      >
        <ArrowLeft size={16} />
        Back to policies
      </button>

      <h1
        className="font-extrabold mb-8"
        style={{
          fontSize: typography.display.size,
          letterSpacing: typography.display.tracking,
          color: t.text,
          lineHeight: typography.display.lineHeight,
        }}
      >
        Create Leave Policy
      </h1>

      {/* Form */}
      <form onSubmit={handleSubmit(onSubmit)} className="max-w-xl">
        <div
          style={{
            background: t.surface,
            borderRadius: 16,
            border: `1px solid ${t.border}`,
            padding: 24,
          }}
        >
          {/* Policy Name */}
          <div className="mb-6">
            <label
              className="block font-semibold mb-2"
              style={{
                fontSize: typography.label.size,
                color: t.text,
              }}
            >
              Policy Name
            </label>
            <input
              {...register('name')}
              type="text"
              placeholder="e.g., Annual Leave, Sick Leave"
              className="w-full px-4 py-2.5 transition-colors"
              style={{
                background: t.input,
                border: errors.name
                  ? '1px solid #D44040'
                  : `1px solid ${t.inputBorder}`,
                borderRadius: 12,
                color: t.text,
                fontSize: typography.body.size,
              }}
            />
            {errors.name && (
              <p className="text-sm mt-1" style={{ color: '#D44040' }}>
                {errors.name.message}
              </p>
            )}
          </div>

          {/* Days Per Year */}
          <div className="mb-6">
            <label
              className="block font-semibold mb-2"
              style={{
                fontSize: typography.label.size,
                color: t.text,
              }}
            >
              Days Per Year
            </label>
            <input
              {...register('days_per_year', { valueAsNumber: true })}
              type="number"
              min="0"
              className="w-full px-4 py-2.5 transition-colors"
              style={{
                background: t.input,
                border: errors.days_per_year
                  ? '1px solid #D44040'
                  : `1px solid ${t.inputBorder}`,
                borderRadius: 12,
                color: t.text,
                fontSize: typography.body.size,
              }}
            />
            {errors.days_per_year && (
              <p className="text-sm mt-1" style={{ color: '#D44040' }}>
                {errors.days_per_year.message}
              </p>
            )}
          </div>

          {/* Carry Over Days */}
          <div className="mb-6">
            <label
              className="block font-semibold mb-2"
              style={{
                fontSize: typography.label.size,
                color: t.text,
              }}
            >
              Carry Over Days
            </label>
            <input
              {...register('carry_over_days', { valueAsNumber: true })}
              type="number"
              min="0"
              className="w-full px-4 py-2.5 transition-colors"
              style={{
                background: t.input,
                border: errors.carry_over_days
                  ? '1px solid #D44040'
                  : `1px solid ${t.inputBorder}`,
                borderRadius: 12,
                color: t.text,
                fontSize: typography.body.size,
              }}
            />
            {errors.carry_over_days && (
              <p className="text-sm mt-1" style={{ color: '#D44040' }}>
                {errors.carry_over_days.message}
              </p>
            )}
          </div>

          {/* Min Tenure Days */}
          <div className="mb-6">
            <label
              className="block font-semibold mb-2"
              style={{
                fontSize: typography.label.size,
                color: t.text,
              }}
            >
              Minimum Tenure (Days)
            </label>
            <input
              {...register('min_tenure_days', { valueAsNumber: true })}
              type="number"
              min="0"
              className="w-full px-4 py-2.5 transition-colors"
              style={{
                background: t.input,
                border: errors.min_tenure_days
                  ? '1px solid #D44040'
                  : `1px solid ${t.inputBorder}`,
                borderRadius: 12,
                color: t.text,
                fontSize: typography.body.size,
              }}
            />
            <p className="text-xs mt-1" style={{ color: t.textMuted }}>
              Employees must work this many days before eligibility. Use 0 for immediate eligibility.
            </p>
            {errors.min_tenure_days && (
              <p className="text-sm mt-1" style={{ color: '#D44040' }}>
                {errors.min_tenure_days.message}
              </p>
            )}
          </div>

          {/* Requires Approval */}
          <div className="mb-6">
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                {...register('requires_approval')}
                type="checkbox"
                className="w-5 h-5 cursor-pointer"
                style={{
                  accentColor: t.accent,
                }}
              />
              <span
                className="font-semibold"
                style={{
                  fontSize: typography.label.size,
                  color: t.text,
                }}
              >
                Requires approval
              </span>
            </label>
            <p className="text-xs mt-1 ml-8" style={{ color: t.textMuted }}>
              {requiresApproval
                ? 'Employees need manager/admin approval to take leave'
                : 'Employees can take leave immediately without approval'}
            </p>
          </div>

          {/* Submit Button */}
          <button
            type="submit"
            disabled={isSubmitting || createMutation.isPending}
            className="w-full py-3 font-bold text-sm transition-opacity disabled:opacity-50"
            style={{
              background: t.accent,
              color: t.accentText,
              borderRadius: 12,
            }}
          >
            {isSubmitting || createMutation.isPending ? 'Creating...' : 'Create Policy'}
          </button>

          {createMutation.isError && (
            <p className="text-sm mt-3 text-center" style={{ color: '#D44040' }}>
              Failed to create policy. Please try again.
            </p>
          )}
        </div>
      </form>
    </div>
  )
}
