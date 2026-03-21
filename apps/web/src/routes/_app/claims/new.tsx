import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useForm } from 'react-hook-form'
import { useState, useEffect } from 'react'
import { ArrowLeft, Upload, X } from 'lucide-react'
import { useSubmitClaim, useCategories } from '@/lib/hooks/useClaims'
import { useOrganisation } from '@/lib/hooks/useOrganisation'
import { moduleBackgrounds, moduleThemes, typography } from '@/design/tokens'

const t = moduleThemes.claims

type ClaimSearchParams = {
  categoryId?: string
}

export const Route = createFileRoute('/_app/claims/new')({
  component: NewClaimPage,
  validateSearch: (search: Record<string, unknown>): ClaimSearchParams => ({
    categoryId: (search.categoryId as string) || undefined,
  }),
})

interface ClaimFormData {
  category_id: string
  amount: string
  description: string
  claim_date: string
}

function NewClaimPage() {
  const navigate = useNavigate()
  const { categoryId: prefilledCategoryId } = Route.useSearch()
  const { data: org } = useOrganisation()
  const { data: categories } = useCategories()
  const submitMutation = useSubmitClaim()

  const [receipt, setReceipt] = useState<File | null>(null)
  const [receiptPreview, setReceiptPreview] = useState<string | null>(null)

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors },
  } = useForm<ClaimFormData>({
    defaultValues: {
      category_id: prefilledCategoryId || '',
      claim_date: new Date().toISOString().split('T')[0], // Today
    },
  })

  const categoryId = watch('category_id')
  const selectedCategory = categories?.find((c) => c.id === categoryId)

  // Set category when prefilled and categories are loaded, or auto-select first category
  useEffect(() => {
    if (prefilledCategoryId && categories && categories.length > 0) {
      // Only set if the category exists and is active
      const categoryExists = categories.find(
        (c) => c.id === prefilledCategoryId && c.is_active
      )
      if (categoryExists) {
        setValue('category_id', prefilledCategoryId)
      }
    } else if (categories && categories.length > 0 && !watch('category_id')) {
      // Auto-select first active category if none prefilled
      const firstActiveCategory = categories.find((c) => c.is_active)
      if (firstActiveCategory) {
        setValue('category_id', firstActiveCategory.id)
      }
    }
  }, [prefilledCategoryId, categories, setValue, watch])

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    // Validate file type
    const allowedTypes = ['image/jpeg', 'image/png', 'application/pdf']
    if (!allowedTypes.includes(file.type)) {
      alert('Only JPG, PNG, and PDF files are allowed')
      return
    }

    // Validate file size (10MB max)
    if (file.size > 10 * 1024 * 1024) {
      alert('File size must be less than 10MB')
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
  }

  const onSubmit = async (data: ClaimFormData) => {
    if (!org) return

    // Check if receipt is required
    if (selectedCategory?.requires_receipt && !receipt) {
      alert('Receipt is required for this category')
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
      navigate({ to: '/claims' })
    } catch (error) {
      // Error handled by mutation
      console.error('Submit claim error:', error)
    }
  }

  return (
    <div
      className="min-h-screen px-6 py-8 md:px-11 md:py-10 pb-28"
      style={{ background: moduleBackgrounds.claims }}
    >
      {/* Header */}
      <div className="mb-6">
        <button
          onClick={() => navigate({ to: '/claims' })}
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
          Submit Claim
        </h1>
      </div>

      {/* API Error Display */}
      {submitMutation.error && (
        <div
          className="mb-6 p-4"
          style={{
            background: (submitMutation.error as any)?.response?.data?.error?.code === 'INSUFFICIENT_CLAIM_BUDGET' 
              ? '#FEF3E2' 
              : '#FDF2E3',
            border: (submitMutation.error as any)?.response?.data?.error?.code === 'INSUFFICIENT_CLAIM_BUDGET'
              ? '1px solid #F59E0B'
              : '1px solid #C97B2A',
            borderRadius: 14,
          }}
        >
          <p className="text-sm font-semibold" style={{ color: '#A0601A' }}>
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
            })()}
          </p>
          <p className="text-xs mt-1 whitespace-pre-line" style={{ color: '#72708A' }}>
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
          {/* Category */}
          <div className="mb-5">
            <label
              htmlFor="category_id"
              className="block mb-2"
              style={{
                fontSize: typography.label.size,
                fontWeight: typography.label.weight,
                color: t.text,
              }}
            >
              Category *
            </label>
            <select
              id="category_id"
              {...register('category_id', { required: 'Please select a category' })}
              disabled={!!prefilledCategoryId}
              className="w-full px-3 py-2.5 text-sm focus:outline-none focus:ring-2 disabled:opacity-60 disabled:cursor-not-allowed"
              style={{
                background: t.input,
                border: errors.category_id ? '2px solid #D44040' : `1px solid ${t.inputBorder}`,
                borderRadius: 10,
                color: t.text,
              }}
            >
              <option value="">Select category</option>
              {categories
                ?.filter((c) => c.is_active)
                .map((cat) => (
                  <option key={cat.id} value={cat.id}>
                    {cat.name}
                  </option>
                ))}
            </select>
            {errors.category_id && (
              <p className="text-xs mt-1" style={{ color: '#D44040' }}>
                {errors.category_id.message}
              </p>
            )}
            {selectedCategory?.requires_receipt && (
              <p className="text-xs mt-1" style={{ color: t.textMuted }}>
                Receipt required for this category
              </p>
            )}
          </div>

          {/* Amount */}
          <div className="mb-5">
            <label
              htmlFor="amount"
              className="block mb-2"
              style={{
                fontSize: typography.label.size,
                fontWeight: typography.label.weight,
                color: t.text,
              }}
            >
              Amount ({org?.currency_code}) *
            </label>
            <input
              id="amount"
              type="number"
              step="1"
              min="1"
              {...register('amount', { 
                required: 'Amount is required', 
                min: { value: 1, message: 'Amount must be at least 1' },
                validate: (value) => parseInt(value) > 0 || 'Amount must be greater than zero'
              })}
              placeholder="0"
              className="w-full px-3 py-2.5 text-sm focus:outline-none focus:ring-2"
              style={{
                background: t.input,
                border: errors.amount ? '2px solid #D44040' : `1px solid ${t.inputBorder}`,
                borderRadius: 10,
                color: t.text,
              }}
            />
            {errors.amount && (
              <p className="text-xs mt-1" style={{ color: '#D44040' }}>
                {errors.amount.message}
              </p>
            )}
            <p className="text-xs mt-1" style={{ color: t.textMuted }}>
              Enter amount in smallest currency unit (e.g., cents for USD, rupiah for IDR)
            </p>
          </div>

          {/* Claim Date */}
          <div className="mb-5">
            <label
              htmlFor="claim_date"
              className="block mb-2"
              style={{
                fontSize: typography.label.size,
                fontWeight: typography.label.weight,
                color: t.text,
              }}
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
                border: errors.claim_date ? '2px solid #D44040' : `1px solid ${t.inputBorder}`,
                borderRadius: 10,
                color: t.text,
                colorScheme: 'dark',
              }}
            />
            {errors.claim_date && (
              <p className="text-xs mt-1" style={{ color: '#D44040' }}>
                {errors.claim_date.message}
              </p>
            )}
          </div>

          {/* Description */}
          <div className="mb-5">
            <label
              htmlFor="description"
              className="block mb-2"
              style={{
                fontSize: typography.label.size,
                fontWeight: typography.label.weight,
                color: t.text,
              }}
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
                border: errors.description ? '2px solid #D44040' : `1px solid ${t.inputBorder}`,
                borderRadius: 10,
                color: t.text,
              }}
            />
            {errors.description && (
              <p className="text-xs mt-1" style={{ color: '#D44040' }}>
                {errors.description.message}
              </p>
            )}
          </div>

          {/* Receipt Upload */}
          <div className="mb-6">
            <label
              className="block mb-2"
              style={{
                fontSize: typography.label.size,
                fontWeight: typography.label.weight,
                color: t.text,
              }}
            >
              Receipt {selectedCategory?.requires_receipt && '*'}
            </label>

            {!receipt ? (
              <label
                htmlFor="receipt-upload"
                className="flex flex-col items-center justify-center cursor-pointer transition-all"
                style={{
                  background: t.input,
                  border: `2px dashed ${t.inputBorder}`,
                  borderRadius: 10,
                  padding: '32px 20px',
                }}
              >
                <Upload size={32} style={{ color: t.textMuted, marginBottom: 8 }} />
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
                  padding: 16,
                }}
              >
                {receiptPreview && (
                  <img
                    src={receiptPreview}
                    alt="Receipt preview"
                    className="w-full h-48 object-contain mb-3"
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
                    style={{ color: '#D44040' }}
                  >
                    <X size={20} />
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Submit Button */}
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
        </div>
      </form>
    </div>
  )
}
