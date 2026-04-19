import React from 'react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'

vi.mock('@/lib/hooks/useAttendance', () => ({
  useCorrections: vi.fn(),
  useApproveCorrection: vi.fn(),
  useRejectCorrection: vi.fn(),
  useCancelCorrection: vi.fn(),
}))

vi.mock('@/lib/hooks/useAttendanceRole', () => ({
  useAttendanceRole: vi.fn(),
}))

import { useCorrections, useApproveCorrection, useRejectCorrection, useCancelCorrection } from '@/lib/hooks/useAttendance'
import { useAttendanceRole } from '@/lib/hooks/useAttendanceRole'
import { CorrectionsPanel } from './CorrectionsPanel'
import type { AttendanceCorrection } from '@/types/api'

function makeCorrection(overrides: Partial<AttendanceCorrection> = {}): AttendanceCorrection {
  return {
    id: 'corr-1',
    organisation_id: 'org-1',
    employee_id: 'emp-1',
    employee_name: 'Budi Santoso',
    date: '2026-04-17',
    reason: 'Forgot to clock in at the main entrance',
    status: 'pending',
    created_at: '2026-04-17T10:00:00Z',
    updated_at: '2026-04-17T10:00:00Z',
    ...overrides,
  }
}

function setupMocks({
  corrections = [] as AttendanceCorrection[],
  loading = false,
  canReview = true,
} = {}) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  vi.mocked(useAttendanceRole).mockReturnValue({ canViewAll: canReview, canViewTeam: false, isEmployee: !canReview } as any)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  vi.mocked(useCorrections).mockReturnValue({ data: corrections, isLoading: loading } as any)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  vi.mocked(useApproveCorrection).mockReturnValue({ mutate: vi.fn(), isPending: false } as any)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  vi.mocked(useRejectCorrection).mockReturnValue({ mutate: vi.fn(), isPending: false } as any)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  vi.mocked(useCancelCorrection).mockReturnValue({ mutate: vi.fn(), isPending: false } as any)
}

