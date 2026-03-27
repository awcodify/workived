import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'

// Mock changelog data
vi.mock('@/data/changelog', () => ({
  getLatestChangelogId: () => 5,
}))

describe('useChangelogUnread', () => {
  beforeEach(() => {
    localStorage.clear()
    vi.resetModules()
  })

  it('returns hasUnread=true when no lastSeen stored', async () => {
    const { useChangelogUnread } = await import('./useChangelog')
    const { result } = renderHook(() => useChangelogUnread())
    expect(result.current.hasUnread).toBe(true)
  })

  it('returns hasUnread=false when lastSeen matches latest', async () => {
    localStorage.setItem('workived-changelog-last-seen', '5')
    const { useChangelogUnread } = await import('./useChangelog')
    const { result } = renderHook(() => useChangelogUnread())
    expect(result.current.hasUnread).toBe(false)
  })

  it('returns hasUnread=true when lastSeen is older than latest', async () => {
    localStorage.setItem('workived-changelog-last-seen', '3')
    const { useChangelogUnread } = await import('./useChangelog')
    const { result } = renderHook(() => useChangelogUnread())
    expect(result.current.hasUnread).toBe(true)
  })

  it('markAsRead sets lastSeen to latest ID', async () => {
    const { useChangelogUnread } = await import('./useChangelog')
    const { result } = renderHook(() => useChangelogUnread())

    act(() => {
      result.current.markAsRead()
    })

    expect(localStorage.getItem('workived-changelog-last-seen')).toBe('5')
  })
})
