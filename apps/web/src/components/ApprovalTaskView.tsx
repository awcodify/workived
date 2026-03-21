import { useState } from 'react'
import { ArrowLeft, Calendar, DollarSign, FileText, User, CheckCircle, XCircle } from 'lucide-react'
import { useClaim, useApproveClaim, useRejectClaim } from '@/lib/hooks/useClaims'
import { useLeaveRequest, useApproveRequest, useRejectRequest } from '@/lib/hooks/useLeave'
import { useMoveTask, useTaskLists } from '@/lib/hooks/useTasks'
import { moduleThemes } from '@/design/tokens'
import type { Task } from '@/types/api'

interface ApprovalTaskViewProps {
  task: Task
  onClose: () => void
}

export function ApprovalTaskView({ task, onClose }: ApprovalTaskViewProps) {
  const approvalType = task.approval_type
  const approvalId = task.approval_id

  if (!approvalType || !approvalId) {
    return <div>No approval data</div>
  }

  if (approvalType === 'leave') {
    return <LeaveApprovalView task={task} approvalId={approvalId} onClose={onClose} />
  }

  if (approvalType === 'claim') {
    return <ClaimApprovalView task={task} approvalId={approvalId} onClose={onClose} />
  }

  return <div>Unknown approval type</div>
}

// ── Leave Approval View ──────────────────────────────────────
interface LeaveApprovalViewProps {
  task: Task
  approvalId: string
  onClose: () => void
}

