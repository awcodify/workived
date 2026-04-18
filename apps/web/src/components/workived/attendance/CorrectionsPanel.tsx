import { useState } from 'react'
import { useCorrections, useApproveCorrection, useRejectCorrection } from '@/lib/hooks/useAttendance'
import { moduleThemes, colors } from '@/design/tokens'
import { X, Check, XCircle, Clock } from 'lucide-react'
import type { AttendanceCorrection } from '@/types/api'

const t = moduleThemes.attendance

interface CorrectionsPanelProps {
  onClose: () => void
}

export function CorrectionsPanel({ onClose }: CorrectionsPanelProps) {
  const [statusFilter, setStatusFilter] = useState<string | undefined>(undefined)
  const { data: corrections = [], isLoading } = useCorrections(statusFilter)

  return (
    <div
      data-testid="corrections-panel"
      className="fixed inset-0 z-50 flex items-end md:items-center justify-center p-0 md:p-4"
      style={{ background: 'rgba(0,0,0,0.5)' }}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        className="w-full md:max-w-2xl rounded-t-2xl md:rounded-2xl shadow-xl max-h-[90vh] flex flex-col"
        style={{ background: t.surface, border: `1px solid ${t.border}` }}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between px-6 py-4 flex-shrink-0"
          style={{ borderBottom: `1px solid ${t.border}` }}
        >
          <h2 className="font-bold text-base" style={{ color: t.text }}>Attendance Corrections</h2>
          <button
            data-testid="corrections-panel-close-btn"
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-black/5 transition-all"
            style={{ color: t.textMuted }}
          >
            <X size={18} />
          </button>
        </div>

        {/* Filter tabs */}
        <div
          className="flex items-center gap-1 px-4 py-3 flex-shrink-0"
          style={{ borderBottom: `1px solid ${t.border}` }}
        >
          {([undefined, 'pending', 'approved', 'rejected'] as const).map((status) => (
            <button
              key={status ?? 'all'}
              data-testid={`corrections-filter-${status ?? 'all'}-btn`}
              onClick={() => setStatusFilter(status)}
              className="px-3 py-1.5 rounded-lg text-xs font-bold transition-all"
              style={{
                background: statusFilter === status ? t.accent : 'transparent',
                color: statusFilter === status ? t.accentText : t.textMuted,
              }}
            >
              {status === undefined ? 'All' : status.charAt(0).toUpperCase() + status.slice(1)}
            </button>
          ))}
        </div>

        {/* List */}
        <div className="flex-1 overflow-y-auto">
          {isLoading ? (
            <div data-testid="corrections-skeleton" className="px-6 py-8 text-center">
              <p className="text-sm" style={{ color: t.textMuted }}>Loading…</p>
            </div>
          ) : corrections.length === 0 ? (
            <div data-testid="corrections-empty" className="px-6 py-10 text-center">
              <Clock size={32} className="mx-auto mb-3" style={{ color: t.textMuted, opacity: 0.4 }} />
              <p className="text-sm font-bold" style={{ color: t.textMuted }}>No corrections found</p>
            </div>
          ) : (
            corrections.map((c) => (
              <CorrectionRow key={c.id} correction={c} />
            ))
          )}
        </div>
      </div>
    </div>
  )
}

