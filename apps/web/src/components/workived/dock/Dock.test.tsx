import { render, screen } from '@testing-library/react'

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

import { Dock } from '@/components/workived/dock/Dock'

describe('Dock', () => {
  it('renders all 5 nav items', () => {
    render(<Dock />)
    expect(screen.getByText('Overview')).toBeInTheDocument()
    expect(screen.getByText('People')).toBeInTheDocument()
    expect(screen.getByText('Attendance')).toBeInTheDocument()
    expect(screen.getByText('Reports')).toBeInTheDocument()
    expect(screen.getByText('Tasks')).toBeInTheDocument()
  })

  it('renders as a nav element', () => {
    const { container } = render(<Dock />)
    const nav = container.querySelector('nav')
    expect(nav).toBeInTheDocument()
  })

  it('renders SettingsMenu', () => {
    render(<Dock />)
    expect(screen.getByTestId('settings-menu')).toBeInTheDocument()
  })
})
