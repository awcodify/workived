import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { RouterProvider, createRouter, createRootRoute, createRoute } from '@tanstack/react-router'
import { LoadingBar } from './LoadingBar'

// Mock routes for testing
const rootRoute = createRootRoute({
  component: () => (
    <div>
      <LoadingBar />
      <div data-testid="content">Content</div>
    </div>
  ),
})

const indexRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/',
  component: () => <div>Home</div>,
})

const aboutRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/about',
  component: () => <div>About</div>,
})

const routeTree = rootRoute.addChildren([indexRoute, aboutRoute])

function createTestRouter() {
  return createRouter({
    routeTree,
    defaultPreload: false,
  })
}

function renderWithRouter() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  })

  const router = createTestRouter()

  return {
    ...render(
      <QueryClientProvider client={queryClient}>
        <RouterProvider router={router} />
      </QueryClientProvider>
    ),
    router,
    queryClient,
  }
}

describe('LoadingBar', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.restoreAllMocks()
    vi.useRealTimers()
  })

  it('renders without loading bar initially', () => {
    const { container } = renderWithRouter()
    
    // Loading bar should not be visible initially
    const loadingBar = container.querySelector('[style*="position: fixed"]')
    expect(loadingBar).toBeFalsy()
  })

  it('has proper styling for fixed positioning at top', async () => {
    const { container, router } = renderWithRouter()
    
    // Trigger navigation to show loading bar
    router.navigate({ to: '/about' })
    
    await waitFor(() => {
      const loadingBar = container.querySelector('[style*="position: fixed"]')
      expect(loadingBar).toBeTruthy()
    })

    const loadingBar = container.querySelector('[style*="position: fixed"]') as HTMLElement
    expect(loadingBar.style.position).toBe('fixed')
    expect(loadingBar.style.top).toBe('0px')
    expect(loadingBar.style.zIndex).toBe('9999')
  })

  it('shows gradient background', async () => {
    const { container, router } = renderWithRouter()
    
    router.navigate({ to: '/about' })
    
    await waitFor(() => {
      const progressBar = container.querySelector('[style*="linear-gradient"]')
      expect(progressBar).toBeTruthy()
    })

    const progressBar = container.querySelector('[style*="linear-gradient"]') as HTMLElement
    expect(progressBar.style.background).toContain('linear-gradient')
    expect(progressBar.style.background).toContain('#8B5CF6') // Purple
    expect(progressBar.style.background).toContain('#D97706') // Amber
    expect(progressBar.style.background).toContain('#12A05C') // Green
  })

  it('has non-interactive pointer events', async () => {
    const { container, router } = renderWithRouter()
    
    router.navigate({ to: '/about' })
    
    await waitFor(() => {
      const loadingBar = container.querySelector('[style*="position: fixed"]')
      expect(loadingBar).toBeTruthy()
    })

    const loadingBar = container.querySelector('[style*="position: fixed"]') as HTMLElement
    expect(loadingBar.style.pointerEvents).toBe('none')
  })

  it('shows correct height', async () => {
    const { container, router } = renderWithRouter()
    
    router.navigate({ to: '/about' })
    
    await waitFor(() => {
      const loadingBar = container.querySelector('[style*="position: fixed"]')
      expect(loadingBar).toBeTruthy()
    })

    const loadingBar = container.querySelector('[style*="position: fixed"]') as HTMLElement
    expect(loadingBar.style.height).toBe('3px')
  })

  it('progress bar has box shadow for glow effect', async () => {
    const { container, router } = renderWithRouter()
    
    router.navigate({ to: '/about' })
    
    await waitFor(() => {
      const progressBar = container.querySelector('[style*="box-shadow"]')
      expect(progressBar).toBeTruthy()
    })

    const progressBar = container.querySelector('[style*="box-shadow"]') as HTMLElement
    expect(progressBar.style.boxShadow).toContain('rgba(139, 92, 246, 0.5)')
  })

  it('renders content without loading bar', () => {
    renderWithRouter()
    expect(screen.getByTestId('content')).toBeInTheDocument()
  })
})
