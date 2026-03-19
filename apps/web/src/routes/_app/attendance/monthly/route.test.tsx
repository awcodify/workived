import React from 'react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import type { MonthlySummary } from '@/types/api'

// ── Mocks ─────────────────────────────────────────────────────────────────────

vi.mock('@/lib/hooks/useAttendance', () => ({
  useMonthlyReport: vi.fn(),
}))

vi.mock('@/components/workived/layout/Avatar', () => ({
  Avatar: ({ name }: { name: string }) => <div data-testid="avatar">{name}</div>,
}))

vi.mock('@tanstack/react-router', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@tanstack/react-router')>()
  return {
    ...actual,
    createFileRoute: () => (opts: Record<string, unknown>) => ({
      options: opts,
    }),
    useNavigate: () => vi.fn(),
  }
})

// ── Import AFTER mocks ────────────────────────────────────────────────────────

import { useMonthlyReport } from '@/lib/hooks/useAttendance'

const { Route } = await import('./route')
const MonthlyReportPage = Route.options.component as React.ComponentType

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeSummary(overrides: Partial<MonthlySummary> = {}): MonthlySummary {
  return {
    employee_id: 'emp-1',
    employee_name: 'Budi Santoso',
    present: 18,
    late: 2,
    absent: 1,
    working_days: 21,
    ...overrides,
  }
}

function setupDefaultMocks() {
  vi.mocked(useMonthlyReport).mockReturnValue({
    data: [],
    isLoading: false,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any)
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('MonthlyReportPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    setupDefaultMocks()
  })

  it('renders monthly report heading', () => {
    render(<MonthlyReportPage />)
    expect(screen.getByText('Monthly Report')).toBeInTheDocument()
  })

  it('shows month dropdown and year input', () => {
    render(<MonthlyReportPage />)
    const select = document.querySelector('select')
    expect(select).toBeInTheDocument()
    const yearInput = document.querySelector('input[type="number"]')
    expect(yearInput).toBeInTheDocument()
  })

  it('shows employee summary table with data', () => {
    vi.mocked(useMonthlyReport).mockReturnValue({
      data: [makeSummary({ employee_name: 'Ahmad Rashid', present: 20, late: 1, absent: 0, working_days: 21 })],
      isLoading: false,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any)

    render(<MonthlyReportPage />)
    expect(screen.getAllByText('Ahmad Rashid').length).toBeGreaterThan(0)
    expect(screen.getByText('20')).toBeInTheDocument()
    expect(screen.getByText('21')).toBeInTheDocument()
  })

  it('shows table column headers', () => {
    vi.mocked(useMonthlyReport).mockReturnValue({
      data: [makeSummary()],
      isLoading: false,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any)

    render(<MonthlyReportPage />)
    expect(screen.getByText('Employee')).toBeInTheDocument()
    expect(screen.getByText('Present')).toBeInTheDocument()
    expect(screen.getByText('Late')).toBeInTheDocument()
    expect(screen.getByText('Absent')).toBeInTheDocument()
    expect(screen.getByText('Days')).toBeInTheDocument()
  })

  it('shows empty state when no data', () => {
    render(<MonthlyReportPage />)
    expect(screen.getByText('No data for this period')).toBeInTheDocument()
  })

  it('shows loading state', () => {
    vi.mocked(useMonthlyReport).mockReturnValue({
      data: undefined,
      isLoading: true,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any)

    render(<MonthlyReportPage />)
    expect(screen.getByText('Loading...')).toBeInTheDocument()
  })

  it('renders multiple employee rows', () => {
    vi.mocked(useMonthlyReport).mockReturnValue({
      data: [
        makeSummary({ employee_id: 'e1', employee_name: 'Budi' }),
        makeSummary({ employee_id: 'e2', employee_name: 'Siti' }),
        makeSummary({ employee_id: 'e3', employee_name: 'Reza' }),
      ],
      isLoading: false,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any)

    render(<MonthlyReportPage />)
    expect(screen.getAllByText('Budi').length).toBeGreaterThan(0)
    expect(screen.getAllByText('Siti').length).toBeGreaterThan(0)
    expect(screen.getAllByText('Reza').length).toBeGreaterThan(0)
  })
})
