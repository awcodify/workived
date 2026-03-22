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
  const now = new Date()
  const localNow = new Date(now.toLocaleString('en-US', { timeZone: tz }))
  const day = localNow.getDay()
  const diff = day === 0 ? -6 : 1 - day // Sunday = 0, so go back 6 days; otherwise go to Monday
  const monday = new Date(localNow)
  monday.setDate(localNow.getDate() + diff + (weekOffset * 7)) // Add week offset
  const isoDate = monday.toISOString().split('T')[0]
  return isoDate ?? todayISO(tz) // Fallback to today if ISO conversion fails
}
