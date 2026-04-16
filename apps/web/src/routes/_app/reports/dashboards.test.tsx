import React from 'react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'

// ── Mocks ─────────────────────────────────────────────────────────────────────

// Mutable search state — update before render to simulate URL params
const mockSearch: { dashboardId: string | undefined } = { dashboardId: undefined }
const mockNavigate = vi.fn()

vi.mock('@tanstack/react-router', () => ({
  createFileRoute: () => (opts: { component: React.ComponentType }) => ({
    options: opts,
    useSearch: () => ({ dashboardId: mockSearch.dashboardId }),
  }),
  useMatches: vi.fn(() => [{ pathname: '/reports/dashboards' }]),
  useNavigate: vi.fn(() => mockNavigate),
  Link: ({ children, ...props }: { children: React.ReactNode; [key: string]: unknown }) => <a {...props}>{children}</a>,
}))

vi.mock('@/lib/hooks/useDashboard', () => ({
  useDashboards: vi.fn(),
  useCreateDashboard: vi.fn(),
  useDeleteDashboard: vi.fn(),
  useWidgets: vi.fn(),
  useCreateWidget: vi.fn(),
  useUpdateWidget: vi.fn(),
  useDeleteWidget: vi.fn(),
  useExecuteQuery: vi.fn(() => ({ isLoading: false, isError: false, data: undefined })),
}))

vi.mock('@/lib/hooks/useTasks', () => ({
  useFieldDefinitions: vi.fn(() => ({ data: [] })),
}))

vi.mock('recharts', () => ({
  BarChart: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  LineChart: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  Bar: () => null,
  Line: () => null,
  XAxis: () => null,
  YAxis: () => null,
  CartesianGrid: () => null,
  Tooltip: () => null,
  ResponsiveContainer: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}))

vi.mock('react-grid-layout', async () => {
  const ResponsiveGridLayout = ({ children }: { children: React.ReactNode }) => (
    <div data-testid="grid-layout">{children}</div>
  )
  const useContainerWidth = () => ({ width: 1200, containerRef: { current: null }, mounted: true })
  return { ResponsiveGridLayout, useContainerWidth }
})

vi.mock('@/design/tokens', () => ({
  moduleBackgrounds: { dark: '#0C0C0F', reports: '#F3F2FB' },
  moduleThemes: { reports: { text: '#0F0E13', textMuted: '#72708A', surface: '#FFFFFF', surfaceHover: '#F3F2FB', accent: '#6357E8', accentText: '#FFFFFF', border: 'rgba(99,87,232,0.10)', input: '#FFFFFF', inputBorder: 'rgba(99,87,232,0.12)' } },
  typography: { h1: {}, label: {} },
}))

// ── Import after mocks ────────────────────────────────────────────────────────

import {
  useDashboards,
  useCreateDashboard,
  useDeleteDashboard,
  useWidgets,
  useCreateWidget,
  useUpdateWidget,
  useDeleteWidget,
} from '@/lib/hooks/useDashboard'
import { Route } from './dashboards'

const DashboardsPage = Route.options.component as React.ComponentType

// ── Fixtures ──────────────────────────────────────────────────────────────────

function makeDash(id = 'd-1', name = 'My Dashboard') {
  return { id, name, is_default: false, created_at: '', updated_at: '', organisation_id: 'o-1', created_by: 'u-1' }
}

function makeWidget(overrides = {}) {
  return {
    id: 'w-1', dashboard_id: 'd-1', organisation_id: 'o-1',
    title: 'Total Tasks', widget_type: 'kpi' as const,
    query_config: { source: 'tasks', aggregate: 'count' },
    viz_config: {}, position_x: 0, position_y: 0, width: 4, height: 2,
    created_at: '', updated_at: '',
    ...overrides,
  }
}

