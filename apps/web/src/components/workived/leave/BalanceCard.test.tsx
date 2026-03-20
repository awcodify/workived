import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { BalanceCard } from '@/components/workived/leave/BalanceCard'
import type { LeaveBalanceWithPolicy } from '@/types/api'

// Mock Link component to avoid router setup
vi.mock('@tanstack/react-router', () => ({
  Link: ({ children, ...props }: any) => <a {...props}>{children}</a>,
}))

describe('BalanceCard', () => {
  const mockBalance: LeaveBalanceWithPolicy = {
    id: 'bal1',
    organisation_id: 'org1',
    employee_id: 'emp1',
    leave_policy_id: 'pol1',
    year: 2025,
    entitled_days: 12,
    carried_over_days: 3,
    used_days: 5,
    pending_days: 2,
    created_at: '2025-01-01T00:00:00Z',
    updated_at: '2025-01-01T00:00:00Z',
    policy_name: 'Annual Leave',
  }

  it('renders policy name', () => {
    render(<BalanceCard balance={mockBalance} />)
    expect(screen.getByText('Annual Leave')).toBeInTheDocument()
  })

  it('displays correct available days (entitled + carried - used - pending)', () => {
    render(<BalanceCard balance={mockBalance} />)
    // 12 + 3 - 5 - 2 = 8.0
    expect(screen.getByText('8.0')).toBeInTheDocument()
    expect(screen.getByText('days available')).toBeInTheDocument()
  })

  it('shows stats breakdown', () => {
    render(<BalanceCard balance={mockBalance} />)
    // Entitled section
    expect(screen.getByText('Entitled')).toBeInTheDocument()
    expect(screen.getByText('12')).toBeInTheDocument()
    // Used section
    expect(screen.getByText('Used')).toBeInTheDocument()
    expect(screen.getByText('5')).toBeInTheDocument()
    // Should show carried over (3) in the third column since carried_over_days > 0
    expect(screen.getByText('Carried')).toBeInTheDocument()
    expect(screen.getByText('3')).toBeInTheDocument()
  })

  it('shows pending badge when pending days > 0', () => {
    render(<BalanceCard balance={mockBalance} />)
    expect(screen.getByText('2 pending')).toBeInTheDocument()
  })

  it('shows year info', () => {
    render(<BalanceCard balance={mockBalance} />)
    expect(screen.getByText('2025')).toBeInTheDocument()
  })

  it('renders progress bar with legend', () => {
    render(<BalanceCard balance={mockBalance} />)
    expect(screen.getByText('Usage')).toBeInTheDocument()
    // Legend items
    expect(screen.getByText('Used')).toBeInTheDocument()
    expect(screen.getByText('Pending')).toBeInTheDocument()
    expect(screen.getByText('Available')).toBeInTheDocument()
  })

  it('handles zero carried over days', () => {
    const balanceNoCarry: LeaveBalanceWithPolicy = {
      ...mockBalance,
      carried_over_days: 0,
    }
    render(<BalanceCard balance={balanceNoCarry} />)
    // 12 + 0 - 5 - 2 = 5.0
    expect(screen.getByText('5.0')).toBeInTheDocument()
    // Should show pending in third column when no carried over
    expect(screen.getByText('Pending')).toBeInTheDocument()
  })

  it('handles fully used balance', () => {
    const fullyUsed: LeaveBalanceWithPolicy = {
      ...mockBalance,
      entitled_days: 10,
      carried_over_days: 0,
      used_days: 10,
      pending_days: 0,
    }
    render(<BalanceCard balance={fullyUsed} />)
    expect(screen.getByText('0.0')).toBeInTheDocument()
    expect(screen.getByText('Exhausted')).toBeInTheDocument()
  })

  it('handles negative available (overused)', () => {
    const overused: LeaveBalanceWithPolicy = {
      ...mockBalance,
      entitled_days: 10,
      carried_over_days: 0,
      used_days: 12,
      pending_days: 0,
    }
    render(<BalanceCard balance={overused} />)
    // 10 - 12 = -2.0
    expect(screen.getByText('-2.0')).toBeInTheDocument()
    expect(screen.getByText('Exhausted')).toBeInTheDocument()
  })

  it('shows low balance badge when available < 20% of total', () => {
    const lowBalance: LeaveBalanceWithPolicy = {
      ...mockBalance,
      entitled_days: 10,
      carried_over_days: 0,
      used_days: 9,
      pending_days: 0,
    }
    render(<BalanceCard balance={lowBalance} />)
    // 1 / 10 = 10% < 20%
    expect(screen.getByText('Low')).toBeInTheDocument()
  })

  it('renders quick action button when showActions=true', () => {
    render(<BalanceCard balance={mockBalance} showActions={true} />)
    expect(screen.getByText('Request Leave')).toBeInTheDocument()
  })

  it('does not render quick action button by default', () => {
    render(<BalanceCard balance={mockBalance} />)
    expect(screen.queryByText('Request Leave')).not.toBeInTheDocument()
  })

  it('applies overview variant styles', () => {
    const { container } = render(<BalanceCard balance={mockBalance} variant="overview" />)
    // Just verify it renders without error - visual styles are harder to test
    expect(container).toBeInTheDocument()
  })

  it('applies compact variant - hides year and legend', () => {
    render(<BalanceCard balance={mockBalance} variant="compact" />)
    // Year should not be shown in compact
    expect(screen.queryByText('2025')).not.toBeInTheDocument()
    // Legend items should not be shown
    const usedLabels = screen.queryAllByText('Used')
    // Only one 'Used' from the inline stats, not from legend
    expect(usedLabels).toHaveLength(1)
  })

  it('compact variant shows inline stats', () => {
    render(<BalanceCard balance={mockBalance} variant="compact" />)
    // Should have inline stats text
    expect(screen.getByText(/Entitled:/)).toBeInTheDocument()
    expect(screen.getByText(/Used:/)).toBeInTheDocument()
  })

  it('does not break with very long policy names', () => {
    const longName: LeaveBalanceWithPolicy = {
      ...mockBalance,
      policy_name: 'Very Long Leave Policy Name That Should Be Truncated Or Wrapped',
    }
    render(<BalanceCard balance={longName} />)
    expect(
      screen.getByText('Very Long Leave Policy Name That Should Be Truncated Or Wrapped')
    ).toBeInTheDocument()
  })
})
