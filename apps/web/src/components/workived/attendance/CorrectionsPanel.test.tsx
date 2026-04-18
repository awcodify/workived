import React from 'react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'

vi.mock('@/lib/hooks/useAttendance', () => ({
  useCorrections: vi.fn(),
  useApproveCorrection: vi.fn(),
  useRejectCorrection: vi.fn(),
}))

import { useCorrections, useApproveCorrection, useRejectCorrection } from '@/lib/hooks/useAttendance'
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

function setupMocks(corrections: AttendanceCorrection[] = [], loading = false) {
  vi.mocked(useCorrections).mockReturnValue({
    data: corrections,
    isLoading: loading,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any)
  vi.mocked(useApproveCorrection).mockReturnValue({
    mutate: vi.fn(),
    isPending: false,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any)
  vi.mocked(useRejectCorrection).mockReturnValue({
    mutate: vi.fn(),
    isPending: false,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any)
}

describe('CorrectionsPanel', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders panel', () => {
    setupMocks()
    render(<CorrectionsPanel onClose={vi.fn()} />)
    expect(screen.getByTestId('corrections-panel')).toBeInTheDocument()
  })

  it('shows close button', () => {
    const onClose = vi.fn()
    setupMocks()
    render(<CorrectionsPanel onClose={onClose} />)
    fireEvent.click(screen.getByTestId('corrections-panel-close-btn'))
    expect(onClose).toHaveBeenCalled()
  })

  it('shows empty state when no corrections', () => {
    setupMocks([])
    render(<CorrectionsPanel onClose={vi.fn()} />)
    expect(screen.getByTestId('corrections-empty')).toBeInTheDocument()
  })

  it('shows loading state', () => {
    setupMocks([], true)
    render(<CorrectionsPanel onClose={vi.fn()} />)
    expect(screen.getByTestId('corrections-skeleton')).toBeInTheDocument()
  })

  it('shows correction row with employee name', () => {
    setupMocks([makeCorrection({ employee_name: 'Siti Rahayu' })])
    render(<CorrectionsPanel onClose={vi.fn()} />)
    expect(screen.getByTestId('correction-row-corr-1')).toBeInTheDocument()
    expect(screen.getAllByText('Siti Rahayu').length).toBeGreaterThan(0)
  })

  it('shows approve and reject buttons for pending corrections', () => {
    setupMocks([makeCorrection()])
    render(<CorrectionsPanel onClose={vi.fn()} />)
    expect(screen.getByTestId('correction-approve-btn-corr-1')).toBeInTheDocument()
    expect(screen.getByTestId('correction-reject-btn-corr-1')).toBeInTheDocument()
  })

  it('calls approve mutation on approve click', () => {
    const mutate = vi.fn()
    setupMocks([makeCorrection()])
    vi.mocked(useApproveCorrection).mockReturnValue({
      mutate,
      isPending: false,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any)

    render(<CorrectionsPanel onClose={vi.fn()} />)
    fireEvent.click(screen.getByTestId('correction-approve-btn-corr-1'))
    expect(mutate).toHaveBeenCalled()
    expect(mutate.mock.calls[0][0]).toBe('corr-1')
  })

  it('shows reject reason input after clicking reject', () => {
    setupMocks([makeCorrection()])
    render(<CorrectionsPanel onClose={vi.fn()} />)
    fireEvent.click(screen.getByTestId('correction-reject-btn-corr-1'))
    expect(screen.getByTestId('correction-reject-reason-input-corr-1')).toBeInTheDocument()
    expect(screen.getByTestId('correction-reject-confirm-btn-corr-1')).toBeInTheDocument()
  })

  it('renders filter buttons', () => {
    setupMocks()
    render(<CorrectionsPanel onClose={vi.fn()} />)
    expect(screen.getByTestId('corrections-filter-all-btn')).toBeInTheDocument()
    expect(screen.getByTestId('corrections-filter-pending-btn')).toBeInTheDocument()
    expect(screen.getByTestId('corrections-filter-approved-btn')).toBeInTheDocument()
    expect(screen.getByTestId('corrections-filter-rejected-btn')).toBeInTheDocument()
  })

  it('does not show approve/reject for approved corrections', () => {
    setupMocks([makeCorrection({ status: 'approved' })])
    render(<CorrectionsPanel onClose={vi.fn()} />)
    expect(screen.queryByTestId('correction-approve-btn-corr-1')).not.toBeInTheDocument()
    expect(screen.queryByTestId('correction-reject-btn-corr-1')).not.toBeInTheDocument()
  })
})
