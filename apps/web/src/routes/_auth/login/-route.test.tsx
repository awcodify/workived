import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { createRootRoute, createRouter, RouterProvider } from '@tanstack/react-router'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { Route as LoginRoute } from './route'

// Create a simple test router
const rootRoute = createRootRoute()
const routeTree = rootRoute.addChildren([LoginRoute])
const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: false },
    mutations: { retry: false },
  },
})

const router = createRouter({
  routeTree,
  context: { queryClient },
})

function renderWithRouter() {
  return render(
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>
  )
}

describe('LoginPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders login form', () => {
    renderWithRouter()
    
    expect(screen.getByText('Welcome back')).toBeInTheDocument()
    expect(screen.getByText('Sign in to continue to your workspace')).toBeInTheDocument()
    expect(screen.getByLabelText('Email address')).toBeInTheDocument()
    expect(screen.getByLabelText('Password')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /sign in/i })).toBeInTheDocument()
  })

  it('renders branding section on desktop', () => {
    renderWithRouter()
    
    expect(screen.getByText('Your team,')).toBeInTheDocument()
    expect(screen.getByText('simplified.')).toBeInTheDocument()
    expect(screen.getByText('Real-time attendance tracking')).toBeInTheDocument()
    expect(screen.getByText('Smart leave management')).toBeInTheDocument()
  })

  it('shows validation errors for invalid email', async () => {
    renderWithRouter()
    
    const emailInput = screen.getByLabelText('Email address')
    const submitButton = screen.getByRole('button', { name: /sign in/i })
    
    fireEvent.change(emailInput, { target: { value: 'invalid-email' } })
    fireEvent.click(submitButton)
    
    await waitFor(() => {
      expect(screen.getByText('Invalid email address')).toBeInTheDocument()
    })
  })

  it('shows validation error for empty password', async () => {
    renderWithRouter()
    
    const emailInput = screen.getByLabelText('Email address')
    const submitButton = screen.getByRole('button', { name: /sign in/i })
    
    fireEvent.change(emailInput, { target: { value: 'test@workived.com' } })
    fireEvent.click(submitButton)
    
    await waitFor(() => {
      expect(screen.getByText('Password is required')).toBeInTheDocument()
    })
  })

  it('displays form with glassmorphism styling', () => {
    renderWithRouter()
    
    const emailInput = screen.getByLabelText('Email address')
    expect(emailInput).toHaveStyle({ background: 'rgba(255,255,255,0.08)' })
  })
})
