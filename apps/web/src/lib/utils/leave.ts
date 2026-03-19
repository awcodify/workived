import type { LeaveRequestWithDetails } from '@/types/api'

interface WorkingDaysParams {
  startDate: string // YYYY-MM-DD
  endDate: string // YYYY-MM-DD
  workDays: number[] // [1,2,3,4,5] = Mon-Fri (1=Mon, 7=Sun)
  publicHolidays: string[] // ['2026-03-20', '2026-03-21']
}

/**
 * Calculate working days between start and end (inclusive),
 * excluding weekends (based on org work_days) and public holidays.
 *
 * @param params - Configuration for working days calculation
 * @returns Number of working days
 */
export function calculateWorkingDays(params: WorkingDaysParams): number {
  const { startDate, endDate, workDays, publicHolidays } = params

  const start = new Date(startDate)
  const end = new Date(endDate)
  const holidaySet = new Set(publicHolidays)

  let count = 0
  const current = new Date(start)

  while (current <= end) {
    // Convert JS day (0=Sun, 6=Sat) to ISO day (1=Mon, 7=Sun)
    const jsDay = current.getDay()
    const isoDay = jsDay === 0 ? 7 : jsDay

    // Format current date as YYYY-MM-DD
    const dateISO = current.toISOString().split('T')[0]

    // Count if it's a work day and not a holiday
    if (workDays.includes(isoDay) && !holidaySet.has(dateISO!)) {
      count++
    }

    current.setDate(current.getDate() + 1)
  }

  return count
}

/**
 * Check if a date falls on a weekend or public holiday
 *
 * @param date - Date string in YYYY-MM-DD format
 * @param workDays - Array of work days (1=Mon, 7=Sun)
 * @param publicHolidays - Array of holiday dates
 * @returns true if the date should be excluded
 */
export function isExcludedDate(
  date: string,
  workDays: number[],
  publicHolidays: string[]
): boolean {
  const d = new Date(date)
  const jsDay = d.getDay()
  const isoDay = jsDay === 0 ? 7 : jsDay

  const isWeekend = !workDays.includes(isoDay)
  const isHoliday = publicHolidays.includes(date)

  return isWeekend || isHoliday
}

/**
 * Check if a date range overlaps with existing approved/pending leave
 *
 * @param startDate - Start date in YYYY-MM-DD format
 * @param endDate - End date in YYYY-MM-DD format
 * @param existingRequests - Array of existing leave requests
 * @returns true if there's an overlap
 */
export function hasOverlap(
  startDate: string,
  endDate: string,
  existingRequests: Array<{ start_date: string; end_date: string; status: string }>
): boolean {
  const start = new Date(startDate)
  const end = new Date(endDate)

  return existingRequests
    .filter((req) => req.status === 'approved' || req.status === 'pending')
    .some((req) => {
      const reqStart = new Date(req.start_date)
      const reqEnd = new Date(req.end_date)

      // Check if date ranges overlap
      return (
        (start <= reqEnd && end >= reqStart) ||
        (reqStart <= end && reqEnd >= start)
      )
    })
}

/**
 * Calculate available days for a leave balance
 *
 * @param balance - Leave balance object
 * @returns Available days (entitled + carried - used - pending)
 */
export function calculateAvailableDays(balance: {
  entitled_days: number
  carried_over_days: number
  used_days: number
  pending_days: number
}): number {
  return (
    balance.entitled_days +
    balance.carried_over_days -
    balance.used_days -
    balance.pending_days
  )
}

/**
 * Format date range for display
 *
 * @param startDate - Start date in YYYY-MM-DD format
 * @param endDate - End date in YYYY-MM-DD format
 * @param totalDays - Total days (optional)
 * @returns Formatted string like "Mar 25 – Mar 27 (3 days)"
 */
export function formatDateRange(
  startDate: string,
  endDate: string,
  totalDays?: number
): string {
  const start = new Date(startDate)
  const end = new Date(endDate)

  const formatter = new Intl.DateTimeFormat('en', {
    month: 'short',
    day: 'numeric',
  })

  const startStr = formatter.format(start)
  const endStr = formatter.format(end)

  if (startDate === endDate) {
    return totalDays ? `${startStr} (${totalDays} day${totalDays === 1 ? '' : 's'})` : startStr
  }

  return totalDays
    ? `${startStr} – ${endStr} (${totalDays} day${totalDays === 1 ? '' : 's'})`
    : `${startStr} – ${endStr}`
}

/**
 * Group leave requests by status
 *
 * @param requests - Array of leave requests
 * @returns Object with requests grouped by status
 */
export function groupByStatus(requests: LeaveRequestWithDetails[]) {
  return {
    pending: requests.filter((r) => r.status === 'pending'),
    approved: requests.filter((r) => r.status === 'approved'),
    rejected: requests.filter((r) => r.status === 'rejected'),
    cancelled: requests.filter((r) => r.status === 'cancelled'),
  }
}

/**
 * Check if a leave request can be cancelled
 * (Only pending requests can be cancelled)
 *
 * @param status - Request status
 * @returns true if request can be cancelled
 */
export function canCancelRequest(status: string): boolean {
  return status === 'pending'
}
