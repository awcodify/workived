import { describe, it, expect } from 'vitest'
import {
  calculateWorkingDays,
  isExcludedDate,
  hasOverlap,
  calculateAvailableDays,
  formatDateRange,
  groupByStatus,
  canCancelRequest,
} from '@/lib/utils/leave'
import type { LeaveRequestWithDetails } from '@/types/api'

describe('calculateWorkingDays', () => {
  const workDays = [1, 2, 3, 4, 5] // Monday to Friday
  const publicHolidays = ['2025-01-01', '2025-01-25'] // New Year and Australia Day

  it('calculates working days correctly for same day', () => {
    const result = calculateWorkingDays({
      startDate: '2025-01-06',
      endDate: '2025-01-06',
      workDays,
      publicHolidays,
    })
    expect(result).toBe(1) // Monday
  })

  it('calculates working days for a full week', () => {
    const result = calculateWorkingDays({
      startDate: '2025-01-06',
      endDate: '2025-01-10',
      workDays,
      publicHolidays,
    })
    expect(result).toBe(5) // Mon-Fri
  })

  it('excludes weekends from count', () => {
    const result = calculateWorkingDays({
      startDate: '2025-01-06',
      endDate: '2025-01-12',
      workDays,
      publicHolidays,
    })
    expect(result).toBe(5) // Mon-Fri (excludes Sat-Sun)
  })

  it('excludes public holidays from count', () => {
    const result = calculateWorkingDays({
      startDate: '2024-12-30',
      endDate: '2025-01-02',
      workDays,
      publicHolidays,
    })
    expect(result).toBe(3) // Mon 30, Tue 31, Thu 2 (excludes Wed 1 Jan holiday)
  })

  it('excludes both weekends and holidays', () => {
    const result = calculateWorkingDays({
      startDate: '2025-01-24',
      endDate: '2025-01-27',
      workDays,
      publicHolidays,
    })
    expect(result).toBe(2) // Fri 24 + Mon 27 (excludes Sat 25 holiday+weekend, Sun 26 weekend)
  })

  it('returns 0 for date range with no working days', () => {
    const result = calculateWorkingDays({
      startDate: '2025-01-11',
      endDate: '2025-01-12',
      workDays,
      publicHolidays,
    })
    expect(result).toBe(0) // Sat-Sun
  })

  it('handles different work days (including Saturday)', () => {
    const sixDayWeek = [1, 2, 3, 4, 5, 6] // Mon-Sat
    const result = calculateWorkingDays({
      startDate: '2025-01-06',
      endDate: '2025-01-12',
      workDays: sixDayWeek,
      publicHolidays: [],
    })
    expect(result).toBe(6) // Mon-Sat
  })

  it('handles cross-month ranges', () => {
    const result = calculateWorkingDays({
      startDate: '2024-12-30',
      endDate: '2025-01-03',
      workDays,
      publicHolidays: [],
    })
    expect(result).toBe(5) // Mon 30, Tue 31, Thu 2, Fri 3
  })
})

describe('isExcludedDate', () => {
  const workDays = [1, 2, 3, 4, 5]
  const holidays = ['2025-01-01']

  it('returns true for weekends (Sunday)', () => {
    expect(isExcludedDate('2025-01-05', workDays, holidays)).toBe(true)
  })

  it('returns true for weekends (Saturday)', () => {
    expect(isExcludedDate('2025-01-04', workDays, holidays)).toBe(true)
  })

  it('returns true for public holidays', () => {
    expect(isExcludedDate('2025-01-01', workDays, holidays)).toBe(true)
  })

  it('returns false for regular working days', () => {
    expect(isExcludedDate('2025-01-06', workDays, holidays)).toBe(false)
  })

  it('handles holidays on weekends correctly', () => {
    const holidaysOnWeekend = ['2025-01-04'] // Saturday
    expect(isExcludedDate('2025-01-04', workDays, holidaysOnWeekend)).toBe(true)
  })
})

