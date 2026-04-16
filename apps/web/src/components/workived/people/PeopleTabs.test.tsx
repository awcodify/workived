import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import React from 'react'

vi.mock('@tanstack/react-router', () => ({
  Link: ({ to, children, ...props }: { to: string; children: React.ReactNode; [key: string]: unknown }) => (
    <a href={to} {...props}>{children}</a>
  ),
  useMatches: vi.fn(() => [{ pathname: '/people' }]),
}))

import { PeopleTabs } from './PeopleTabs'

describe('PeopleTabs', () => {
  it('renders both tabs', () => {
    render(<PeopleTabs />)
    expect(screen.getByText('Team')).toBeInTheDocument()
    expect(screen.getByText('Performance')).toBeInTheDocument()
  })

  it('active tab has amber background when on /people', () => {
    render(<PeopleTabs />)
    const teamLink = screen.getByText('Team').closest('a')!
    expect(teamLink.style.background).toBe('rgb(201, 123, 42)')
  })

  it('inactive tab is not accented', () => {
    render(<PeopleTabs />)
    const perfLink = screen.getByText('Performance').closest('a')!
    expect(perfLink.style.background).toBe('transparent')
  })

  it('performance tab is active when on /people/performance', () => {
    const { useMatches } = await import('@tanstack/react-router')
    vi.mocked(useMatches).mockReturnValue([{ pathname: '/people/performance' }] as ReturnType<typeof useMatches>)
    render(<PeopleTabs />)
    const perfLink = screen.getByText('Performance').closest('a')!
    expect(perfLink.style.background).toBe('rgb(201, 123, 42)')
  })
})
