import React from 'react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

// ── Mocks (must be declared before imports that use them) ──────────────────────

const mockNavigate = vi.fn()
const mockSetAuth = vi.fn()
let mockIsAuthenticated = false

vi.mock('@tanstack/react-router', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@tanstack/react-router')>()
  return {
    ...actual,
    useNavigate: () => mockNavigate,
    Link: ({
      children,
      to,
      search,
      ...props
    }: {
      children: React.ReactNode
      to: string
      search?: Record<string, unknown>
      [k: string]: unknown
    }) => {
      const qs = search ? '?' + new URLSearchParams(search as Record<string, string>).toString() : ''
      return (
        <a href={`${to}${qs}`} {...props}>
          {children}
        </a>
      )
    },
  }
})

vi.mock('@/lib/api/organisations', () => ({
  organisationsApi: {
    acceptInvitation: vi.fn(),
  },
}))

vi.mock('@/lib/stores/auth', () => {
  const state = {
    setAuth: mockSetAuth,
    accessToken: null as string | null,
    user: { id: 'u1', full_name: 'Ahmad', email: 'a@b.com' },
    isAuthenticated: () => mockIsAuthenticated,
  }
  const useAuthStore = vi.fn((selector: (s: typeof state) => unknown) => selector(state))
  useAuthStore.getState = () => state
  return { useAuthStore }
})

vi.mock('@/components/workived/layout/WorkivedLogo', () => ({
  WorkivedLogo: () => <div data-testid="workived-logo" />,
}))

// ── Import route AFTER mocks ──────────────────────────────────────────────────

import { organisationsApi } from '@/lib/api/organisations'
const { Route } = await import('./route')
const InviteAcceptPage = Route.options.component as React.ComponentType

// ── Helpers ─────────────────────────────────────────────────────────────────────

function renderInvite() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })
  return render(
    <QueryClientProvider client={qc}>
      <InviteAcceptPage />
    </QueryClientProvider>
  )
}

// ── Tests ───────────────────────────────────────────────────────────────────────

describe('InviteAcceptPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockIsAuthenticated = false
    vi.spyOn(Route, 'useSearch').mockReturnValue({ token: undefined })
  })

  it('has search validation for token param', () => {
    expect(Route.options.validateSearch).toBeDefined()
  })

  it('shows invalid invite link message when no token present', () => {
    vi.spyOn(Route, 'useSearch').mockReturnValue({ token: undefined })
    renderInvite()
    expect(screen.getByText('Invalid invite link')).toBeInTheDocument()
  })

  it('shows "Go to login" link on invalid invite', () => {
    vi.spyOn(Route, 'useSearch').mockReturnValue({ token: undefined })
    renderInvite()
    expect(screen.getByRole('link', { name: /go to login/i })).toBeInTheDocument()
  })

  it('shows "You\'re invited!" when token present and not authenticated', () => {
    mockIsAuthenticated = false
    vi.spyOn(Route, 'useSearch').mockReturnValue({ token: 'abc-token-123' })
    renderInvite()
    expect(screen.getByText("You're invited!")).toBeInTheDocument()
  })

  it('shows Sign in and Create account links when not authenticated', () => {
    mockIsAuthenticated = false
    vi.spyOn(Route, 'useSearch').mockReturnValue({ token: 'abc-token-123' })
    renderInvite()
    expect(screen.getByRole('link', { name: /sign in/i })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /create account/i })).toBeInTheDocument()
  })

  it('Create account link passes invite_token as search param to /register', () => {
    mockIsAuthenticated = false
    vi.spyOn(Route, 'useSearch').mockReturnValue({ token: 'abc-token-123' })
    renderInvite()

    const createAccountLink = screen.getByRole('link', { name: /create account/i })
    const href = createAccountLink.getAttribute('href') ?? ''
    expect(href).toContain('register')
    expect(href).toContain('abc-token-123')
  })

  it('shows Accept invitation button when authenticated', () => {
    mockIsAuthenticated = true
    vi.spyOn(Route, 'useSearch').mockReturnValue({ token: 'abc-token-123' })
    renderInvite()
    expect(screen.getByRole('button', { name: /join workspace/i })).toBeInTheDocument()
  })

  it('calls acceptInvitation with the token on accept click', async () => {
    mockIsAuthenticated = true
    vi.spyOn(Route, 'useSearch').mockReturnValue({ token: 'abc-token-123' })
    vi.mocked(organisationsApi.acceptInvitation).mockResolvedValue({
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      data: { data: { access_token: 'new-tok', organisation: null, member: null } } as any,
    })
    renderInvite()

    fireEvent.click(screen.getByRole('button', { name: /join workspace/i }))

    await waitFor(() => {
      expect(organisationsApi.acceptInvitation).toHaveBeenCalledWith({ token: 'abc-token-123' })
    })
  })

  it('navigates to /overview after successful acceptance', async () => {
    mockIsAuthenticated = true
    vi.spyOn(Route, 'useSearch').mockReturnValue({ token: 'abc-token-123' })
    vi.mocked(organisationsApi.acceptInvitation).mockResolvedValue({
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      data: { data: { access_token: 'new-tok', organisation: null, member: null } } as any,
    })
    renderInvite()

    fireEvent.click(screen.getByRole('button', { name: /join workspace/i }))

    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith({ to: '/overview' })
    })
  })

  it('shows API error message when accept invitation fails', async () => {
    mockIsAuthenticated = true
    vi.spyOn(Route, 'useSearch').mockReturnValue({ token: 'expired-token' })

    const { AxiosError } = await import('axios')
    const axiosErr = new AxiosError('Forbidden')
    axiosErr.response = {
      data: { error: { code: 'FORBIDDEN', message: 'Invitation has expired' } },
      status: 403,
      statusText: 'Forbidden',
      headers: {},
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      config: {} as any,
    }
    vi.mocked(organisationsApi.acceptInvitation).mockRejectedValue(axiosErr)
    renderInvite()

    fireEvent.click(screen.getByRole('button', { name: /join workspace/i }))

    await waitFor(() => {
      expect(screen.getByText('Invitation has expired')).toBeInTheDocument()
    })
  })
})
