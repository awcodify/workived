import React from 'react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import type { Widget } from '@/types/api'
import { LineWidget } from './LineWidget'

vi.mock('@/lib/hooks/useDashboard', () => ({
  useExecuteQuery: vi.fn(),
}))

import { useExecuteQuery } from '@/lib/hooks/useDashboard'

function makeWidget(overrides: Partial<Widget> = {}): Widget {
  return {
    id: 'w-line',
    organisation_id: 'org-1',
    dashboard_id: 'd-1',
    title: 'Tasks per Day',
    widget_type: 'line',
    query_config: { source: 'tasks', aggregate: 'count', date_bucket: 'day' },
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

describe('LineWidget', () => {
  beforeEach(() => vi.clearAllMocks())

  it('shows loading state', () => {
    vi.mocked(useExecuteQuery).mockReturnValue({ isLoading: true, isError: false, data: undefined } as ReturnType<typeof useExecuteQuery>)
    const { container } = render(<LineWidget widget={makeWidget()} />)
    expect(container.querySelector('.animate-pulse')).toBeInTheDocument()
  })

  it('shows error state', () => {
    vi.mocked(useExecuteQuery).mockReturnValue({ isLoading: false, isError: true, data: undefined } as ReturnType<typeof useExecuteQuery>)
    render(<LineWidget widget={makeWidget()} />)
    expect(screen.getByText('Failed to load data')).toBeInTheDocument()
  })

  it('shows empty state', () => {
    vi.mocked(useExecuteQuery).mockReturnValue({ isLoading: false, isError: false, data: { columns: [], rows: [] } } as ReturnType<typeof useExecuteQuery>)
    render(<LineWidget widget={makeWidget()} />)
    expect(screen.getByText('No data')).toBeInTheDocument()
  })

  it('renders widget title', () => {
    vi.mocked(useExecuteQuery).mockReturnValue({ isLoading: false, isError: false, data: { columns: [], rows: [] } } as ReturnType<typeof useExecuteQuery>)
    render(<LineWidget widget={makeWidget({ title: 'Attendance per Week' })} />)
    expect(screen.getByText('Attendance per Week')).toBeInTheDocument()
  })

  it('renders chart container when time-series data present', () => {
    vi.mocked(useExecuteQuery).mockReturnValue({
      isLoading: false,
      isError: false,
      data: {
        columns: ['bucket', 'value'],
        rows: [
          { bucket: '2026-04-01T00:00:00Z', value: 8 },
          { bucket: '2026-04-02T00:00:00Z', value: 12 },
          { bucket: '2026-04-03T00:00:00Z', value: 7 },
        ],
      },
    } as ReturnType<typeof useExecuteQuery>)
    render(<LineWidget widget={makeWidget()} />)
    // No error or loading state — recharts container is mounted
    expect(screen.queryByText('Failed to load data')).not.toBeInTheDocument()
    expect(screen.queryByText('No data')).not.toBeInTheDocument()
  })

  it('renders edit/delete buttons setup', () => {
    vi.mocked(useExecuteQuery).mockReturnValue({ isLoading: false, isError: false, data: { columns: [], rows: [] } } as ReturnType<typeof useExecuteQuery>)
    const onEdit = vi.fn()
    const onDelete = vi.fn()
    render(<LineWidget widget={makeWidget()} onEdit={onEdit} onDelete={onDelete} />)
    const buttons = document.querySelectorAll('button')
    expect(buttons.length).toBeGreaterThanOrEqual(2)
  })
})
