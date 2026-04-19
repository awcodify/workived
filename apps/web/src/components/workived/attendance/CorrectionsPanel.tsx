import { useState, useRef, useEffect } from 'react'
import { useCorrections, useApproveCorrection, useRejectCorrection, useCancelCorrection } from '@/lib/hooks/useAttendance'
import { useAttendanceRole } from '@/lib/hooks/useAttendanceRole'
import { moduleThemes, colors } from '@/design/tokens'
import { formatDate } from '@/lib/utils/date'
import { Check, X, Clock, ChevronDown, ChevronUp } from 'lucide-react'
import type { AttendanceCorrection } from '@/types/api'

const t = moduleThemes.attendance
const PREVIEW_LIMIT = 5
const MODAL_PAGE_SIZE = 10

type Group = { employeeId: string; employeeName: string; items: AttendanceCorrection[] }

function groupByEmployee(corrections: AttendanceCorrection[]): Group[] {
  const map = new Map<string, Group>()
  for (const c of corrections) {
    if (!map.has(c.employee_id)) {
      map.set(c.employee_id, { employeeId: c.employee_id, employeeName: c.employee_name, items: [] })
    }
    map.get(c.employee_id)!.items.push(c)
  }
  return Array.from(map.values())
}

// ── Main panel ────────────────────────────────────────────────────────────────

export function CorrectionsPanel({ tz = 'UTC' }: { tz?: string }) {
  const role = useAttendanceRole()
  const canReview = role.canViewTeam || role.canViewAll

  const [tab, setTab] = useState<'pending' | 'mine'>(canReview ? 'pending' : 'mine')
  const activeTab = canReview ? tab : 'mine'
  const [showAllModal, setShowAllModal] = useState(false)

  const { data: mineData = [], isLoading: mineLoading } = useCorrections(undefined, true)
  const { data: pendingData = [], isLoading: pendingLoading } = useCorrections('pending', false)

  const allGroups = groupByEmployee(pendingData)
  const pendingCount = pendingData.filter((c) => c.status === 'pending').length
  const isLoading = activeTab === 'mine' ? mineLoading : pendingLoading

  const previewGroups = allGroups.slice(0, PREVIEW_LIMIT)
  const previewMine = mineData.slice(0, PREVIEW_LIMIT)
  const hasMore = activeTab === 'pending' ? allGroups.length > PREVIEW_LIMIT : mineData.length > PREVIEW_LIMIT
  const totalCount = activeTab === 'pending' ? pendingData.length : mineData.length

  return (
    <>
      <div
        data-testid="corrections-panel"
        className="rounded-2xl overflow-hidden flex flex-col"
        style={{ background: t.surface, border: `1px solid ${t.border}` }}
      >
        {/* Header */}
        <div className="px-4 py-3" style={{ borderBottom: `1px solid ${t.border}` }}>
          <h3 className="text-xs font-bold uppercase tracking-wide" style={{ color: t.textMuted }}>
            Attendance Corrections
          </h3>
        </div>

        {/* Tabs */}
        {canReview && (
          <div className="flex items-center gap-1 px-3 py-2" style={{ borderBottom: `1px solid ${t.border}` }}>
            <button
              data-testid="corrections-tab-pending"
              onClick={() => setTab('pending')}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all"
              style={{
                background: tab === 'pending' ? t.accent : 'transparent',
                color: tab === 'pending' ? t.accentText : t.textMuted,
              }}
            >
              Need Review
              {pendingCount > 0 && (
                <span
                  className="text-[10px] font-black px-1.5 py-0.5 rounded-full"
                  style={{
                    background: tab === 'pending' ? 'rgba(255,255,255,0.25)' : colors.warnDim,
                    color: tab === 'pending' ? '#fff' : colors.warnText,
                  }}
                >
                  {pendingCount}
                </span>
              )}
            </button>
            <button
              data-testid="corrections-tab-mine"
              onClick={() => setTab('mine')}
              className="px-3 py-1.5 rounded-lg text-xs font-bold transition-all"
              style={{
                background: tab === 'mine' ? t.accent : 'transparent',
                color: tab === 'mine' ? t.accentText : t.textMuted,
              }}
            >
              My Requests
            </button>
          </div>
        )}

        {/* Body */}
        {isLoading ? (
          <div data-testid="corrections-skeleton" className="px-4 py-6 text-center">
            <p className="text-xs" style={{ color: t.textMuted }}>Loading…</p>
          </div>
        ) : activeTab === 'pending' && allGroups.length === 0 ? (
          <div data-testid="corrections-empty" className="px-4 py-6 text-center">
            <Clock size={24} className="mx-auto mb-2" style={{ color: t.textMuted, opacity: 0.4 }} />
            <p className="text-xs font-bold" style={{ color: t.textMuted }}>No pending corrections</p>
          </div>
        ) : activeTab === 'mine' && mineData.length === 0 ? (
          <div data-testid="corrections-empty" className="px-4 py-6 text-center">
            <Clock size={24} className="mx-auto mb-2" style={{ color: t.textMuted, opacity: 0.4 }} />
            <p className="text-xs font-bold" style={{ color: t.textMuted }}>No correction requests yet</p>
          </div>
        ) : activeTab === 'pending' ? (
          <>
            <div className="divide-y" style={{ borderColor: t.border }}>
              {previewGroups.map((g) => (
                <CorrectionGroup key={g.employeeId} group={g} tz={tz} />
              ))}
            </div>
            {hasMore && (
              <button
                data-testid="corrections-show-all-btn"
                onClick={() => setShowAllModal(true)}
                className="w-full px-4 py-2.5 text-xs font-bold text-center transition-all hover:opacity-70"
                style={{ color: t.accent, borderTop: `1px solid ${t.border}` }}
              >
                Show all {totalCount} requests
              </button>
            )}
          </>
        ) : (
          <>
            <div>
              {previewMine.map((c) => (
                <CorrectionMyRow key={c.id} correction={c} tz={tz} />
              ))}
            </div>
            {hasMore && (
              <button
                data-testid="corrections-show-all-btn"
                onClick={() => setShowAllModal(true)}
                className="w-full px-4 py-2.5 text-xs font-bold text-center transition-all hover:opacity-70"
                style={{ color: t.accent, borderTop: `1px solid ${t.border}` }}
              >
                Show all {totalCount} requests
              </button>
            )}
          </>
        )}
      </div>

      {showAllModal && (
        <AllCorrectionsModal
          pendingData={pendingData}
          mineData={mineData}
          activeTab={activeTab}
          tz={tz}
          onClose={() => setShowAllModal(false)}
        />
      )}
    </>
  )
}