describe('hasOverlap', () => {
  it('detects exact overlap', () => {
    const existing = [{ start_date: '2025-01-01', end_date: '2025-01-10', status: 'approved' }]
    const result = hasOverlap('2025-01-01', '2025-01-10', existing)
    expect(result).toBe(true)
  })

  it('detects partial overlap (start within existing)', () => {
    const existing = [{ start_date: '2025-01-01', end_date: '2025-01-10', status: 'approved' }]
    const result = hasOverlap('2025-01-05', '2025-01-15', existing)
    expect(result).toBe(true)
  })

  it('detects partial overlap (end within existing)', () => {
    const existing = [{ start_date: '2025-01-01', end_date: '2025-01-10', status: 'approved' }]
    const result = hasOverlap('2024-12-25', '2025-01-05', existing)
    expect(result).toBe(true)
  })

  it('detects containment (new range contains existing)', () => {
    const existing = [{ start_date: '2025-01-10', end_date: '2025-01-15', status: 'approved' }]
    const result = hasOverlap('2025-01-01', '2025-01-31', existing)
    expect(result).toBe(true)
  })

  it('detects containment (existing contains new)', () => {
    const existing = [{ start_date: '2025-01-01', end_date: '2025-01-31', status: 'approved' }]
    const result = hasOverlap('2025-01-10', '2025-01-15', existing)
    expect(result).toBe(true)
  })

  it('returns false for adjacent ranges (no overlap)', () => {
    const existing = [{ start_date: '2025-01-01', end_date: '2025-01-10', status: 'approved' }]
    const result = hasOverlap('2025-01-11', '2025-01-20', existing)
    expect(result).toBe(false)
  })

  it('returns false for separate ranges', () => {
    const existing = [{ start_date: '2025-01-01', end_date: '2025-01-10', status: 'approved' }]
    const result = hasOverlap('2025-02-01', '2025-02-10', existing)
    expect(result).toBe(false)
  })

  it('handles same-day ranges', () => {
    const existing = [{ start_date: '2025-01-10', end_date: '2025-01-10', status: 'approved' }]
    const result = hasOverlap('2025-01-10', '2025-01-10', existing)
    expect(result).toBe(true)
  })

  it('ignores cancelled and rejected requests', () => {
    const existing = [
      { start_date: '2025-01-01', end_date: '2025-01-10', status: 'cancelled' },
      { start_date: '2025-01-01', end_date: '2025-01-10', status: 'rejected' }
    ]
    const result = hasOverlap('2025-01-01', '2025-01-10', existing)
    expect(result).toBe(false)
  })

  it('detects overlap with pending requests', () => {
    const existing = [{ start_date: '2025-01-01', end_date: '2025-01-10', status: 'pending' }]
    const result = hasOverlap('2025-01-05', '2025-01-15', existing)
    expect(result).toBe(true)
  })
})

describe('calculateAvailableDays', () => {
  it('calculates available days correctly', () => {
    const result = calculateAvailableDays({
      entitled_days: 12,
      carried_over_days: 5,
      used_days: 2,
      pending_days: 1,
    })
    expect(result).toBe(14) // 12 + 5 - 2 - 1
  })

  it('handles zero values', () => {
    const result = calculateAvailableDays({
      entitled_days: 12,
      carried_over_days: 0,
      used_days: 0,
      pending_days: 0,
    })
    expect(result).toBe(12)
  })

  it('can return negative for overused leave', () => {
    const result = calculateAvailableDays({
      entitled_days: 10,
      carried_over_days: 0,
      used_days: 12,
      pending_days: 0,
    })
    expect(result).toBe(-2)
  })

  it('accounts for pending leave', () => {
    const result = calculateAvailableDays({
      entitled_days: 15,
      carried_over_days: 3,
      used_days: 5,
      pending_days: 8,
    })
    expect(result).toBe(5) // 15 + 3 - 5 - 8
  })
})

describe('formatDateRange', () => {
  it('formats single day correctly', () => {
    const result = formatDateRange('2025-01-10', '2025-01-10')
    expect(result).toMatch(/Jan 10/) // Locale-dependent
  })

  it('formats date range in same month', () => {
    const result = formatDateRange('2025-01-10', '2025-01-15')
    expect(result).toMatch(/Jan 10.*15/) // Should show both days
  })

  it('formats date range across months', () => {
    const result = formatDateRange('2025-01-28', '2025-02-03')
    expect(result).toMatch(/Jan 28/) // Should show both months
    expect(result).toMatch(/Feb 3/)
  })

  it('formats date range across years', () => {
    const result = formatDateRange('2024-12-28', '2025-01-05')
    expect(result).toMatch(/Dec 28/)
    expect(result).toMatch(/Jan 5/)
  })

  it('includes day count when provided', () => {
    const result = formatDateRange('2025-01-10', '2025-01-15', 4)
    expect(result).toMatch(/4 days/)
  })

  it('uses singular for 1 day', () => {
    const result = formatDateRange('2025-01-10', '2025-01-10', 1)
    expect(result).toMatch(/1 day/)
    expect(result).not.toMatch(/days/)
  })
})

