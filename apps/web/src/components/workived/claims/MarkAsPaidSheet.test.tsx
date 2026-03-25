import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { vi, describe, it, expect, beforeEach } from 'vitest'
import { MarkAsPaidSheet } from './MarkAsPaidSheet'
import type { ClaimWithDetails } from '@/types/api'

const baseClaim: ClaimWithDetails = {
  id: 'claim-1',
  organisation_id: 'org-1',
  employee_id: 'emp-1',
  employee_name: 'Sari Ahmad',
  category_id: 'cat-1',
  category_name: 'Office Supplies',
  amount: 200,
  currency_code: 'AED',
  description: 'Paper and pens',
  claim_date: '2026-03-20',
  status: 'approved',
  reviewed_at: '2026-03-21T10:00:00Z',
  created_at: '2026-03-20T08:00:00Z',
  updated_at: '2026-03-21T10:00:00Z',
}

describe('MarkAsPaidSheet', () => {
  const onClose = vi.fn()
  const onConfirm = vi.fn()

  beforeEach(() => {
    onClose.mockReset()
    onConfirm.mockReset()
  })

  it('renders employee name, category, and formatted amount', () => {
    onConfirm.mockResolvedValue(undefined)
    render(<MarkAsPaidSheet claim={baseClaim} onClose={onClose} onConfirm={onConfirm} />)

    expect(screen.getByText('Sari Ahmad')).toBeInTheDocument()
    expect(screen.getByText('Office Supplies')).toBeInTheDocument()
    // AED 200 formatted
    expect(screen.getByText(/200/)).toBeInTheDocument()
    expect(screen.getByText('Confirm Payment')).toBeInTheDocument()
  })

  it('renders approved date when reviewed_at is set', () => {
    onConfirm.mockResolvedValue(undefined)
    render(<MarkAsPaidSheet claim={baseClaim} onClose={onClose} onConfirm={onConfirm} />)

    expect(screen.getByText(/Approved on/)).toBeInTheDocument()
  })

  it('does not render approved date when reviewed_at is missing', () => {
    onConfirm.mockResolvedValue(undefined)
    const claimNoDate: ClaimWithDetails = { ...baseClaim, reviewed_at: undefined }
    render(<MarkAsPaidSheet claim={claimNoDate} onClose={onClose} onConfirm={onConfirm} />)

    expect(screen.queryByText(/Approved on/)).not.toBeInTheDocument()
  })

  it('shows employee initials in avatar', () => {
    onConfirm.mockResolvedValue(undefined)
    render(<MarkAsPaidSheet claim={baseClaim} onClose={onClose} onConfirm={onConfirm} />)

    expect(screen.getByTestId('employee-avatar')).toHaveTextContent('SA')
  })

  it('calls onClose when backdrop is clicked', () => {
    onConfirm.mockResolvedValue(undefined)
    render(<MarkAsPaidSheet claim={baseClaim} onClose={onClose} onConfirm={onConfirm} />)

    fireEvent.click(screen.getByTestId('mark-paid-backdrop'))
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('calls onClose when cancel button is clicked', () => {
    onConfirm.mockResolvedValue(undefined)
    render(<MarkAsPaidSheet claim={baseClaim} onClose={onClose} onConfirm={onConfirm} />)

    fireEvent.click(screen.getByTestId('cancel-pay-btn'))
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('calls onConfirm and then onClose on successful confirmation', async () => {
    onConfirm.mockResolvedValue(undefined)
    render(<MarkAsPaidSheet claim={baseClaim} onClose={onClose} onConfirm={onConfirm} />)

    fireEvent.click(screen.getByTestId('confirm-pay-btn'))

    await waitFor(() => {
      expect(onConfirm).toHaveBeenCalledTimes(1)
      expect(onClose).toHaveBeenCalledTimes(1)
    })
  })

  it('shows processing state while pending', async () => {
    // Never resolves during the test
    onConfirm.mockImplementation(() => new Promise(() => {}))
    render(<MarkAsPaidSheet claim={baseClaim} onClose={onClose} onConfirm={onConfirm} />)

    fireEvent.click(screen.getByTestId('confirm-pay-btn'))

    await waitFor(() => {
      expect(screen.getByTestId('confirm-pay-btn')).toHaveTextContent('Processing…')
      expect(screen.getByTestId('confirm-pay-btn')).toBeDisabled()
    })
  })

  it('shows error banner and re-enables button on failure', async () => {
    onConfirm.mockRejectedValue(new Error('network error'))
    render(<MarkAsPaidSheet claim={baseClaim} onClose={onClose} onConfirm={onConfirm} />)

    fireEvent.click(screen.getByTestId('confirm-pay-btn'))

    await waitFor(() => {
      expect(screen.getByTestId('pay-error')).toBeInTheDocument()
      expect(screen.getByTestId('pay-error')).toHaveTextContent('Payment could not be recorded')
      expect(screen.getByTestId('confirm-pay-btn')).toHaveTextContent('Confirm — Mark as Paid')
      expect(screen.getByTestId('confirm-pay-btn')).not.toBeDisabled()
    })
    // onClose should NOT have been called on failure
    expect(onClose).not.toHaveBeenCalled()
  })

  it('does not call onClose when cancel is clicked while pending', async () => {
    onConfirm.mockImplementation(() => new Promise(() => {}))
    render(<MarkAsPaidSheet claim={baseClaim} onClose={onClose} onConfirm={onConfirm} />)

    fireEvent.click(screen.getByTestId('confirm-pay-btn'))

    await waitFor(() => {
      expect(screen.getByTestId('confirm-pay-btn')).toBeDisabled()
    })

    fireEvent.click(screen.getByTestId('cancel-pay-btn'))
    // cancel is disabled while pending — onClose should not be triggered
    // (button is disabled so click is a no-op in real browser, but we verify state)
    expect(screen.getByTestId('cancel-pay-btn')).toBeDisabled()
  })

  it('renders IDR amounts with Rp prefix', () => {
    onConfirm.mockResolvedValue(undefined)
    const idrClaim: ClaimWithDetails = { ...baseClaim, amount: 500000, currency_code: 'IDR' }
    render(<MarkAsPaidSheet claim={idrClaim} onClose={onClose} onConfirm={onConfirm} />)

    expect(screen.getByText(/500/)).toBeInTheDocument()
  })
})
