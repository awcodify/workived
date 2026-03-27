import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook } from '@testing-library/react'

// Mock window.matchMedia for jsdom
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
})

// Mock pwa store
const mockSetDeferredPrompt = vi.fn()
const mockSetIsInstalled = vi.fn()
const mockStoreState = {
  deferredPrompt: null as unknown,
  dismissed: false,
  isInstalled: false,
}

vi.mock('@/lib/stores/pwa', () => ({
  usePWAStore: (selector?: (s: typeof mockStoreState & { setDeferredPrompt: typeof mockSetDeferredPrompt; setIsInstalled: typeof mockSetIsInstalled }) => unknown) => {
    const state = {
      ...mockStoreState,
      setDeferredPrompt: mockSetDeferredPrompt,
      setIsInstalled: mockSetIsInstalled,
      setDismissed: vi.fn(),
    }
    return selector ? selector(state) : state
  },
}))

describe('usePWA hooks', () => {
  beforeEach(() => {
    localStorage.clear()
    mockStoreState.deferredPrompt = null
    mockStoreState.dismissed = false
    mockStoreState.isInstalled = false
    vi.resetModules()
  })

  describe('usePWAInstall', () => {
    it('increments session count on mount', async () => {
      const { usePWAInstall } = await import('./usePWA')
      renderHook(() => usePWAInstall())
      expect(localStorage.getItem('workived-pwa-sessions')).toBe('1')
    })

    it('increments session count on each mount', async () => {
      localStorage.setItem('workived-pwa-sessions', '3')
      const { usePWAInstall } = await import('./usePWA')
      renderHook(() => usePWAInstall())
      expect(localStorage.getItem('workived-pwa-sessions')).toBe('4')
    })
  })

  describe('useShouldShowInstallPrompt', () => {
    it('returns false when no deferred prompt', async () => {
      localStorage.setItem('workived-pwa-sessions', '5')
      const { useShouldShowInstallPrompt } = await import('./usePWA')
      const { result } = renderHook(() => useShouldShowInstallPrompt())
      expect(result.current).toBe(false)
    })

    it('returns false on first session even with prompt', async () => {
      localStorage.setItem('workived-pwa-sessions', '1')
      mockStoreState.deferredPrompt = { prompt: vi.fn() }
      const { useShouldShowInstallPrompt } = await import('./usePWA')
      const { result } = renderHook(() => useShouldShowInstallPrompt())
      expect(result.current).toBe(false)
    })

    it('returns true on 2nd session with prompt', async () => {
      localStorage.setItem('workived-pwa-sessions', '2')
      mockStoreState.deferredPrompt = { prompt: vi.fn() }
      const { useShouldShowInstallPrompt } = await import('./usePWA')
      const { result } = renderHook(() => useShouldShowInstallPrompt())
      expect(result.current).toBe(true)
    })

    it('returns false when dismissed', async () => {
      localStorage.setItem('workived-pwa-sessions', '2')
      mockStoreState.deferredPrompt = { prompt: vi.fn() }
      mockStoreState.dismissed = true
      const { useShouldShowInstallPrompt } = await import('./usePWA')
      const { result } = renderHook(() => useShouldShowInstallPrompt())
      expect(result.current).toBe(false)
    })

    it('returns false when already installed', async () => {
      localStorage.setItem('workived-pwa-sessions', '2')
      mockStoreState.deferredPrompt = { prompt: vi.fn() }
      mockStoreState.isInstalled = true
      const { useShouldShowInstallPrompt } = await import('./usePWA')
      const { result } = renderHook(() => useShouldShowInstallPrompt())
      expect(result.current).toBe(false)
    })
  })

  describe('useIsIOSSafari', () => {
    it('returns false for non-iOS user agent', async () => {
      const { useIsIOSSafari } = await import('./usePWA')
      const { result } = renderHook(() => useIsIOSSafari())
      expect(result.current).toBe(false)
    })
  })
})
