import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import React from 'react'

vi.mock('@tanstack/react-router', () => ({
  Link: ({ to, children, ...props }: { to: string; children: React.ReactNode; [key: string]: unknown }) => (
    <a href={to} {...props}>{children}</a>
  ),
  useMatches: vi.fn(() => [{ pathname: '/reports/dashboards' }]),
}))

import { ReportsTabs } from './ReportsTabs'

describe('ReportsTabs', () => {
  it('renders both tabs', () => {
    render(<ReportsTabs />)
    expect(screen.getByText('Performance')).toBeInTheDocument()
    expect(screen.getByText('Dashboards')).toBeInTheDocument()
  })

  it('active tab has accent background', () => {
    render(<ReportsTabs />)
    const dashLink = screen.getByText('Dashboards').closest('a')!
    expect(dashLink.style.background).toBe('rgb(99, 87, 232)')
  })

  it('inactive tab is not accented', () => {
    render(<ReportsTabs />)
    const perfLink = screen.getByText('Performance').closest('a')!
    expect(perfLink.style.background).toBe('transparent')
  })
})
