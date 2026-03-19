import React from 'react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'

// ── Mocks (must be declared before imports that use them) ──────────────────────

const mockNavigate = vi.fn()
const mockSetAuth = vi.fn()

vi.mock('@tanstack/react-router', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@tanstack/react-router')>()
  return {
    ...actual,
    useNavigate: () => mockNavigate,
    Link: ({ children, to, ...props }: { children: React.ReactNode; to: string; [k: string]: unknown }) => (
      <a href={to} {...props}>{children}</a>
    ),
  }
})

vi.mock('@/lib/api/auth', () => ({
  authApi: {
    register: vi.fn().mockResolvedValue({}),
    login: vi.fn().mockResolvedValue({
      data: { data: { access_token: 'tok', user: { id: 'u1', full_name: 'Ahmad', email: 'a@b.com' } } },
    }),
  },
}))

vi.mock('@/lib/stores/auth', () => ({
  useAuthStore: vi.fn((selector) =>
    selector({
      setAuth: mockSetAuth,
      accessToken: null,
      user: null,
      isAuthenticated: () => false,
    })
  ),
}))

vi.mock('@/components/workived/layout/WorkivedLogo', () => ({
  WorkivedLogo: () => <div data-testid="workived-logo" />,
}))

// ── Import route AFTER mocks ──────────────────────────────────────────────────

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
const { Route } = await import('./route')
const RegisterPage = Route.options.component as React.ComponentType

function renderPage() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })
  return render(
    <QueryClientProvider client={qc}>
      <RegisterPage />
    </QueryClientProvider>
  )
}

// ── Tests ───────────────────────────────────────────────────────────────────────

describe('RegisterPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.spyOn(Route, 'useSearch').mockReturnValue({ invite_token: undefined })
  })

  it('renders the registration form', () => {
    renderPage()

    expect(screen.getByText('Create your account')).toBeInTheDocument()
    expect(screen.getByLabelText('Full name')).toBeInTheDocument()
    expect(screen.getByLabelText('Work email')).toBeInTheDocument()
    expect(screen.getByLabelText('Password')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /create account/i })).toBeInTheDocument()
  })

  it('shows validation error for empty name', async () => {
    renderPage()

    fireEvent.click(screen.getByRole('button', { name: /create account/i }))

    await waitFor(() => {
      expect(screen.getByText('Name is required')).toBeInTheDocument()
    })
  })

  it('shows validation error when email is missing', async () => {
    renderPage()

    // Fill name and password but leave email empty — triggers email format validation
    fireEvent.change(screen.getByLabelText('Full name'), { target: { value: 'Ahmad' } })
    fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'password123' } })
    fireEvent.click(screen.getByRole('button', { name: /create account/i }))

    await waitFor(() => {
      expect(screen.getByText('Invalid email address')).toBeInTheDocument()
    })
  })

  it('shows validation error for short password', async () => {
    renderPage()

    fireEvent.change(screen.getByLabelText('Full name'), { target: { value: 'Ahmad' } })
    fireEvent.change(screen.getByLabelText('Work email'), { target: { value: 'a@b.com' } })
    fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'short' } })
    fireEvent.click(screen.getByRole('button', { name: /create account/i }))

    await waitFor(() => {
      expect(screen.getByText('Password must be at least 8 characters')).toBeInTheDocument()
    })
  })

  it('has validateSearch defined for invite_token', () => {
    expect(Route.options.validateSearch).toBeDefined()
  })

  it('validateSearch extracts invite_token from search params', () => {
    const result = Route.options.validateSearch!({ invite_token: 'abc123' })
    expect(result).toEqual({ invite_token: 'abc123' })
  })

  it('validateSearch returns undefined when invite_token absent', () => {
    const result = Route.options.validateSearch!({})
    expect(result).toEqual({ invite_token: undefined })
  })

  it('navigates to /setup-org after registration without invite token', async () => {
    vi.spyOn(Route, 'useSearch').mockReturnValue({ invite_token: undefined })
    renderPage()

    fireEvent.change(screen.getByLabelText('Full name'), { target: { value: 'Ahmad' } })
    fireEvent.change(screen.getByLabelText('Work email'), { target: { value: 'a@b.com' } })
    fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'password123' } })
    fireEvent.click(screen.getByRole('button', { name: /create account/i }))

    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith({ to: '/setup-org' })
    })
  })

  it('navigates to /invite with token after registration with invite token', async () => {
    vi.spyOn(Route, 'useSearch').mockReturnValue({ invite_token: 'tok-abc-123' })
    renderPage()

    fireEvent.change(screen.getByLabelText('Full name'), { target: { value: 'Ahmad' } })
    fireEvent.change(screen.getByLabelText('Work email'), { target: { value: 'a@b.com' } })
    fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'password123' } })
    fireEvent.click(screen.getByRole('button', { name: /create account/i }))

    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith({
        to: '/invite',
        search: { token: 'tok-abc-123' },
      })
    })
  })
})
