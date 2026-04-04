import { render, screen, waitFor } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { RouterProvider, createRouter, createMemoryHistory } from '@tanstack/react-router'
import { routeTree } from '@/routeTree.gen'
import * as employeeHooks from '@/lib/hooks/useEmployees'
import * as invitationHooks from '@/lib/hooks/useInvitations'
import * as departmentHooks from '@/lib/hooks/useDepartments'
import * as jobTitleHooks from '@/lib/hooks/useJobTitles'

// Mock all the hooks
vi.mock('@/lib/hooks/useEmployees')
vi.mock('@/lib/hooks/useInvitations')
vi.mock('@/lib/hooks/useDepartments')
vi.mock('@/lib/hooks/useJobTitles')

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: false } },
})

describe('Add Employee Page', () => {
  beforeEach(() => {
    vi.clearAllMocks()

    // Set up default mocks
    vi.mocked(invitationHooks.useUnlinkedMembers).mockReturnValue({
      data: [
        { user_id: '1', full_name: 'Jane Smith', email: 'jane@company.com' },
      ],
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
  })

  it('renders all form sections on single page', async () => {
    const memoryHistory = createMemoryHistory({
      initialEntries: ['/people/new'],
    })

    const router = createRouter({
      routeTree,
      history: memoryHistory,
      context: { queryClient },
    })

    render(
      <QueryClientProvider client={queryClient}>
        <RouterProvider router={router} />
      </QueryClientProvider>
    )

    await waitFor(() => {
      // Access mode section
      expect(screen.getByText('How will this person access Workived?')).toBeInTheDocument()
      
      // Personal info section
      expect(screen.getByText('Personal Information')).toBeInTheDocument()
      
      // Employment details section
      expect(screen.getByText('Employment Details')).toBeInTheDocument()
      
      // Submit button
      expect(screen.getByText('Add Employee')).toBeInTheDocument()
    })
  })

  it('submits form with minimal required fields', async () => {
    const user = userEvent.setup()
    const mutateFn = vi.fn()
    
    vi.mocked(employeeHooks.useCreateEmployee).mockReturnValue({
      mutate: mutateFn,
      isPending: false,
      isError: false,
      error: null,
    } as any)

    const memoryHistory = createMemoryHistory({
      initialEntries: ['/people/new'],
    })

    const router = createRouter({
      routeTree,
      history: memoryHistory,
      context: { queryClient },
    })

    render(
      <QueryClientProvider client={queryClient}>
        <RouterProvider router={router} />
      </QueryClientProvider>
    )

    await waitFor(() => {
      expect(screen.getByText('How will this person access Workived?')).toBeInTheDocument()
    })

    // Select HR only mode
    const hrOnlyCard = screen.getByText('HR record only').closest('button')
    if (hrOnlyCard) await user.click(hrOnlyCard)

    // Fill required fields
    const nameInput = screen.getByPlaceholderText(/ahmad rahman/i)
    await user.type(nameInput, 'Test Employee')

    const startDateInput = screen.getByLabelText(/start date/i)
    await user.type(startDateInput, '2026-04-15')

    // Submit
    const submitButton = screen.getByRole('button', { name: /add employee/i })
    await user.click(submitButton)

    // Should call create mutation
    await waitFor(() => {
      expect(mutateFn).toHaveBeenCalled()
    })
  })

  it('validates required fields', async () => {
    const user = userEvent.setup()
    const memoryHistory = createMemoryHistory({
      initialEntries: ['/people/new'],
    })

    const router = createRouter({
      routeTree,
      history: memoryHistory,
      context: { queryClient },
    })

    render(
      <QueryClientProvider client={queryClient}>
        <RouterProvider router={router} />
      </QueryClientProvider>
    )

    await waitFor(() => {
      expect(screen.getByText('How will this person access Workived?')).toBeInTheDocument()
    })

    // Select HR only
    const hrOnlyCard = screen.getByText('HR record only').closest('button')
    if (hrOnlyCard) await user.click(hrOnlyCard)

    // Try to submit without filling required fields
    const submitButton = screen.getByRole('button', { name: /add employee/i })
    
    // Button should be disabled when form is invalid
    expect(submitButton).toBeDisabled()
  })

  it('shows photo upload in personal info section', async () => {
    const memoryHistory = createMemoryHistory({
      initialEntries: ['/people/new'],
    })

    const router = createRouter({
      routeTree,
      history: memoryHistory,
      context: { queryClient },
    })

    render(
      <QueryClientProvider client={queryClient}>
        <RouterProvider router={router} />
      </QueryClientProvider>
    )

    await waitFor(() => {
      expect(screen.getByText('Upload photo')).toBeInTheDocument()
    })
  })

  it('shows all optional fields without needing to navigate', async () => {
    const memoryHistory = createMemoryHistory({
      initialEntries: ['/people/new'],
    })

    const router = createRouter({
      routeTree,
      history: memoryHistory,
      context: { queryClient },
    })

    render(
      <QueryClientProvider client={queryClient}>
        <RouterProvider router={router} />
      </QueryClientProvider>
    )

    await waitFor(() => {
      // All fields should be visible on the same page
      expect(screen.getByText(/phone/i)).toBeInTheDocument()
      expect(screen.getByText(/gender/i)).toBeInTheDocument()
      expect(screen.getByText(/job title/i)).toBeInTheDocument()
      expect(screen.getByText(/department/i)).toBeInTheDocument()
      expect(screen.getByText(/reports to/i)).toBeInTheDocument()
    })
  })
})
