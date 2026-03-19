import React from 'react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import type { Employee, UnlinkedMember } from '@/types/api'

// ── Mock hooks before component import ────────────────────────────────────────

const mockCreateMutate = vi.fn()
const mockUpdateMutate = vi.fn()

vi.mock('@/lib/hooks/useEmployees', () => ({
  useEmployee: vi.fn(),
  useCreateEmployee: vi.fn(),
  useUpdateEmployee: vi.fn(),
}))

vi.mock('@/lib/hooks/useInvitations', () => ({
  useUnlinkedMembers: vi.fn(),
  useInviteMember: vi.fn(() => ({ mutate: vi.fn(), isPending: false, error: null })),
}))

vi.mock('@/components/workived/layout/Avatar', () => ({
  Avatar: ({ name }: { name: string }) => <div data-testid="avatar">{name}</div>,
}))

vi.mock('@/components/workived/layout/StatusSquare', () => ({
  StatusSquare: ({ status }: { status: string }) => (
    <span data-testid="status">{status}</span>
  ),
}))

vi.mock('@tanstack/react-router', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@tanstack/react-router')>()
  return {
    ...actual,
    createFileRoute: () => (opts: Record<string, unknown>) => ({
      options: opts,
      useSearch: () => ({ user_id: undefined }),
    }),
    useNavigate: () => vi.fn(),
    Link: ({ children, to }: { children: React.ReactNode; to: string }) => (
      <a href={to}>{children}</a>
    ),
  }
})

import { useEmployee, useCreateEmployee, useUpdateEmployee } from '@/lib/hooks/useEmployees'
import { useUnlinkedMembers } from '@/lib/hooks/useInvitations'

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeEmployee(overrides: Partial<Employee> = {}): Employee {
  return {
    id: 'emp-1',
    organisation_id: 'org-1',
    full_name: 'Ahmad Rashid',
    email: 'ahmad@example.com',
    employment_type: 'full_time',
    status: 'active',
    start_date: '2024-01-01',
    is_active: true,
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z',
    ...overrides,
  }
}

function makeUnlinkedMember(overrides: Partial<UnlinkedMember> = {}): UnlinkedMember {
  return {
    user_id: 'user-1',
    full_name: 'Budi Santoso',
    email: 'budi@example.com',
    role: 'member',
    ...overrides,
  }
}

