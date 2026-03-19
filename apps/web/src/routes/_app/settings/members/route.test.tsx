import React from 'react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import type { MemberWithProfile, PendingInvitation } from '@/types/api'

// ── Mock fns (declared before vi.mock) ──────────────────────────────────────

const mockInviteMutate = vi.fn()
const mockRevokeMutate = vi.fn()
const mockRefetchInvitations = vi.fn()

vi.mock('@/lib/hooks/useOrganisation', () => ({
  useOrganisation: vi.fn(),
}))

vi.mock('@/lib/hooks/useInvitations', () => ({
  useInvitations: vi.fn(),
  useInviteMember: vi.fn(),
  useRevokeInvitation: vi.fn(),
  useMembers: vi.fn(),
}))

vi.mock('@/lib/hooks/useRole', () => ({
  useCanInvite: vi.fn(),
}))

vi.mock('@/components/workived/layout/WorkivedLogo', () => ({
  WorkivedLogo: () => <div data-testid="workived-logo" />,
}))

vi.mock('@tanstack/react-router', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@tanstack/react-router')>()
  return {
    ...actual,
    createFileRoute: () => (opts: Record<string, unknown>) => ({
      options: opts,
    }),
    useNavigate: () => vi.fn(),
    redirect: vi.fn(),
    Link: ({ children, to }: { children: React.ReactNode; to: string }) => (
      <a href={to}>{children}</a>
    ),
  }
})

// ── Import AFTER mocks ──────────────────────────────────────────────────────

import { useOrganisation } from '@/lib/hooks/useOrganisation'
import { useInvitations, useInviteMember, useRevokeInvitation, useMembers } from '@/lib/hooks/useInvitations'
import { useCanInvite } from '@/lib/hooks/useRole'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

const { Route } = await import('./route')
const MembersPage = Route.options.component as React.ComponentType

// ── Helpers ─────────────────────────────────────────────────────────────────

function makeMember(overrides: Partial<MemberWithProfile> = {}): MemberWithProfile {
  return {
    id: 'mem-1',
    user_id: 'user-1',
    organisation_id: 'org-1',
    role: 'admin',
    joined_at: '2024-01-01T00:00:00Z',
    full_name: 'Ahmad Rashid',
    email: 'ahmad@example.com',
    has_hr_profile: true,
    hr_profile_active: true,
    ...overrides,
  }
}

function makeInvitation(overrides: Partial<PendingInvitation> = {}): PendingInvitation {
  return {
    id: 'inv-1',
    organisation_id: 'org-1',
    email: 'newuser@example.com',
    role: 'member',
    invited_by: 'user-1',
    invite_url: 'https://app.workived.com/invite?token=abc',
    expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
    created_at: '2024-01-01T00:00:00Z',
    ...overrides,
  }
}

