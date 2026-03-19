import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { BalanceCard } from '@/components/workived/leave/BalanceCard'
import type { LeaveBalanceWithPolicy } from '@/types/api'

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
    // 12 + 3 - 5 - 2 = 8
    expect(screen.getByText('8')).toBeInTheDocument()
  })

  it('shows breakdown of days', () => {
    render(<BalanceCard balance={mockBalance} />)
    expect(screen.getByText(/12 days granted/)).toBeInTheDocument()
    expect(screen.getByText(/3 carried over/)).toBeInTheDocument()
    expect(screen.getByText(/5.*15 used/)).toBeInTheDocument()
    expect(screen.getByText(/2 pending/)).toBeInTheDocument()
  })

  it('renders progress bar', () => {
    const { container } = render(<BalanceCard balance={mockBalance} />)
    const progressBars = container.querySelectorAll('[style*="width"]')
    expect(progressBars.length).toBeGreaterThan(0)
  })

  it('handles zero carried over days', () => {
    const balanceNoCarry: LeaveBalanceWithPolicy = {
      ...mockBalance,
      carried_over_days: 0,
    }
    render(<BalanceCard balance={balanceNoCarry} />)
    // 12 + 0 - 5 - 2 = 5
    expect(screen.getByText('5')).toBeInTheDocument()
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
    expect(screen.getByText('0')).toBeInTheDocument()
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
    // 10 - 12 = -2
    expect(screen.getByText('-2')).toBeInTheDocument()
  })

  it('shows pending indicator when pending days > 0', () => {
    render(<BalanceCard balance={mockBalance} />)
    expect(screen.getByText(/2 pending/)).toBeInTheDocument()
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