function setupHooks() {
  vi.mocked(useDashboards).mockReturnValue({ data: [], isLoading: false } as ReturnType<typeof useDashboards>)
  vi.mocked(useCreateDashboard).mockReturnValue({ mutateAsync: vi.fn().mockResolvedValue(makeDash()), isPending: false } as ReturnType<typeof useCreateDashboard>)
  vi.mocked(useDeleteDashboard).mockReturnValue({ mutate: vi.fn() } as ReturnType<typeof useDeleteDashboard>)
  vi.mocked(useWidgets).mockReturnValue({ data: [], isLoading: false } as ReturnType<typeof useWidgets>)
  vi.mocked(useCreateWidget).mockReturnValue({ mutateAsync: vi.fn().mockResolvedValue(makeWidget()), isPending: false } as ReturnType<typeof useCreateWidget>)
  vi.mocked(useUpdateWidget).mockReturnValue({ mutate: vi.fn(), mutateAsync: vi.fn(), isPending: false } as ReturnType<typeof useUpdateWidget>)
  vi.mocked(useDeleteWidget).mockReturnValue({ mutate: vi.fn() } as ReturnType<typeof useDeleteWidget>)
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('DashboardsPage', () => {
  beforeEach(() => {
    setupHooks()
    vi.clearAllMocks()
    setupHooks()
    mockSearch.dashboardId = undefined // reset URL state
  })

  it('shows loading state', () => {
    vi.mocked(useDashboards).mockReturnValue({ data: [], isLoading: true } as ReturnType<typeof useDashboards>)
    render(<DashboardsPage />)
    expect(screen.getByText('Loading…')).toBeInTheDocument()
  })

  it('auto-opens modal when no dashboards', () => {
    render(<DashboardsPage />)
    expect(screen.getByTestId('template-selector')).toBeInTheDocument()
  })

  it('template selector shows all 3 templates', () => {
    render(<DashboardsPage />)
    // modal auto-opens on empty state
    expect(screen.getByText('HR Overview')).toBeInTheDocument()
    expect(screen.getByText('Task Tracker')).toBeInTheDocument()
    expect(screen.getByText('Claims Monitor')).toBeInTheDocument()
  })

  it('template selector shows widget type counts for HR Overview', () => {
    render(<DashboardsPage />)
    const hrButton = screen.getByText('HR Overview').closest('button')!
    expect(hrButton.textContent).toContain('5 KPIs')
    expect(hrButton.textContent).toContain('4 charts')
  })

  it('shows blank dashboard card', () => {
    render(<DashboardsPage />)
    expect(screen.getByText('Blank')).toBeInTheDocument()
  })

  it('blank card opens new dashboard name input', () => {
    render(<DashboardsPage />)
    fireEvent.click(screen.getByText('Blank').closest('button')!)
    expect(screen.getByPlaceholderText('Dashboard name…')).toBeInTheDocument()
  })

  it('shows dashboard card in list view when dashboards exist', () => {
    vi.mocked(useDashboards).mockReturnValue({ data: [makeDash()], isLoading: false } as ReturnType<typeof useDashboards>)
    render(<DashboardsPage />)
    expect(screen.getByText('My Dashboard')).toBeInTheDocument()
  })

  it('clicking + card opens new dashboard modal', () => {
    vi.mocked(useDashboards).mockReturnValue({ data: [makeDash()], isLoading: false } as ReturnType<typeof useDashboards>)
    render(<DashboardsPage />)
    fireEvent.click(screen.getByText('New Dashboard'))
    expect(screen.getByTestId('template-selector')).toBeInTheDocument()
  })

  it('clicking dashboard card calls navigate with dashboardId', () => {
    vi.mocked(useDashboards).mockReturnValue({ data: [makeDash()], isLoading: false } as ReturnType<typeof useDashboards>)
    render(<DashboardsPage />)
    fireEvent.click(screen.getByText('My Dashboard'))
    expect(mockNavigate).toHaveBeenCalledWith(
      expect.objectContaining({ search: { dashboardId: 'd-1' } })
    )
  })

  it('shows dashboard view when dashboardId set in URL', () => {
    mockSearch.dashboardId = 'd-1'
    vi.mocked(useDashboards).mockReturnValue({ data: [makeDash()], isLoading: false } as ReturnType<typeof useDashboards>)
    render(<DashboardsPage />)
    expect(screen.getByText('No widgets yet')).toBeInTheDocument()
  })

  it('renders grid layout when widgets present', () => {
    mockSearch.dashboardId = 'd-1'
    vi.mocked(useDashboards).mockReturnValue({ data: [makeDash()], isLoading: false } as ReturnType<typeof useDashboards>)
    vi.mocked(useWidgets).mockReturnValue({ data: [makeWidget()], isLoading: false } as ReturnType<typeof useWidgets>)
    render(<DashboardsPage />)
    expect(screen.getByTestId('grid-layout')).toBeInTheDocument()
    expect(screen.getByText('Total Tasks')).toBeInTheDocument()
  })

  it('Add Widget button opens config panel', () => {
    mockSearch.dashboardId = 'd-1'
    vi.mocked(useDashboards).mockReturnValue({ data: [makeDash()], isLoading: false } as ReturnType<typeof useDashboards>)
    render(<DashboardsPage />)
    fireEvent.click(screen.getByText('Add Widget'))
    expect(screen.getByText('New Widget')).toBeInTheDocument()
  })

  it('back button navigates to list view', () => {
    mockSearch.dashboardId = 'd-1'
    vi.mocked(useDashboards).mockReturnValue({ data: [makeDash()], isLoading: false } as ReturnType<typeof useDashboards>)
    render(<DashboardsPage />)
    // "Dashboards" text appears as back button in dashboard view
    const backBtn = screen.getAllByText('Dashboards').find(el => el.tagName === 'BUTTON' || el.closest('button'))
    fireEvent.click(backBtn!.closest('button') ?? backBtn!)
    expect(mockNavigate).toHaveBeenCalledWith(
      expect.objectContaining({ search: {} })
    )
  })
})