function LeaveApprovalView({ task, approvalId, onClose }: LeaveApprovalViewProps) {
  const t = moduleThemes.leave
  const { data: request, isLoading } = useLeaveRequest(approvalId)
  const { data: taskLists = [] } = useTaskLists()
  const [showApproveModal, setShowApproveModal] = useState(false)
  const [showRejectModal, setShowRejectModal] = useState(false)
  const [rejectNote, setRejectNote] = useState('')

  const approveMutation = useApproveRequest()
  const rejectMutation = useRejectRequest()
  const moveMutation = useMoveTask()

  const handleApprove = async () => {
    try {
      // First approve the leave request
      await approveMutation.mutateAsync({ id: approvalId })
      
      // Then move the approval task to Done list (final state)
      const doneList = taskLists.find(list => list.is_final_state)
      if (doneList) {
        // Get max position in Done list to place at end
        await moveMutation.mutateAsync({
          id: task.id,
          data: {
            task_list_id: doneList.id,
            position: 999999, // Will be placed at end
          },
        })
      }
      
      setShowApproveModal(false)
      onClose()
    } catch (error) {
      console.error('Failed to approve leave:', error)
    }
  }

  const handleReject = async () => {
    if (!rejectNote.trim()) {
      alert('Please provide a reason for rejection')
      return
    }

    try {
      await rejectMutation.mutateAsync({ id: approvalId, note: rejectNote })
      setShowRejectModal(false)
      onClose()
    } catch (error) {
      console.error('Failed to reject leave:', error)
    }
  }

  return (
    <div className="p-6">
      <div className="mb-6">
        <button
          onClick={onClose}
          className="flex items-center gap-2 mb-4 transition-opacity hover:opacity-70"
          style={{ color: '#64748B' }}
        >
          <ArrowLeft size={18} />
          <span className="text-sm font-medium">Back to Tasks</span>
        </button>

        <h2 className="text-2xl font-bold mb-2" style={{ color: t.text }}>
          Leave Request Approval
        </h2>
        <p className="text-sm" style={{ color: '#64748B' }}>
          Review and approve or reject this leave request.
        </p>
      </div>

      {isLoading ? (
        <div className="p-6 rounded-lg mb-6" style={{ background: t.surface, border: `1px solid ${t.border}` }}>
          <p className="text-sm" style={{ color: '#64748B' }}>Loading leave details...</p>
        </div>
      ) : !request ? (
        <div className="p-6 rounded-lg mb-6" style={{ background: t.surface, border: `1px solid ${t.border}` }}>
          <p className="text-sm" style={{ color: '#EF4444' }}>Leave request not found</p>
        </div>
      ) : (
        <div className="p-6 rounded-lg mb-6" style={{ background: t.surface, border: `1px solid ${t.border}` }}>
          <div className="space-y-4">
            <div>
              <p className="text-xs font-semibold uppercase mb-1" style={{ color: '#64748B' }}>Employee</p>
              <p className="text-sm font-semibold" style={{ color: t.text }}>{request.employee_name}</p>
            </div>
            <div>
              <p className="text-xs font-semibold uppercase mb-1" style={{ color: '#64748B' }}>Leave Type</p>
              <p className="text-sm font-semibold" style={{ color: t.text }}>{request.policy_name}</p>
            </div>
            <div>
              <p className="text-xs font-semibold uppercase mb-1" style={{ color: '#64748B' }}>Dates</p>
              <p className="text-sm font-semibold" style={{ color: t.text }}>
                {new Date(request.start_date).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })} — {new Date(request.end_date).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}
              </p>
              <p className="text-xs mt-1" style={{ color: '#64748B' }}>{request.total_days} day(s)</p>
            </div>
            {request.reason && (
              <div>
                <p className="text-xs font-semibold uppercase mb-1" style={{ color: '#64748B' }}>Reason</p>
                <p className="text-sm" style={{ color: t.text }}>{request.reason}</p>
              </div>
            )}
            <div>
              <p className="text-xs font-semibold uppercase mb-1" style={{ color: '#64748B' }}>Status</p>
              <span className="text-xs font-bold uppercase px-2 py-1 rounded" style={{ 
                background: request.status === 'pending' ? '#F59E0B20' : request.status === 'approved' ? '#10B98120' : '#EF444420',
                color: request.status === 'pending' ? '#F59E0B' : request.status === 'approved' ? '#10B981' : '#EF4444'
              }}>
                {request.status}
              </span>
            </div>
          </div>
        </div>
      )}

      {request && request.status === 'pending' && (
        <div className="flex gap-3">
          <button
            onClick={() => setShowRejectModal(true)}
            className="flex-1 flex items-center justify-center gap-2 px-4 py-3 text-sm font-semibold transition-opacity hover:opacity-90"
            style={{
              background: '#EF4444',
              color: '#FFFFFF',
              borderRadius: 10,
            }}
          >
            <XCircle size={16} />
            Reject
          </button>
          <button
            onClick={() => setShowApproveModal(true)}
            className="flex-1 flex items-center justify-center gap-2 px-4 py-3 text-sm font-semibold transition-opacity hover:opacity-90"
            style={{
              background: t.accent,
              color: t.accentText,
              borderRadius: 10,
            }}
          >
            <CheckCircle size={16} />
            Approve
          </button>
        </div>
      )}

      {/* Approve Modal */}
      {showApproveModal && (
        <ApprovalModal
          title="Approve Leave Request"
          confirmText="Approve"
          confirmColor="#10B981"
          onConfirm={handleApprove}
          onCancel={() => setShowApproveModal(false)}
          isPending={approveMutation.isPending}
        />
      )}

      {/* Reject Modal */}
      {showRejectModal && (
        <ApprovalModal
          title="Reject Leave Request"
          confirmText="Reject"
          confirmColor="#EF4444"
          requireNote
          note={rejectNote}
          onNoteChange={setRejectNote}
          onConfirm={handleReject}
          onCancel={() => setShowRejectModal(false)}
          isPending={rejectMutation.isPending}
        />
      )}
    </div>
  )
}

// ── Claim Approval View ──────────────────────────────────────
interface ClaimApprovalViewProps {
  task: Task
  approvalId: string
  onClose: () => void
}

