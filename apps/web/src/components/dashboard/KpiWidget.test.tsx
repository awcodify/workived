import React from 'react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import type { Widget } from '@/types/api'
import { KpiWidget } from './KpiWidget'

vi.mock('@/lib/hooks/useDashboard', () => ({
  useExecuteQuery: vi.fn(),
}))

import { useExecuteQuery } from '@/lib/hooks/useDashboard'

function makeWidget(overrides: Partial<Widget> = {}): Widget {
  return {
    id: 'w-1',
    organisation_id: 'org-1',
    dashboard_id: 'd-1',
    title: 'Total Tasks',
    widget_type: 'kpi',
    query_config: { source: 'tasks', aggregate: 'count' },
    viz_config: {},
    position_x: 0,
    position_y: 0,
    width: 4,
    height: 2,
    created_at: '2026-04-01T00:00:00Z',
    updated_at: '2026-04-01T00:00:00Z',
    ...overrides,
  }
}

describe('KpiWidget', () => {
  const onEdit = vi.fn()
  const onDelete = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('shows loading spinner while fetching', () => {
    vi.mocked(useExecuteQuery).mockReturnValue({ isLoading: true, isError: false, data: undefined } as ReturnType<typeof useExecuteQuery>)
    const { container } = render(<KpiWidget widget={makeWidget()} onEdit={onEdit} onDelete={onDelete} />)
    expect(container.querySelector('.animate-pulse')).toBeInTheDocument()
  })

  it('shows error state', () => {
    vi.mocked(useExecuteQuery).mockReturnValue({ isLoading: false, isError: true, data: undefined } as ReturnType<typeof useExecuteQuery>)
    render(<KpiWidget widget={makeWidget()} />)
    expect(screen.getByText('Error')).toBeInTheDocument()
  })

  it('renders KPI value', () => {
    vi.mocked(useExecuteQuery).mockReturnValue({ isLoading: false, isError: false, data: { columns: [], rows: [], value: 42 } } as ReturnType<typeof useExecuteQuery>)
    render(<KpiWidget widget={makeWidget()} />)
    expect(screen.getByText('42')).toBeInTheDocument()
  })

  it('renders widget title', () => {
    vi.mocked(useExecuteQuery).mockReturnValue({ isLoading: false, isError: false, data: { columns: [], rows: [], value: 0 } } as ReturnType<typeof useExecuteQuery>)
    render(<KpiWidget widget={makeWidget({ title: 'Open Tasks' })} />)
    expect(screen.getByText('Open Tasks')).toBeInTheDocument()
  })

  it('shows dash for undefined value', () => {
    vi.mocked(useExecuteQuery).mockReturnValue({ isLoading: false, isError: false, data: { columns: [], rows: [] } } as ReturnType<typeof useExecuteQuery>)
    render(<KpiWidget widget={makeWidget()} />)
    expect(screen.getByText('—')).toBeInTheDocument()
  })

  it('formats large numbers with K suffix', () => {
    vi.mocked(useExecuteQuery).mockReturnValue({ isLoading: false, isError: false, data: { columns: [], rows: [], value: 1500 } } as ReturnType<typeof useExecuteQuery>)
    render(<KpiWidget widget={makeWidget()} />)
    expect(screen.getByText('1.5K')).toBeInTheDocument()
  })

  it('renders unit label when provided', () => {
    vi.mocked(useExecuteQuery).mockReturnValue({ isLoading: false, isError: false, data: { columns: [], rows: [], value: 75 } } as ReturnType<typeof useExecuteQuery>)
    render(<KpiWidget widget={makeWidget({ viz_config: { unit: '%' } })} />)
    expect(screen.getByText('%')).toBeInTheDocument()
  })
})
