import { createFileRoute, useRouter, useSearch } from '@tanstack/react-router'
import { useState, useMemo } from 'react'
import { ArrowLeft, Check, X, Filter, Search, Calendar, Receipt, Clock } from 'lucide-react'
import { moduleThemes, typography, colors } from '@/design/tokens'
import { useAllClaims, useApproveClaim, useRejectClaim } from '@/lib/hooks/useClaims'
import { useAllRequests, useApproveRequest, useRejectRequest } from '@/lib/hooks/useLeave'
import { useCorrections, useApproveCorrection, useRejectCorrection } from '@/lib/hooks/useAttendance'
import { useAttendanceRole } from '@/lib/hooks/useAttendanceRole'
import { useCanManageLeave, useCanManageClaims } from '@/lib/hooks/useRole'
import { RequestListItem, type RequestData, type RequestListItemTheme } from '@/components/workived/shared/requests'
import { createClaimRequestConfig, claimRequestTheme, claimStatusColors } from '@/components/workived/claims/ClaimRequestConfig'
import { createLeaveRequestConfig, leaveRequestTheme } from '@/components/workived/leave/LeaveRequestConfig'
import { RequestTableSkeleton } from '@/components/workived/shared/Skeleton'
import type { ClaimWithDetails, AttendanceCorrection } from '@/types/api'

type FilterType = 'all' | 'leave' | 'claims' | 'attendance'

export const Route = createFileRoute('/_app/approvals')({
  component: ApprovalsPage,
  validateSearch: (search: Record<string, unknown>) => ({
    filter: (['all', 'leave', 'claims', 'attendance'].includes(search.filter as string)
      ? (search.filter as FilterType)
      : 'all'),
  }),
})

/* ── Theme ── */
const t = moduleThemes.overview

const approvalTheme: RequestListItemTheme = {
  text: t.text,
  textMuted: t.textMuted,
  surface: t.surface,
  surfaceHover: t.surfaceHover,
  border: t.border,
  input: t.input,
  inputBorder: t.inputBorder,
}

/* ── Attendance theme & config ── */
const attendanceTheme: RequestListItemTheme = {
  text: moduleThemes.attendance.text,
  textMuted: moduleThemes.attendance.textMuted,
  surface: moduleThemes.attendance.surface,
  surfaceHover: moduleThemes.attendance.surfaceHover,
  border: moduleThemes.attendance.border,
  input: moduleThemes.attendance.input,
  inputBorder: moduleThemes.attendance.inputBorder,
}

function correctionToRequestData(c: AttendanceCorrection): RequestData {
  return {
    id: c.id,
    status: c.status,
    start_date: c.date,
    end_date: c.date,
    total_days: 1,
    reason: c.reason,
    review_note: c.rejection_reason,
    employee_id: c.employee_id,
    employee_name: c.employee_name,
    original_clock_in: c.original_clock_in,
    original_clock_out: c.original_clock_out,
    requested_clock_in: c.requested_clock_in,
    requested_clock_out: c.requested_clock_out,
    created_at: c.created_at,
  }
}

function formatTime(t?: string) {
  if (!t) return '—'
  // Handle ISO timestamps (2026-04-10T08:00:00Z) and plain HH:MM:SS
  if (t.includes('T')) {
    const date = new Date(t)
    return date.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false })
  }
  return t.slice(0, 5)
}

