import { describe, test, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { ErrorBanner } from './ErrorBanner'

describe('ErrorBanner', () => {
  test('renders simple error message', () => {
    render(<ErrorBanner message="Something went wrong" />)
    expect(screen.getByText('Something went wrong')).toBeInTheDocument()
  })

  test('renders error with details', () => {
    render(
      <ErrorBanner
        error={{
          message: 'Insufficient claim budget',
          details: {
            limit: 5000000,
            spent: 4800000,
            remaining: 200000,
            currency: 'IDR',
          },
        }}
      />
    )
    expect(screen.getByText('Insufficient claim budget')).toBeInTheDocument()
    expect(screen.getByText('Details:')).toBeInTheDocument()
    expect(screen.getByText(/limit/i)).toBeInTheDocument()
    expect(screen.getByText('5,000,000')).toBeInTheDocument()
    expect(screen.getByText(/currency/i)).toBeInTheDocument()
    expect(screen.getByText('IDR')).toBeInTheDocument()
  })

  test('prefers error object message over string message', () => {
    render(
      <ErrorBanner
        message="Old message"
        error={{
          message: 'New message',
          details: {},
        }}
      />
    )
    expect(screen.getByText('New message')).toBeInTheDocument()
    expect(screen.queryByText('Old message')).not.toBeInTheDocument()
  })

  test('renders nothing when no message provided', () => {
    const { container } = render(<ErrorBanner />)
    expect(container.firstChild).toBeNull()
  })

  test('formats numbers with thousand separators', () => {
    render(
      <ErrorBanner
        error={{
          message: 'Test',
          details: { amount: 1234567 },
        }}
      />
    )
    expect(screen.getByText('1,234,567')).toBeInTheDocument()
  })

  test('formats underscored keys to readable text', () => {
    render(
      <ErrorBanner
        error={{
          message: 'Test',
          details: { start_date: '2026-01-01' },
        }}
      />
    )
    expect(screen.getByText(/start date/i)).toBeInTheDocument()
  })

  test('does not render details section when details is empty', () => {
    render(
      <ErrorBanner
        error={{
          message: 'Test error',
          details: {},
        }}
      />
    )
    expect(screen.queryByText('Details:')).not.toBeInTheDocument()
  })

  test('does not render details section when details is undefined', () => {
    render(
      <ErrorBanner
        error={{
          message: 'Test error',
        }}
      />
    )
    expect(screen.queryByText('Details:')).not.toBeInTheDocument()
  })
})
