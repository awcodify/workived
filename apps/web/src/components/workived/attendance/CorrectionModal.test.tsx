import React from 'react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'

vi.mock('@/lib/hooks/useAttendance', () => ({
  useSubmitCorrection: vi.fn(),
}))

import { useSubmitCorrection } from '@/lib/hooks/useAttendance'
import { CorrectionModal } from './CorrectionModal'
import type { WeekDay } from '@/types/api'

const mockDay: WeekDay = {
  date: '2026-04-17',
  day_name: 'Thu',
  day_number: 17,
  status: 'on-time',
  clock_in_at: '2026-04-17T01:00:00Z',
  is_today: false,
}

function setup() {
  vi.mocked(useSubmitCorrection).mockReturnValue({
    mutate: vi.fn(),
    isPending: false,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any)
}

describe('CorrectionModal', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    setup()
  })

  it('renders modal with date and form', () => {
    render(<CorrectionModal day={mockDay} onClose={vi.fn()} />)
    expect(screen.getByTestId('correction-modal')).toBeInTheDocument()
    expect(screen.getByTestId('correction-form')).toBeInTheDocument()
    expect(screen.getByText('2026-04-17 · Thu')).toBeInTheDocument()
  })

  it('renders all form inputs', () => {
    render(<CorrectionModal day={mockDay} onClose={vi.fn()} />)
    expect(screen.getByTestId('correction-clock-in-input')).toBeInTheDocument()
    expect(screen.getByTestId('correction-clock-out-input')).toBeInTheDocument()
    expect(screen.getByTestId('correction-reason-input')).toBeInTheDocument()
    expect(screen.getByTestId('correction-submit-btn')).toBeInTheDocument()
  })

  it('renders close button', () => {
    const onClose = vi.fn()
    render(<CorrectionModal day={mockDay} onClose={onClose} />)
    fireEvent.click(screen.getByTestId('correction-modal-close-btn'))
    expect(onClose).toHaveBeenCalled()
  })

  it('calls mutate on submit with reason filled', async () => {
    const mutate = vi.fn()
    vi.mocked(useSubmitCorrection).mockReturnValue({
      mutate,
      isPending: false,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any)

    render(<CorrectionModal day={mockDay} onClose={vi.fn()} />)

    fireEvent.change(screen.getByTestId('correction-clock-in-input'), { target: { value: '08:00' } })
    fireEvent.change(screen.getByTestId('correction-reason-input'), { target: { value: 'Forgot to scan my badge at the entrance' } })
    fireEvent.click(screen.getByTestId('correction-submit-btn'))

    await waitFor(() => {
      expect(mutate).toHaveBeenCalled()
    })
  })

  it('shows loading state when pending', () => {
    vi.mocked(useSubmitCorrection).mockReturnValue({
      mutate: vi.fn(),
      isPending: true,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any)

    render(<CorrectionModal day={mockDay} onClose={vi.fn()} />)
    expect(screen.getByTestId('correction-submit-btn')).toBeDisabled()
    expect(screen.getByText('Submitting…')).toBeInTheDocument()
  })

  it('renders current times from day prop', () => {
    render(<CorrectionModal day={mockDay} onClose={vi.fn()} />)
    expect(screen.getByText('Current Record')).toBeInTheDocument()
  })
})
