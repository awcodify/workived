import { describe, test, expect, vi, beforeEach } from 'vitest'
import { getHealthStatus } from './health'
import { apiClient } from './client'

vi.mock('./client', () => ({
  apiClient: {
    get: vi.fn(),
  },
}))

const mockGet = vi.mocked(apiClient.get)

describe('getHealthStatus', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  test('returns status from backend', async () => {
    mockGet.mockResolvedValueOnce({ data: { status: 'ok' } })

    const result = await getHealthStatus()

    expect(mockGet).toHaveBeenCalledWith('/api/health', { timeout: 2000 })
    expect(result).toEqual({ status: 'ok' })
  })

  test('throws when backend is unreachable', async () => {
    mockGet.mockRejectedValueOnce(new Error('Network Error'))

    await expect(getHealthStatus()).rejects.toThrow('Network Error')
  })
})
