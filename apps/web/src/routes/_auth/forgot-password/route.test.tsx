import React from 'react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { AxiosError } from 'axios'

// ── Mocks ─────────────────────────────────────────────────────────────────────

const mockForgotPassword = vi.fn()

vi.mock('@tanstack/react-router', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@tanstack/react-router')>()
  return {
    ...actual,
    Link: ({ children, to, ...props }: { children: React.ReactNode; to: string; [k: string]: unknown }) => (
      <a href={to} {...props}>{children}</a>
    ),
  }
})

vi.mock('@/lib/api/auth', () => ({
  authApi: {
    forgotPassword: (...args: unknown[]) => mockForgotPassword(...args),
  },
}))

vi.mock('@/components/workived/layout/WorkivedLogo', () => ({
  WorkivedLogo: () => <div data-testid="workived-logo" />,
}))

// ── Import AFTER mocks ────────────────────────────────────────────────────────

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
const { Route } = await import('./route')
const ForgotPasswordPage = Route.options.component as React.ComponentType

function renderPage() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })
  return render(
    <QueryClientProvider client={qc}>
      <ForgotPasswordPage />
    </QueryClientProvider>
  )
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('ForgotPasswordPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockForgotPassword.mockResolvedValue({
      data: { data: { message: 'if that email is registered, a reset link has been sent' } },
    })
  })

  it('renders email input and submit button', () => {
    renderPage()
    expect(screen.getByLabelText('Email address')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /send reset link/i })).toBeInTheDocument()
  })

  it('has a back to sign in link', () => {
    renderPage()
    expect(screen.getByRole('link', { name: /sign in/i })).toBeInTheDocument()
  })

  it('shows validation error for invalid email', async () => {
    renderPage()
    fireEvent.change(screen.getByLabelText('Email address'), { target: { value: 'not-valid' } })
    fireEvent.click(screen.getByRole('button', { name: /send reset link/i }))
    await waitFor(() => {
      expect(screen.getByText('Invalid email address')).toBeInTheDocument()
    })
  })

  it('shows success state after successful submission', async () => {
    renderPage()
    fireEvent.change(screen.getByLabelText('Email address'), { target: { value: 'user@example.com' } })
    fireEvent.click(screen.getByRole('button', { name: /send reset link/i }))

    await waitFor(() => {
      expect(screen.getByText('Check your email')).toBeInTheDocument()
    })
    expect(screen.getByRole('link', { name: /back to sign in/i })).toBeInTheDocument()
  })

  it('calls forgotPassword with email on submit', async () => {
    renderPage()
    fireEvent.change(screen.getByLabelText('Email address'), { target: { value: 'user@example.com' } })
    fireEvent.click(screen.getByRole('button', { name: /send reset link/i }))

    await waitFor(() => {
      expect(mockForgotPassword).toHaveBeenCalledWith({ email: 'user@example.com' })
    })
  })

  it('shows API error on failure', async () => {
    const err = new AxiosError('Request failed')
    err.response = {
      data: { error: { message: 'Too many requests' } },
      status: 429,
      statusText: 'Too Many Requests',
      headers: {},
      config: { headers: {} as never },
    }
    mockForgotPassword.mockRejectedValueOnce(err)

    renderPage()
    fireEvent.change(screen.getByLabelText('Email address'), { target: { value: 'user@example.com' } })
    fireEvent.click(screen.getByRole('button', { name: /send reset link/i }))

    await waitFor(() => {
      expect(screen.getByText('Too many requests')).toBeInTheDocument()
    })
  })

  it('shows pending state while submitting', async () => {
    mockForgotPassword.mockReturnValue(new Promise(() => {}))
    renderPage()
    fireEvent.change(screen.getByLabelText('Email address'), { target: { value: 'user@example.com' } })
    fireEvent.click(screen.getByRole('button', { name: /send reset link/i }))

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /sending/i })).toBeDisabled()
    })
  })
})
