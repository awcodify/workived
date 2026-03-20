import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { X, DollarSign, FileText, Calendar } from 'lucide-react'
import { useApproveClaim, useRejectClaim } from '@/lib/hooks/useClaims'
import { z } from 'zod'
import type { ClaimWithDetails } from '@/types/api'
import { moduleThemes, typography } from '@/design/tokens'
import { useEffect } from 'react'

const t = moduleThemes.claims

const approveSchema = z.object({
  note: z.string().optional(),
})

const rejectSchema = z.object({
  note: z.string().min(10, 'Rejection reason is required (minimum 10 characters)'),
})

interface ClaimApprovalDialogProps {
  claim: ClaimWithDetails
  onClose: () => void
}

export function ClaimApprovalDialog({ claim, onClose }: ClaimApprovalDialogProps) {
  const approveMutation = useApproveClaim()
  const rejectMutation = useRejectClaim()

  const approveForm = useForm({
    resolver: zodResolver(approveSchema),
  })

  const rejectForm = useForm({
    resolver: zodResolver(rejectSchema),
  })

  // Close dialog on successful mutation
  useEffect(() => {
    if (approveMutation.isSuccess || rejectMutation.isSuccess) {
      onClose()
    }
  }, [approveMutation.isSuccess, rejectMutation.isSuccess, onClose])

  const handleApprove = async (data: { note?: string }) => {
    try {
      await approveMutation.mutateAsync({ 
        id: claim.id, 
        data: data.note ? { review_note: data.note } : undefined 
      })
    } catch (error) {
      // Error handled by mutation
    }
  }

  const handleReject = async (data: { note: string }) => {
    try {
      await rejectMutation.mutateAsync({ 
        id: claim.id, 
        data: { review_note: data.note } 
      })
    } catch (error) {
      // Error handled by mutation
    }
  }

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('en-GB', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    })
  }

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-40"
        style={{ background: 'rgba(0, 0, 0, 0.4)' }}
        onClick={onClose}
      />

      {/* Dialog */}
      <div
        className="fixed inset-x-4 md:inset-x-auto md:left-1/2 md:-translate-x-1/2 top-1/2 -translate-y-1/2 z-50 max-w-lg w-full"
        style={{
          background: t.surface,
          borderRadius: 18,
          boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
        }}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between p-6 pb-4"
          style={{ borderBottom: `1px solid ${t.border}` }}
        >
          <h2
            className="font-bold"
            style={{
              fontSize: typography.h2.size,
              letterSpacing: typography.h2.tracking,
              color: t.text,
            }}
          >
            Review Claim
          </h2>
          <button
            onClick={onClose}
            className="transition-opacity hover:opacity-70"
            style={{ color: t.textMuted }}
          >
            <X size={20} />
          </button>
        </div>

        {/* Content */}
        <div className="p-6">
          {/* Claim Details */}
          <div className="mb-5 space-y-3">
            <InfoRow 
              icon={<FileText size={18} style={{ color: t.accent }} />}
              label="Employee" 
              value={claim.employee_name} 
            />
            <InfoRow 
              icon={<FileText size={18} style={{ color: t.accent }} />}
              label="Category" 
              value={claim.category_name} 
            />
            <InfoRow 
              icon={<DollarSign size={18} style={{ color: t.accent }} />}
              label="Amount" 
              value={`${claim.currency_code} ${new Intl.NumberFormat('id-ID').format(claim.amount)}`} 
            />
            <InfoRow 
              icon={<Calendar size={18} style={{ color: t.accent }} />}
              label="Date" 
              value={formatDate(claim.claim_date)} 
            />
            {claim.description && (
              <InfoRow 
                icon={<FileText size={18} style={{ color: t.accent }} />}
                label="Description" 
                value={claim.description} 
              />
            )}
            {claim.receipt_url && (
              <div className="flex items-start gap-2">
                <FileText size={18} style={{ color: t.accent, marginTop: 2 }} />
                <div className="flex-1">
                  <span className="block text-xs font-semibold mb-1" style={{ color: t.textMuted }}>
                    Receipt
                  </span>
                  <a
                    href={claim.receipt_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm font-semibold hover:underline"
                    style={{ color: t.accent }}
                  >
                    View Receipt →
                  </a>
                </div>
              </div>
            )}
          </div>

          {/* Note Input (shared for both approve/reject) */}
          <div className="mb-5">
            <label
              htmlFor="note"
              className="block mb-2"
              style={{
                fontSize: typography.label.size,
                fontWeight: typography.label.weight,
                color: t.text,
              }}
            >
              Note (optional for approval, required for rejection)
            </label>
            <textarea
              id="note"
              {...approveForm.register('note')}
              rows={2}
              className="w-full px-3 py-2.5 text-sm focus:outline-none focus:ring-2 resize-none"
              style={{
                background: t.input,
                border: `1px solid ${t.inputBorder}`,
                borderRadius: 10,
                color: t.text,
              }}
              placeholder="Add a note..."
            />
            {(approveForm.formState.errors.note || rejectForm.formState.errors.note) && (
              <p className="text-xs mt-1" style={{ color: '#D44040' }}>
                {approveForm.formState.errors.note?.message || rejectForm.formState.errors.note?.message}
              </p>
            )}
          </div>

          {/* Actions */}
          <div className="flex items-center gap-3">
            <button
              onClick={() => {
                const note = approveForm.getValues('note')
                handleApprove({ note })
              }}
              disabled={approveMutation.isPending || rejectMutation.isPending}
              className="flex-1 font-semibold px-5 py-3 transition-opacity hover:opacity-90 disabled:opacity-50"
              style={{
                background: '#12A05C',
                color: '#FFFFFF',
                borderRadius: 10,
                fontSize: typography.body.size,
              }}
            >
              {approveMutation.isPending ? 'Approving...' : 'Approve'}
            </button>
            <button
              onClick={() => {
                const note = approveForm.getValues('note')
                if (!note || note.length < 10) {
                  rejectForm.setError('note', {
                    message: 'Rejection reason is required (minimum 10 characters)',
                  })
                  return
                }
                handleReject({ note })
              }}
              disabled={approveMutation.isPending || rejectMutation.isPending}
              className="flex-1 font-semibold px-5 py-3 transition-opacity hover:opacity-90 disabled:opacity-50"
              style={{
                background: '#D44040',
                color: '#FFFFFF',
                borderRadius: 10,
                fontSize: typography.body.size,
              }}
            >
              {rejectMutation.isPending ? 'Rejecting...' : 'Reject'}
            </button>
          </div>

          {/* Cancel */}
          <button
            onClick={onClose}
            disabled={approveMutation.isPending || rejectMutation.isPending}
            className="w-full mt-3 font-semibold py-2 transition-opacity hover:opacity-70"
            style={{ color: t.textMuted, fontSize: typography.body.size }}
          >
            Cancel
          </button>
        </div>
      </div>
    </>
  )
}

function InfoRow({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="flex items-start gap-2">
      {icon}
      <div className="flex-1">
        <span className="block text-xs font-semibold mb-0.5" style={{ color: t.textMuted }}>
          {label}
        </span>
        <span className="block text-sm" style={{ color: t.text }}>
          {value}
        </span>
      </div>
    </div>
  )
}