function CorrectionDetailsModal({ request, onClose }: { request: RequestData; onClose: () => void }) {
  const at = moduleThemes.attendance
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ background: 'rgba(0,0,0,0.5)' }}
      onClick={onClose}
    >
      <div
        className="w-full max-w-sm mx-4"
        style={{ background: '#FFFFFF', borderRadius: 16, overflow: 'hidden' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-5 py-4" style={{ borderBottom: `1px solid ${colors.ink100}` }}>
          <p className="font-bold" style={{ fontSize: typography.h3.size, color: at.text }}>Correction Details</p>
        </div>
        <div className="px-5 py-4 space-y-3">
          <div>
            <p className="text-xs font-semibold mb-1" style={{ color: at.textMuted }}>Date</p>
            <p className="text-sm font-bold" style={{ color: at.text }}>
              {new Date(request.start_date).toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric' })}
            </p>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <p className="text-xs font-semibold mb-1" style={{ color: at.textMuted }}>Original</p>
              <p className="text-sm" style={{ color: at.text }}>
                {formatTime(request.original_clock_in)} – {formatTime(request.original_clock_out)}
              </p>
            </div>
            <div>
              <p className="text-xs font-semibold mb-1" style={{ color: at.textMuted }}>Requested</p>
              <p className="text-sm font-bold" style={{ color: at.accent ?? at.text }}>
                {formatTime(request.requested_clock_in)} – {formatTime(request.requested_clock_out)}
              </p>
            </div>
          </div>
          {request.reason && (
            <div>
              <p className="text-xs font-semibold mb-1" style={{ color: at.textMuted }}>Reason</p>
              <p className="text-sm" style={{ color: at.text }}>{request.reason}</p>
            </div>
          )}
        </div>
        <div className="px-5 py-3" style={{ borderTop: `1px solid ${colors.ink100}` }}>
          <button
            onClick={onClose}
            className="w-full py-2 text-sm font-semibold transition-opacity hover:opacity-80"
            style={{ borderRadius: 8, background: colors.ink50, color: colors.ink500 }}
          >
            Close
          </button>
        </div>
      </div>
    </div>
  )
}

const correctionRequestConfig = {
  getTitle: (request: RequestData) => {
    const orig = `${formatTime(request.original_clock_in)} – ${formatTime(request.original_clock_out)}`
    const req = `${formatTime(request.requested_clock_in)} – ${formatTime(request.requested_clock_out)}`
    return `${orig} → ${req}`
  },
  getSubtitle: () => null,
  getExtraInfo: (request: RequestData) => {
    if (!request.reason) return null
    return (
      <p className="text-xs mt-0.5 truncate" style={{ color: moduleThemes.attendance.textMuted, maxWidth: 360 }}>
        {request.reason}
      </p>
    )
  },
  getRightContent: (request: RequestData) => {
    const d = new Date(request.start_date)
    return (
      <div className="text-right">
        <p className="text-xs" style={{ color: moduleThemes.attendance.textMuted }}>
          {d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
        </p>
        <p className="text-xs font-bold mt-0.5" style={{ color: moduleThemes.attendance.text }}>Correction</p>
      </div>
    )
  },
  DetailsModal: CorrectionDetailsModal,
} as const

/* ── Unified request type ── */
interface UnifiedRequest {
  id: string
  type: 'leave' | 'claims' | 'attendance'
  employeeId: string
  employeeName: string
  raw: any
  createdAt: string
}

/* ── Page ── */
function ApprovalsPage() {
  const router = useRouter()
  const { filter: initialFilter } = useSearch({ from: '/_app/approvals' })
  const canManageLeave = useCanManageLeave()
  const canManageClaims = useCanManageClaims()
  const attendanceRole = useAttendanceRole()
  const canReviewCorrections = attendanceRole.canViewTeam || attendanceRole.canViewAll

  /* ── Data ── */
  const { data: allClaims, isLoading: claimsLoading } = useAllClaims()
  const { data: pendingLeaveRequests, isLoading: leaveLoading } = useAllRequests({ status: 'pending' })
  const { data: pendingCorrections, isLoading: correctionsLoading } = useCorrections('pending', false)

  const pendingClaims = useMemo(
    () => allClaims?.data?.filter((c: ClaimWithDetails) => c.status === 'pending') ?? [],
    [allClaims],
  )

  /* ── Mutations ── */
  const approveClaimMutation = useApproveClaim()
  const rejectClaimMutation = useRejectClaim()
  const approveLeaveM = useApproveRequest()
  const rejectLeaveM = useRejectRequest()
  const approveCorrectionM = useApproveCorrection()
  const rejectCorrectionM = useRejectCorrection()

  /* ── State ── */
  const [filterType, setFilterType] = useState<FilterType>(initialFilter)
  const [searchQuery, setSearchQuery] = useState('')
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [bulkRejectOpen, setBulkRejectOpen] = useState(false)
  const [bulkRejectNote, setBulkRejectNote] = useState('')
  const [bulkRejectError, setBulkRejectError] = useState('')
  const [bulkProcessing, setBulkProcessing] = useState(false)

  /* ── Unified list ── */
  const unified = useMemo<UnifiedRequest[]>(() => {
    const items: UnifiedRequest[] = []
    if (canManageLeave && pendingLeaveRequests) {
      for (const r of pendingLeaveRequests) {
        items.push({
          id: r.id,
          type: 'leave',
          employeeId: r.employee_id,
          employeeName: r.employee_name ?? 'Unknown',
          raw: r,
          createdAt: r.created_at,
        })
      }
    }
    if (canManageClaims && pendingClaims) {
      for (const c of pendingClaims) {
        items.push({
          id: c.id,
          type: 'claims',
          employeeId: c.employee_id,
          employeeName: c.employee_name ?? 'Unknown',
          raw: c,
          createdAt: c.created_at,
        })
      }
    }
    if (canReviewCorrections && pendingCorrections) {
      for (const c of pendingCorrections) {
        items.push({
          id: c.id,
          type: 'attendance',
          employeeId: c.employee_id,
          employeeName: c.employee_name ?? 'Unknown',
          raw: c,
          createdAt: c.created_at,
        })
      }
    }
    items.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    return items
  }, [pendingLeaveRequests, pendingClaims, pendingCorrections, canManageLeave, canManageClaims, canReviewCorrections])

  /* ── Filtered ── */
  const filtered = useMemo(() => {
    let list = unified
    if (filterType !== 'all') {
      list = list.filter((r) => r.type === filterType)
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase()
      list = list.filter((r) => r.employeeName.toLowerCase().includes(q))
    }
    return list
  }, [unified, filterType, searchQuery])

  /* ── Counts ── */
  const leaveCount = unified.filter((r) => r.type === 'leave').length
  const claimCount = unified.filter((r) => r.type === 'claims').length
  const attendanceCount = unified.filter((r) => r.type === 'attendance').length
  const totalCount = unified.length

  /* ── Employees for grouping ── */
  const uniqueEmployees = useMemo(() => {
    const map = new Map<string, string>()
    for (const r of filtered) map.set(r.employeeId, r.employeeName)
    return Array.from(map.entries())
  }, [filtered])

  /* ── Selection ── */
  const allSelected = filtered.length > 0 && filtered.every((r) => selected.has(r.id))
  const someSelected = selected.size > 0

  function toggleSelectAll() {
    if (allSelected) {
      setSelected(new Set())
    } else {
      setSelected(new Set(filtered.map((r) => r.id)))
    }
  }

  function toggleSelect(id: string) {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  /* ── Bulk actions ── */
  async function bulkApprove() {
    setBulkProcessing(true)
    const toProcess = filtered.filter((r) => selected.has(r.id))
    for (const r of toProcess) {
      try {
        if (r.type === 'leave') {
          await approveLeaveM.mutateAsync({ id: r.id })
        } else if (r.type === 'claims') {
          await approveClaimMutation.mutateAsync({ id: r.id })
        } else {
          await approveCorrectionM.mutateAsync(r.id)
        }
      } catch (e) {
        console.error(`Failed to approve ${r.type} ${r.id}:`, e)
      }
    }
    setSelected(new Set())
    setBulkProcessing(false)
  }

  async function bulkReject() {
    if (!bulkRejectNote || bulkRejectNote.trim().length < 10) {
      setBulkRejectError('Rejection reason is required (minimum 10 characters)')
      return
    }
    setBulkProcessing(true)
    const note = bulkRejectNote.trim()
    const toProcess = filtered.filter((r) => selected.has(r.id))
    for (const r of toProcess) {
      try {
        if (r.type === 'leave') {
          await rejectLeaveM.mutateAsync({ id: r.id, note })
        } else if (r.type === 'claims') {
          await rejectClaimMutation.mutateAsync({ id: r.id, data: { review_note: note } })
        } else {
          await rejectCorrectionM.mutateAsync({ id: r.id, reason: note })
        }
      } catch (e) {
        console.error(`Failed to reject ${r.type} ${r.id}:`, e)
      }
    }
    setSelected(new Set())
    setBulkRejectOpen(false)
    setBulkRejectNote('')
    setBulkRejectError('')
    setBulkProcessing(false)
  }

  /* ── Individual actions ── */
  async function handleApprove(id: string) {
    const item = unified.find((r) => r.id === id)
    if (!item) return
    if (item.type === 'leave') {
      await approveLeaveM.mutateAsync({ id })
    } else if (item.type === 'claims') {
      await approveClaimMutation.mutateAsync({ id })
    } else {
      await approveCorrectionM.mutateAsync(id)
    }
  }

  async function handleReject(id: string, note: string) {
    const item = unified.find((r) => r.id === id)
    if (!item) return
    if (item.type === 'leave') {
      await rejectLeaveM.mutateAsync({ id, note })
    } else if (item.type === 'claims') {
      await rejectClaimMutation.mutateAsync({ id, data: { review_note: note } })
    } else {
      await rejectCorrectionM.mutateAsync({ id, reason: note })
    }
  }

  const isLoading = claimsLoading || leaveLoading || correctionsLoading

  /* ── Filter chips config ── */
  const filterChips: { key: FilterType; label: string; count: number; icon: React.ReactNode }[] = [
    { key: 'all', label: 'All', count: totalCount, icon: null },
    { key: 'leave', label: 'Leave', count: leaveCount, icon: <Calendar size={13} /> },
    { key: 'claims', label: 'Claims', count: claimCount, icon: <Receipt size={13} /> },
    { key: 'attendance', label: 'Attendance', count: attendanceCount, icon: <Clock size={13} /> },
  ]

  return (
    <div className="min-h-screen" data-testid="approvals-page" style={{ background: '#F8F9FA' }}>
      {/* ── Header ── */}
      <div className="sticky top-0 z-20" style={{ background: '#FFFFFF', borderBottom: `1px solid ${colors.ink100}` }}>
        <div className="max-w-4xl mx-auto px-5 py-4">
          <div className="flex items-center gap-3">
            <button
              onClick={() => router.history.back()}
              data-testid="approvals-back-btn"
              className="flex items-center justify-center transition-opacity hover:opacity-70"
              style={{ width: 36, height: 36, borderRadius: 10, background: colors.ink50 }}
            >
              <ArrowLeft size={18} style={{ color: colors.ink500 }} />
            </button>
            <div className="flex-1">
              <h1 className="font-bold" data-testid="approvals-title" style={{ fontSize: typography.h2.size, color: t.text }}>
                Approvals
              </h1>
              {totalCount > 0 && (
                <p className="text-xs mt-0.5" style={{ color: t.textMuted }}>
                  {totalCount} pending {totalCount === 1 ? 'request' : 'requests'}
                </p>
              )}
            </div>
          </div>

          {/* ── Filter chips + search ── */}
          <div className="flex items-center gap-2 mt-4">
            {filterChips.map((chip) => {
              const active = filterType === chip.key
              return (
                <button
                  key={chip.key}
                  onClick={() => { setFilterType(chip.key); setSelected(new Set()) }}
                  data-testid={`approvals-filter-${chip.key}`}
                  className="flex items-center gap-1.5 px-3 py-1.5 transition-all"
                  style={{
                    borderRadius: 8,
                    fontSize: typography.label.size,
                    fontWeight: 600,
                    background: active ? colors.ink900 : colors.ink50,
                    color: active ? '#FFFFFF' : colors.ink500,
                  }}
                >
                  {chip.icon}
                  {chip.label}
                  {chip.count > 0 && (
                    <span
                      className="text-[10px] font-bold px-1.5 py-0.5 rounded-full"
                      style={{
                        background: active ? 'rgba(255,255,255,0.20)' : colors.ink100,
                        color: active ? '#FFFFFF' : colors.ink500,
                      }}
                    >
                      {chip.count}
                    </span>
                  )}
                </button>
              )
            })}
            <div className="flex-1" />
            <div
              className="flex items-center gap-2 px-3"
              style={{
                height: 36,
                borderRadius: 10,
                border: `1px solid ${colors.ink100}`,
                background: colors.ink0,
              }}
            >
              <Search size={14} style={{ color: colors.ink300, flexShrink: 0 }} />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search employee…"
                data-testid="approvals-search"
                className="text-sm bg-transparent focus:outline-none w-40"
                style={{ color: t.text }}
              />
            </div>
          </div>
        </div>
      </div>

      {/* ── Bulk action bar ── */}
      {someSelected && (
        <div
          className="sticky z-10"
          style={{ top: 120, background: '#FFFFFF', borderBottom: `1px solid ${colors.ink100}` }}
        >
          <div className="max-w-4xl mx-auto px-5 py-3 flex items-center gap-3">
            {/* Select all checkbox */}
            <button
              onClick={toggleSelectAll}
              data-testid="approvals-select-all"
              className="flex items-center justify-center transition-all"
              style={{
                width: 22,
                height: 22,
                borderRadius: 6,
                border: `2px solid ${allSelected ? colors.accent : colors.ink300}`,
                background: allSelected ? colors.accent : 'transparent',
                flexShrink: 0,
              }}
            >
              {allSelected && <Check size={13} strokeWidth={3} color="#FFFFFF" />}
            </button>

            <p className="text-sm font-semibold" data-testid="approvals-selected-count" style={{ color: t.text }}>
              {selected.size} selected
            </p>

            <div className="flex-1" />

            {!bulkRejectOpen && (
              <>
                <button
                  onClick={bulkApprove}
                  disabled={bulkProcessing}
                  data-testid="approvals-bulk-approve"
                  className="flex items-center gap-1.5 px-4 py-2 text-sm font-semibold transition-all hover:brightness-110 disabled:opacity-50"
                  style={{ background: colors.ok, color: '#FFFFFF', borderRadius: 10 }}
                >
                  <Check size={15} strokeWidth={2.5} />
                  {bulkProcessing ? 'Processing…' : `Approve ${selected.size}`}
                </button>
                <button
                  onClick={() => setBulkRejectOpen(true)}
                  disabled={bulkProcessing}
                  data-testid="approvals-bulk-reject"
                  className="flex items-center gap-1.5 px-4 py-2 text-sm font-semibold transition-all hover:brightness-110 disabled:opacity-50"
                  style={{ background: colors.err, color: '#FFFFFF', borderRadius: 10 }}
                >
                  <X size={15} strokeWidth={2.5} />
                  Reject {selected.size}
                </button>
              </>
            )}

            {bulkRejectOpen && (
              <div className="flex items-center gap-2 flex-1 max-w-md">
                <input
                  value={bulkRejectNote}
                  onChange={(e) => { setBulkRejectNote(e.target.value); setBulkRejectError('') }}
                  placeholder="Rejection reason (min 10 chars)…"
                  data-testid="approvals-bulk-reject-input"
                  className="flex-1 px-3 py-2 text-sm focus:outline-none"
                  style={{
                    borderRadius: 8,
                    border: `1px solid ${bulkRejectError ? colors.err : colors.ink150}`,
                    color: t.text,
                  }}
                  autoFocus
                />
                <button
                  onClick={bulkReject}
                  disabled={bulkProcessing}
                  className="flex items-center gap-1.5 px-3 py-2 text-sm font-semibold transition-all hover:brightness-110 disabled:opacity-50"
                  style={{ background: colors.err, color: '#FFFFFF', borderRadius: 8, whiteSpace: 'nowrap' }}
                >
                  {bulkProcessing ? 'Rejecting…' : 'Confirm'}
                </button>
                <button
                  onClick={() => { setBulkRejectOpen(false); setBulkRejectNote(''); setBulkRejectError('') }}
                  className="px-2 py-2 text-sm font-medium transition-opacity hover:opacity-70"
                  style={{ color: t.textMuted }}
                >
                  Cancel
                </button>
              </div>
            )}
          </div>
          {bulkRejectError && (
            <div className="max-w-4xl mx-auto px-5 pb-2">
              <p className="text-xs" style={{ color: colors.err }}>{bulkRejectError}</p>
            </div>
          )}
        </div>
      )}

      {/* ── Content ── */}
      <div className="max-w-4xl mx-auto px-5 py-6">
        {isLoading ? (
          <RequestTableSkeleton count={5} surfaceColor={t.surface} borderColor={t.border} />
        ) : filtered.length === 0 ? (
          /* ── Empty state ── */
          <div
            data-testid="approvals-empty"
            className="flex flex-col items-center justify-center text-center"
            style={{
              background: t.surface,
              borderRadius: 14,
              border: `1px solid ${t.border}`,
              padding: 64,
              minHeight: 320,
            }}
          >
            <svg
              width="56"
              height="56"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              style={{ color: colors.ink300, marginBottom: 16 }}
            >
              <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
              <polyline points="22 4 12 14.01 9 11.01" />
            </svg>
            <p className="font-bold" style={{ fontSize: typography.h3.size, color: t.text }}>
              {searchQuery || filterType !== 'all' ? 'No matching requests' : 'All caught up!'}
            </p>
            <p className="text-sm mt-1" style={{ color: t.textMuted }}>
              {searchQuery || filterType !== 'all'
                ? 'Try changing your filters'
                : 'No pending approvals right now'}
            </p>
          </div>
        ) : (
          /* ── Grouped by employee ── */
          <div className="space-y-4" data-testid="approvals-list">
            {uniqueEmployees.map(([empId, empName]) => {
              const empRequests = filtered.filter((r) => r.employeeId === empId)
              if (empRequests.length === 0) return null

              const empAllSelected = empRequests.every((r) => selected.has(r.id))

              return (
                <div
                  key={empId}
                  data-testid={`approvals-employee-group-${empId}`}
                  style={{
                    background: t.surface,
                    borderRadius: 14,
                    border: `1px solid ${t.border}`,
                    overflow: 'hidden',
                  }}
                >
                  {/* Employee header */}
                  <div
                    className="flex items-center gap-3 px-5 py-3.5"
                    style={{ borderBottom: `1px solid ${t.border}` }}
                  >
                    <button
                      onClick={() => {
                        const ids = empRequests.map((r) => r.id)
                        setSelected((prev) => {
                          const next = new Set(prev)
                          if (empAllSelected) {
                            ids.forEach((id) => next.delete(id))
                          } else {
                            ids.forEach((id) => next.add(id))
                          }
                          return next
                        })
                      }}
                      className="flex items-center justify-center transition-all"
                      style={{
                        width: 20,
                        height: 20,
                        borderRadius: 5,
                        border: `2px solid ${empAllSelected ? colors.accent : colors.ink300}`,
                        background: empAllSelected ? colors.accent : 'transparent',
                        flexShrink: 0,
                      }}
                    >
                      {empAllSelected && <Check size={12} strokeWidth={3} color="#FFFFFF" />}
                    </button>
                    <div className="flex-1">
                      <p className="font-bold text-sm" style={{ color: t.text }}>
                        {empName}
                      </p>
                      <p className="text-xs" style={{ color: t.textMuted }}>
                        {empRequests.length} pending {empRequests.length === 1 ? 'request' : 'requests'}
                        {' · '}
                        {empRequests.filter((r) => r.type === 'leave').length > 0 && (
                          <span style={{ color: moduleThemes.leave.accent }}>
                            {empRequests.filter((r) => r.type === 'leave').length} leave
                          </span>
                        )}
                        {empRequests.filter((r) => r.type === 'leave').length > 0 &&
                          (empRequests.filter((r) => r.type === 'claims').length > 0 || empRequests.filter((r) => r.type === 'attendance').length > 0) && ', '}
                        {empRequests.filter((r) => r.type === 'claims').length > 0 && (
                          <span style={{ color: moduleThemes.claims.accent }}>
                            {empRequests.filter((r) => r.type === 'claims').length} claim
                          </span>
                        )}
                        {empRequests.filter((r) => r.type === 'claims').length > 0 &&
                          empRequests.filter((r) => r.type === 'attendance').length > 0 && ', '}
                        {empRequests.filter((r) => r.type === 'attendance').length > 0 && (
                          <span style={{ color: moduleThemes.attendance.accent }}>
                            {empRequests.filter((r) => r.type === 'attendance').length} correction
                          </span>
                        )}
                      </p>
                    </div>
                  </div>

                  {/* Requests list */}
                  {empRequests.map((item, idx) => {
                    const rowTheme = item.type === 'leave'
                      ? leaveRequestTheme
                      : item.type === 'claims'
                        ? claimRequestTheme
                        : attendanceTheme

                    return (
                      <div
                        key={item.id}
                        data-testid={`approvals-item-${item.id}`}
                        className="flex items-center transition-colors"
                        style={{
                          borderBottom: idx !== empRequests.length - 1 ? `1px solid ${t.border}` : 'none',
                        }}
                        onMouseEnter={(e) => { e.currentTarget.style.background = colors.ink50 }}
                        onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent' }}
                      >
                        {/* Checkbox */}
                        <button
                          onClick={() => toggleSelect(item.id)}
                          className="flex items-center justify-center ml-5 transition-all"
                          style={{
                            width: 18,
                            height: 18,
                            borderRadius: 5,
                            border: `2px solid ${selected.has(item.id) ? colors.accent : colors.ink150}`,
                            background: selected.has(item.id) ? colors.accent : 'transparent',
                            flexShrink: 0,
                          }}
                        >
                          {selected.has(item.id) && <Check size={11} strokeWidth={3} color="#FFFFFF" />}
                        </button>

                        {/* Type badge */}
                        <div
                          className="flex items-center justify-center ml-3"
                          style={{
                            width: 24,
                            height: 24,
                            borderRadius: 6,
                            background: item.type === 'leave'
                              ? 'rgba(99,87,232,0.08)'
                              : item.type === 'claims'
                                ? 'rgba(16,185,129,0.08)'
                                : 'rgba(139,92,246,0.08)',
                            flexShrink: 0,
                          }}
                        >
                          {item.type === 'leave' ? (
                            <Calendar size={13} style={{ color: moduleThemes.leave.accent }} />
                          ) : item.type === 'claims' ? (
                            <Receipt size={13} style={{ color: moduleThemes.claims.accent }} />
                          ) : (
                            <Clock size={13} style={{ color: moduleThemes.attendance.accent }} />
                          )}
                        </div>

                        {/* Request item — disable its own hover since parent handles it */}
                        <div className="flex-1 min-w-0">
                          <RequestListItem
                            request={item.type === 'attendance' ? correctionToRequestData(item.raw) : (item.raw as RequestData)}
                            variant="approval"
                            config={
                              item.type === 'leave'
                                ? createLeaveRequestConfig()
                                : item.type === 'claims'
                                  ? createClaimRequestConfig()
                                  : correctionRequestConfig
                            }
                            actions={{
                              onApprove: handleApprove,
                              onReject: handleReject,
                              isPendingApprove: approveClaimMutation.isPending || approveLeaveM.isPending || approveCorrectionM.isPending,
                              isPendingReject: rejectClaimMutation.isPending || rejectLeaveM.isPending || rejectCorrectionM.isPending,
                            }}
                            theme={{ ...rowTheme, surfaceHover: 'transparent' }}
                            isLast={true}
                          />
                        </div>
                      </div>
                    )
                  })}
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
