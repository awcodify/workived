import React from 'react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { AxiosError } from 'axios'

// ── Mocks ─────────────────────────────────────────────────────────────────────

const mockNavigate = vi.fn()
const mockResetPassword = vi.fn()

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
    resetPassword: (...args: unknown[]) => mockResetPassword(...args),
  },
}))

vi.mock('@/components/workived/layout/WorkivedLogo', () => ({
  WorkivedLogo: () => <div data-testid="workived-logo" />,
}))

// ── Import AFTER mocks ────────────────────────────────────────────────────────

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
const { Route } = await import('./route')
const ResetPasswordPage = Route.options.component as React.ComponentType

function renderPage(token = 'valid-reset-token') {
  vi.spyOn(Route, 'useSearch').mockReturnValue({ token } as ReturnType<typeof Route.useSearch>)
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })
  return render(
    <QueryClientProvider client={qc}>
      <ResetPasswordPage />
    </QueryClientProvider>
  )
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('ResetPasswordPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockResetPassword.mockResolvedValue({
      data: { data: { message: 'password updated successfully' } },
    })
  })

  it('renders password fields and submit button', () => {
    renderPage()
    expect(screen.getByLabelText('New password')).toBeInTheDocument()
    expect(screen.getByLabelText('Confirm new password')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /update password/i })).toBeInTheDocument()
  })

  it('shows invalid link message when token is missing', () => {
    renderPage('')
    expect(screen.getByText(/invalid or missing reset link/i)).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /request a new link/i })).toBeInTheDocument()
  })

  it('shows validation error when password too short', async () => {
    renderPage()
    fireEvent.change(screen.getByLabelText('New password'), { target: { value: 'short' } })
    fireEvent.change(screen.getByLabelText('Confirm new password'), { target: { value: 'short' } })
    fireEvent.click(screen.getByRole('button', { name: /update password/i }))
    await waitFor(() => {
      expect(screen.getByText(/at least 8 characters/i)).toBeInTheDocument()
    })
  })

  it('shows validation error when passwords do not match', async () => {
    renderPage()
    fireEvent.change(screen.getByLabelText('New password'), { target: { value: 'password123' } })
    fireEvent.change(screen.getByLabelText('Confirm new password'), { target: { value: 'different456' } })
    fireEvent.click(screen.getByRole('button', { name: /update password/i }))
    await waitFor(() => {
      expect(screen.getByText(/passwords do not match/i)).toBeInTheDocument()
    })
  })

  it('calls resetPassword with token and new password on submit', async () => {
    renderPage('my-token-abc')
    fireEvent.change(screen.getByLabelText('New password'), { target: { value: 'newpassword1' } })
    fireEvent.change(screen.getByLabelText('Confirm new password'), { target: { value: 'newpassword1' } })
    fireEvent.click(screen.getByRole('button', { name: /update password/i }))

    await waitFor(() => {
      expect(mockResetPassword).toHaveBeenCalledWith({
        token: 'my-token-abc',
        new_password: 'newpassword1',
      })
    })
  })

  it('navigates to /login after successful reset', async () => {
    renderPage()
    fireEvent.change(screen.getByLabelText('New password'), { target: { value: 'newpassword1' } })
    fireEvent.change(screen.getByLabelText('Confirm new password'), { target: { value: 'newpassword1' } })
    fireEvent.click(screen.getByRole('button', { name: /update password/i }))

    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith({ to: '/login' })
    })
  })

  it('shows API error when token is invalid', async () => {
    const err = new AxiosError('Unauthorized')
    err.response = {
      data: { error: { message: 'token is invalid or expired' } },
      status: 401,
      statusText: 'Unauthorized',
      headers: {},
      config: { headers: {} as never },
    }
    mockResetPassword.mockRejectedValueOnce(err)

    renderPage()
    fireEvent.change(screen.getByLabelText('New password'), { target: { value: 'newpassword1' } })
    fireEvent.change(screen.getByLabelText('Confirm new password'), { target: { value: 'newpassword1' } })
    fireEvent.click(screen.getByRole('button', { name: /update password/i }))

    await waitFor(() => {
      expect(screen.getByText('token is invalid or expired')).toBeInTheDocument()
    })
  })

  it('shows pending state while submitting', async () => {
    mockResetPassword.mockReturnValue(new Promise(() => {}))
    renderPage()
    fireEvent.change(screen.getByLabelText('New password'), { target: { value: 'newpassword1' } })
    fireEvent.change(screen.getByLabelText('Confirm new password'), { target: { value: 'newpassword1' } })
    fireEvent.click(screen.getByRole('button', { name: /update password/i }))

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /updating/i })).toBeDisabled()
    })
  })

  it('has a back to sign in link', () => {
    renderPage()
    expect(screen.getByRole('link', { name: /back to sign in/i })).toBeInTheDocument()
  })
})
