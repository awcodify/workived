import { render, screen } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import React from 'react'

vi.mock('@tanstack/react-router', () => ({
  Link: ({ children, to, ...props }: Record<string, unknown>) => (
    <a href={to as string} {...props}>
      {children}
    </a>
  ),
  useMatches: () => [{ pathname: '/overview' }],
}))

vi.mock('./SettingsMenu', () => ({
  SettingsMenu: ({ currentModule }: { currentModule: string }) => (
    <div data-testid="settings-menu" data-module={currentModule} />
  ),
}))

vi.mock('@/lib/hooks/useAdmin', () => ({
  useEnabledFeatures: vi.fn(() => ({ data: { reports: true, tasks: true }, isLoading: false })),
}))

import { Dock } from '@/components/workived/dock/Dock'

function renderWithProviders(ui: React.ReactElement) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(<QueryClientProvider client={qc}>{ui}</QueryClientProvider>)
}

describe('Dock', () => {
  it('renders all 5 nav items', () => {
    renderWithProviders(<Dock />)
    expect(screen.getByText('Overview')).toBeInTheDocument()
    expect(screen.getByText('People')).toBeInTheDocument()
    expect(screen.getByText('Attendance')).toBeInTheDocument()
    expect(screen.getByText('Reports')).toBeInTheDocument()
    expect(screen.getByText('Tasks')).toBeInTheDocument()
  })

  it('renders as a nav element', () => {
    const { container } = renderWithProviders(<Dock />)
    const nav = container.querySelector('nav')
    expect(nav).toBeInTheDocument()
  })

  it('renders SettingsMenu', () => {
    renderWithProviders(<Dock />)
    expect(screen.getByTestId('settings-menu')).toBeInTheDocument()
  })
})
