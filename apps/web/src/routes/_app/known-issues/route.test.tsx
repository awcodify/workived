import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'

// Mock TanStack Router
vi.mock('@tanstack/react-router', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@tanstack/react-router')>()
  return {
    ...actual,
    createFileRoute: () => (opts: Record<string, unknown>) => ({
      options: opts,
    }),
  }
})

// Mock data module so we can control entries
vi.mock('@/data/known-issues', () => ({
  knownIssues: [],
}))

import { knownIssues } from '@/data/known-issues'
const { Route } = await import('./route')
const KnownIssuesPage = Route.options.component as React.ComponentType

describe('KnownIssuesPage', () => {
  it('renders heading', () => {
    render(<KnownIssuesPage />)
    expect(screen.getByText('Known Issues')).toBeInTheDocument()
  })

  it('shows empty state when no issues', () => {
    render(<KnownIssuesPage />)
    expect(screen.getByText('No known issues')).toBeInTheDocument()
    expect(screen.getByText('Everything is running smoothly.')).toBeInTheDocument()
  })

  it('renders issues when present', async () => {
    // Mutate the mock array in place
    const issues = knownIssues as typeof knownIssues extends readonly (infer T)[] ? T[] : never[]
    issues.push({
      id: 1,
      reported: '2026-04-01',
      status: 'fixing',
      title: 'Clock-in timezone bug',
      description: 'Clock-in records wrong timezone.',
      module: 'Attendance',
      eta: '2026-04-07',
    })

    render(<KnownIssuesPage />)

    expect(screen.getByText('Clock-in timezone bug')).toBeInTheDocument()
    expect(screen.getByText('Clock-in records wrong timezone.')).toBeInTheDocument()
    expect(screen.getByText('Attendance')).toBeInTheDocument()
    expect(screen.getByText('Fixing')).toBeInTheDocument()
    expect(screen.queryByText('No known issues')).not.toBeInTheDocument()

    // Clean up
    issues.length = 0
  })
})