describe('CorrectionsPanel', () => {
  beforeEach(() => vi.clearAllMocks())

  // ── Panel shell ─────────────────────────────────────────────────────────────

  it('renders panel', () => {
    setupMocks()
    render(<CorrectionsPanel />)
    expect(screen.getByTestId('corrections-panel')).toBeInTheDocument()
  })

  it('shows loading skeleton', () => {
    setupMocks({ loading: true })
    render(<CorrectionsPanel />)
    expect(screen.getByTestId('corrections-skeleton')).toBeInTheDocument()
  })

  it('shows empty state when no corrections', () => {
    setupMocks({ corrections: [] })
    render(<CorrectionsPanel />)
    expect(screen.getByTestId('corrections-empty')).toBeInTheDocument()
  })

  it('shows tabs for managers', () => {
    setupMocks()
    render(<CorrectionsPanel />)
    expect(screen.getByTestId('corrections-tab-pending')).toBeInTheDocument()
    expect(screen.getByTestId('corrections-tab-mine')).toBeInTheDocument()
  })

  it('hides tabs for regular employees', () => {
    setupMocks({ canReview: false })
    render(<CorrectionsPanel />)
    expect(screen.queryByTestId('corrections-tab-pending')).not.toBeInTheDocument()
  })

  // ── Grouped pending tab ──────────────────────────────────────────────────────

  it('groups corrections by employee in pending tab', () => {
    const corrections = [
      makeCorrection({ id: 'c1', employee_id: 'e1', employee_name: 'Budi Santoso' }),
      makeCorrection({ id: 'c2', employee_id: 'e2', employee_name: 'Siti Rahayu' }),
    ]
    setupMocks({ corrections })
    render(<CorrectionsPanel />)
    expect(screen.getByTestId('correction-group-e1')).toBeInTheDocument()
    expect(screen.getByTestId('correction-group-e2')).toBeInTheDocument()
  })

  it('shows approve and reject group buttons', () => {
    setupMocks({ corrections: [makeCorrection()] })
    render(<CorrectionsPanel />)
    expect(screen.getByTestId('correction-group-approve-btn-budi-santoso')).toBeInTheDocument()
    expect(screen.getByTestId('correction-group-reject-btn-budi-santoso')).toBeInTheDocument()
  })

  it('approve group button shows "Sure?" on first click then calls mutate on second', () => {
    const mutate = vi.fn()
    setupMocks({ corrections: [makeCorrection()] })
    vi.mocked(useApproveCorrection).mockReturnValue({ mutate, isPending: false } as any) // eslint-disable-line @typescript-eslint/no-explicit-any
    render(<CorrectionsPanel />)
    const btn = screen.getByTestId('correction-group-approve-btn-budi-santoso')
    fireEvent.click(btn)
    expect(screen.getByText('Sure?')).toBeInTheDocument()
    fireEvent.click(btn)
    expect(mutate).toHaveBeenCalledWith('corr-1')
  })

  it('expand group to see individual items', () => {
    const corrections = [
      makeCorrection({ id: 'c1' }),
      makeCorrection({ id: 'c2', date: '2026-04-18' }),
    ]
    setupMocks({ corrections })
    render(<CorrectionsPanel />)
    fireEvent.click(screen.getByTestId('correction-group-toggle-budi-santoso'))
    expect(screen.getByTestId('correction-row-c1')).toBeInTheDocument()
    expect(screen.getByTestId('correction-row-c2')).toBeInTheDocument()
  })

  it('clicking individual item in group opens detail modal', () => {
    setupMocks({ corrections: [makeCorrection()] })
    render(<CorrectionsPanel />)
    // single-item groups are always expanded
    fireEvent.click(screen.getByTestId('correction-row-corr-1'))
    expect(screen.getByTestId('correction-detail-modal')).toBeInTheDocument()
  })

  it('detail modal has approve and reject buttons for manager', () => {
    setupMocks({ corrections: [makeCorrection()] })
    render(<CorrectionsPanel />)
    fireEvent.click(screen.getByTestId('correction-row-corr-1'))
    expect(screen.getByTestId('correction-detail-approve-btn')).toBeInTheDocument()
    expect(screen.getByTestId('correction-detail-reject-btn')).toBeInTheDocument()
  })

  it('reject group shows reject-all input', () => {
    setupMocks({ corrections: [makeCorrection()] })
    render(<CorrectionsPanel />)
    fireEvent.click(screen.getByTestId('correction-group-reject-btn-budi-santoso'))
    expect(screen.getByTestId('correction-group-reject-input-budi-santoso')).toBeInTheDocument()
    expect(screen.getByTestId('correction-group-reject-confirm-btn-budi-santoso')).toBeInTheDocument()
  })

  // ── My Requests tab ──────────────────────────────────────────────────────────

  it('shows my-request rows in mine tab', () => {
    setupMocks({ corrections: [makeCorrection()] })
    render(<CorrectionsPanel />)
    fireEvent.click(screen.getByTestId('corrections-tab-mine'))
    expect(screen.getByTestId('correction-row-corr-1')).toBeInTheDocument()
  })

  it('clicking my-request row opens detail modal directly', () => {
    setupMocks({ corrections: [makeCorrection()] })
    render(<CorrectionsPanel />)
    fireEvent.click(screen.getByTestId('corrections-tab-mine'))
    fireEvent.click(screen.getByTestId('correction-row-corr-1'))
    expect(screen.getByTestId('correction-detail-modal')).toBeInTheDocument()
  })

  it('detail modal has cancel button for own requests', () => {
    setupMocks({ corrections: [makeCorrection()] })
    render(<CorrectionsPanel />)
    fireEvent.click(screen.getByTestId('corrections-tab-mine'))
    fireEvent.click(screen.getByTestId('correction-row-corr-1'))
    expect(screen.getByTestId('correction-detail-cancel-btn')).toBeInTheDocument()
  })

  it('cancel in detail shows confirmation', () => {
    setupMocks({ corrections: [makeCorrection()] })
    render(<CorrectionsPanel />)
    fireEvent.click(screen.getByTestId('corrections-tab-mine'))
    fireEvent.click(screen.getByTestId('correction-row-corr-1'))
    fireEvent.click(screen.getByTestId('correction-detail-cancel-btn'))
    expect(screen.getByTestId('correction-detail-cancel-confirm-btn')).toBeInTheDocument()
    expect(screen.getByTestId('correction-detail-cancel-back-btn')).toBeInTheDocument()
  })

  // ── Show all + pagination ────────────────────────────────────────────────────

  it('shows "show all" button when more than 5 employees (pending)', () => {
    const corrections = Array.from({ length: 6 }, (_, i) =>
      makeCorrection({ id: `c${i}`, employee_id: `e${i}`, employee_name: `Employee ${i}` })
    )
    setupMocks({ corrections })
    render(<CorrectionsPanel />)
    expect(screen.getByTestId('corrections-show-all-btn')).toBeInTheDocument()
  })

  it('no "show all" button when 5 or fewer employees', () => {
    setupMocks({ corrections: [makeCorrection()] })
    render(<CorrectionsPanel />)
    expect(screen.queryByTestId('corrections-show-all-btn')).not.toBeInTheDocument()
  })

  it('show all button opens modal', () => {
    const corrections = Array.from({ length: 6 }, (_, i) =>
      makeCorrection({ id: `c${i}`, employee_id: `e${i}`, employee_name: `Employee ${i}` })
    )
    setupMocks({ corrections })
    render(<CorrectionsPanel />)
    fireEvent.click(screen.getByTestId('corrections-show-all-btn'))
    expect(screen.getByTestId('corrections-all-modal')).toBeInTheDocument()
  })

  it('shows pagination in modal when >10 groups', () => {
    const corrections = Array.from({ length: 11 }, (_, i) =>
      makeCorrection({ id: `c${i}`, employee_id: `e${i}`, employee_name: `Employee ${i}` })
    )
    setupMocks({ corrections })
    render(<CorrectionsPanel />)
    fireEvent.click(screen.getByTestId('corrections-show-all-btn'))
    expect(screen.getByTestId('corrections-modal-next-btn')).toBeInTheDocument()
    expect(screen.getByTestId('corrections-modal-prev-btn')).toBeInTheDocument()
  })

  it('no pagination in modal when ≤10 groups', () => {
    const corrections = Array.from({ length: 6 }, (_, i) =>
      makeCorrection({ id: `c${i}`, employee_id: `e${i}`, employee_name: `Employee ${i}` })
    )
    setupMocks({ corrections })
    render(<CorrectionsPanel />)
    fireEvent.click(screen.getByTestId('corrections-show-all-btn'))
    expect(screen.queryByTestId('corrections-modal-next-btn')).not.toBeInTheDocument()
  })
})
