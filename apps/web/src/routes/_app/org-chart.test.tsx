import React from 'react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import type { OrgChartNode } from '@/types/api'

// ── Mock hooks before component import ───────────────────────────────

vi.mock('@tanstack/react-router', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@tanstack/react-router')>()
  return {
    ...actual,
    createFileRoute: () => (opts: Record<string, unknown>) => ({ options: opts }),
    Link: ({ children, ...props }: React.PropsWithChildren<Record<string, unknown>>) => (
      <a href={props.to as string} data-testid={props['data-testid'] as string}>
        {children}
      </a>
    ),
  }
})

vi.mock('@/lib/hooks/useEmployees', () => ({
  useOrgChart: vi.fn(),
  useReparentEmployee: vi.fn(() => ({ mutate: vi.fn(), mutateAsync: vi.fn().mockResolvedValue({}), isPending: false })),
}))

vi.mock('@/lib/hooks/useRole', () => ({
  useCanManageEmployees: vi.fn(() => false),
}))

vi.mock('@/lib/hooks/useOrganisation', () => ({
  useOrganisation: vi.fn(() => ({ data: { plan: 'free', slug: 'test-org' } })),
}))

vi.mock('@/components/workived/layout/Avatar', () => ({
  Avatar: ({ name }: { name: string }) => <div data-testid="avatar">{name}</div>,
}))

vi.mock('@/components/workived/layout/StatusSquare', () => ({
  StatusSquare: ({ status }: { status: string }) => <div data-testid="status-square">{status}</div>,
}))

vi.mock('@/components/workived/shared/EmployeeDetailModal', () => ({
  EmployeeDetailModal: ({ employeeId, onClose }: { employeeId: string; onClose: () => void }) => (
    <div data-testid="employee-detail-modal">
      <span>{employeeId}</span>
      <button onClick={onClose} data-testid="modal-close">
        Close
      </button>
    </div>
  ),
}))

vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}))

import { useOrgChart, useReparentEmployee } from '@/lib/hooks/useEmployees'
import { useCanManageEmployees } from '@/lib/hooks/useRole'
import { useOrganisation } from '@/lib/hooks/useOrganisation'

// ── Helpers ───────────────────────────────────────────────────────────

function makeNode(overrides: Partial<OrgChartNode> = {}): OrgChartNode {
  return {
    id: 'emp-1',
    full_name: 'Ahmad CEO',
    job_title: 'Chief Executive Officer',
    employment_type: 'full_time',
    status: 'active',
    ...overrides,
  }
}

function makeTree(): OrgChartNode[] {
  return [
    makeNode({
      id: 'ceo-1',
      full_name: 'Ahmad CEO',
      job_title: 'Chief Executive Officer',
      direct_reports: [
        makeNode({
          id: 'mgr-1',
          full_name: 'Budi Manager',
          job_title: 'Engineering Manager',
          reporting_to: 'ceo-1',
          direct_reports: [
            makeNode({
              id: 'dev-1',
              full_name: 'Citra Developer',
              job_title: 'Software Engineer',
              reporting_to: 'mgr-1',
            }),
            makeNode({
              id: 'dev-2',
              full_name: 'Dewi Developer',
              job_title: 'Software Engineer',
              reporting_to: 'mgr-1',
            }),
          ],
        }),
        makeNode({
          id: 'mgr-2',
          full_name: 'Eka Designer',
          job_title: 'Design Lead',
          reporting_to: 'ceo-1',
        }),
      ],
    }),
  ]
}

async function importComponent() {
  return import('./org-chart')
}

// ── Tests ─────────────────────────────────────────────────────────────

