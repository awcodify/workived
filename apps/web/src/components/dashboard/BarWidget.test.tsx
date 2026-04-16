import React from 'react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import type { Widget } from '@/types/api'
import { BarWidget } from './BarWidget'

vi.mock('@/lib/hooks/useDashboard', () => ({
  useExecuteQuery: vi.fn(),
}))

import { useExecuteQuery } from '@/lib/hooks/useDashboard'

function makeWidget(overrides: Partial<Widget> = {}): Widget {
  return {
    id: 'w-bar',
    organisation_id: 'org-1',
    dashboard_id: 'd-1',
    title: 'Tasks by Priority',
    widget_type: 'bar',
    query_config: { source: 'tasks', aggregate: 'count', group_by: 'priority' },
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

describe('BarWidget', () => {
  beforeEach(() => vi.clearAllMocks())

  it('shows loading state', () => {
    vi.mocked(useExecuteQuery).mockReturnValue({ isLoading: true, isError: false, data: undefined } as ReturnType<typeof useExecuteQuery>)
    const { container } = render(<BarWidget widget={makeWidget()} />)
    expect(container.querySelector('.animate-pulse')).toBeInTheDocument()
  })

  it('shows error state', () => {
    vi.mocked(useExecuteQuery).mockReturnValue({ isLoading: false, isError: true, data: undefined } as ReturnType<typeof useExecuteQuery>)
    render(<BarWidget widget={makeWidget()} />)
    expect(screen.getByText('Failed to load data')).toBeInTheDocument()
  })

  it('shows empty state', () => {
    vi.mocked(useExecuteQuery).mockReturnValue({ isLoading: false, isError: false, data: { columns: [], rows: [] } } as ReturnType<typeof useExecuteQuery>)
    render(<BarWidget widget={makeWidget()} />)
    expect(screen.getByText('No data')).toBeInTheDocument()
  })

  it('renders widget title', () => {
    vi.mocked(useExecuteQuery).mockReturnValue({ isLoading: false, isError: false, data: { columns: [], rows: [] } } as ReturnType<typeof useExecuteQuery>)
    render(<BarWidget widget={makeWidget({ title: 'Claims by Category' })} />)
    expect(screen.getByText('Claims by Category')).toBeInTheDocument()
  })

  it('renders chart container when data present', () => {
    vi.mocked(useExecuteQuery).mockReturnValue({
      isLoading: false,
      isError: false,
      data: {
        columns: ['group_key', 'value'],
        rows: [
          { group_key: 'high', value: 12 },
          { group_key: 'urgent', value: 5 },
        ],
      },
    } as ReturnType<typeof useExecuteQuery>)
    render(<BarWidget widget={makeWidget()} />)
    // No error or loading state — recharts container is mounted
    expect(screen.queryByText('Failed to load data')).not.toBeInTheDocument()
    expect(screen.queryByText('No data')).not.toBeInTheDocument()
  })

  it('renders edit/delete buttons on hover setup', () => {
    vi.mocked(useExecuteQuery).mockReturnValue({ isLoading: false, isError: false, data: { columns: [], rows: [] } } as ReturnType<typeof useExecuteQuery>)
    const onEdit = vi.fn()
    const onDelete = vi.fn()
    render(<BarWidget widget={makeWidget()} onEdit={onEdit} onDelete={onDelete} />)
    // buttons are hidden via CSS class, but present in DOM
    const buttons = document.querySelectorAll('button')
    expect(buttons.length).toBeGreaterThanOrEqual(2)
  })
})
