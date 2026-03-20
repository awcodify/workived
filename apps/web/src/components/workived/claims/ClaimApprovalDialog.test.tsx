import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { ClaimApprovalDialog } from '@/components/workived/claims/ClaimApprovalDialog'
import type { ClaimWithDetails } from '@/types/api'

// Mock the hooks
vi.mock('@/lib/hooks/useClaims', () => ({
  useApproveClaim: () => ({
    mutateAsync: vi.fn().mockResolvedValue({}),
    isPending: false,
    isSuccess: false,
  }),
  useRejectClaim: () => ({
    mutateAsync: vi.fn().mockResolvedValue({}),
    isPending: false,
    isSuccess: false,
  }),
}))

describe('ClaimApprovalDialog', () => {
  const mockClaim: ClaimWithDetails = {
    id: 'claim1',
    organisation_id: 'org1',
    employee_id: 'emp1',
    category_id: 'cat1',
    amount: 50000,
    currency_code: 'IDR',
    description: 'Team lunch',
    receipt_url: 'https://example.com/receipt.pdf',
    status: 'pending',
    claim_date: '2026-03-15',
    created_at: '2026-03-15T00:00:00Z',
    updated_at: '2026-03-15T00:00:00Z',
    employee_name: 'John Doe',
    category_name: 'Meals & Entertainment',
  }

  const mockOnClose = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders claim details', () => {
    render(<ClaimApprovalDialog claim={mockClaim} onClose={mockOnClose} />)
    
    expect(screen.getByText('John Doe')).toBeInTheDocument()
    expect(screen.getByText('Meals & Entertainment')).toBeInTheDocument()  
    expect(screen.getByText(/IDR.*50,000/)).toBeInTheDocument()
    expect(screen.getByText('Team lunch')).toBeInTheDocument()
  })

  it('shows approve and reject buttons', () => {
    render(<ClaimApprovalDialog claim={mockClaim} onClose={mockOnClose} />)
    
    expect(screen.getByText('Approve')).toBeInTheDocument()
    expect(screen.getByText('Reject')).toBeInTheDocument()
  })

  it('shows note textarea', () => {
    render(<ClaimApprovalDialog claim={mockClaim} onClose={mockOnClose} />)
    
    const textarea = screen.getByPlaceholderText(/Add a note/i)
    expect(textarea).toBeInTheDocument()
  })

  it('allows entering note text', () => {
    render(<ClaimApprovalDialog claim={mockClaim} onClose={mockOnClose} />)
    
    const textarea = screen.getByPlaceholderText(/Add a note/i)
    fireEvent.change(textarea, { target: { value: 'Approved for payment' } })
    
    expect(textarea).toHaveValue('Approved for payment')
  })

  it('does not require note for approval', async () => {
    render(<ClaimApprovalDialog claim={mockClaim} onClose={mockOnClose} />)
    
    const approveButton = screen.getByText('Approve')
    fireEvent.click(approveButton)
    
    // Should not show validation error
    await waitFor(() => {
      const errors = screen.queryAllByText(/minimum 10 characters/i)
      expect(errors).toHaveLength(0)
    })
  })

  it('requires note for rejection (minimum 10 characters)', async () => {
    render(<ClaimApprovalDialog claim={mockClaim} onClose={mockOnClose} />)
    
    const rejectButton = screen.getByText('Reject')
    fireEvent.click(rejectButton)
    
    // Should show validation error
    await waitFor(() => {
      expect(screen.getByText(/Rejection reason is required.*minimum 10 characters/i)).toBeInTheDocument()
    })
  })

  it('shows receipt link when available', () => {
    render(<ClaimApprovalDialog claim={mockClaim} onClose={mockOnClose} />)
    
    const receiptLink = screen.getByText('View Receipt →')
    expect(receiptLink).toBeInTheDocument()
    expect(receiptLink).toHaveAttribute('href', mockClaim.receipt_url)
    expect(receiptLink).toHaveAttribute('target', '_blank')
  })

  it('calls onClose when cancel button is clicked', () => {
    render(<ClaimApprovalDialog claim={mockClaim} onClose={mockOnClose} />)
    
    const cancelButton = screen.getByText('Cancel')
    fireEvent.click(cancelButton)
    
    expect(mockOnClose).toHaveBeenCalledTimes(1)
  })

  it('calls onClose when backdrop is clicked', () => {
    const { container } = render(<ClaimApprovalDialog claim={mockClaim} onClose={mockOnClose} />)
    
    const backdrop = container.querySelector('.fixed.inset-0.z-40')
    fireEvent.click(backdrop!)
    
    expect(mockOnClose).toHaveBeenCalledTimes(1)
  })

  it('formats currency amount with separators', () => {
    const largeAmountClaim = { ...mockClaim, amount: 1500000 }
    render(<ClaimApprovalDialog claim={largeAmountClaim} onClose={mockOnClose} />)
    
    expect(screen.getByText(/IDR.*1,500,000/)).toBeInTheDocument()
  })
})