function setupDefaultMocks() {
  vi.mocked(useOrganisation).mockReturnValue({
    data: { id: 'org-1', name: 'Workived', slug: 'workived', plan: 'free', timezone: 'Asia/Jakarta' },
    isLoading: false,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any)

  vi.mocked(useInvitations).mockReturnValue({
    data: [],
    isLoading: false,
    refetch: mockRefetchInvitations,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any)

  vi.mocked(useInviteMember).mockReturnValue({
    mutate: mockInviteMutate,
    isPending: false,
    error: null,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any)

  vi.mocked(useRevokeInvitation).mockReturnValue({
    mutate: mockRevokeMutate,
    isPending: false,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any)

  vi.mocked(useMembers).mockReturnValue({
    data: [],
    isLoading: false,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any)

  vi.mocked(useCanInvite).mockReturnValue(true)
}

function renderPage() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })
  return render(
    <QueryClientProvider client={qc}>
      <MembersPage />
    </QueryClientProvider>,
  )
}

// ── Tests ───────────────────────────────────────────────────────────────────

describe('MembersPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    setupDefaultMocks()
  })

  it('renders the page heading', () => {
    renderPage()
    expect(screen.getByText('Workspace Members')).toBeInTheDocument()
  })

  it('shows invite form with email input and role dropdown', () => {
    renderPage()
    expect(screen.getByPlaceholderText('colleague@company.com')).toBeInTheDocument()
    expect(screen.getByRole('combobox')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /send invite/i })).toBeInTheDocument()
  })

  it('hides invite form when user cannot invite', () => {
    vi.mocked(useCanInvite).mockReturnValue(false)
    renderPage()
    expect(screen.queryByPlaceholderText('colleague@company.com')).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /send invite/i })).not.toBeInTheDocument()
  })

  it('shows role options in dropdown', () => {
    renderPage()
    const select = screen.getByRole('combobox')
    const options = select.querySelectorAll('option')
    const labels = Array.from(options).map((o) => o.textContent)
    expect(labels).toContain('Admin')
    expect(labels).toContain('Member')
  })

  it('shows pending invitations list when data exists', () => {
    const inv = makeInvitation({ email: 'pending@example.com' })
    vi.mocked(useInvitations).mockReturnValue({
      data: [inv],
      isLoading: false,
      refetch: mockRefetchInvitations,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any)

    renderPage()
    expect(screen.getByText('pending@example.com')).toBeInTheDocument()
    expect(screen.getByText('Pending invitations')).toBeInTheDocument()
  })

  it('shows empty state when no pending invitations', () => {
    vi.mocked(useInvitations).mockReturnValue({
      data: [],
      isLoading: false,
      refetch: mockRefetchInvitations,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any)

    renderPage()
    expect(screen.getByText('No pending invitations. Invite someone above to get started.')).toBeInTheDocument()
  })

  it('shows members list when data exists', () => {
    const member = makeMember({ full_name: 'Budi Santoso', email: 'budi@example.com' })
    vi.mocked(useMembers).mockReturnValue({
      data: [member],
      isLoading: false,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any)

    renderPage()
    expect(screen.getByText('Budi Santoso')).toBeInTheDocument()
    expect(screen.getByText('budi@example.com')).toBeInTheDocument()
  })

  it('calls inviteMember mutation on form submit', async () => {
    renderPage()

    fireEvent.change(screen.getByPlaceholderText('colleague@company.com'), {
      target: { value: 'new@example.com' },
    })

    fireEvent.click(screen.getByRole('button', { name: /send invite/i }))

    await waitFor(() => {
      expect(mockInviteMutate).toHaveBeenCalledWith(
        { email: 'new@example.com', role: 'member' },
        expect.any(Object),
      )
    })
  })

  it('shows "Expired" badge for expired invitations', () => {
    const expired = makeInvitation({
      id: 'inv-expired',
      email: 'expired@example.com',
      expires_at: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
    })

    vi.mocked(useInvitations).mockReturnValue({
      data: [expired],
      isLoading: false,
      refetch: mockRefetchInvitations,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any)

    renderPage()
    expect(screen.getByText('Expired')).toBeInTheDocument()
  })

  it('revoke button calls revoke mutation', () => {
    const inv = makeInvitation({ id: 'inv-to-revoke' })
    vi.mocked(useInvitations).mockReturnValue({
      data: [inv],
      isLoading: false,
      refetch: mockRefetchInvitations,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any)

    renderPage()
    fireEvent.click(screen.getByRole('button', { name: /revoke/i }))
    expect(mockRevokeMutate).toHaveBeenCalledWith('inv-to-revoke')
  })

  it('shows loading state for invitations', () => {
    vi.mocked(useInvitations).mockReturnValue({
      data: undefined,
      isLoading: true,
      refetch: mockRefetchInvitations,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any)

    renderPage()
    // Loading skeleton divs with animate-pulse class
    const skeletons = document.querySelectorAll('.animate-pulse')
    expect(skeletons.length).toBeGreaterThan(0)
  })

  it('shows loading state for members', () => {
    vi.mocked(useMembers).mockReturnValue({
      data: [],
      isLoading: true,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any)

    renderPage()
    const skeletons = document.querySelectorAll('.animate-pulse')
    expect(skeletons.length).toBeGreaterThan(0)
  })

  it('shows "Sending..." text when invite is pending', () => {
    vi.mocked(useInviteMember).mockReturnValue({
      mutate: mockInviteMutate,
      isPending: true,
      error: null,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any)

    renderPage()
    expect(screen.getByRole('button', { name: /sending/i })).toBeInTheDocument()
  })

  it('shows member role badge', () => {
    const member = makeMember({ role: 'admin' })
    vi.mocked(useMembers).mockReturnValue({
      data: [member],
      isLoading: false,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any)

    renderPage()
    expect(screen.getByText('admin')).toBeInTheDocument()
  })

  it('shows "No HR profile" link for members without HR profile', () => {
    const member = makeMember({ has_hr_profile: false, hr_profile_active: false })
    vi.mocked(useMembers).mockReturnValue({
      data: [member],
      isLoading: false,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any)

    renderPage()
    expect(screen.getByText('No HR profile')).toBeInTheDocument()
  })

  it('shows "Linked" for members with active HR profile', () => {
    const member = makeMember({ has_hr_profile: true, hr_profile_active: true })
    vi.mocked(useMembers).mockReturnValue({
      data: [member],
      isLoading: false,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any)

    renderPage()
    expect(screen.getByText('Linked')).toBeInTheDocument()
  })
})