function CorrectionRow({ correction: c }: { correction: AttendanceCorrection }) {
  const { mutate: approve, isPending: approving } = useApproveCorrection()
  const { mutate: reject, isPending: rejecting } = useRejectCorrection()
  const [showRejectInput, setShowRejectInput] = useState(false)
  const [rejectionReason, setRejectionReason] = useState('')

  const isPending = c.status === 'pending'

  const statusColor = {
    pending: '#F59E0B',
    approved: '#10B981',
    rejected: '#EF4444',
  }[c.status]

  const fmtTime = (iso?: string) => {
    if (!iso) return '—'
    return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  }

  return (
    <div
      data-testid={`correction-row-${c.id}`}
      className="px-6 py-5"
      style={{ borderBottom: `1px solid ${t.border}` }}
    >
      {/* Top row: name + status */}
      <div className="flex items-start justify-between mb-3">
        <div>
          <p className="text-sm font-bold" style={{ color: t.text }}>{c.employee_name}</p>
          <p className="text-xs mt-0.5" style={{ color: t.textMuted }}>{c.date}</p>
        </div>
        <span
          className="text-[10px] font-bold uppercase px-2 py-1 rounded-full"
          style={{ background: `${statusColor}18`, color: statusColor }}
        >
          {c.status}
        </span>
      </div>

      {/* Before / After times */}
      <div className="grid grid-cols-2 gap-3 mb-3">
        <div
          className="rounded-xl p-3"
          style={{ background: '#F9FAFB', border: '1px solid #E5E7EB' }}
        >
          <p className="text-[10px] font-bold uppercase mb-1" style={{ color: t.textMuted }}>Original</p>
          <p className="text-xs font-bold" style={{ color: t.text }}>
            In: {fmtTime(c.original_clock_in)} · Out: {fmtTime(c.original_clock_out)}
          </p>
        </div>
        <div
          className="rounded-xl p-3"
          style={{ background: '#F0FDF4', border: '1px solid #D1FAE5' }}
        >
          <p className="text-[10px] font-bold uppercase mb-1" style={{ color: '#10B981', opacity: 0.7 }}>Requested</p>
          <p className="text-xs font-bold" style={{ color: '#065F46' }}>
            In: {fmtTime(c.requested_clock_in)} · Out: {fmtTime(c.requested_clock_out)}
          </p>
        </div>
      </div>

      {/* Reason */}
      <p className="text-xs mb-3 italic" style={{ color: t.textMuted }}>&ldquo;{c.reason}&rdquo;</p>

      {/* Rejection reason if rejected */}
      {c.status === 'rejected' && c.rejection_reason && (
        <p className="text-xs mb-3 px-3 py-2 rounded-lg" style={{ background: '#FEF2F2', color: '#991B1B' }}>
          Rejected: {c.rejection_reason}
        </p>
      )}

      {/* Actions (pending only) */}
      {isPending && !showRejectInput && (
        <div className="flex gap-2">
          <button
            data-testid={`correction-approve-btn-${c.id}`}
            onClick={() => approve(c.id)}
            disabled={approving}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold transition-all disabled:opacity-50"
            style={{ background: '#DCFCE7', color: '#065F46' }}
          >
            <Check size={14} />
            Approve
          </button>
          <button
            data-testid={`correction-reject-btn-${c.id}`}
            onClick={() => setShowRejectInput(true)}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold transition-all"
            style={{ background: '#FEE2E2', color: '#991B1B' }}
          >
            <XCircle size={14} />
            Reject
          </button>
        </div>
      )}

      {/* Reject input */}
      {isPending && showRejectInput && (
        <div className="space-y-2">
          <textarea
            data-testid={`correction-reject-reason-input-${c.id}`}
            value={rejectionReason}
            onChange={(e) => setRejectionReason(e.target.value)}
            rows={2}
            placeholder="Rejection reason (optional)"
            className="w-full px-3 py-2 rounded-xl text-xs resize-none outline-none"
            style={{ background: '#F9FAFB', border: '1px solid #E5E7EB', color: t.text }}
          />
          <div className="flex gap-2">
            <button
              data-testid={`correction-reject-confirm-btn-${c.id}`}
              onClick={() => reject({ id: c.id, reason: rejectionReason || undefined })}
              disabled={rejecting}
              className="flex-1 py-2 rounded-xl text-xs font-bold transition-all disabled:opacity-50"
              style={{ background: '#FEE2E2', color: '#991B1B' }}
            >
              {rejecting ? 'Rejecting…' : 'Confirm Reject'}
            </button>
            <button
              onClick={() => setShowRejectInput(false)}
              className="px-4 py-2 rounded-xl text-xs font-bold"
              style={{ color: t.textMuted }}
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

