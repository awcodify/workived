import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock the client
vi.mock('./client', () => ({
  apiClient: {
    get: vi.fn(),
    post: vi.fn(),
    delete: vi.fn(),
  },
}))

import { calendarApi } from './calendar'
import { apiClient } from './client'

const mockGet = vi.mocked(apiClient.get)
const mockPost = vi.mocked(apiClient.post)
const mockDelete = vi.mocked(apiClient.delete)

beforeEach(() => {
  vi.clearAllMocks()
})

describe('calendarApi', () => {
  it('listHolidays calls correct endpoint with params', async () => {
    mockGet.mockResolvedValue({ data: { data: [] } } as never)
    await calendarApi.listHolidays('2026-01-01', '2026-12-31')
    expect(mockGet).toHaveBeenCalledWith('/api/v1/calendar/holidays', {
      params: { start_date: '2026-01-01', end_date: '2026-12-31' },
    })
  })

  it('listCustomHolidays calls correct endpoint', async () => {
    mockGet.mockResolvedValue({ data: { data: [] } } as never)
    await calendarApi.listCustomHolidays()
    expect(mockGet).toHaveBeenCalledWith('/api/v1/calendar/holidays/custom')
  })

  it('createCustomHoliday posts to correct endpoint', async () => {
    mockPost.mockResolvedValue({ data: { data: {} } } as never)
    await calendarApi.createCustomHoliday({ date: '2026-06-01', name: 'Company Day' })
    expect(mockPost).toHaveBeenCalledWith('/api/v1/calendar/holidays/custom', {
      date: '2026-06-01',
      name: 'Company Day',
    })
  })

  it('deleteCustomHoliday calls correct endpoint', async () => {
    mockDelete.mockResolvedValue({ data: {} } as never)
    await calendarApi.deleteCustomHoliday('abc-123')
    expect(mockDelete).toHaveBeenCalledWith('/api/v1/calendar/holidays/custom/abc-123')
  })
})
