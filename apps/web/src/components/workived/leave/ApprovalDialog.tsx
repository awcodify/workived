import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { X } from 'lucide-react'
import { useApproveRequest, useRejectRequest } from '@/lib/hooks/useLeave'
import { approveSchema, rejectSchema } from '@/lib/validations/leave'
import { formatDateRange } from '@/lib/utils/leave'
import type { LeaveRequestWithDetails } from '@/types/api'
import { moduleThemes, typography } from '@/design/tokens'
import { useEffect } from 'react'

const t = moduleThemes.leave

interface ApprovalDialogProps {
  request: LeaveRequestWithDetails
  onClose: () => void
}

export function ApprovalDialog({ request, onClose }: ApprovalDialogProps) {
  const approveMutation = useApproveRequest()
  const rejectMutation = useRejectRequest()

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
      await approveMutation.mutateAsync({ id: request.id, note: data.note })
    } catch (error) {
      // Error handled by mutation
    }
  }

  const handleReject = async (data: { note: string }) => {
    try {
      await rejectMutation.mutateAsync({ id: request.id, note: data.note })
    } catch (error) {
      // Error handled by mutation
    }
  }

  const dateRange = formatDateRange(request.start_date, request.end_date, request.total_days)

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
            Review Leave Request
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
          {/* Request Details */}
          <div className="mb-5 space-y-2">
            <InfoRow label="Employee" value={request.employee_name} />
            <InfoRow label="Leave type" value={request.policy_name} />
            <InfoRow label="Dates" value={dateRange} />
            {request.reason && <InfoRow label="Reason" value={request.reason} />}
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
                background: '#12A05C', // ok
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
                background: '#D44040', // err
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

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start">
      <span
        className="w-24 flex-shrink-0"
        style={{
          fontSize: typography.label.size,
          color: '#72708A', // textMuted
        }}
      >
        {label}:
      </span>
      <span
        className="font-medium"
        style={{
          fontSize: typography.body.size,
          color: t.text,
        }}
      >
        {value}
      </span>
    </div>
  )
}
