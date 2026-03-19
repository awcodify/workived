import React from 'react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import type { OrgDetail } from '@/types/api'

// ── Mock hooks before component import ────────────────────────────────────────

const mockUpdateMutate = vi.fn()
const mockTransferMutate = vi.fn()
const mockAcceptMutate = vi.fn()
const mockNavigate = vi.fn()

vi.mock('@tanstack/react-router', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@tanstack/react-router')>()
  return {
    ...actual,
    createFileRoute: () => (opts: Record<string, unknown>) => ({ options: opts }),
    useNavigate: () => mockNavigate,
  }
})

vi.mock('@tanstack/react-query', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@tanstack/react-query')>()
  return {
    ...actual,
    useMutation: vi.fn(() => ({ mutate: mockAcceptMutate, isPending: false, error: null })),
  }
})

vi.mock('@/lib/hooks/useOrganisation', () => ({
  useOrgDetail: vi.fn(),
  useUpdateOrg: vi.fn(),
  useTransferOwnership: vi.fn(),
}))

vi.mock('@/lib/hooks/useRole', () => ({
  useCanEditOrgSettings: vi.fn(() => true),
  useHasOrg: vi.fn(() => true),
}))

vi.mock('@/lib/hooks/useInvitations', () => ({
  useMyInvitations: vi.fn(() => ({ data: [] })),
}))

vi.mock('@/lib/stores/auth', () => ({
  useAuthStore: vi.fn((selector) =>
    selector({
      accessToken: 'fake-token',
      user: { id: 'user-1', full_name: 'Ahmad', email: 'ahmad@example.com' },
      setAuth: vi.fn(),
    }),
  ),
}))

vi.mock('@/components/workived/layout/WorkivedLogo', () => ({
  WorkivedLogo: () => <div data-testid="workived-logo" />,
}))

import { useOrgDetail, useUpdateOrg, useTransferOwnership } from '@/lib/hooks/useOrganisation'
import { useCanEditOrgSettings, useHasOrg } from '@/lib/hooks/useRole'

// ── Helpers ────────────────────────────────────────────────────────────────────

function makeOrg(overrides: Partial<OrgDetail> = {}): OrgDetail {
  return {
    id: 'org-1',
    name: 'Acme Corp',
    slug: 'acme-corp',
    country_code: 'ID',
    timezone: 'Asia/Jakarta',
    currency_code: 'IDR',
    work_days: [1, 2, 3, 4, 5],
    plan: 'free',
    plan_employee_limit: 25,
    is_active: true,
    created_at: '2024-01-01T00:00:00Z',
    employee_count: 0,
    owner_name: 'Ahmad',
    ...overrides,
  }
}

