export function formatDate(
  utcDate: string,
  timezone: string,
  format: 'date' | 'datetime' | 'time' = 'date',
): string {
  return new Intl.DateTimeFormat('en', {
    timeZone: timezone,
    ...(format === 'date' && { dateStyle: 'medium' }),
    ...(format === 'datetime' && { dateStyle: 'medium', timeStyle: 'short' }),
    ...(format === 'time' && { timeStyle: 'short' }),
  }).format(new Date(utcDate))
}

export function formatDateLocal(date: string): string {
  return new Intl.DateTimeFormat('en', { dateStyle: 'medium' }).format(new Date(date))
}

export function todayISO(timezone: string): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: timezone }).format(new Date())
}

/**
 * Calculate the Monday of a given week offset from today
 * @param tz - Timezone string (e.g., 'Asia/Jakarta')
 * @param weekOffset - Number of weeks to offset (0 = current week, -1 = previous, +1 = next)
 * @returns ISO date string (YYYY-MM-DD) of the Monday
 */
export function getMondayOfWeek(tz: string, weekOffset: number = 0): string {
  // Get today's date in the target timezone using todayISO
  const today = todayISO(tz) // Returns YYYY-MM-DD in the target timezone
  const date = new Date(today + 'T00:00:00Z') // Parse as UTC to avoid local timezone issues
  
  // Get day of week (0 = Sunday, 1 = Monday, ..., 6 = Saturday)
  const day = date.getUTCDay()
  
  // Calculate days to subtract to get to Monday
  const diff = day === 0 ? -6 : 1 - day // Sunday = 0, go back 6 days; otherwise go to Monday
  
  // Calculate the target date
  const targetDate = new Date(date)
  targetDate.setUTCDate(date.getUTCDate() + diff + (weekOffset * 7))
  
  // Return ISO date string (YYYY-MM-DD)
  return targetDate.toISOString().split('T')[0]!
}

/**
 * Format due date with relative time and absolute date
 * @param dueDate - ISO date string or Date object
 * @param now - Current time (for testing)
 * @returns Formatted string like "Due in 3h (17 Dec)" or "Overdue by 2h (15 Dec)"
 */
export function formatRelativeDueDate(dueDate: string | Date, now: Date = new Date()): string {
  const due = new Date(dueDate)
  const diffMs = due.getTime() - now.getTime()
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60))
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))
  
  // Absolute date component (always shown in parentheses)
  const absoluteDate = due.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  
  // Relative time component
  let relativeTime: string
  
  if (diffMs < 0) {
    // Overdue
    const absDiffMs = Math.abs(diffMs)
    const overdueHours = Math.floor(absDiffMs / (1000 * 60 * 60))
    
    if (overdueHours < 1) {
      relativeTime = 'Overdue'
    } else if (overdueHours < 24) {
      relativeTime = `Overdue by ${overdueHours}h`
    } else {
      const overdueDays = Math.abs(diffDays)
      relativeTime = `Overdue by ${overdueDays}d`
    }
  } else {
    // Future
    if (diffHours < 1) {
      relativeTime = 'Due soon'
    } else if (diffHours < 24) {
      relativeTime = `Due in ${diffHours}h`
    } else if (diffDays === 1) {
      relativeTime = 'Due tomorrow'
    } else if (diffDays < 7) {
      relativeTime = `Due in ${diffDays}d`
    } else {
      relativeTime = 'Due'
    }
  }
  
  return `${relativeTime} (${absoluteDate})`
}
