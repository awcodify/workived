import React from 'react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import type { DailyEntry } from '@/types/api'

// ── Mock fns ──────────────────────────────────────────────────────────────────

const mockClockInMutate = vi.fn()
const mockClockOutMutate = vi.fn()

vi.mock('@/lib/hooks/useEmployees', () => ({
  useMyEmployee: vi.fn(),
}))

vi.mock('@/lib/hooks/useOrganisation', () => ({
  useOrganisation: vi.fn(),
}))

vi.mock('@/lib/hooks/useAttendance', () => ({
  useDailyReport: vi.fn(),
  useClockIn: vi.fn(),
  useClockOut: vi.fn(),
}))

// ── Import AFTER mocks ────────────────────────────────────────────────────────

import { useMyEmployee } from '@/lib/hooks/useEmployees'
import { useOrganisation } from '@/lib/hooks/useOrganisation'
import { useDailyReport, useClockIn, useClockOut } from '@/lib/hooks/useAttendance'
import { QuickClock } from './QuickClock'

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeEntry(overrides: Partial<DailyEntry> = {}): DailyEntry {
  return {
    employee_id: 'emp-1',
    employee_name: 'Budi Santoso',
    status: 'present',
    clock_in_at: '2026-03-19T01:00:00Z',
    ...overrides,
  }
}

function setupDefaultMocks(opts: {
  employee?: { id: string } | null
  empLoading?: boolean
  entries?: DailyEntry[]
  clockInPending?: boolean
  clockOutPending?: boolean
} = {}) {
  vi.mocked(useOrganisation).mockReturnValue({
    data: { id: 'org-1', name: 'Test', slug: 'test', plan: 'free', timezone: 'UTC' },
    isLoading: false,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any)

  vi.mocked(useMyEmployee).mockReturnValue({
    data: opts.employee !== undefined ? opts.employee : { id: 'emp-1' },
    isLoading: opts.empLoading ?? false,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any)

  vi.mocked(useDailyReport).mockReturnValue({
    data: opts.entries ?? [],
    isLoading: false,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any)

  vi.mocked(useClockIn).mockReturnValue({
    mutate: mockClockInMutate,
    isPending: opts.clockInPending ?? false,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any)

  vi.mocked(useClockOut).mockReturnValue({
    mutate: mockClockOutMutate,
    isPending: opts.clockOutPending ?? false,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any)
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('QuickClock', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('shows Clock In button when not clocked in', () => {
    setupDefaultMocks()
    render(<QuickClock />)
    expect(screen.getByRole('button', { name: /clock in/i })).toBeInTheDocument()
  })

  it('shows Clock Out button after clocking in', () => {
    setupDefaultMocks({
      entries: [makeEntry({ employee_id: 'emp-1', clock_in_at: '2026-03-19T01:00:00Z' })],
    })
    render(<QuickClock />)
    expect(screen.getByRole('button', { name: /clock out/i })).toBeInTheDocument()
  })

  it('shows clocked-in time display', () => {
    setupDefaultMocks({
      entries: [makeEntry({ employee_id: 'emp-1', clock_in_at: '2026-03-19T01:00:00Z' })],
    })
    render(<QuickClock />)
    expect(screen.getByText(/clocked in at/i)).toBeInTheDocument()
  })

  it('shows note input in inline layout', () => {
    setupDefaultMocks()
    render(<QuickClock layout="inline" />)
    expect(screen.getByPlaceholderText('Note (optional)')).toBeInTheDocument()
  })

  it('returns null when no employee linked', () => {
    setupDefaultMocks({ employee: null })
    const { container } = render(<QuickClock />)
    expect(container.firstChild).toBeNull()
  })

  it('shows "Completed for today" after clocking out in sidebar mode', () => {
    setupDefaultMocks({
      entries: [makeEntry({
        employee_id: 'emp-1',
        clock_in_at: '2026-03-19T01:00:00Z',
        clock_out_at: '2026-03-19T09:00:00Z',
      })],
    })
    render(<QuickClock />)
    expect(screen.getByText('Completed for today')).toBeInTheDocument()
  })

  it('shows "You worked today" after clocking out in inline mode', () => {
    setupDefaultMocks({
      entries: [makeEntry({
        employee_id: 'emp-1',
        clock_in_at: '2026-03-19T01:00:00Z',
        clock_out_at: '2026-03-19T09:00:00Z',
      })],
    })
    render(<QuickClock layout="inline" />)
    expect(screen.getByText('You worked today')).toBeInTheDocument()
  })

  it('hides note input and buttons after clocking out', () => {
    setupDefaultMocks({
      entries: [makeEntry({
        employee_id: 'emp-1',
        clock_in_at: '2026-03-19T01:00:00Z',
        clock_out_at: '2026-03-19T09:00:00Z',
      })],
    })
    render(<QuickClock />)
    expect(screen.queryByPlaceholderText('Note (optional)')).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /clock/i })).not.toBeInTheDocument()
  })

  it('calls clockIn mutate on Clock In click', () => {
    setupDefaultMocks()
    render(<QuickClock />)
    fireEvent.click(screen.getByRole('button', { name: /clock in/i }))
    expect(mockClockInMutate).toHaveBeenCalled()
  })

  it('calls clockOut mutate on Clock Out click', () => {
    setupDefaultMocks({
      entries: [makeEntry({ employee_id: 'emp-1', clock_in_at: '2026-03-19T01:00:00Z' })],
    })
    render(<QuickClock />)
    fireEvent.click(screen.getByRole('button', { name: /clock out/i }))
    expect(mockClockOutMutate).toHaveBeenCalled()
  })

  it('shows pending state for clock in', () => {
    setupDefaultMocks({ clockInPending: true })
    render(<QuickClock />)
    expect(screen.getByRole('button', { name: /clocking in/i })).toBeInTheDocument()
  })

  it('shows pending state for clock out', () => {
    setupDefaultMocks({
      entries: [makeEntry({ employee_id: 'emp-1', clock_in_at: '2026-03-19T01:00:00Z' })],
      clockOutPending: true,
    })
    render(<QuickClock />)
    expect(screen.getByRole('button', { name: /clocking out/i })).toBeInTheDocument()
  })

  it('returns null while employee is loading', () => {
    setupDefaultMocks({ empLoading: true })
    const { container } = render(<QuickClock />)
    expect(container.innerHTML).toBe('')
  })

  it('shows late indicator when clocked in late (inline mode)', () => {
    setupDefaultMocks({
      entries: [makeEntry({
        employee_id: 'emp-1',
        clock_in_at: '2026-03-19T01:00:00Z',
        status: 'late',
      })],
    })
    render(<QuickClock layout="inline" />)
    expect(screen.getByText('Late')).toBeInTheDocument()
  })
})