function makeDefaultMutations() {
  vi.mocked(useUpdateOrg).mockReturnValue({
    mutate: mockUpdateMutate,
    isPending: false,
    error: null,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any)
  vi.mocked(useTransferOwnership).mockReturnValue({
    mutate: mockTransferMutate,
    isPending: false,
    error: null,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any)
}

// Import actual component — mocks above apply at module resolution time
// We need a dynamic import to get the inner function; instead export and import directly.
// The component is the default export of the route's named export.
// Since the route only exports `Route`, we render the component directly.

// Workaround: We import Route and extract its component option.
// This must happen after all vi.mock() calls are established.
const { Route } = await import('./route')
const CompanyPage = Route.options.component as React.ComponentType

// ── Tests ──────────────────────────────────────────────────────────────────────

describe('CompanyPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    makeDefaultMutations()
  })

  it('renders loading skeletons when data is loading', () => {
    vi.mocked(useOrgDetail).mockReturnValue({
      data: undefined,
      isLoading: true,
      isError: false,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any)

    const { container } = render(<CompanyPage />)
    expect(container.querySelector('[aria-label="Loading company settings"]')).toBeTruthy()
  })

  it('renders error state when fetch fails', () => {
    vi.mocked(useOrgDetail).mockReturnValue({
      data: undefined,
      isLoading: false,
      isError: true,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any)

    render(<CompanyPage />)
    expect(screen.getByRole('alert')).toBeTruthy()
    expect(screen.getByText(/failed to load company settings/i)).toBeTruthy()
  })

  it('renders company name and slug when loaded', () => {
    vi.mocked(useOrgDetail).mockReturnValue({
      data: makeOrg(),
      isLoading: false,
      isError: false,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any)

    render(<CompanyPage />)
    expect(screen.getByDisplayValue('Acme Corp')).toBeTruthy()
    expect(screen.getByDisplayValue('acme-corp')).toBeTruthy()
  })

  it('shows editable location fields when employee_count is 0', () => {
    vi.mocked(useOrgDetail).mockReturnValue({
      data: makeOrg({ employee_count: 0 }),
      isLoading: false,
      isError: false,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any)

    render(<CompanyPage />)
    const countrySelect = screen.getByLabelText('Country')
    expect(countrySelect.tagName).toBe('SELECT')
  })

  it('shows locked location state when employee_count > 0', () => {
    vi.mocked(useOrgDetail).mockReturnValue({
      data: makeOrg({ employee_count: 5 }),
      isLoading: false,
      isError: false,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any)

    render(<CompanyPage />)
    expect(screen.getByText(/location settings are locked/i)).toBeTruthy()
    const countryElements = screen.queryAllByLabelText('Country')
    const selectElements = countryElements.filter((el) => el.tagName === 'SELECT')
    expect(selectElements).toHaveLength(0)
  })

  it('renders plan progress bar', () => {
    vi.mocked(useOrgDetail).mockReturnValue({
      data: makeOrg({ employee_count: 10, plan_employee_limit: 25 }),
      isLoading: false,
      isError: false,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any)

    render(<CompanyPage />)
    const progressBar = screen.getByRole('progressbar')
    expect(progressBar.getAttribute('aria-valuenow')).toBe('10')
    expect(progressBar.getAttribute('aria-valuemax')).toBe('25')
  })

  it('shows Upgrade to Pro CTA when usage >= 80%', () => {
    vi.mocked(useOrgDetail).mockReturnValue({
      data: makeOrg({ employee_count: 20, plan_employee_limit: 25 }),
      isLoading: false,
      isError: false,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any)

    render(<CompanyPage />)
    expect(screen.getByText('Upgrade to Pro')).toBeTruthy()
  })

  it('does not show Upgrade to Pro CTA below 80% usage', () => {
    vi.mocked(useOrgDetail).mockReturnValue({
      data: makeOrg({ employee_count: 5, plan_employee_limit: 25 }),
      isLoading: false,
      isError: false,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any)

    render(<CompanyPage />)
    expect(screen.queryByText('Upgrade to Pro')).toBeNull()
  })

  it('submits company info form with updated name', async () => {
    vi.mocked(useOrgDetail).mockReturnValue({
      data: makeOrg(),
      isLoading: false,
      isError: false,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any)

    render(<CompanyPage />)

    const nameInput = screen.getByDisplayValue('Acme Corp')
    fireEvent.change(nameInput, { target: { value: 'New Corp' } })

    const saveButtons = screen.getAllByRole('button', { name: /save changes/i })
    fireEvent.click(saveButtons[0]!)

    await waitFor(() => {
      expect(mockUpdateMutate).toHaveBeenCalledWith(
        expect.objectContaining({ name: 'New Corp' }),
        expect.any(Object),
      )
    })
  })

  it('shows confirmation modal before transfer ownership submission', async () => {
    vi.mocked(useOrgDetail).mockReturnValue({
      data: makeOrg(),
      isLoading: false,
      isError: false,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any)

    render(<CompanyPage />)

    const uuid = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890'
    const uuidInput = screen.getByLabelText(/new owner's user id/i)
    fireEvent.change(uuidInput, { target: { value: uuid } })

    const transferButton = screen.getByRole('button', { name: /transfer ownership/i })
    fireEvent.click(transferButton)

    await waitFor(() => {
      expect(screen.getByRole('dialog')).toBeTruthy()
      expect(screen.getByText(/confirm ownership transfer/i)).toBeTruthy()
    })

    expect(mockTransferMutate).not.toHaveBeenCalled()
  })

  it('calls transfer mutation only after confirming in the modal', async () => {
    vi.mocked(useOrgDetail).mockReturnValue({
      data: makeOrg(),
      isLoading: false,
      isError: false,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any)

    render(<CompanyPage />)

    const uuid = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890'
    const uuidInput = screen.getByLabelText(/new owner's user id/i)
    fireEvent.change(uuidInput, { target: { value: uuid } })

    fireEvent.click(screen.getByRole('button', { name: /transfer ownership/i }))
    await waitFor(() => screen.getByRole('dialog'))

    fireEvent.click(screen.getByRole('button', { name: /yes, transfer/i }))

    await waitFor(() => {
      expect(mockTransferMutate).toHaveBeenCalledWith(
        { new_owner_user_id: uuid },
        expect.any(Object),
      )
    })
  })

  it('shows read-only view and notice for non-admin role', () => {
    vi.mocked(useCanEditOrgSettings).mockReturnValueOnce(false)
    vi.mocked(useOrgDetail).mockReturnValue({
      data: makeOrg(),
      isLoading: false,
      isError: false,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any)

    render(<CompanyPage />)
    expect(screen.getByText(/view-only access/i)).toBeTruthy()
    expect(screen.queryByDisplayValue('Acme Corp')).toBeNull()
    expect(screen.getAllByText('Acme Corp').length).toBeGreaterThan(0)
  })

  it('dismisses confirmation modal on cancel', async () => {
    vi.mocked(useOrgDetail).mockReturnValue({
      data: makeOrg(),
      isLoading: false,
      isError: false,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any)

    render(<CompanyPage />)

    const uuid = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890'
    const uuidInput = screen.getByLabelText(/new owner's user id/i)
    fireEvent.change(uuidInput, { target: { value: uuid } })

    fireEvent.click(screen.getByRole('button', { name: /transfer ownership/i }))
    await waitFor(() => screen.getByRole('dialog'))

    fireEvent.click(screen.getByRole('button', { name: /cancel/i }))

    await waitFor(() => {
      expect(screen.queryByRole('dialog')).toBeNull()
    })

    expect(mockTransferMutate).not.toHaveBeenCalled()
  })
})