function ClaimApprovalView({ task, approvalId, onClose }: ClaimApprovalViewProps) {
  const t = moduleThemes.claims
  const { data: claim, isLoading } = useClaim(approvalId)
  const { data: taskLists = [] } = useTaskLists()
  const approveMutation = useApproveClaim()
  const rejectMutation = useRejectClaim()
  const moveMutation = useMoveTask()

  const [showApproveModal, setShowApproveModal] = useState(false)
  const [showRejectModal, setShowRejectModal] = useState(false)
  const [rejectNote, setRejectNote] = useState('')

  const handleApprove = async () => {
    try {
      // First approve the claim
      await approveMutation.mutateAsync({ id: approvalId })
      
      // Then move the approval task to Done list (final state)
      const doneList = taskLists.find(list => list.is_final_state)
      if (doneList) {
        await moveMutation.mutateAsync({
          id: task.id,
          data: {
            task_list_id: doneList.id,
            position: 999999, // Will be placed at end
          },
        })
      }
      
      setShowApproveModal(false)
      onClose()
    } catch (error) {
      console.error('Failed to approve claim:', error)
    }
  }

  const handleReject = async () => {
    if (!rejectNote.trim()) {
      alert('Please provide a reason for rejection')
      return
    }

    try {
      await rejectMutation.mutateAsync({
        id: approvalId,
        data: { review_note: rejectNote },
      })
      setShowRejectModal(false)
      onClose()
    } catch (error) {
      console.error('Failed to reject claim:', error)
    }
  }

  if (isLoading) {
    return (
      <div className="p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-gray-200 rounded w-1/3" />
          <div className="h-20 bg-gray-200 rounded" />
          <div className="h-12 bg-gray-200 rounded" />
        </div>
      </div>
    )
  }

  if (!claim) {
    return (
      <div className="p-6">
        <p className="text-sm" style={{ color: '#64748B' }}>
          Claim not found
        </p>
      </div>
    )
  }

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('en-GB', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    })
  }

  const statusColor = {
    pending: '#F59E0B',
    approved: '#10B981',
    rejected: '#EF4444',
    cancelled: '#6B7280',
  }[claim.status] || '#6B7280'

  const isPending = claim.status === 'pending'

  return (
    <div className="p-6">
      <div className="mb-6">
        <button
          onClick={onClose}
          className="flex items-center gap-2 mb-4 transition-opacity hover:opacity-70"
          style={{ color: '#64748B' }}
        >
          <ArrowLeft size={18} />
          <span className="text-sm font-medium">Back to Tasks</span>
        </button>

        <div className="flex items-start justify-between">
          <div>
            <h2 className="text-2xl font-bold mb-2" style={{ color: t.text }}>
              Claim Approval
            </h2>
            <div className="flex items-center gap-2">
              <span
                className="text-xs font-bold uppercase px-2.5 py-1"
                style={{
                  background: `${statusColor}20`,
                  color: statusColor,
                  borderRadius: 6,
                }}
              >
                {claim.status}
              </span>
              <span className="text-xs" style={{ color: '#64748B' }}>
                #{claim.id.slice(0, 8)}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Claim Details */}
      <div
        className="p-6 rounded-lg mb-6"
        style={{
          background: t.surface,
          border: `1px solid ${t.border}`,
        }}
      >
        <div className="space-y-4">
          {/* Employee */}
          <div className="flex items-start gap-3">
            <User size={18} style={{ color: t.accent, marginTop: 2 }} />
            <div>
              <p className="text-xs font-semibold uppercase" style={{ color: '#64748B' }}>
                Employee
              </p>
              <p className="text-sm font-semibold mt-1" style={{ color: t.text }}>
                {claim.employee_name}
              </p>
            </div>
          </div>

          {/* Category */}
          <div className="flex items-start gap-3">
            <FileText size={18} style={{ color: t.accent, marginTop: 2 }} />
            <div>
              <p className="text-xs font-semibold uppercase" style={{ color: '#64748B' }}>
                Category
              </p>
              <p className="text-sm font-semibold mt-1" style={{ color: t.text }}>
                {claim.category_name}
              </p>
            </div>
          </div>

          {/* Amount */}
          <div className="flex items-start gap-3">
            <DollarSign size={18} style={{ color: t.accent, marginTop: 2 }} />
            <div>
              <p className="text-xs font-semibold uppercase" style={{ color: '#64748B' }}>
                Amount
              </p>
              <p className="text-lg font-bold mt-1" style={{ color: t.text }}>
                {claim.currency_code} {new Intl.NumberFormat('id-ID').format(claim.amount)}
              </p>
            </div>
          </div>

          {/* Date */}
          <div className="flex items-start gap-3">
            <Calendar size={18} style={{ color: t.accent, marginTop: 2 }} />
            <div>
              <p className="text-xs font-semibold uppercase" style={{ color: '#64748B' }}>
                Claim Date
              </p>
              <p className="text-sm font-semibold mt-1" style={{ color: t.text }}>
                {formatDate(claim.claim_date)}
              </p>
            </div>
          </div>

          {/* Description */}
          {claim.description && (
            <div>
              <p className="text-xs font-semibold uppercase mb-2" style={{ color: '#64748B' }}>
                Description
              </p>
              <p className="text-sm leading-relaxed" style={{ color: t.text }}>
                {claim.description}
              </p>
            </div>
          )}

          {/* Receipt */}
          {claim.receipt_url && (
            <div>
              <p className="text-xs font-semibold uppercase mb-2" style={{ color: '#64748B' }}>
                Receipt
              </p>
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
          )}
        </div>
      </div>

      {/* Action Buttons (only for pending) */}
      {isPending && (
        <div className="flex gap-3">
          <button
            onClick={() => setShowRejectModal(true)}
            className="flex-1 flex items-center justify-center gap-2 px-4 py-3 text-sm font-semibold transition-opacity hover:opacity-90"
            style={{
              background: '#EF4444',
              color: '#FFFFFF',
              borderRadius: 10,
            }}
          >
            <XCircle size={16} />
            Reject
          </button>
          <button
            onClick={() => setShowApproveModal(true)}
            className="flex-1 flex items-center justify-center gap-2 px-4 py-3 text-sm font-semibold transition-opacity hover:opacity-90"
            style={{
              background: t.accent,
              color: t.accentText,
              borderRadius: 10,
            }}
          >
            <CheckCircle size={16} />
            Approve
          </button>
        </div>
      )}

      {/* Approve Modal */}
      {showApproveModal && (
        <ApprovalModal
          title="Approve Claim"
          confirmText="Approve"
          confirmColor="#10B981"
          onConfirm={handleApprove}
          onCancel={() => setShowApproveModal(false)}
          isPending={approveMutation.isPending}
        />
      )}

      {/* Reject Modal */}
      {showRejectModal && (
        <ApprovalModal
          title="Reject Claim"
          confirmText="Reject"
          confirmColor="#EF4444"
          requireNote
          note={rejectNote}
          onNoteChange={setRejectNote}
          onConfirm={handleReject}
          onCancel={() => setShowRejectModal(false)}
          isPending={rejectMutation.isPending}
        />
      )}
    </div>
  )
}

