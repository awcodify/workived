import { formatDate, formatDateLocal, todayISO } from '@/lib/utils/date'

describe('formatDate', () => {
  const utcDate = '2025-06-15T10:30:00Z'

  it('formats with date style by default', () => {
    const result = formatDate(utcDate, 'Asia/Jakarta')
    expect(result).toBe('Jun 15, 2025')
  })

  it('formats with time style', () => {
    // UTC 10:30 → Asia/Jakarta (UTC+7) = 17:30
    const result = formatDate(utcDate, 'Asia/Jakarta', 'time')
    expect(result).toBe('5:30 PM')
  })

  it('formats with datetime style', () => {
    const result = formatDate(utcDate, 'Asia/Jakarta', 'datetime')
    expect(result).toBe('Jun 15, 2025, 5:30 PM')
  })

  it('respects the provided timezone', () => {
    // UTC 10:30 → Asia/Dubai (UTC+4) = 14:30
    const result = formatDate(utcDate, 'Asia/Dubai', 'time')
    expect(result).toBe('2:30 PM')
  })

  it('handles date that crosses midnight into next day', () => {
    // UTC 22:00 Jun 15 → Asia/Jakarta (UTC+7) = 05:00 Jun 16
    const lateUtc = '2025-06-15T22:00:00Z'
    const result = formatDate(lateUtc, 'Asia/Jakarta', 'date')
    expect(result).toBe('Jun 16, 2025')
  })
})

describe('formatDateLocal', () => {
  it('returns medium date style for a given date string', () => {
    const result = formatDateLocal('2025-06-15')
    expect(result).toBe('Jun 15, 2025')
  })

  it('handles ISO datetime strings', () => {
    const result = formatDateLocal('2025-12-25T00:00:00Z')
    expect(result).toMatch(/Dec 2[45], 2025/)
  })
})

describe('todayISO', () => {
  it('returns a string in YYYY-MM-DD format', () => {
    const result = todayISO('Asia/Jakarta')
    expect(result).toMatch(/^\d{4}-\d{2}-\d{2}$/)
  })

  it('returns a valid date for a different timezone', () => {
    const result = todayISO('America/New_York')
    expect(result).toMatch(/^\d{4}-\d{2}-\d{2}$/)
  })
})
