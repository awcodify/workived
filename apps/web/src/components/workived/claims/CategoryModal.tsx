import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { X } from 'lucide-react'
import { useCreateCategory, useUpdateCategory } from '@/lib/hooks/useClaims'
import { useOrganisation } from '@/lib/hooks/useOrganisation'
import { moduleThemes, typography } from '@/design/tokens'
import type { ClaimCategory } from '@/types/api'

const t = moduleThemes.claims

interface CategoryModalProps {
  category?: ClaimCategory  // If provided, edit mode; otherwise create mode
  onClose: () => void
  onSuccess: () => void
}

interface CategoryFormData {
  name: string
  monthly_limit: string
  currency_code: string
  requires_receipt: boolean
}

export function CategoryModal({ category, onClose, onSuccess }: CategoryModalProps) {
  const { data: org } = useOrganisation()
  const createMutation = useCreateCategory()
  const updateMutation = useUpdateCategory(category?.id ?? '')

  const isEditMode = !!category

  // Formatted display value for monthly limit input
  const [displayLimit, setDisplayLimit] = useState(
    isEditMode && category.monthly_limit ? formatNumber(category.monthly_limit) : ''
  )

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors },
  } = useForm<CategoryFormData>({
    defaultValues: isEditMode
      ? {
          name: category.name,
          monthly_limit: category.monthly_limit ? category.monthly_limit.toString() : '',
          currency_code: category.currency_code || org?.currency_code || 'IDR',
          requires_receipt: category.requires_receipt,
        }
      : {
          name: '',
          monthly_limit: '',
          currency_code: org?.currency_code || 'IDR',
          requires_receipt: false,
        },
  })

  const hasMonthlyLimit = watch('monthly_limit') !== ''

  // Format number with thousand separators
  function formatNumber(value: number | string): string {
    const num = typeof value === 'string' ? parseFloat(value.replace(/[^0-9]/g, '')) : value
    if (isNaN(num)) return ''
    return num.toLocaleString('en-US')
  }

  // Parse formatted string back to raw number
  function parseFormattedNumber(formatted: string): string {
    const raw = formatted.replace(/[^0-9]/g, '')
    return raw || ''
  }

  const handleLimitChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const rawValue = parseFormattedNumber(e.target.value)
    const formatted = rawValue ? formatNumber(rawValue) : ''
    
    setDisplayLimit(formatted)
    setValue('monthly_limit', rawValue)
  }

  const onSubmit = async (data: CategoryFormData) => {
    const payload = {
      name: data.name,
      monthly_limit: hasMonthlyLimit ? Math.round(parseFloat(data.monthly_limit)) : undefined,
      currency_code: hasMonthlyLimit ? data.currency_code : undefined,
      requires_receipt: data.requires_receipt,
    }

    try {
      if (isEditMode) {
        await updateMutation.mutateAsync(payload)
      } else {
        await createMutation.mutateAsync(payload)
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
        className="w-full max-w-lg"
        style={{
          background: t.surface,
          borderRadius: 16,
          border: `1px solid ${t.border}`,
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between px-6 py-4"
          style={{ borderBottom: `1px solid ${t.border}` }}
        >
          <h2
            className="font-bold"
            style={{
              fontSize: typography.h1.size,
              letterSpacing: typography.h1.tracking,
              color: t.text,
            }}
          >
            {isEditMode ? 'Edit Category' : 'New Category'}
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
          {/* Name */}
          <div>
            <label
              className="block mb-1.5"
              style={{
                fontSize: typography.label.size,
                fontWeight:600,
                color: t.text,
              }}
            >
              Category Name
            </label>
            <input
              type="text"
              {...register('name', { required: 'Category name is required' })}
              placeholder="e.g. Travel, Meals, Equipment"
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

          {/* Monthly Limit */}
          <div>
            <label
              className="block mb-1.5"
              style={{
                fontSize: typography.label.size,
                fontWeight: 600,
                color: t.text,
              }}
            >
              Monthly Limit (Optional)
            </label>
            <div className="flex gap-2">
              <select
                {...register('currency_code')}
                className="px-3 py-2.5 text-sm focus:outline-none focus:ring-2"
                style={{
                  background: t.input,
                  border: `1px solid ${t.inputBorder}`,
                  borderRadius: 10,
                  color: t.text,
                  width: 100,
                }}
              >
                <option value="IDR">IDR</option>
                <option value="AED">AED</option>
                <option value="MYR">MYR</option>
                <option value="SGD">SGD</option>
              </select>
              <input
                type="text"
                value={displayLimit}
                onChange={handleLimitChange}
                placeholder="0"
                className="flex-1 px-3 py-2.5 text-sm focus:outline-none focus:ring-2"
                style={{
                  background: t.input,
                  border: `1px solid ${t.inputBorder}`,
                  borderRadius: 10,
                  color: t.text,
                  caretColor: t.accent,
                }}
              />
            </div>
            <p className="text-xs mt-1" style={{ color: t.textMuted }}>
              Leave empty for no limit. Amount is per employee per month.
            </p>
          </div>

          {/* Requires Receipt */}
          <div className="flex items-center gap-3 pt-2">
            <input
              id="requires-receipt"
              type="checkbox"
              {...register('requires_receipt')}
              className="w-5 h-5 rounded transition-colors cursor-pointer"
              style={{
                accentColor: t.accent,
              }}
            />
            <label
              htmlFor="requires-receipt"
              className="cursor-pointer select-none"
              style={{
                fontSize: typography.body.size,
                color: t.text,
              }}
            >
              Require receipt attachment
            </label>
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
                  : 'Failed to save category. Please try again.'}
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
                  : 'Create Category'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
