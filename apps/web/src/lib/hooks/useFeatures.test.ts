import { renderHook, waitFor } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { createElement } from 'react'
import type { ReactNode } from 'react'
import { useEnabledFeatures } from './useFeatures'
import { features } from '@/lib/api/features'

vi.mock('@/lib/api/features', () => ({
  features: {
    getEnabled: vi.fn(),
  },
}))

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
    },
  })
  return ({ children }: { children: ReactNode }) =>
    createElement(QueryClientProvider, { client: queryClient }, children)
}

describe('useEnabledFeatures', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('fetches enabled features', async () => {
    const mockFeatures = { reports: true, tasks: false }
    vi.mocked(features.getEnabled).mockResolvedValue({ data: mockFeatures })

    const { result } = renderHook(() => useEnabledFeatures(), {
      wrapper: createWrapper(),
    })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))

    expect(result.current.data).toEqual(mockFeatures)
    expect(features.getEnabled).toHaveBeenCalledTimes(1)
  })

  it('handles errors', async () => {
    vi.mocked(features.getEnabled).mockRejectedValue(new Error('Failed to fetch'))

    const { result } = renderHook(() => useEnabledFeatures(), {
      wrapper: createWrapper(),
    })

    await waitFor(() => expect(result.current.isError).toBe(true))

    expect(result.current.error).toBeInstanceOf(Error)
  })

  it('returns loading state initially', () => {
    vi.mocked(features.getEnabled).mockImplementation(
      () => new Promise(() => {}) // Never resolves
    )

    const { result } = renderHook(() => useEnabledFeatures(), {
      wrapper: createWrapper(),
    })

    expect(result.current.isLoading).toBe(true)
    expect(result.current.data).toBeUndefined()
  })
})