describe('groupByStatus', () => {
  const mockRequests: LeaveRequestWithDetails[] = [
    {
      id: '1',
      organisation_id: 'org1',
      employee_id: 'emp1',
      leave_policy_id: 'pol1',
      start_date: '2025-01-01',
      end_date: '2025-01-05',
      total_days: 5,
      status: 'pending',
      created_at: '2025-01-01T00:00:00Z',
      updated_at: '2025-01-01T00:00:00Z',
      employee_name: 'John Doe',
      policy_name: 'Annual Leave',
    },
    {
      id: '2',
      organisation_id: 'org1',
      employee_id: 'emp1',
      leave_policy_id: 'pol1',
      start_date: '2025-02-01',
      end_date: '2025-02-03',
      total_days: 3,
      status: 'approved',
      created_at: '2025-01-01T00:00:00Z',
      updated_at: '2025-01-01T00:00:00Z',
      reviewed_at: '2025-01-02T00:00:00Z',
      reviewed_by: 'manager1',
      employee_name: 'John Doe',
      policy_name: 'Annual Leave',
    },
    {
      id: '3',
      organisation_id: 'org1',
      employee_id: 'emp1',
      leave_policy_id: 'pol1',
      start_date: '2025-03-01',
      end_date: '2025-03-02',
      total_days: 2,
      status: 'rejected',
      created_at: '2025-01-01T00:00:00Z',
      updated_at: '2025-01-01T00:00:00Z',
      reviewed_at: '2025-01-02T00:00:00Z',
      reviewed_by: 'manager1',
      review_note: 'Busy period',
      employee_name: 'John Doe',
      policy_name: 'Annual Leave',
    },
    {
      id: '4',
      organisation_id: 'org1',
      employee_id: 'emp1',
      leave_policy_id: 'pol1',
      start_date: '2025-04-01',
      end_date: '2025-04-01',
      total_days: 1,
      status: 'pending',
      created_at: '2025-01-01T00:00:00Z',
      updated_at: '2025-01-01T00:00:00Z',
      employee_name: 'John Doe',
      policy_name: 'Annual Leave',
    },
  ]

  it('groups requests by status correctly', () => {
    const result = groupByStatus(mockRequests)
    
    expect(result.pending).toHaveLength(2)
    expect(result.approved).toHaveLength(1)
    expect(result.rejected).toHaveLength(1)
    expect(result.cancelled).toHaveLength(0)
  })

  it('handles empty array', () => {
    const result = groupByStatus([])
    
    expect(result.pending).toHaveLength(0)
    expect(result.approved).toHaveLength(0)
    expect(result.rejected).toHaveLength(0)
    expect(result.cancelled).toHaveLength(0)
  })

  it('groups cancelled requests', () => {
    const withCancelled: LeaveRequestWithDetails[] = [
      ...mockRequests,
      {
        id: '5',
        organisation_id: 'org1',
        employee_id: 'emp1',
        leave_policy_id: 'pol1',
        start_date: '2025-05-01',
        end_date: '2025-05-01',
        total_days: 1,
        status: 'cancelled',
        created_at: '2025-01-01T00:00:00Z',
        updated_at: '2025-01-01T00:00:00Z',
        employee_name: 'John Doe',
        policy_name: 'Annual Leave',
      },
    ]
    const result = groupByStatus(withCancelled)
    
    expect(result.cancelled).toHaveLength(1)
  })
})

describe('canCancelRequest', () => {
  it('allows cancelling pending requests', () => {
    expect(canCancelRequest('pending')).toBe(true)
  })

  it('prevents cancelling approved requests', () => {
    expect(canCancelRequest('approved')).toBe(false)
  })

  it('prevents cancelling rejected requests', () => {
    expect(canCancelRequest('rejected')).toBe(false)
  })

  it('prevents cancelling already cancelled requests', () => {
    expect(canCancelRequest('cancelled')).toBe(false)
  })
})
