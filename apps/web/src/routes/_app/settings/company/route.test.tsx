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

const mockScorecardUpdateMutate = vi.fn()

vi.mock('@/lib/hooks/useReports', () => ({
  useScorecardConfig: vi.fn(),
  useUpdateScorecardConfig: vi.fn(),
}))

import { useOrgDetail, useUpdateOrg, useTransferOwnership } from '@/lib/hooks/useOrganisation'
import { useCanEditOrgSettings, useHasOrg } from '@/lib/hooks/useRole'
import { useScorecardConfig, useUpdateScorecardConfig } from '@/lib/hooks/useReports'

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
    allow_web_clock_in: false,
    is_active: true,
    created_at: '2024-01-01T00:00:00Z',
    employee_count: 0,
    owner_name: 'Ahmad',
    ...overrides,
  }
}

function makeScorecardConfig() {
  return {
    attendance_weight: 30,
    punctuality_weight: 20,
    leave_weight: 15,
    tasks_weight: 35,
    grade_a_min: 90,
    grade_b_min: 75,
    grade_c_min: 60,
    late_flag_threshold: 3,
    leave_warning_pct: 90,
    task_concern_pct: 60,
    score_drop_threshold: 10,
    min_working_days: 5,
  }
}

function makeDefaultScorecardMocks() {
  vi.mocked(useScorecardConfig).mockReturnValue({
    data: makeScorecardConfig(),
    isLoading: false,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any)
  vi.mocked(useUpdateScorecardConfig).mockReturnValue({
    mutate: mockScorecardUpdateMutate,
    isPending: false,
    isError: false,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any)
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
    makeDefaultScorecardMocks()
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
    expect(screen.getByText('Upgrade')).toBeTruthy()
  })

  it('does not show Upgrade to Pro CTA below 80% usage', () => {
    vi.mocked(useOrgDetail).mockReturnValue({
      data: makeOrg({ employee_count: 5, plan_employee_limit: 25 }),
      isLoading: false,
      isError: false,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any)

    render(<CompanyPage />)
    expect(screen.queryByText('Upgrade')).toBeNull()
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
    const uuidInput = screen.getByLabelText(/transfer ownership/i)
    fireEvent.change(uuidInput, { target: { value: uuid } })

    const transferButton = screen.getByRole('button', { name: /transfer ownership/i })
    fireEvent.click(transferButton)

    await waitFor(() => {
      expect(screen.getByRole('dialog')).toBeTruthy()
      expect(screen.getByText(/confirm transfer/i)).toBeTruthy()
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
    const uuidInput = screen.getByLabelText(/transfer ownership/i)
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
    const uuidInput = screen.getByLabelText(/transfer ownership/i)
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

// ── Scorecard config tests ─────────────────────────────────────────────────────

describe('ScorecardConfigSection', () => {
  function setup() {
    vi.mocked(useOrgDetail).mockReturnValue({
      data: {
        id: 'org-1', name: 'Acme', slug: 'acme', country_code: 'ID',
        timezone: 'Asia/Jakarta', currency_code: 'IDR', work_days: [1,2,3,4,5],
        plan: 'free', plan_employee_limit: 25, allow_web_clock_in: false,
        is_active: true, created_at: '2024-01-01T00:00:00Z',
        employee_count: 3, owner_name: 'Ahmad',
      },
      isLoading: false,
      isError: false,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any)
    vi.mocked(useUpdateOrg).mockReturnValue({ mutate: mockUpdateMutate, isPending: false, error: null } as any)  // eslint-disable-line @typescript-eslint/no-explicit-any
    vi.mocked(useTransferOwnership).mockReturnValue({ mutate: mockTransferMutate, isPending: false, error: null } as any)  // eslint-disable-line @typescript-eslint/no-explicit-any
  }

  beforeEach(() => {
    vi.clearAllMocks()
    setup()
    makeDefaultScorecardMocks()
  })

  it('renders weight sliders with values from config', () => {
    render(<CompanyPage />)
    const attendanceSlider = screen.getByRole('slider', { name: /attendance/i })
    expect(attendanceSlider).toHaveValue('30')
  })

  it('shows weight total badge', () => {
    render(<CompanyPage />)
    expect(screen.getByLabelText(/weight total: 100 of 100/i)).toBeTruthy()
  })

  it('save button disabled when weights do not sum to 100', () => {
    vi.mocked(useScorecardConfig).mockReturnValue({
      data: { ...makeScorecardConfig(), attendance_weight: 10 },
      isLoading: false,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any)

    render(<CompanyPage />)
    const saveBtn = screen.getByRole('button', { name: /save scorecard config/i })
    expect(saveBtn).toBeDisabled()
  })

  it('shows invalid grade message when A <= B', () => {
    vi.mocked(useScorecardConfig).mockReturnValue({
      data: { ...makeScorecardConfig(), grade_a_min: 70, grade_b_min: 80 },
      isLoading: false,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any)

    render(<CompanyPage />)
    expect(screen.getByText(/thresholds must satisfy/i)).toBeTruthy()
  })

  it('calls mutate with correct payload on save', async () => {
    render(<CompanyPage />)
    fireEvent.click(screen.getByRole('button', { name: /save scorecard config/i }))

    await waitFor(() => {
      expect(mockScorecardUpdateMutate).toHaveBeenCalledWith(
        expect.objectContaining({
          attendance_weight: 30,
          punctuality_weight: 20,
          leave_weight: 15,
          tasks_weight: 35,
          grade_a_min: 90,
          grade_b_min: 75,
          grade_c_min: 60,
        }),
        expect.any(Object),
      )
    })
  })

  it('reset to defaults restores default weight values', async () => {
    vi.mocked(useScorecardConfig).mockReturnValue({
      data: { ...makeScorecardConfig(), attendance_weight: 50, tasks_weight: 15 },
      isLoading: false,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any)

    render(<CompanyPage />)
    fireEvent.click(screen.getByRole('button', { name: /reset to defaults/i }))

    await waitFor(() => {
      const slider = screen.getByRole('slider', { name: /attendance/i })
      expect(slider).toHaveValue('30')
    })
  })

  it('shows error banner when save fails', () => {
    vi.mocked(useUpdateScorecardConfig).mockReturnValue({
      mutate: mockScorecardUpdateMutate,
      isPending: false,
      isError: true,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any)

    render(<CompanyPage />)
    expect(screen.getByText(/failed to save scorecard config/i)).toBeTruthy()
  })

  it('shows loading skeleton when config is loading', () => {
    vi.mocked(useScorecardConfig).mockReturnValue({
      data: undefined,
      isLoading: true,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any)

    render(<CompanyPage />)
    expect(screen.queryByRole('slider')).toBeNull()
  })
})
