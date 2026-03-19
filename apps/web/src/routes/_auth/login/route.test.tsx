import React from 'react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { AxiosError } from 'axios'

// ── Mocks (must be declared before imports that use them) ──────────────────────

const mockNavigate = vi.fn()
const mockSetAuth = vi.fn()
const mockLogin = vi.fn()

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
    login: (...args: unknown[]) => mockLogin(...args),
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
const LoginPage = Route.options.component as React.ComponentType

function renderPage() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })
  return render(
    <QueryClientProvider client={qc}>
      <LoginPage />
    </QueryClientProvider>
  )
}

// ── Tests ───────────────────────────────────────────────────────────────────────

describe('LoginPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.spyOn(Route, 'useSearch').mockReturnValue({ redirect: undefined })
    mockLogin.mockResolvedValue({
      data: { data: { access_token: 'tok', user: { id: 'u1', full_name: 'Ahmad', email: 'a@b.com' } } },
    })
  })

  it('renders the login heading and subtitle', () => {
    renderPage()

    expect(screen.getByText('Welcome back')).toBeInTheDocument()
    expect(screen.getByText('Sign in to continue to your workspace')).toBeInTheDocument()
  })

  it('shows email and password input fields', () => {
    renderPage()

    expect(screen.getByLabelText('Email address')).toBeInTheDocument()
    expect(screen.getByLabelText('Password')).toBeInTheDocument()
  })

  it('has a submit button', () => {
    renderPage()

    expect(screen.getByRole('button', { name: /sign in/i })).toBeInTheDocument()
  })

  it('has a link to the register page', () => {
    renderPage()

    const link = screen.getByText('Sign up')
    expect(link).toBeInTheDocument()
    expect(link.closest('a')).toHaveAttribute('href', '/register')
  })

  it('shows validation error for invalid email', async () => {
    renderPage()

    fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'password123' } })
    fireEvent.click(screen.getByRole('button', { name: /sign in/i }))

    await waitFor(() => {
      expect(screen.getByText('Invalid email address')).toBeInTheDocument()
    })
  })

  it('shows validation error when password is empty', async () => {
    renderPage()

    fireEvent.change(screen.getByLabelText('Email address'), { target: { value: 'a@b.com' } })
    fireEvent.click(screen.getByRole('button', { name: /sign in/i }))

    await waitFor(() => {
      expect(screen.getByText('Password is required')).toBeInTheDocument()
    })
  })

  it('calls login mutation on form submit with valid data', async () => {
    renderPage()

    fireEvent.change(screen.getByLabelText('Email address'), { target: { value: 'a@b.com' } })
    fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'password123' } })
    fireEvent.click(screen.getByRole('button', { name: /sign in/i }))

    await waitFor(() => {
      expect(mockLogin).toHaveBeenCalledWith({ email: 'a@b.com', password: 'password123' })
    })
  })

  it('navigates to /overview after successful login without redirect', async () => {
    renderPage()

    fireEvent.change(screen.getByLabelText('Email address'), { target: { value: 'a@b.com' } })
    fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'password123' } })
    fireEvent.click(screen.getByRole('button', { name: /sign in/i }))

    await waitFor(() => {
      expect(mockSetAuth).toHaveBeenCalled()
      expect(mockNavigate).toHaveBeenCalledWith({ to: '/overview' })
    })
  })

  it('shows error message on failed login', async () => {
    const axiosError = new AxiosError('Request failed')
    axiosError.response = {
      data: { error: { message: 'Invalid email or password' } },
      status: 401,
      statusText: 'Unauthorized',
      headers: {},
      config: { headers: {} as never },
    }
    mockLogin.mockRejectedValueOnce(axiosError)

    renderPage()

    fireEvent.change(screen.getByLabelText('Email address'), { target: { value: 'a@b.com' } })
    fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'wrongpassword' } })
    fireEvent.click(screen.getByRole('button', { name: /sign in/i }))

    await waitFor(() => {
      expect(screen.getByText('Invalid email or password')).toBeInTheDocument()
    })
  })

  it('shows pending state while submitting', async () => {
    // Make login hang indefinitely
    mockLogin.mockReturnValue(new Promise(() => {}))

    renderPage()

    fireEvent.change(screen.getByLabelText('Email address'), { target: { value: 'a@b.com' } })
    fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'password123' } })
    fireEvent.click(screen.getByRole('button', { name: /sign in/i }))

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /signing in/i })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /signing in/i })).toBeDisabled()
    })
  })

  it('has validateSearch defined for redirect', () => {
    expect(Route.options.validateSearch).toBeDefined()
  })

  it('validateSearch extracts redirect from search params', () => {
    const result = Route.options.validateSearch!({ redirect: '/people' })
    expect(result).toEqual({ redirect: '/people' })
  })

  it('validateSearch returns undefined when redirect is absent', () => {
    const result = Route.options.validateSearch!({})
    expect(result).toEqual({ redirect: undefined })
  })
})
