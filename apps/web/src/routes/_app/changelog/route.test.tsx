import { render, screen } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock TanStack Router
vi.mock('@tanstack/react-router', () => ({
  createFileRoute: () => () => ({}),
}))

// Mock design tokens
vi.mock('@/design/tokens', () => ({
  colors: {
    ok: '#12A05C',
    err: '#D44040',
    accent: '#6357E8',
    warn: '#C97B2A',
  },
  typography: {
    fontFamily: "'Plus Jakarta Sans', sans-serif",
    h1: { size: '32px', weight: 800, tracking: '-0.04em', lineHeight: '1.05' },
    caption: { size: '11px', weight: 500, tracking: '0.04em', lineHeight: '1.4' },
  },
}))

// Mock changelog data
vi.mock('@/data/changelog', () => ({
  changelog: [
    {
      id: 3,
      date: '2026-03-28',
      type: 'feature',
      title: 'New Feature',
      description: 'A great feature.',
      module: 'Tasks',
    },
    {
      id: 2,
      date: '2026-03-27',
      type: 'fix',
      title: 'Bug Fix',
      description: 'Fixed a bug.',
    },
    {
      id: 1,
      date: '2026-02-15',
      type: 'improvement',
      title: 'Old Improvement',
      description: 'Something improved.',
      module: 'Leave',
    },
  ],
  getLatestChangelogId: () => 3,
}))

const mockMarkAsRead = vi.fn()
vi.mock('@/lib/hooks/useChangelog', () => ({
  useChangelogUnread: () => ({
    hasUnread: false,
    markAsRead: mockMarkAsRead,
  }),
}))

// Import the page component directly (not through the route)
// We need to extract the component from the module
let ChangelogPage: React.ComponentType

beforeEach(async () => {
  mockMarkAsRead.mockClear()
  // Dynamic import to get the actual module with mocks applied
  const mod = await import('./route')
  // The component is inside the Route, but since we mocked createFileRoute
  // we need to render the actual JSX. Let's use a different approach.
})

// Since TanStack Router makes it hard to extract the component directly,
// we'll test the core logic and rendering via a simulated approach

describe('Changelog Page', () => {
  it('renders changelog entries', async () => {
    // Re-import to ensure mocks are applied
    vi.resetModules()

    // Re-apply mocks after reset
    vi.doMock('@tanstack/react-router', () => ({
      createFileRoute: () => (opts: Record<string, unknown>) => opts,
    }))
    vi.doMock('@/design/tokens', () => ({
      colors: { ok: '#12A05C', err: '#D44040', accent: '#6357E8', warn: '#C97B2A' },
      typography: {
        fontFamily: "'Plus Jakarta Sans', sans-serif",
        h1: { size: '32px', weight: 800, tracking: '-0.04em', lineHeight: '1.05' },
        caption: { tracking: '0.04em' },
      },
    }))
    vi.doMock('@/data/changelog', () => ({
      changelog: [
        { id: 2, date: '2026-03-28', type: 'feature', title: 'New Feature', description: 'A great feature.', module: 'Tasks' },
        { id: 1, date: '2026-03-27', type: 'fix', title: 'Bug Fix', description: 'Fixed a bug.' },
      ],
      getLatestChangelogId: () => 2,
    }))
    vi.doMock('@/lib/hooks/useChangelog', () => ({
      useChangelogUnread: () => ({ hasUnread: false, markAsRead: mockMarkAsRead }),
    }))

    const mod = await import('./route')
    const routeResult = mod.Route as unknown as { component: React.ComponentType }
    const Component = routeResult.component

    render(<Component />)

    expect(screen.getByText("What's New")).toBeInTheDocument()
    expect(screen.getByText('New Feature')).toBeInTheDocument()
    expect(screen.getByText('Bug Fix')).toBeInTheDocument()
    expect(screen.getByText('Tasks')).toBeInTheDocument()
  })

  it('calls markAsRead on mount', async () => {
    vi.resetModules()
    const localMarkAsRead = vi.fn()

    vi.doMock('@tanstack/react-router', () => ({
      createFileRoute: () => (opts: Record<string, unknown>) => opts,
    }))
    vi.doMock('@/design/tokens', () => ({
      colors: { ok: '#12A05C', err: '#D44040', accent: '#6357E8', warn: '#C97B2A' },
      typography: {
        fontFamily: "'Plus Jakarta Sans', sans-serif",
        h1: { size: '32px', weight: 800, tracking: '-0.04em', lineHeight: '1.05' },
        caption: { tracking: '0.04em' },
      },
    }))
    vi.doMock('@/data/changelog', () => ({
      changelog: [
        { id: 1, date: '2026-03-27', type: 'fix', title: 'Fix', description: 'Fixed.' },
      ],
      getLatestChangelogId: () => 1,
    }))
    vi.doMock('@/lib/hooks/useChangelog', () => ({
      useChangelogUnread: () => ({ hasUnread: true, markAsRead: localMarkAsRead }),
    }))

    const mod = await import('./route')
    const routeResult = mod.Route as unknown as { component: React.ComponentType }
    const Component = routeResult.component

    render(<Component />)

    expect(localMarkAsRead).toHaveBeenCalled()
  })

  it('groups entries by month', async () => {
    vi.resetModules()

    vi.doMock('@tanstack/react-router', () => ({
      createFileRoute: () => (opts: Record<string, unknown>) => opts,
    }))
    vi.doMock('@/design/tokens', () => ({
      colors: { ok: '#12A05C', err: '#D44040', accent: '#6357E8', warn: '#C97B2A' },
      typography: {
        fontFamily: "'Plus Jakarta Sans', sans-serif",
        h1: { size: '32px', weight: 800, tracking: '-0.04em', lineHeight: '1.05' },
        caption: { tracking: '0.04em' },
      },
    }))
    vi.doMock('@/data/changelog', () => ({
      changelog: [
        { id: 2, date: '2026-03-28', type: 'feature', title: 'March Entry', description: 'March.' },
        { id: 1, date: '2026-02-15', type: 'fix', title: 'Feb Entry', description: 'Feb.' },
      ],
      getLatestChangelogId: () => 2,
    }))
    vi.doMock('@/lib/hooks/useChangelog', () => ({
      useChangelogUnread: () => ({ hasUnread: false, markAsRead: vi.fn() }),
    }))

    const mod = await import('./route')
    const routeResult = mod.Route as unknown as { component: React.ComponentType }
    const Component = routeResult.component

    render(<Component />)

    expect(screen.getByText('March 2026')).toBeInTheDocument()
    expect(screen.getByText('February 2026')).toBeInTheDocument()
  })
})
