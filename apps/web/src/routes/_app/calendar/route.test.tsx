import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import React from 'react'

// Mock TanStack Router
vi.mock('@tanstack/react-router', () => ({
  createFileRoute: () => () => ({ component: undefined }),
  Outlet: () => <div data-testid="outlet" />,
}))

vi.mock('@/design/tokens', async () => {
  const actual = await vi.importActual('@/design/tokens')
  return actual
})

function renderWithProviders(ui: React.ReactElement) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(<QueryClientProvider client={qc}>{ui}</QueryClientProvider>)
}

// Test the design tokens integration
describe('Calendar Design Tokens', () => {
  it('calendar module tokens exist', async () => {
    const tokens = await import('@/design/tokens')
    expect(tokens.moduleBackgrounds.calendar).toBe('#FFF8F3')
    expect(tokens.moduleThemes.calendar).toBeDefined()
    expect(tokens.moduleThemes.calendar.accent).toBe('#D97706')
    expect(tokens.moduleThemes.calendar.text).toBe('#1A1207')
    expect(tokens.dockThemes.calendar).toBeDefined()
    expect(tokens.logoMarkColors.calendar).toBeDefined()
  })
})

// Test the Dock includes Calendar
describe('Calendar in Dock', () => {
  it('Dock renders Calendar nav item', async () => {
    // Mock all Dock dependencies
    vi.doMock('@tanstack/react-router', () => ({
      Link: ({ children, to }: { children: React.ReactNode; to: string }) => <a href={to}>{children}</a>,
      useMatches: () => [{ pathname: '/calendar' }],
      useRouter: () => ({ subscribe: () => () => {} }),
    }))
    vi.doMock('@/components/workived/dock/SettingsMenu', () => ({
      SettingsMenu: () => <div data-testid="settings-menu" />,
    }))
    vi.doMock('@/lib/hooks/useFeatures', () => ({
      useEnabledFeatures: () => ({ data: {}, isLoading: false }),
    }))
    vi.doMock('@/lib/hooks/useLeave', () => ({
      useLeaveNotificationCount: () => ({ data: 0 }),
    }))
    vi.doMock('@/lib/hooks/useClaims', () => ({
      useClaimNotificationCount: () => ({ data: 0 }),
    }))
    vi.doMock('@/lib/hooks/useRole', () => ({
      useCanManageLeave: () => false,
      useCanManageClaims: () => false,
    }))

    // Dynamic import to pick up the mocks
    const { Dock } = await import('@/components/workived/dock/Dock')
    renderWithProviders(<Dock />)
    expect(screen.getByText('Calendar')).toBeInTheDocument()
  })
})
