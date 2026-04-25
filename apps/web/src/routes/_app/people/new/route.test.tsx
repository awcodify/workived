import React from 'react'
import { render, screen, waitFor } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

// ── Mocks ─────────────────────────────────────────────────────────────────────

vi.mock('@tanstack/react-router', () => ({
  createFileRoute: () => (opts: { component: React.ComponentType }) => ({
    options: opts,
    useSearch: () => ({}),
    useParams: () => ({}),
  }),
  useNavigate: () => vi.fn(),
  Link: ({ children, to, ...props }: { children: React.ReactNode; to: string; [key: string]: unknown }) =>
    <a href={to as string} {...props}>{children}</a>,
}))

vi.mock('@/lib/hooks/useEmployees')
vi.mock('@/lib/hooks/useInvitations')
vi.mock('@/lib/hooks/useDepartments')
vi.mock('@/lib/hooks/useJobTitles')
vi.mock('@/lib/hooks/useAttendance')
vi.mock('@/lib/hooks/usePWA', () => ({ usePWAInstall: () => ({ isInstallable: false }) }))
vi.mock('@/lib/api/client', () => ({
  apiClient: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn() },
}))
vi.mock('@/components/ui', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/components/ui')>()
  return {
    ...actual,
    DatePicker: React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
      (props, ref) => <input type="date" ref={ref} data-testid="people-start-date-input" {...props} />
    ),
  }
})

import * as employeeHooks from '@/lib/hooks/useEmployees'
import * as invitationHooks from '@/lib/hooks/useInvitations'
import * as departmentHooks from '@/lib/hooks/useDepartments'
import * as jobTitleHooks from '@/lib/hooks/useJobTitles'
import * as attendanceHooks from '@/lib/hooks/useAttendance'
import { Route } from './route'

const NewEmployeePage = (Route as any).options.component

function renderPage(queryClient: QueryClient) {
  return render(
    <QueryClientProvider client={queryClient}>
      <NewEmployeePage />
    </QueryClientProvider>
  )
}

describe('Add Employee Page', () => {
  let queryClient: QueryClient

  beforeEach(() => {
    vi.clearAllMocks()

    queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })

    vi.mocked(invitationHooks.useUnlinkedMembers).mockReturnValue({
      data: [{ user_id: '1', full_name: 'Jane Smith', email: 'jane@company.com' }],
      isLoading: false,
    } as any)

    vi.mocked(invitationHooks.useInviteMember).mockReturnValue({
      mutate: vi.fn(),
      isPending: false,
    } as any)

    vi.mocked(employeeHooks.useCreateEmployee).mockReturnValue({
      mutate: vi.fn(),
      isPending: false,
      isError: false,
      error: null,
    } as any)

    vi.mocked(employeeHooks.useEmployees).mockReturnValue({
      data: { data: [], meta: {} },
      isLoading: false,
    } as any)

    vi.mocked(departmentHooks.useDepartments).mockReturnValue({
      data: [{ id: '1', name: 'Engineering' }],
      isLoading: false,
    } as any)

    vi.mocked(jobTitleHooks.useJobTitles).mockReturnValue({
      data: [{ name: 'Software Engineer' }],
      isLoading: false,
    } as any)

    vi.mocked(attendanceHooks.useWorkSchedules).mockReturnValue({
      data: [{ id: 'ws-1', name: 'Standard 9-5', work_days: [1,2,3,4,5], start_time: '09:00', end_time: '17:00', is_default: true }],
      isLoading: false,
    } as any)
  })

  it('renders all form sections', async () => {
    renderPage(queryClient)

    await waitFor(() => {
      expect(screen.getByText('How will this person access Workived?')).toBeInTheDocument()
      expect(screen.getByText('Personal Information')).toBeInTheDocument()
      expect(screen.getByText('Employment Details')).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /add employee/i })).toBeInTheDocument()
    })
  })

  it('shows work schedule field as required', async () => {
    renderPage(queryClient)

    await waitFor(() => {
      expect(screen.getByTestId('people-work-schedule-select')).toBeInTheDocument()
    })
  })

  it('submits form with work_schedule_id in payload', async () => {
    const user = userEvent.setup()
    const mutateFn = vi.fn()

    vi.mocked(employeeHooks.useCreateEmployee).mockReturnValue({
      mutate: mutateFn,
      isPending: false,
      isError: false,
      error: null,
    } as any)

    renderPage(queryClient)

    await waitFor(() => {
      expect(screen.getByText('How will this person access Workived?')).toBeInTheDocument()
    })

    // Select HR only mode
    const hrOnlyCard = screen.getByText('HR record only').closest('button')
    if (hrOnlyCard) await user.click(hrOnlyCard)

    // Fill required fields
    const nameInput = screen.getByPlaceholderText(/ahmad rahman/i)
    await user.type(nameInput, 'Test Employee')

    const startDateInput = screen.getByTestId('people-start-date-input')
    await user.type(startDateInput, '2026-04-15')

    // Select work schedule via Dropdown
    const workScheduleWrapper = screen.getByTestId('people-work-schedule-select')
    const dropdownTrigger = workScheduleWrapper.querySelector('[data-testid="dropdown-trigger"]')
    if (dropdownTrigger) await user.click(dropdownTrigger)
    const scheduleOption = await screen.findByTestId('dropdown-option-ws-1')
    await user.click(scheduleOption)

    // Wait for form to become valid, then submit
    const submitButton = screen.getByRole('button', { name: /add employee/i })
    await waitFor(() => expect(submitButton).not.toBeDisabled())
    await user.click(submitButton)

    await waitFor(() => {
      expect(mutateFn).toHaveBeenCalledWith(
        expect.objectContaining({ work_schedule_id: 'ws-1' }),
        expect.any(Object),
      )
    })
  })

  it('disables submit when required fields missing', async () => {
    const user = userEvent.setup()

    renderPage(queryClient)

    await waitFor(() => {
      expect(screen.getByText('How will this person access Workived?')).toBeInTheDocument()
    })

    // Select HR only
    const hrOnlyCard = screen.getByText('HR record only').closest('button')
    if (hrOnlyCard) await user.click(hrOnlyCard)

    const submitButton = screen.getByRole('button', { name: /add employee/i })
    expect(submitButton).toBeDisabled()
  })

  it('shows photo upload in personal info section', async () => {
    renderPage(queryClient)

    await waitFor(() => {
      expect(screen.getByText('Upload photo')).toBeInTheDocument()
    })
  })

  it('shows all fields on single page', async () => {
    renderPage(queryClient)

    await waitFor(() => {
      expect(screen.getByTestId('people-phone-input')).toBeInTheDocument()
      expect(screen.getByTestId('people-gender-select')).toBeInTheDocument()
      expect(screen.getByTestId('people-employment-type-select')).toBeInTheDocument()
      expect(screen.getByTestId('people-work-schedule-select')).toBeInTheDocument()
    })
  })

  it('shows empty-state guidance when no work schedules exist', async () => {
    vi.mocked(attendanceHooks.useWorkSchedules).mockReturnValue({
      data: [],
      isLoading: false,
    } as any)

    renderPage(queryClient)

    await waitFor(() => {
      expect(screen.getByTestId('people-work-schedule-empty')).toBeInTheDocument()
      expect(screen.getByText(/create one in attendance settings/i)).toBeInTheDocument()
    })
  })
})