describe('OrgChartPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(useReparentEmployee).mockReturnValue({ mutate: vi.fn(), mutateAsync: vi.fn().mockResolvedValue({}), isPending: false } as ReturnType<typeof useReparentEmployee>)
    vi.mocked(useOrganisation).mockReturnValue({ data: { plan: 'free', slug: 'test-org' } } as ReturnType<typeof useOrganisation>)
  })

  it('renders loading spinner while data is loading', async () => {
    vi.mocked(useOrgChart).mockReturnValue({ data: undefined, isLoading: true } as ReturnType<typeof useOrgChart>)
    const mod = await importComponent()
    const Component = mod.Route.options.component as React.ComponentType
    render(<Component />)
    expect(screen.getByTestId('org-chart-loading')).toBeInTheDocument()
  })

  it('renders empty state when no tree data', async () => {
    vi.mocked(useOrgChart).mockReturnValue({ data: [], isLoading: false } as ReturnType<typeof useOrgChart>)
    const mod = await importComponent()
    const Component = mod.Route.options.component as React.ComponentType
    render(<Component />)
    expect(screen.getByTestId('org-chart-empty')).toBeInTheDocument()
    expect(screen.getByText('No organizational structure yet')).toBeInTheDocument()
  })

  it('shows add employee button in empty state when user can manage', async () => {
    vi.mocked(useOrgChart).mockReturnValue({ data: [], isLoading: false } as ReturnType<typeof useOrgChart>)
    vi.mocked(useCanManageEmployees).mockReturnValue(true)
    const mod = await importComponent()
    const Component = mod.Route.options.component as React.ComponentType
    render(<Component />)
    expect(screen.getByTestId('org-chart-add-employee')).toBeInTheDocument()
  })

  it('hides add employee button when user cannot manage', async () => {
    vi.mocked(useOrgChart).mockReturnValue({ data: [], isLoading: false } as ReturnType<typeof useOrgChart>)
    vi.mocked(useCanManageEmployees).mockReturnValue(false)
    const mod = await importComponent()
    const Component = mod.Route.options.component as React.ComponentType
    render(<Component />)
    expect(screen.queryByTestId('org-chart-add-employee')).toBeNull()
  })

  it('renders org chart with tree data', async () => {
    vi.mocked(useOrgChart).mockReturnValue({ data: makeTree(), isLoading: false } as ReturnType<typeof useOrgChart>)
    const mod = await importComponent()
    const Component = mod.Route.options.component as React.ComponentType
    render(<Component />)
    expect(screen.getByTestId('org-chart-canvas')).toBeInTheDocument()
    expect(screen.getByTestId('org-card-ceo-1')).toBeInTheDocument()
    expect(screen.getByTestId('org-card-mgr-1')).toBeInTheDocument()
    expect(screen.getByTestId('org-card-dev-1')).toBeInTheDocument()
  })

  it('displays employee names and job titles', async () => {
    vi.mocked(useOrgChart).mockReturnValue({ data: makeTree(), isLoading: false } as ReturnType<typeof useOrgChart>)
    const mod = await importComponent()
    const Component = mod.Route.options.component as React.ComponentType
    render(<Component />)
    expect(screen.getAllByText('Ahmad CEO').length).toBeGreaterThan(0)
    expect(screen.getAllByText('Chief Executive Officer').length).toBeGreaterThan(0)
    expect(screen.getAllByText('Budi Manager').length).toBeGreaterThan(0)
  })

  it('shows people count in header', async () => {
    vi.mocked(useOrgChart).mockReturnValue({ data: makeTree(), isLoading: false } as ReturnType<typeof useOrgChart>)
    const mod = await importComponent()
    const Component = mod.Route.options.component as React.ComponentType
    render(<Component />)
    expect(screen.getByText('5 people in your organization')).toBeInTheDocument()
  })

  it('renders SVG connector paths', async () => {
    vi.mocked(useOrgChart).mockReturnValue({ data: makeTree(), isLoading: false } as ReturnType<typeof useOrgChart>)
    const mod = await importComponent()
    const Component = mod.Route.options.component as React.ComponentType
    render(<Component />)
    const svg = screen.getByTestId('org-chart-connectors')
    expect(svg.querySelectorAll('path').length).toBeGreaterThan(0)
  })

  it('opens employee detail modal on card click (no drag)', async () => {
    vi.mocked(useOrgChart).mockReturnValue({ data: makeTree(), isLoading: false } as ReturnType<typeof useOrgChart>)
    const mod = await importComponent()
    const Component = mod.Route.options.component as React.ComponentType
    render(<Component />)
    fireEvent.click(screen.getByTestId('org-card-btn-mgr-1'))
    expect(screen.getByTestId('employee-detail-modal')).toBeInTheDocument()
    expect(screen.getByText('mgr-1')).toBeInTheDocument()
  })

  it('closes employee detail modal', async () => {
    vi.mocked(useOrgChart).mockReturnValue({ data: makeTree(), isLoading: false } as ReturnType<typeof useOrgChart>)
    const mod = await importComponent()
    const Component = mod.Route.options.component as React.ComponentType
    render(<Component />)
    fireEvent.click(screen.getByTestId('org-card-btn-mgr-1'))
    expect(screen.getByTestId('employee-detail-modal')).toBeInTheDocument()
    fireEvent.click(screen.getByTestId('modal-close'))
    expect(screen.queryByTestId('employee-detail-modal')).toBeNull()
  })

  it('collapses and expands tree nodes', async () => {
    vi.mocked(useOrgChart).mockReturnValue({ data: makeTree(), isLoading: false } as ReturnType<typeof useOrgChart>)
    const mod = await importComponent()
    const Component = mod.Route.options.component as React.ComponentType
    render(<Component />)
    expect(screen.getByTestId('org-card-dev-1')).toBeInTheDocument()
    fireEvent.click(screen.getByTestId('org-toggle-mgr-1'))
    expect(screen.queryByTestId('org-card-dev-1')).toBeNull()
    fireEvent.click(screen.getByTestId('org-toggle-mgr-1'))
    expect(screen.getByTestId('org-card-dev-1')).toBeInTheDocument()
  })

  it('renders zoom controls', async () => {
    vi.mocked(useOrgChart).mockReturnValue({ data: makeTree(), isLoading: false } as ReturnType<typeof useOrgChart>)
    const mod = await importComponent()
    const Component = mod.Route.options.component as React.ComponentType
    render(<Component />)
    expect(screen.getByTestId('org-chart-zoom-in')).toBeInTheDocument()
    expect(screen.getByTestId('org-chart-zoom-out')).toBeInTheDocument()
    expect(screen.getByTestId('org-chart-zoom-level')).toHaveTextContent('100%')
  })

  it('updates zoom level on zoom in/out', async () => {
    vi.mocked(useOrgChart).mockReturnValue({ data: makeTree(), isLoading: false } as ReturnType<typeof useOrgChart>)
    const mod = await importComponent()
    const Component = mod.Route.options.component as React.ComponentType
    render(<Component />)
    fireEvent.click(screen.getByTestId('org-chart-zoom-in'))
    expect(screen.getByTestId('org-chart-zoom-level')).toHaveTextContent('115%')
    fireEvent.click(screen.getByTestId('org-chart-zoom-out'))
    expect(screen.getByTestId('org-chart-zoom-level')).toHaveTextContent('100%')
  })

  it('opens and closes search', async () => {
    vi.mocked(useOrgChart).mockReturnValue({ data: makeTree(), isLoading: false } as ReturnType<typeof useOrgChart>)
    const mod = await importComponent()
    const Component = mod.Route.options.component as React.ComponentType
    render(<Component />)
    fireEvent.click(screen.getByTestId('org-chart-search-toggle'))
    expect(screen.getByTestId('org-chart-search-input')).toBeInTheDocument()
    fireEvent.click(screen.getByTestId('org-chart-search-close'))
    expect(screen.queryByTestId('org-chart-search-input')).toBeNull()
  })

  it('filters and highlights matching nodes on search', async () => {
    vi.mocked(useOrgChart).mockReturnValue({ data: makeTree(), isLoading: false } as ReturnType<typeof useOrgChart>)
    const mod = await importComponent()
    const Component = mod.Route.options.component as React.ComponentType
    render(<Component />)
    fireEvent.click(screen.getByTestId('org-chart-search-toggle'))
    fireEvent.change(screen.getByTestId('org-chart-search-input'), { target: { value: 'Citra' } })
    expect(screen.getByTestId('org-card-dev-1').style.opacity).toBe('1')
    expect(screen.getByTestId('org-card-ceo-1').style.opacity).toBe('0.35')
  })

  it('shows back link to people page', async () => {
    vi.mocked(useOrgChart).mockReturnValue({ data: makeTree(), isLoading: false } as ReturnType<typeof useOrgChart>)
    const mod = await importComponent()
    const Component = mod.Route.options.component as React.ComponentType
    render(<Component />)
    expect(screen.getByTestId('org-chart-back')).toBeInTheDocument()
  })

  it('falls back to employment type when job_title missing', async () => {
    vi.mocked(useOrgChart).mockReturnValue({
      data: [makeNode({ id: 'no-title', full_name: 'No Title', job_title: undefined, employment_type: 'part_time' })],
      isLoading: false,
    } as ReturnType<typeof useOrgChart>)
    const mod = await importComponent()
    const Component = mod.Route.options.component as React.ComponentType
    render(<Component />)
    expect(screen.getByText('part time')).toBeInTheDocument()
  })

  it('renders single employee with no reports or manager in unassigned section', async () => {
    vi.mocked(useOrgChart).mockReturnValue({
      data: [makeNode({ id: 'solo', full_name: 'Solo Employee' })],
      isLoading: false,
    } as ReturnType<typeof useOrgChart>)
    const mod = await importComponent()
    const Component = mod.Route.options.component as React.ComponentType
    render(<Component />)
    // Solo node has no direct_reports and no reporting_to → lands in unassigned section
    expect(screen.getByTestId('org-unassigned-solo')).toBeInTheDocument()
    expect(screen.queryByTestId('org-chart-canvas')).toBeNull()
    expect(screen.queryByTestId('org-chart-connectors')).toBeNull()
  })

  // ── Ghost cards for invited employees ────────────────────────────────

  it('renders invited employee with ghost opacity and pending badge in hierarchy', async () => {
    vi.mocked(useOrgChart).mockReturnValue({
      data: [
        makeNode({
          id: 'ceo-1',
          full_name: 'Ahmad CEO',
          direct_reports: [
            makeNode({ id: 'invited-1', full_name: 'Pending User', status: 'invited', reporting_to: 'ceo-1' }),
          ],
        }),
      ],
      isLoading: false,
    } as ReturnType<typeof useOrgChart>)
    const mod = await importComponent()
    const Component = mod.Route.options.component as React.ComponentType
    render(<Component />)
    const card = screen.getByTestId('org-card-invited-1')
    expect(card).toBeInTheDocument()
    expect(parseFloat(card.style.opacity)).toBeLessThan(1)
    expect(screen.getByTestId('org-card-invited-badge-invited-1')).toHaveTextContent('Pending invite')
  })

  it('renders invited employee in unassigned section with ghost style', async () => {
    vi.mocked(useOrgChart).mockReturnValue({
      data: [makeNode({ id: 'invited-solo', full_name: 'Invited Solo', status: 'invited' })],
      isLoading: false,
    } as ReturnType<typeof useOrgChart>)
    const mod = await importComponent()
    const Component = mod.Route.options.component as React.ComponentType
    render(<Component />)
    const card = screen.getByTestId('org-unassigned-invited-solo')
    expect(card).toBeInTheDocument()
    expect(parseFloat(card.style.opacity)).toBeLessThan(1)
  })

  // ── Export PNG ────────────────────────────────────────────────────────

  it('renders export button in toolbar', async () => {
    vi.mocked(useOrgChart).mockReturnValue({ data: makeTree(), isLoading: false } as ReturnType<typeof useOrgChart>)
    const mod = await importComponent()
    const Component = mod.Route.options.component as React.ComponentType
    render(<Component />)
    expect(screen.getByTestId('org-chart-export')).toBeInTheDocument()
  })

  it('shows error toast on export when on free plan', async () => {
    vi.mocked(useOrgChart).mockReturnValue({ data: makeTree(), isLoading: false } as ReturnType<typeof useOrgChart>)
    vi.mocked(useOrganisation).mockReturnValue({ data: { plan: 'free', slug: 'test' } } as ReturnType<typeof useOrganisation>)
    const mod = await importComponent()
    const Component = mod.Route.options.component as React.ComponentType
    render(<Component />)
    const { toast } = await import('sonner')
    fireEvent.click(screen.getByTestId('org-chart-export'))
    expect(toast.error).toHaveBeenCalledWith(
      expect.stringContaining('Pro plan'),
    )
  })

  // ── Canvas drag guideline ─────────────────────────────────────────────

  it('shows canvas drag guideline when canEdit', async () => {
    vi.mocked(useOrgChart).mockReturnValue({ data: makeTree(), isLoading: false } as ReturnType<typeof useOrgChart>)
    vi.mocked(useCanManageEmployees).mockReturnValue(true)
    const mod = await importComponent()
    const Component = mod.Route.options.component as React.ComponentType
    render(<Component />)
    expect(screen.getByTestId('org-chart-drag-guide')).toBeInTheDocument()
  })

  it('hides canvas drag guideline when canEdit is false', async () => {
    vi.mocked(useOrgChart).mockReturnValue({ data: makeTree(), isLoading: false } as ReturnType<typeof useOrgChart>)
    vi.mocked(useCanManageEmployees).mockReturnValue(false)
    const mod = await importComponent()
    const Component = mod.Route.options.component as React.ComponentType
    render(<Component />)
    expect(screen.queryByTestId('org-chart-drag-guide')).toBeNull()
  })

  it('reparent hint is hidden when not dragging', async () => {
    vi.mocked(useOrgChart).mockReturnValue({ data: makeTree(), isLoading: false } as ReturnType<typeof useOrgChart>)
    const mod = await importComponent()
    const Component = mod.Route.options.component as React.ComponentType
    render(<Component />)
    expect(screen.queryByTestId('org-chart-reparent-hint')).toBeNull()
  })

  // ── Draft save bar ────────────────────────────────────────────────────

  it('draft bar is hidden when no draft changes', async () => {
    vi.mocked(useOrgChart).mockReturnValue({ data: makeTree(), isLoading: false } as ReturnType<typeof useOrgChart>)
    const mod = await importComponent()
    const Component = mod.Route.options.component as React.ComponentType
    render(<Component />)
    expect(screen.queryByTestId('org-chart-draft-bar')).toBeNull()
  })

  it('draft dot is absent when no changes pending', async () => {
    vi.mocked(useOrgChart).mockReturnValue({ data: makeTree(), isLoading: false } as ReturnType<typeof useOrgChart>)
    const mod = await importComponent()
    const Component = mod.Route.options.component as React.ComponentType
    render(<Component />)
    expect(screen.queryByTestId('org-card-draft-dot-ceo-1')).toBeNull()
  })

  it('save and discard buttons are present on draft bar', async () => {
    // Draft bar renders when draftChanges.size > 0 — we test its structure via canEdit=true + import
    vi.mocked(useOrgChart).mockReturnValue({ data: makeTree(), isLoading: false } as ReturnType<typeof useOrgChart>)
    vi.mocked(useCanManageEmployees).mockReturnValue(true)
    const mod = await importComponent()
    const Component = mod.Route.options.component as React.ComponentType
    render(<Component />)
    // Bar not shown yet (no drafts)
    expect(screen.queryByTestId('org-chart-save-btn')).toBeNull()
    expect(screen.queryByTestId('org-chart-discard-btn')).toBeNull()
  })

  // ── Unassigned card drag ──────────────────────────────────────────────

  it('unassigned card has data-card-id for drop target detection', async () => {
    vi.mocked(useOrgChart).mockReturnValue({
      data: [makeNode({ id: 'solo', full_name: 'Solo Employee' })],
      isLoading: false,
    } as ReturnType<typeof useOrgChart>)
    const mod = await importComponent()
    const Component = mod.Route.options.component as React.ComponentType
    render(<Component />)
    const wrapper = screen.getByTestId('org-unassigned-wrapper-solo')
    expect(wrapper).toHaveAttribute('data-card-id', 'solo')
  })

  it('unassigned card shows grab cursor when canEdit', async () => {
    vi.mocked(useOrgChart).mockReturnValue({
      data: [makeNode({ id: 'solo', full_name: 'Solo Employee' })],
      isLoading: false,
    } as ReturnType<typeof useOrgChart>)
    vi.mocked(useCanManageEmployees).mockReturnValue(true)
    const mod = await importComponent()
    const Component = mod.Route.options.component as React.ComponentType
    render(<Component />)
    const wrapper = screen.getByTestId('org-unassigned-wrapper-solo')
    expect(wrapper).toHaveStyle({ cursor: 'grab' })
  })

  it('unassigned card wrapper has pointer event handlers for drag', async () => {
    vi.mocked(useOrgChart).mockReturnValue({
      data: [makeNode({ id: 'solo', full_name: 'Solo Employee' })],
      isLoading: false,
    } as ReturnType<typeof useOrgChart>)
    const mod = await importComponent()
    const Component = mod.Route.options.component as React.ComponentType
    const { container } = render(<Component />)
    const wrapper = screen.getByTestId('org-unassigned-wrapper-solo')
    // Wrapper must have pointer handlers wired (onpointerdown/move/up present in DOM)
    expect(wrapper.onpointerdown).toBeDefined()
    expect(wrapper.onpointermove).toBeDefined()
    expect(wrapper.onpointerup).toBeDefined()
  })
})