function setupDefaultMocks() {
  vi.mocked(useCreateEmployee).mockReturnValue({
    mutate: mockCreateMutate,
    isPending: false,
    isError: false,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any)

  vi.mocked(useUpdateEmployee).mockReturnValue({
    mutate: mockUpdateMutate,
    isPending: false,
    isError: false,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any)

  vi.mocked(useUnlinkedMembers).mockReturnValue({
    data: [],
    isLoading: false,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any)
}

const { Route } = await import('./route')
const EmployeeDetailPage = Route.options.component as React.ComponentType

// ── Helpers to control params ─────────────────────────────────────────────────
// TanStack Router's useParams is called inside the component. We mock it via
// the module mock above so Route.useParams returns what we need.
// Since we mocked createFileRoute, Route.useParams doesn't exist.
// We test sub-components directly by rendering and checking for markers.
// The component reads `id` from Route.useParams — which we can't easily stub
// without a router provider. Instead we test each sub-page component by
// importing them from the module (they are not exported). We therefore test
// the overall page via integration: render with a minimal router context.

// ── Tests: new employee (id === 'new') ────────────────────────────────────────

describe('NewEmployeePage (email mode UI)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    setupDefaultMocks()
  })

  // We need Route.useParams to return { id: 'new' } — patch it on the Route object.
  function renderNewPage() {
    // Patch useParams on Route before render
    const original = Route.useParams
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ;(Route as any).useParams = () => ({ id: 'new' })
    const result = render(<EmployeeDetailPage />)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ;(Route as any).useParams = original
    return result
  }

  it('renders Add Employee heading', () => {
    renderNewPage()
    expect(screen.getAllByText('Add Employee').length).toBeGreaterThan(0)
  })

  it('shows three email mode options', () => {
    renderNewPage()
    expect(screen.getByText('Link existing member')).toBeTruthy()
    expect(screen.getByText('Invite new person')).toBeTruthy()
    expect(screen.getByText('HR record only')).toBeTruthy()
  })

  it('shows loading text when unlinked members are loading', () => {
    vi.mocked(useUnlinkedMembers).mockReturnValue({
      data: undefined,
      isLoading: true,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any)

    renderNewPage()

    // Select the "member" radio
    const radios = screen.getAllByRole('radio')
    const memberRadio = radios.find(
      (r) => (r as HTMLInputElement).value === 'member',
    )
    if (memberRadio) fireEvent.click(memberRadio)

    expect(screen.getByText(/loading workspace members/i)).toBeTruthy()
  })

  it('shows empty message when no unlinked members exist', () => {
    vi.mocked(useUnlinkedMembers).mockReturnValue({
      data: [],
      isLoading: false,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any)

    renderNewPage()

    const radios = screen.getAllByRole('radio')
    const memberRadio = radios.find(
      (r) => (r as HTMLInputElement).value === 'member',
    )
    if (memberRadio) fireEvent.click(memberRadio)

    expect(screen.getByText(/all workspace members already have an hr record/i)).toBeTruthy()
  })

  it('shows member dropdown when unlinked members exist', () => {
    vi.mocked(useUnlinkedMembers).mockReturnValue({
      data: [makeUnlinkedMember()],
      isLoading: false,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any)

    renderNewPage()

    const radios = screen.getAllByRole('radio')
    const memberRadio = radios.find(
      (r) => (r as HTMLInputElement).value === 'member',
    )
    if (memberRadio) fireEvent.click(memberRadio)

    expect(screen.getByText(/budi santoso/i)).toBeTruthy()
  })

  it('shows email input when "Invite by email" is selected', () => {
    renderNewPage()

    const radios = screen.getAllByRole('radio')
    const emailRadio = radios.find((r) => (r as HTMLInputElement).value === 'new')
    if (emailRadio) fireEvent.click(emailRadio)

    const emailInput = screen.getByPlaceholderText('name@company.com')
    expect(emailInput).toBeTruthy()
  })

  it('hides email input when "No login access yet" is selected (default)', () => {
    renderNewPage()
    expect(screen.queryByPlaceholderText('name@company.com')).toBeNull()
  })

  it('has a submit button', () => {
    renderNewPage()
    expect(screen.getByRole('button', { name: /add employee/i })).toBeTruthy()
  })

  it('shows pending state on submit button while saving', () => {
    vi.mocked(useCreateEmployee).mockReturnValue({
      mutate: mockCreateMutate,
      isPending: true,
      isError: false,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any)

    renderNewPage()
    expect(screen.getByRole('button', { name: /adding/i })).toBeTruthy()
  })
})

// ── Tests: edit employee ───────────────────────────────────────────────────────

describe('EditEmployeePage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    setupDefaultMocks()
  })

  function renderEditPage(emp?: Employee) {
    const original = Route.useParams
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ;(Route as any).useParams = () => ({ id: 'emp-1' })

    vi.mocked(useEmployee).mockReturnValue({
      data: emp ?? makeEmployee(),
      isLoading: false,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any)

    const result = render(<EmployeeDetailPage />)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ;(Route as any).useParams = original
    return result
  }

  it('shows loading state when employee is loading', () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ;(Route as any).useParams = () => ({ id: 'emp-1' })
    vi.mocked(useEmployee).mockReturnValue({
      data: undefined,
      isLoading: true,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any)

    render(<EmployeeDetailPage />)
    expect(screen.getByText(/loading/i)).toBeTruthy()
  })

  it('renders employee name in avatar and heading', () => {
    renderEditPage()
    expect(screen.getByTestId('avatar')).toBeTruthy()
    expect(screen.getAllByText('Ahmad Rashid').length).toBeGreaterThan(0)
  })

  it('renders employee email as plain text (not editable)', () => {
    renderEditPage()
    expect(screen.getByText('ahmad@example.com')).toBeTruthy()
    expect(screen.queryByDisplayValue('ahmad@example.com')).toBeNull()
  })

  it('renders status badge', () => {
    renderEditPage()
    expect(screen.getByTestId('status')).toBeTruthy()
  })

  it('has a save changes button', () => {
    renderEditPage()
    expect(screen.getByRole('button', { name: /save changes/i })).toBeTruthy()
  })

  it('does not show login access section for existing employees', () => {
    renderEditPage()
    expect(screen.queryByText('Login access')).toBeNull()
  })

  it('shows error message when update fails', () => {
    vi.mocked(useUpdateEmployee).mockReturnValue({
      mutate: mockUpdateMutate,
      isPending: false,
      isError: true,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any)

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ;(Route as any).useParams = () => ({ id: 'emp-1' })
    vi.mocked(useEmployee).mockReturnValue({
      data: makeEmployee(),
      isLoading: false,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any)

    render(<EmployeeDetailPage />)
    expect(screen.getByText(/something went wrong/i)).toBeTruthy()
  })

  it('calls updateMutation on form submit', async () => {
    renderEditPage()

    const nameInput = screen.getByDisplayValue('Ahmad Rashid')
    fireEvent.change(nameInput, { target: { value: 'Ahmad Updated' } })

    fireEvent.click(screen.getByRole('button', { name: /save changes/i }))

    await waitFor(() => {
      expect(mockUpdateMutate).toHaveBeenCalledWith(
        expect.objectContaining({ full_name: 'Ahmad Updated' }),
        expect.any(Object),
      )
    })
  })
})
