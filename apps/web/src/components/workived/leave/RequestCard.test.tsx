import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { RequestCard } from '@/components/workived/leave/RequestCard'
import type { LeaveRequestWithDetails } from '@/types/api'

// Mock the hook
vi.mock('@/lib/hooks/useLeave', () => ({
  useCancelRequest: () => ({
    mutateAsync: vi.fn(),
    isPending: false,
  }),
}))

describe('RequestCard', () => {
  const mockRequest: LeaveRequestWithDetails = {
    id: 'req1',
    organisation_id: 'org1',
    employee_id: 'emp1',
    leave_policy_id: 'pol1',
    start_date: '2025-01-10',
    end_date: '2025-01-15',
    total_days: 4, // Working days
    status: 'pending',
    reason: 'Family vacation',
    created_at: '2025-01-01T00:00:00Z',
    updated_at: '2025-01-01T00:00:00Z',
    employee_name: 'John Doe',
    policy_name: 'Annual Leave',
  }

  it('renders request details (my variant)', () => {
    render(<RequestCard request={mockRequest} variant="my" />)
    
    expect(screen.getByText('Annual Leave')).toBeInTheDocument()
    expect(screen.getByText(/Jan 10.*15/)).toBeInTheDocument()
    expect(screen.getByText(/4 days/)).toBeInTheDocument()
    expect(screen.getByText('Family vacation')).toBeInTheDocument()
  })

  it('renders employee name (team variant)', () => {
    render(<RequestCard request={mockRequest} variant="team" />)
    
    expect(screen.getByText('John Doe')).toBeInTheDocument()
  })

  it('does not render employee name (my variant)', () => {
    render(<RequestCard request={mockRequest} variant="my" />)
    
    expect(screen.queryByText('John Doe')).not.toBeInTheDocument()
  })

  it('shows status indicator for pending', () => {
    render(<RequestCard request={mockRequest} variant="my" />)
    
    expect(screen.getByText('Pending')).toBeInTheDocument()
  })

  it('shows status indicator for approved', () => {
    const approved: LeaveRequestWithDetails = {
      ...mockRequest,
      status: 'approved',
      reviewed_at: '2025-01-02T00:00:00Z',
      reviewed_by: 'manager1',
    }
    render(<RequestCard request={approved} variant="my" />)
    
    expect(screen.getByText('Approved')).toBeInTheDocument()
  })

  it('shows status indicator for rejected', () => {
    const rejected: LeaveRequestWithDetails = {
      ...mockRequest,
      status: 'rejected',
      reviewed_at: '2025-01-02T00:00:00Z',
      reviewed_by: 'manager1',
      review_note: 'Insufficient coverage',
    }
    render(<RequestCard request={rejected} variant="my" />)
    
    expect(screen.getByText('Rejected')).toBeInTheDocument()
  })

  it('shows rejection note when rejected', () => {
    const rejected: LeaveRequestWithDetails = {
      ...mockRequest,
      status: 'rejected',
      reviewed_at: '2025-01-02T00:00:00Z',
      reviewed_by: 'manager1',
      review_note: 'Insufficient coverage',
    }
    render(<RequestCard request={rejected} variant="my" />)
    
    expect(screen.getByText(/Insufficient coverage/)).toBeInTheDocument()
  })

  it('shows cancel button for pending requests', () => {
    render(<RequestCard request={mockRequest} variant="my" />)
    
    expect(screen.getByText('Cancel')).toBeInTheDocument()
  })

  it('does not show cancel button for approved requests', () => {
    const approved: LeaveRequestWithDetails = {
      ...mockRequest,
      status: 'approved',
    }
    render(<RequestCard request={approved} variant="my" />)
    
    expect(screen.queryByText('Cancel')).not.toBeInTheDocument()
  })

  it('shows confirmation on first click of cancel', () => {
    render(<RequestCard request={mockRequest} variant="my" />)
    
    const cancelButton = screen.getByText('Cancel')
    fireEvent.click(cancelButton)
    
    expect(screen.getByText('Confirm?')).toBeInTheDocument()
  })

  it('handles request without reason', () => {
    const noReason: LeaveRequestWithDetails = {
      ...mockRequest,
      reason: undefined,
    }
    render(<RequestCard request={noReason} variant="my" />)
    
    expect(screen.queryByText('Family vacation')).not.toBeInTheDocument()
  })

  it('truncates very long reasons', () => {
    const longReason: LeaveRequestWithDetails = {
      ...mockRequest,
      reason: 'A'.repeat(200),
    }
    const { container } = render(<RequestCard request={longReason} variant="my" />)
    
    // Should have CSS truncation applied
    const reasonElement = container.querySelector('[class*="truncate"]')
    expect(reasonElement).toBeInTheDocument()
  })

  it('displays single day correctly', () => {
    const singleDay: LeaveRequestWithDetails = {
      ...mockRequest,
      start_date: '2025-01-10',
      end_date: '2025-01-10',
      total_days: 1,
    }
    render(<RequestCard request={singleDay} variant="my" />)
    
    expect(screen.getByText(/Jan 10/)).toBeInTheDocument()
    expect(screen.getByText(/1 day/)).toBeInTheDocument()
  })

  it('shows cancelled status', () => {
    const cancelled: LeaveRequestWithDetails = {
      ...mockRequest,
      status: 'cancelled',
    }
    render(<RequestCard request={cancelled} variant="my" />)
    
    expect(screen.getByText('Cancelled')).toBeInTheDocument()
    expect(screen.queryByText('Cancel')).not.toBeInTheDocument()
  })
})