// ── Grouped row (pending tab) ─────────────────────────────────────────────────

function CorrectionGroup({ group, tz }: { group: Group; tz: string }) {
  const [expanded, setExpanded] = useState(false)
  const [showRejectAll, setShowRejectAll] = useState(false)
  const [rejectReason, setRejectReason] = useState('')
  const [confirmApproveAll, setConfirmApproveAll] = useState(false)
  const timeoutRef = useRef<number | null>(null)

  const { mutate: approve, isPending: approving } = useApproveCorrection()
  const { mutate: reject, isPending: rejecting } = useRejectCorrection()

  useEffect(() => () => { if (timeoutRef.current) clearTimeout(timeoutRef.current) }, [])

  const handleApproveAll = () => {
    if (!confirmApproveAll) {
      setConfirmApproveAll(true)
      timeoutRef.current = setTimeout(() => setConfirmApproveAll(false), 3000) as unknown as number
      return
    }
    if (timeoutRef.current) clearTimeout(timeoutRef.current)
    setConfirmApproveAll(false)
    group.items.forEach((c) => approve(c.id))
  }

  const handleRejectAll = () => {
    group.items.forEach((c) => reject({ id: c.id, reason: rejectReason || undefined }))
    setShowRejectAll(false)
    setRejectReason('')
  }

  const slug = group.employeeName.replace(/\s+/g, '-').toLowerCase()

  return (
    <div data-testid={`correction-group-${group.employeeId}`}>
      {/* Group header */}
      <div className="flex items-center gap-2 px-3 py-2.5">
        <div
          data-testid={`correction-group-toggle-${slug}`}
          className="flex-1 min-w-0 cursor-pointer"
          onClick={() => setExpanded((v) => !v)}
        >
          <div className="flex items-center gap-1.5">
            <p className="text-xs font-bold" style={{ color: t.text }}>{group.employeeName}</p>
            <span
              className="text-[10px] font-bold px-1.5 py-0.5 rounded"
              style={{ background: colors.ink100, color: colors.ink500 }}
            >
              {group.items.length}
            </span>
          </div>
          {group.items.length > 1 && (
            <p className="text-[11px]" style={{ color: t.textMuted }}>
              {group.items.length} corrections · click to review
            </p>
          )}
        </div>

        {!showRejectAll && (
          <div className="flex items-center gap-1 flex-shrink-0">
            <button
              data-testid={`correction-group-approve-btn-${slug}`}
              onClick={handleApproveAll}
              disabled={approving}
              title={confirmApproveAll ? 'Click again to confirm' : 'Approve all'}
              className="flex items-center justify-center transition-all hover:scale-110 disabled:opacity-50"
              style={{
                width: confirmApproveAll ? 'auto' : 28,
                minWidth: 28,
                height: 28,
                paddingLeft: confirmApproveAll ? 10 : 0,
                paddingRight: confirmApproveAll ? 10 : 0,
                borderRadius: 7,
                background: confirmApproveAll ? colors.warn : colors.ok,
                color: '#fff',
                fontSize: confirmApproveAll ? '11px' : undefined,
                fontWeight: confirmApproveAll ? 700 : undefined,
              }}
            >
              {confirmApproveAll ? 'Sure?' : <Check size={13} strokeWidth={3} />}
            </button>
            <button
              data-testid={`correction-group-reject-btn-${slug}`}
              onClick={() => setShowRejectAll(true)}
              title="Reject all"
              className="flex items-center justify-center transition-all hover:scale-110"
              style={{ width: 28, height: 28, borderRadius: 7, background: colors.err, color: '#fff' }}
            >
              <X size={13} strokeWidth={3} />
            </button>
          </div>
        )}

        {group.items.length > 1 && !showRejectAll && (
          <button
            onClick={() => setExpanded((v) => !v)}
            className="flex-shrink-0"
            style={{ color: t.textMuted }}
          >
            {expanded ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
          </button>
        )}
      </div>

      {/* Reject-all input */}
      {showRejectAll && (
        <div className="px-3 pb-3 space-y-1.5">
          <textarea
            data-testid={`correction-group-reject-input-${slug}`}
            value={rejectReason}
            onChange={(e) => setRejectReason(e.target.value)}
            rows={2}
            placeholder="Rejection reason (optional)"
            autoFocus
            className="w-full px-2.5 py-2 rounded-xl text-xs resize-none outline-none"
            style={{ background: 'rgba(0,0,0,0.03)', border: `1px solid ${t.border}`, color: t.text }}
          />
          <div className="flex gap-1.5">
            <button
              data-testid={`correction-group-reject-confirm-btn-${slug}`}
              onClick={handleRejectAll}
              disabled={rejecting}
              className="flex-1 py-1.5 rounded-xl text-[11px] font-bold disabled:opacity-50"
              style={{ background: `${colors.err}15`, color: colors.errText }}
            >
              {rejecting ? 'Rejecting…' : `Reject all ${group.items.length}`}
            </button>
            <button
              onClick={() => { setShowRejectAll(false); setRejectReason('') }}
              className="px-3 py-1.5 rounded-xl text-[11px] font-bold"
              style={{ color: t.textMuted }}
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Expanded individual items */}
      {(expanded || group.items.length === 1) && (
        <div style={{ borderTop: `1px solid ${t.border}` }}>
          {group.items.map((c, idx) => (
            <CorrectionGroupItem
              key={c.id}
              correction={c}
              tz={tz}
              isLast={idx === group.items.length - 1}
            />
          ))}
        </div>
      )}
    </div>
  )
}

// ── Individual item within a group (click → detail modal) ────────────────────

function CorrectionGroupItem({
  correction: c,
  tz,
  isLast,
}: {
  correction: AttendanceCorrection
  tz: string
  isLast: boolean
}) {
  const [detailOpen, setDetailOpen] = useState(false)
  const { mutate: approve, isPending: approving } = useApproveCorrection()
  const { mutate: reject, isPending: rejecting } = useRejectCorrection()

  const fmtTime = (iso?: string) => (!iso ? '—' : formatDate(iso, tz, 'time'))

  return (
    <>
      <div
        data-testid={`correction-row-${c.id}`}
        className="flex items-center gap-2 px-4 py-2.5 cursor-pointer transition-colors hover:bg-black/[0.02]"
        style={{ borderBottom: isLast ? 'none' : `1px solid ${t.border}` }}
        onClick={() => setDetailOpen(true)}
      >
        <div className="flex-1 min-w-0">
          <p className="text-[11px] font-bold" style={{ color: t.text }}>{c.date}</p>
          <p className="text-[11px]" style={{ color: t.textMuted }}>
            {fmtTime(c.requested_clock_in)} → {fmtTime(c.requested_clock_out)}
          </p>
        </div>
        <div className="flex items-center gap-1 flex-shrink-0" onClick={(e) => e.stopPropagation()}>
          <button
            data-testid={`correction-approve-btn-${c.id}`}
            onClick={() => approve(c.id)}
            disabled={approving}
            title="Approve"
            className="flex items-center justify-center transition-all hover:scale-110 disabled:opacity-50"
            style={{ width: 24, height: 24, borderRadius: 6, background: colors.ok, color: '#fff' }}
          >
            <Check size={12} strokeWidth={3} />
          </button>
          <button
            data-testid={`correction-reject-btn-${c.id}`}
            onClick={() => setDetailOpen(true)}
            title="Reject"
            className="flex items-center justify-center transition-all hover:scale-110"
            style={{ width: 24, height: 24, borderRadius: 6, background: colors.err, color: '#fff' }}
          >
            <X size={12} strokeWidth={3} />
          </button>
        </div>
      </div>

      {detailOpen && (
        <CorrectionDetailModal
          correction={c}
          tz={tz}
          onApprove={() => approve(c.id)}
          onReject={(reason) => reject({ id: c.id, reason })}
          approving={approving}
          rejecting={rejecting}
          onClose={() => setDetailOpen(false)}
        />
      )}
    </>
  )
}

// ── My Requests row (click → detail modal) ───────────────────────────────────

function CorrectionMyRow({ correction: c, tz }: { correction: AttendanceCorrection; tz: string }) {
  const [detailOpen, setDetailOpen] = useState(false)
  const { mutate: cancel, isPending: cancelling } = useCancelCorrection()

  const statusStyles: Record<string, { bg: string; text: string }> = {
    pending: { bg: `${colors.warn}20`, text: colors.warnText },
    approved: { bg: `${colors.ok}18`, text: colors.okText },
    rejected: { bg: `${colors.err}18`, text: colors.errText },
    cancelled: { bg: `${t.border}`, text: t.textMuted },
  }
  const ss = statusStyles[c.status] ?? { bg: t.border, text: t.textMuted }

  return (
    <>
      <div
        data-testid={`correction-row-${c.id}`}
        className="flex items-center gap-2 px-3 py-2.5 cursor-pointer transition-colors hover:bg-black/[0.02]"
        style={{ borderBottom: `1px solid ${t.border}` }}
        onClick={() => setDetailOpen(true)}
      >
        <div className="flex-1 min-w-0">
          <p className="text-xs font-bold" style={{ color: t.text }}>{c.date}</p>
          <p className="text-[11px] truncate" style={{ color: t.textMuted }}>{c.reason}</p>
        </div>
        <span
          className="text-[10px] font-bold uppercase px-1.5 py-0.5 rounded-full flex-shrink-0"
          style={{ background: ss.bg, color: ss.text }}
        >
          {c.status}
        </span>
      </div>

      {detailOpen && (
        <CorrectionDetailModal
          correction={c}
          tz={tz}
          onCancel={() => cancel(c.id)}
          cancelling={cancelling}
          onClose={() => setDetailOpen(false)}
        />
      )}
    </>
  )
}

// ── Detail modal (full info + actions) ───────────────────────────────────────

function CorrectionDetailModal({
  correction: c,
  tz,
  onClose,
  onApprove,
  onReject,
  onCancel,
  approving = false,
  rejecting = false,
  cancelling = false,
}: {
  correction: AttendanceCorrection
  tz: string
  onClose: () => void
  onApprove?: () => void
  onReject?: (reason?: string) => void
  onCancel?: () => void
  approving?: boolean
  rejecting?: boolean
  cancelling?: boolean
}) {
  const [showRejectInput, setShowRejectInput] = useState(false)
  const [rejectReason, setRejectReason] = useState('')
  const [confirmCancel, setConfirmCancel] = useState(false)
  const [confirmApprove, setConfirmApprove] = useState(false)
  const timeoutRef = useRef<number | null>(null)

  useEffect(() => () => { if (timeoutRef.current) clearTimeout(timeoutRef.current) }, [])

  const handleApprove = () => {
    if (!confirmApprove) {
      setConfirmApprove(true)
      timeoutRef.current = setTimeout(() => setConfirmApprove(false), 3000) as unknown as number
      return
    }
    clearTimeout(timeoutRef.current!)
    setConfirmApprove(false)
    onApprove?.()
    onClose()
  }

  const fmtTime = (iso?: string) => (!iso ? '—' : formatDate(iso, tz, 'time'))

  const statusStyles: Record<string, { bg: string; text: string }> = {
    pending: { bg: `${colors.warn}20`, text: colors.warnText },
    approved: { bg: `${colors.ok}18`, text: colors.okText },
    rejected: { bg: `${colors.err}18`, text: colors.errText },
    cancelled: { bg: `${t.border}`, text: t.textMuted },
  }
  const ss = statusStyles[c.status] ?? { bg: t.border, text: t.textMuted }

  return (
    <div
      data-testid="correction-detail-modal"
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.5)' }}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        className="w-full max-w-sm rounded-2xl shadow-xl"
        style={{ background: t.surface, border: `1px solid ${t.border}` }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3" style={{ borderBottom: `1px solid ${t.border}` }}>
          <div>
            <p className="text-sm font-bold" style={{ color: t.text }}>{c.employee_name}</p>
            <p className="text-[11px]" style={{ color: t.textMuted }}>{c.date}</p>
          </div>
          <div className="flex items-center gap-2">
            <span
              className="text-[10px] font-bold uppercase px-1.5 py-0.5 rounded-full"
              style={{ background: ss.bg, color: ss.text }}
            >
              {c.status}
            </span>
            <button
              data-testid="correction-detail-close-btn"
              onClick={onClose}
              className="p-1.5 rounded-lg hover:bg-black/5 transition-all"
              style={{ color: t.textMuted }}
            >
              <X size={15} />
            </button>
          </div>
        </div>

        {/* Times */}
        <div className="px-4 py-3 grid grid-cols-2 gap-2">
          <div className="rounded-xl p-2.5" style={{ background: 'rgba(0,0,0,0.03)', border: `1px solid ${t.border}` }}>
            <p className="text-[10px] font-bold uppercase mb-1.5" style={{ color: t.textMuted }}>Original</p>
            <p className="text-[11px]" style={{ color: t.text }}>In: {fmtTime(c.original_clock_in)}</p>
            <p className="text-[11px]" style={{ color: t.text }}>Out: {fmtTime(c.original_clock_out)}</p>
          </div>
          <div className="rounded-xl p-2.5" style={{ background: `${colors.ok}10`, border: `1px solid ${colors.ok}30` }}>
            <p className="text-[10px] font-bold uppercase mb-1.5" style={{ color: colors.ok }}>Requested</p>
            <p className="text-[11px]" style={{ color: colors.okText }}>In: {fmtTime(c.requested_clock_in)}</p>
            <p className="text-[11px]" style={{ color: colors.okText }}>Out: {fmtTime(c.requested_clock_out)}</p>
          </div>
        </div>

        {/* Reason */}
        <div className="px-4 pb-3">
          <p className="text-[11px] italic" style={{ color: t.textMuted }}>&ldquo;{c.reason}&rdquo;</p>

          {c.status === 'rejected' && c.rejection_reason && (
            <p className="text-[11px] mt-2 px-2 py-1.5 rounded-lg" style={{ background: `${colors.err}10`, color: colors.errText }}>
              Rejected: {c.rejection_reason}
            </p>
          )}
        </div>

        {/* Actions */}
        {(onApprove || onReject || onCancel) && c.status === 'pending' && (
          <div className="px-4 pb-4 pt-1" style={{ borderTop: `1px solid ${t.border}` }}>
            {/* Manager: approve + reject */}
            {onApprove && !showRejectInput && (
              <div className="flex items-center gap-2 pt-3">
                <button
                  data-testid="correction-detail-approve-btn"
                  onClick={handleApprove}
                  disabled={approving}
                  className="flex items-center justify-center gap-1.5 flex-1 py-2 rounded-xl text-xs font-bold transition-all disabled:opacity-50"
                  style={{
                    background: confirmApprove ? colors.warn : colors.ok,
                    color: '#fff',
                  }}
                >
                  <Check size={13} strokeWidth={3} />
                  {confirmApprove ? 'Sure?' : approving ? 'Approving…' : 'Approve'}
                </button>
                {onReject && (
                  <button
                    data-testid="correction-detail-reject-btn"
                    onClick={() => setShowRejectInput(true)}
                    className="flex items-center justify-center gap-1.5 flex-1 py-2 rounded-xl text-xs font-bold transition-all"
                    style={{ background: `${colors.err}15`, color: colors.errText }}
                  >
                    <X size={13} strokeWidth={3} />
                    Reject
                  </button>
                )}
              </div>
            )}

            {onReject && showRejectInput && (
              <div className="space-y-1.5 pt-3">
                <textarea
                  data-testid="correction-detail-reject-reason-input"
                  value={rejectReason}
                  onChange={(e) => setRejectReason(e.target.value)}
                  rows={2}
                  placeholder="Rejection reason (optional)"
                  autoFocus
                  className="w-full px-3 py-2 rounded-xl text-xs resize-none outline-none"
                  style={{ background: 'rgba(0,0,0,0.03)', border: `1px solid ${t.border}`, color: t.text }}
                />
                <div className="flex gap-1.5">
                  <button
                    data-testid="correction-detail-reject-confirm-btn"
                    onClick={() => { onReject(rejectReason || undefined); onClose() }}
                    disabled={rejecting}
                    className="flex-1 py-1.5 rounded-xl text-[11px] font-bold disabled:opacity-50"
                    style={{ background: `${colors.err}15`, color: colors.errText }}
                  >
                    {rejecting ? 'Rejecting…' : 'Confirm Reject'}
                  </button>
                  <button
                    onClick={() => setShowRejectInput(false)}
                    className="px-3 py-1.5 rounded-xl text-[11px] font-bold"
                    style={{ color: t.textMuted }}
                  >
                    Back
                  </button>
                </div>
              </div>
            )}

            {/* Employee: cancel */}
            {onCancel && !confirmCancel && (
              <button
                data-testid="correction-detail-cancel-btn"
                onClick={() => setConfirmCancel(true)}
                className="flex items-center justify-center gap-1.5 w-full mt-3 py-2 rounded-xl text-xs font-bold transition-all"
                style={{ background: `${colors.err}10`, color: colors.errText }}
              >
                <X size={13} /> Cancel Request
              </button>
            )}
            {onCancel && confirmCancel && (
              <div className="flex gap-1.5 mt-3">
                <button
                  data-testid="correction-detail-cancel-confirm-btn"
                  onClick={() => { onCancel(); onClose() }}
                  disabled={cancelling}
                  className="flex-1 py-2 rounded-xl text-xs font-bold disabled:opacity-50"
                  style={{ background: `${colors.err}20`, color: colors.errText }}
                >
                  {cancelling ? 'Cancelling…' : 'Sure, Cancel'}
                </button>
                <button
                  data-testid="correction-detail-cancel-back-btn"
                  onClick={() => setConfirmCancel(false)}
                  className="px-3 py-2 rounded-xl text-xs font-bold"
                  style={{ color: t.textMuted }}
                >
                  Keep
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

// ── "Show all" paginated modal ────────────────────────────────────────────────

function AllCorrectionsModal({
  pendingData,
  mineData,
  activeTab,
  tz,
  onClose,
}: {
  pendingData: AttendanceCorrection[]
  mineData: AttendanceCorrection[]
  activeTab: 'pending' | 'mine'
  tz: string
  onClose: () => void
}) {
  const [page, setPage] = useState(0)
  const allGroups = groupByEmployee(pendingData)

  // Pending: paginate groups; mine: paginate items
  const totalPages = activeTab === 'pending'
    ? Math.ceil(allGroups.length / MODAL_PAGE_SIZE)
    : Math.ceil(mineData.length / MODAL_PAGE_SIZE)

  const pageGroups = allGroups.slice(page * MODAL_PAGE_SIZE, (page + 1) * MODAL_PAGE_SIZE)
  const pageItems = mineData.slice(page * MODAL_PAGE_SIZE, (page + 1) * MODAL_PAGE_SIZE)
  const totalCount = activeTab === 'pending' ? pendingData.length : mineData.length

  return (
    <div
      data-testid="corrections-all-modal"
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.5)' }}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        className="w-full max-w-md rounded-2xl shadow-xl flex flex-col"
        style={{ background: t.surface, border: `1px solid ${t.border}`, maxHeight: '80vh' }}
      >
        <div className="flex items-center justify-between px-4 py-3 flex-shrink-0" style={{ borderBottom: `1px solid ${t.border}` }}>
          <div>
            <h2 className="text-sm font-bold" style={{ color: t.text }}>
              {activeTab === 'pending' ? 'All Pending Reviews' : 'All My Requests'}
            </h2>
            <p className="text-[11px]" style={{ color: t.textMuted }}>{totalCount} total</p>
          </div>
          <button
            data-testid="corrections-all-modal-close-btn"
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-black/5 transition-all"
            style={{ color: t.textMuted }}
          >
            <X size={16} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto divide-y" style={{ borderColor: t.border }}>
          {activeTab === 'pending'
            ? pageGroups.map((g) => <CorrectionGroup key={g.employeeId} group={g} tz={tz} />)
            : pageItems.map((c) => <CorrectionMyRow key={c.id} correction={c} tz={tz} />)
          }
        </div>

        {totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-2.5 flex-shrink-0" style={{ borderTop: `1px solid ${t.border}` }}>
            <button
              data-testid="corrections-modal-prev-btn"
              onClick={() => setPage((p) => p - 1)}
              disabled={page === 0}
              className="px-3 py-1.5 rounded-lg text-xs font-bold transition-all disabled:opacity-30"
              style={{ color: t.textMuted }}
            >
              ← Prev
            </button>
            <span className="text-xs font-bold" style={{ color: t.textMuted }}>{page + 1} / {totalPages}</span>
            <button
              data-testid="corrections-modal-next-btn"
              onClick={() => setPage((p) => p + 1)}
              disabled={page >= totalPages - 1}
              className="px-3 py-1.5 rounded-lg text-xs font-bold transition-all disabled:opacity-30"
              style={{ color: t.textMuted }}
            >
              Next →
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
