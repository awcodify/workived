import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, act } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

// Track subscribers so we can trigger them in tests
let routerSubscribers: Record<string, Array<() => void>> = {}

vi.mock('@tanstack/react-router', () => ({
  useRouter: () => ({
    subscribe: (event: string, cb: () => void) => {
      if (!routerSubscribers[event]) routerSubscribers[event] = []
      routerSubscribers[event].push(cb)
      return () => {
        routerSubscribers[event] = routerSubscribers[event].filter((fn) => fn !== cb)
      }
    },
  }),
}))

import { LoadingBar } from './LoadingBar'

function renderWithProviders() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  return render(
    <QueryClientProvider client={queryClient}>
      <LoadingBar />
      <div data-testid="content">Content</div>
    </QueryClientProvider>
  )
}

describe('LoadingBar', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    routerSubscribers = {}
  })

  afterEach(() => {
    vi.restoreAllMocks()
    vi.useRealTimers()
  })

  it('renders without loading bar initially', () => {
    const { container } = renderWithProviders()
    const loadingBar = container.querySelector('[style*="position: fixed"]')
    expect(loadingBar).toBeFalsy()
  })

  it('has proper styling for fixed positioning at top', () => {
    const { container } = renderWithProviders()

    // Trigger onBeforeLoad to show loading bar
    act(() => {
      routerSubscribers['onBeforeLoad']?.forEach((cb) => cb())
    })

    const loadingBar = container.querySelector('[style*="position: fixed"]') as HTMLElement
    expect(loadingBar).toBeTruthy()
    expect(loadingBar.style.position).toBe('fixed')
    expect(loadingBar.style.top).toBe('0px')
    expect(loadingBar.style.zIndex).toBe('9999')
  })

  it('shows gradient background', () => {
    const { container } = renderWithProviders()

    act(() => {
      routerSubscribers['onBeforeLoad']?.forEach((cb) => cb())
    })

    const progressBar = container.querySelector('[style*="linear-gradient"]') as HTMLElement
    expect(progressBar).toBeTruthy()
    expect(progressBar.style.background).toContain('linear-gradient')
    // Browser converts hex to rgb
    expect(progressBar.style.background).toContain('rgb(59, 130, 246)')
    expect(progressBar.style.background).toContain('rgb(139, 92, 246)')
    expect(progressBar.style.background).toContain('rgb(236, 72, 153)')
  })

  it('has non-interactive pointer events', () => {
    const { container } = renderWithProviders()

    act(() => {
      routerSubscribers['onBeforeLoad']?.forEach((cb) => cb())
    })

    const loadingBar = container.querySelector('[style*="position: fixed"]') as HTMLElement
    expect(loadingBar.style.pointerEvents).toBe('none')
  })

  it('shows correct height', () => {
    const { container } = renderWithProviders()

    act(() => {
      routerSubscribers['onBeforeLoad']?.forEach((cb) => cb())
    })

    const loadingBar = container.querySelector('[style*="position: fixed"]') as HTMLElement
    expect(loadingBar.style.height).toBe('3px')
  })

  it('progress bar has box shadow for glow effect', () => {
    const { container } = renderWithProviders()

    act(() => {
      routerSubscribers['onBeforeLoad']?.forEach((cb) => cb())
    })

    const progressBar = container.querySelector('[style*="box-shadow"]') as HTMLElement
    expect(progressBar).toBeTruthy()
    expect(progressBar.style.boxShadow).toContain('rgba(59, 130, 246, 0.3)')
  })

  it('renders content without loading bar', () => {
    renderWithProviders()
    expect(screen.getByTestId('content')).toBeInTheDocument()
  })
})
