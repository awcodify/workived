import React from 'react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import type { MyInvitation } from '@/types/api'

// ── Mocks ─────────────────────────────────────────────────────────────────────

const mockCreateMutate = vi.fn()
const mockAcceptMutate = vi.fn()

vi.mock('@/lib/hooks/useInvitations', () => ({
  useMyInvitations: vi.fn(),
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
  WorkivedLogo: () => <div data-testid="logo" />,
}))

vi.mock('@tanstack/react-router', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@tanstack/react-router')>()
  return {
    ...actual,
    createFileRoute: () => (opts: Record<string, unknown>) => ({ options: opts }),
    useNavigate: () => vi.fn(),
    redirect: vi.fn(),
  }
})

vi.mock('@tanstack/react-query', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@tanstack/react-query')>()
  return {
    ...actual,
    useMutation: vi.fn((opts: { mutationFn: unknown }) => {
      // Return create mutation for create org, accept mutation for accept invitation
      // Distinguish by checking mutationFn identity — we just return both fakes
      return {
        mutate: opts.mutationFn?.toString().includes('acceptInvitation')
          ? mockAcceptMutate
          : mockCreateMutate,
        isPending: false,
        error: null,
      }
    }),
  }
})

import { useMyInvitations } from '@/lib/hooks/useInvitations'

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeInvitation(overrides: Partial<MyInvitation> = {}): MyInvitation {
  return {
    id: 'inv-1',
    organisation_id: 'org-1',
    email: 'ahmad@example.com',
    role: 'member',
    invited_by: 'user-admin',
    invite_url: 'https://app.workived.com/invite?token=abc123',
    expires_at: new Date(Date.now() + 72 * 60 * 60 * 1000).toISOString(),
    created_at: new Date().toISOString(),
    org_name: 'Acme Corp',
    org_slug: 'acme-corp',
    ...overrides,
  }
}

const { Route } = await import('./route')
const SetupOrgPage = Route.options.component as React.ComponentType

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('SetupOrgPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('shows create workspace form when no invitations', () => {
    vi.mocked(useMyInvitations).mockReturnValue({
      data: [],
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any)

    render(<SetupOrgPage />)
    expect(screen.getByText('Create your workspace')).toBeTruthy()
    expect(screen.queryByText("You've been invited")).toBeNull()
  })

  it('shows invitation card when user has pending invitations', () => {
    vi.mocked(useMyInvitations).mockReturnValue({
      data: [makeInvitation()],
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any)

    render(<SetupOrgPage />)
    expect(screen.getByText("You've been invited")).toBeTruthy()
    expect(screen.getByText('Acme Corp')).toBeTruthy()
    expect(screen.getByRole('button', { name: /accept & join/i })).toBeTruthy()
  })

  it('shows role label on invitation card', () => {
    vi.mocked(useMyInvitations).mockReturnValue({
      data: [makeInvitation({ role: 'admin' })],
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any)

    render(<SetupOrgPage />)
    expect(screen.getByText('admin')).toBeTruthy()
  })

  it('shows divider between invitations and create form', () => {
    vi.mocked(useMyInvitations).mockReturnValue({
      data: [makeInvitation()],
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any)

    render(<SetupOrgPage />)
    expect(screen.getByText('or create a new workspace')).toBeTruthy()
  })

  it('still shows create form below invitations', () => {
    vi.mocked(useMyInvitations).mockReturnValue({
      data: [makeInvitation()],
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any)

    render(<SetupOrgPage />)
    expect(screen.getByText('Create your workspace')).toBeTruthy()
  })

  it('shows multiple invitation cards when multiple pending', () => {
    vi.mocked(useMyInvitations).mockReturnValue({
      data: [
        makeInvitation({ id: 'inv-1', org_name: 'Acme Corp' }),
        makeInvitation({ id: 'inv-2', org_name: 'Beta Ltd', invite_url: 'https://app.workived.com/invite?token=xyz789' }),
      ],
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any)

    render(<SetupOrgPage />)
    expect(screen.getByText('Acme Corp')).toBeTruthy()
    expect(screen.getByText('Beta Ltd')).toBeTruthy()
  })

  it('submits create org form', async () => {
    vi.mocked(useMyInvitations).mockReturnValue({
      data: [],
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any)

    render(<SetupOrgPage />)

    fireEvent.change(screen.getByPlaceholderText('Acme Corp'), {
      target: { value: 'Test Company' },
    })

    fireEvent.change(screen.getByRole('combobox'), {
      target: { value: 'ID' },
    })

    fireEvent.click(screen.getByRole('button', { name: /create workspace/i }))

    await waitFor(() => {
      expect(mockCreateMutate).toHaveBeenCalled()
    })
  })
})
