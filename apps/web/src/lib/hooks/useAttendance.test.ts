import { attendanceKeys } from '@/lib/hooks/useAttendance'

describe('attendanceKeys', () => {
  it('all returns ["attendance"]', () => {
    expect(attendanceKeys.all).toEqual(['attendance'])
  })

  it('today("emp-1") returns correct key', () => {
    expect(attendanceKeys.today('emp-1')).toEqual(['attendance', 'today', 'emp-1'])
  })

  it('daily("2026-03-18") returns correct key', () => {
    expect(attendanceKeys.daily('2026-03-18')).toEqual(['attendance', 'daily', '2026-03-18'])
  })

  it('monthly(2026, 3) returns correct key', () => {
    expect(attendanceKeys.monthly(2026, 3)).toEqual(['attendance', 'monthly', 2026, 3])
  })

  it('employeeMonthly("emp-1", 2026, 3) returns correct key', () => {
    expect(attendanceKeys.employeeMonthly('emp-1', 2026, 3)).toEqual([
      'attendance',
      'employee-monthly',
      'emp-1',
      2026,
      3,
    ])
  })
})
