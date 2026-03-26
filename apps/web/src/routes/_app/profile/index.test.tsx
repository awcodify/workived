import React from 'react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import type { Employee } from '@/types/api'

// ── Mock hooks before component import ────────────────────────────────────────

vi.mock('@tanstack/react-router', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@tanstack/react-router')>()
  return {
    ...actual,
    createFileRoute: () => (opts: Record<string, unknown>) => ({ options: opts }),
    Link: ({ children, ...props }: React.PropsWithChildren<Record<string, unknown>>) => (
      <a href={props.to as string}>{children}</a>
    ),
  }
})

vi.mock('@/lib/hooks/useEmployees', () => ({
  useMyEmployee: vi.fn(),
}))

vi.mock('@/lib/stores/auth', () => ({
  useAuthStore: vi.fn((selector: (s: Record<string, unknown>) => unknown) =>
    selector({
      accessToken: 'fake-token',
      user: { id: 'user-1', full_name: 'Ahmad', email: 'ahmad@example.com' },
    }),
  ),
}))

vi.mock('@/components/workived/layout/Avatar', () => ({
  Avatar: () => <div data-testid="avatar" />,
}))

vi.mock('@/components/workived/layout/StatusSquare', () => ({
  StatusSquare: () => <div data-testid="status-square" />,
}))

import { useMyEmployee } from '@/lib/hooks/useEmployees'

// ── Helpers ────────────────────────────────────────────────────────────────────

function makeEmployee(overrides: Partial<Employee> = {}): Employee {
  return {
    id: 'emp-1',
    organisation_id: 'org-1',
    full_name: 'Ahmad Founder',
    email: 'ahmad@acme.com',
    phone: '+971501234567',
    job_title: 'CEO',
    department_name: 'Management',
    employment_type: 'full_time',
    status: 'active',
    gender: 'male',
    start_date: '2024-01-15',
    is_active: true,
    created_at: '2024-01-15T00:00:00Z',
    updated_at: '2024-01-15T00:00:00Z',
    ...overrides,
  }
}

// Lazy import component after mocks
async function importComponent() {
  const mod = await import('./index')
  return mod
}

describe('MyProfilePage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders loading skeleton when data is loading', async () => {
    vi.mocked(useMyEmployee).mockReturnValue({
      data: undefined,
      isLoading: true,
      error: null,
    } as ReturnType<typeof useMyEmployee>)

    const mod = await importComponent()
    const Component = mod.Route.options.component as React.ComponentType
    render(<Component />)

    // Should have animated skeleton placeholders
    const skeletons = document.querySelectorAll('.animate-pulse')
    expect(skeletons.length).toBeGreaterThan(0)
  })

  it('renders error state when employee data fails to load', async () => {
    vi.mocked(useMyEmployee).mockReturnValue({
      data: undefined,
      isLoading: false,
      error: new Error('Network error'),
    } as ReturnType<typeof useMyEmployee>)

    const mod = await importComponent()
    const Component = mod.Route.options.component as React.ComponentType
    render(<Component />)

    expect(screen.getByText(/unable to load your profile/i)).toBeInTheDocument()
  })

  it('renders employee profile with full data', async () => {
    const employee = makeEmployee()
    vi.mocked(useMyEmployee).mockReturnValue({
      data: employee,
      isLoading: false,
      error: null,
    } as ReturnType<typeof useMyEmployee>)

    const mod = await importComponent()
    const Component = mod.Route.options.component as React.ComponentType
    render(<Component />)

    expect(screen.getByText('Ahmad Founder')).toBeInTheDocument()
    expect(screen.getByText('CEO')).toBeInTheDocument()
    expect(screen.getAllByText('Management').length).toBeGreaterThanOrEqual(1)
    expect(screen.getByText('ahmad@acme.com')).toBeInTheDocument()
    expect(screen.getByText('+971501234567')).toBeInTheDocument()
    expect(screen.getByText('Full Time')).toBeInTheDocument()
    expect(screen.getByText('Male')).toBeInTheDocument()
  })

  it('renders status badge', async () => {
    vi.mocked(useMyEmployee).mockReturnValue({
      data: makeEmployee({ status: 'probation' }),
      isLoading: false,
      error: null,
    } as ReturnType<typeof useMyEmployee>)

    const mod = await importComponent()
    const Component = mod.Route.options.component as React.ComponentType
    render(<Component />)

    expect(screen.getByText('probation')).toBeInTheDocument()
    expect(screen.getByTestId('status-square')).toBeInTheDocument()
  })

  it('shows read-only notice at bottom', async () => {
    vi.mocked(useMyEmployee).mockReturnValue({
      data: makeEmployee(),
      isLoading: false,
      error: null,
    } as ReturnType<typeof useMyEmployee>)

    const mod = await importComponent()
    const Component = mod.Route.options.component as React.ComponentType
    render(<Component />)

    expect(screen.getByText(/contact your HR administrator/i)).toBeInTheDocument()
  })

  it('hides optional fields when not present', async () => {
    vi.mocked(useMyEmployee).mockReturnValue({
      data: makeEmployee({ phone: undefined, job_title: undefined, department_name: undefined, gender: undefined }),
      isLoading: false,
      error: null,
    } as ReturnType<typeof useMyEmployee>)

    const mod = await importComponent()
    const Component = mod.Route.options.component as React.ComponentType
    render(<Component />)

    expect(screen.getByText('Ahmad Founder')).toBeInTheDocument()
    // Phone and job title should not appear
    expect(screen.queryByText('+971501234567')).toBeNull()
    expect(screen.queryByText('CEO')).toBeNull()
  })

  it('formats start date in human-readable format', async () => {
    vi.mocked(useMyEmployee).mockReturnValue({
      data: makeEmployee({ start_date: '2024-01-15' }),
      isLoading: false,
      error: null,
    } as ReturnType<typeof useMyEmployee>)

    const mod = await importComponent()
    const Component = mod.Route.options.component as React.ComponentType
    render(<Component />)

    expect(screen.getByText('15 January 2024')).toBeInTheDocument()
  })
})
