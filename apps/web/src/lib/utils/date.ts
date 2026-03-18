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
