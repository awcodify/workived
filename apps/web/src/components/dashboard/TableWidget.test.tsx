import React from 'react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import type { Widget } from '@/types/api'
import { TableWidget } from './TableWidget'

vi.mock('@/lib/hooks/useDashboard', () => ({
  useExecuteQuery: vi.fn(),
}))

import { useExecuteQuery } from '@/lib/hooks/useDashboard'

function makeWidget(overrides: Partial<Widget> = {}): Widget {
  return {
    id: 'w-2',
    organisation_id: 'org-1',
    dashboard_id: 'd-1',
    title: 'Overdue Tasks',
    widget_type: 'table',
    query_config: { source: 'tasks', columns: ['title', 'priority'] },
    viz_config: {},
    position_x: 0,
    position_y: 0,
    width: 6,
    height: 3,
    created_at: '2026-04-01T00:00:00Z',
    updated_at: '2026-04-01T00:00:00Z',
    ...overrides,
  }
}

describe('TableWidget', () => {
  beforeEach(() => vi.clearAllMocks())

  it('shows loading state', () => {
    vi.mocked(useExecuteQuery).mockReturnValue({ isLoading: true, isError: false, data: undefined } as ReturnType<typeof useExecuteQuery>)
    const { container } = render(<TableWidget widget={makeWidget()} />)
    expect(container.querySelector('.animate-pulse')).toBeInTheDocument()
  })

  it('shows error state', () => {
    vi.mocked(useExecuteQuery).mockReturnValue({ isLoading: false, isError: true, data: undefined } as ReturnType<typeof useExecuteQuery>)
    render(<TableWidget widget={makeWidget()} />)
    expect(screen.getByText('Failed to load data')).toBeInTheDocument()
  })

  it('shows empty state', () => {
    vi.mocked(useExecuteQuery).mockReturnValue({ isLoading: false, isError: false, data: { columns: [], rows: [] } } as ReturnType<typeof useExecuteQuery>)
    render(<TableWidget widget={makeWidget()} />)
    expect(screen.getByText('No results')).toBeInTheDocument()
  })

  it('renders column headers', () => {
    vi.mocked(useExecuteQuery).mockReturnValue({
      isLoading: false,
      isError: false,
      data: {
        columns: ['title', 'priority'],
        rows: [{ title: 'Fix bug', priority: 'high' }],
      },
    } as ReturnType<typeof useExecuteQuery>)
    render(<TableWidget widget={makeWidget()} />)
    expect(screen.getByText('title')).toBeInTheDocument()
    expect(screen.getByText('priority')).toBeInTheDocument()
  })

  it('renders data rows', () => {
    vi.mocked(useExecuteQuery).mockReturnValue({
      isLoading: false,
      isError: false,
      data: {
        columns: ['title', 'priority'],
        rows: [
          { title: 'Fix bug', priority: 'high' },
          { title: 'Deploy fix', priority: 'urgent' },
        ],
      },
    } as ReturnType<typeof useExecuteQuery>)
    render(<TableWidget widget={makeWidget()} />)
    expect(screen.getByText('Fix bug')).toBeInTheDocument()
    expect(screen.getByText('Deploy fix')).toBeInTheDocument()
    expect(screen.getByText('urgent')).toBeInTheDocument()
  })

  it('renders widget title', () => {
    vi.mocked(useExecuteQuery).mockReturnValue({ isLoading: false, isError: false, data: { columns: [], rows: [] } } as ReturnType<typeof useExecuteQuery>)
    render(<TableWidget widget={makeWidget({ title: 'My Table' })} />)
    expect(screen.getByText('My Table')).toBeInTheDocument()
  })

  it('renders null cell as dash', () => {
    vi.mocked(useExecuteQuery).mockReturnValue({
      isLoading: false,
      isError: false,
      data: {
        columns: ['title'],
        rows: [{ title: null }],
      },
    } as ReturnType<typeof useExecuteQuery>)
    render(<TableWidget widget={makeWidget()} />)
    expect(screen.getByText('—')).toBeInTheDocument()
  })
})
