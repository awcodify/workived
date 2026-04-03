import { formatDate, formatDateLocal, todayISO, getMondayOfWeek, formatRelativeDueDate } from '@/lib/utils/date'

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

describe('getMondayOfWeek', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('returns Monday of current week when today is Sunday', () => {
    // Set date to Sunday, March 22, 2026
    vi.setSystemTime(new Date('2026-03-22T00:00:00Z'))
    
    const result = getMondayOfWeek('UTC', 0)
    expect(result).toBe('2026-03-16') // Monday of that week
  })

  it('returns Monday of current week when today is Monday', () => {
    // Set date to Monday, March 16, 2026
    vi.setSystemTime(new Date('2026-03-16T00:00:00Z'))
    
    const result = getMondayOfWeek('UTC', 0)
    expect(result).toBe('2026-03-16') // Same day
  })

  it('returns Monday of current week when today is Wednesday', () => {
    // Set date to Wednesday, March 18, 2026
    vi.setSystemTime(new Date('2026-03-18T00:00:00Z'))
    
    const result = getMondayOfWeek('UTC', 0)
    expect(result).toBe('2026-03-16') // Monday of that week
  })

  it('returns Monday of current week when today is Saturday', () => {
    // Set date to Saturday, March 21, 2026
    vi.setSystemTime(new Date('2026-03-21T00:00:00Z'))
    
    const result = getMondayOfWeek('UTC', 0)
    expect(result).toBe('2026-03-16') // Monday of that week
  })

  it('returns Monday of previous week with weekOffset -1', () => {
    // Set date to Wednesday, March 18, 2026
    vi.setSystemTime(new Date('2026-03-18T00:00:00Z'))
    
    const result = getMondayOfWeek('UTC', -1)
    expect(result).toBe('2026-03-09') // Monday of previous week
  })

  it('returns Monday of next week with weekOffset 1', () => {
    // Set date to Wednesday, March 18, 2026
    vi.setSystemTime(new Date('2026-03-18T00:00:00Z'))
    
    const result = getMondayOfWeek('UTC', 1)
    expect(result).toBe('2026-03-23') // Monday of next week
  })

  it('handles timezone correctly for Asia/Jakarta', () => {
    // Set date to Sunday, March 22, 2026 at 00:00 UTC
    // In Asia/Jakarta (UTC+7), this is 07:00 on Sunday March 22
    vi.setSystemTime(new Date('2026-03-22T00:00:00Z'))
    
    const result = getMondayOfWeek('Asia/Jakarta', 0)
    expect(result).toBe('2026-03-16') // Monday of that week
  })

  it('handles timezone correctly when day differs from UTC', () => {
    // Set date to Saturday, March 21, 2026 at 20:00 UTC
    // In Asia/Jakarta (UTC+7), this is 03:00 on Sunday March 22
    vi.setSystemTime(new Date('2026-03-21T20:00:00Z'))
    
    const result = getMondayOfWeek('Asia/Jakarta', 0)
    // In Jakarta it's Sunday, so Monday should be 2026-03-16
    expect(result).toBe('2026-03-16')
  })

  it('returns result in YYYY-MM-DD format', () => {
    vi.setSystemTime(new Date('2026-03-18T00:00:00Z'))
    
    const result = getMondayOfWeek('UTC', 0)
    expect(result).toMatch(/^\d{4}-\d{2}-\d{2}$/)
  })
})

describe('formatRelativeDueDate', () => {
  const now = new Date('2026-04-03T10:00:00Z')

  it('shows "Due soon" when less than 1 hour away', () => {
    const dueDate = new Date('2026-04-03T10:30:00Z') // 30 minutes away
    expect(formatRelativeDueDate(dueDate, now)).toBe('Due soon (Apr 3)')
  })

  it('shows "Due in Xh" when within 24 hours', () => {
    const dueDate = new Date('2026-04-03T13:00:00Z') // 3 hours away
    expect(formatRelativeDueDate(dueDate, now)).toBe('Due in 3h (Apr 3)')
  })

  it('shows "Due tomorrow" when exactly 1 day away', () => {
    const dueDate = new Date('2026-04-04T10:00:00Z') // Tomorrow
    expect(formatRelativeDueDate(dueDate, now)).toBe('Due tomorrow (Apr 4)')
  })

  it('shows "Due in Xd" when 2-6 days away', () => {
    const dueDate = new Date('2026-04-08T10:00:00Z') // 5 days away
    expect(formatRelativeDueDate(dueDate, now)).toBe('Due in 5d (Apr 8)')
  })

  it('shows "Due" when more than a week away', () => {
    const dueDate = new Date('2026-04-15T10:00:00Z') // 12 days away
    expect(formatRelativeDueDate(dueDate, now)).toBe('Due (Apr 15)')
  })

  it('shows "Overdue" when less than 1 hour overdue', () => {
    const dueDate = new Date('2026-04-03T09:30:00Z') // 30 minutes ago
    expect(formatRelativeDueDate(dueDate, now)).toBe('Overdue (Apr 3)')
  })

  it('shows "Overdue by Xh" when 1-23 hours overdue', () => {
    const dueDate = new Date('2026-04-03T05:00:00Z') // 5 hours ago
    expect(formatRelativeDueDate(dueDate, now)).toBe('Overdue by 5h (Apr 3)')
  })

  it('shows "Overdue by Xd" when multiple days overdue', () => {
    const dueDate = new Date('2026-04-01T10:00:00Z') // 2 days ago
    expect(formatRelativeDueDate(dueDate, now)).toBe('Overdue by 2d (Apr 1)')
  })

  it('handles ISO date strings', () => {
    const dueDate = '2026-04-03T15:00:00Z'
    expect(formatRelativeDueDate(dueDate, now)).toBe('Due in 5h (Apr 3)')
  })

  it('formats absolute date correctly for different months', () => {
    const dueDate = new Date('2026-12-25T10:00:00Z')
    expect(formatRelativeDueDate(dueDate, now)).toContain('Dec 25')
  })

  it('handles edge case at exactly 24 hours', () => {
    const dueDate = new Date('2026-04-04T10:00:00Z') // Exactly 24 hours
    expect(formatRelativeDueDate(dueDate, now)).toBe('Due tomorrow (Apr 4)')
  })

  it('uses default current time when not provided', () => {
    // Test that it doesn't throw when now parameter is omitted
    const futureDueDate = new Date(Date.now() + 3600000) // 1 hour from now
    const result = formatRelativeDueDate(futureDueDate)
    expect(result).toMatch(/^Due (in \dh|soon) \(.+\)$/)
  })
})