// ── Generic Approval Modal ───────────────────────────────────
interface ApprovalModalProps {
  title: string
  confirmText: string
  confirmColor: string
  requireNote?: boolean
  note?: string
  onNoteChange?: (note: string) => void
  onConfirm: () => void
  onCancel: () => void
  isPending: boolean
}

function ApprovalModal({
  title,
  confirmText,
  confirmColor,
  requireNote = false,
  note = '',
  onNoteChange,
  onConfirm,
  onCancel,
  isPending,
}: ApprovalModalProps) {
  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-50"
        style={{ background: 'rgba(0, 0, 0, 0.5)' }}
        onClick={onCancel}
      />

      {/* Modal */}
      <div
        className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-50 w-full max-w-md p-6"
        style={{
          background: '#FFFFFF',
          borderRadius: 16,
          boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="text-xl font-bold mb-4" style={{ color: '#1E293B' }}>
          {title}
        </h3>

        {requireNote && onNoteChange && (
          <div className="mb-4">
            <label className="block text-sm font-semibold mb-2" style={{ color: '#64748B' }}>
              Reason {requireNote ? '(required)' : '(optional)'}
            </label>
            <textarea
              value={note}
              onChange={(e) => onNoteChange(e.target.value)}
              rows={3}
              className="w-full px-3 py-2 text-sm border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Enter reason..."
            />
          </div>
        )}

        <p className="text-sm mb-6" style={{ color: '#64748B' }}>
          {requireNote
            ? 'Please provide a reason for rejection.'
            : 'Are you sure you want to proceed?'}
        </p>

        <div className="flex gap-3">
          <button
            onClick={onCancel}
            disabled={isPending}
            className="flex-1 px-4 py-2.5 text-sm font-semibold rounded-lg transition-opacity hover:opacity-90 disabled:opacity-50"
            style={{
              background: '#E2E8F0',
              color: '#475569',
            }}
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={isPending || (requireNote && !note.trim())}
            className="flex-1 px-4 py-2.5 text-sm font-semibold rounded-lg transition-opacity hover:opacity-90 disabled:opacity-50"
            style={{
              background: confirmColor,
              color: '#FFFFFF',
            }}
          >
            {isPending ? 'Processing...' : confirmText}
          </button>
        </div>
      </div>
    </>
  )
}
