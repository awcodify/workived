import React from 'react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import type { DailyEntry } from '@/types/api'

// ── Mock fns ──────────────────────────────────────────────────────────────────

vi.mock('@/lib/hooks/useOrganisation', () => ({
  useOrganisation: vi.fn(),
}))

vi.mock('@/lib/hooks/useAttendance', () => ({
  useDailyReport: vi.fn(),
  useClockIn: vi.fn(() => ({ mutate: vi.fn(), isPending: false })),
  useClockOut: vi.fn(() => ({ mutate: vi.fn(), isPending: false })),
}))

vi.mock('@/lib/hooks/useEmployees', () => ({
  useMyEmployee: vi.fn(() => ({ data: null, isLoading: false })),
}))

vi.mock('@/components/workived/layout/Avatar', () => ({
  Avatar: ({ name }: { name: string }) => <div data-testid="avatar">{name}</div>,
}))

vi.mock('@/components/workived/layout/StatusSquare', () => ({
  StatusSquare: ({ status }: { status: string }) => (
    <span data-testid="status">{status}</span>
  ),
}))

vi.mock('@/components/workived/attendance/QuickClock', () => ({
  QuickClock: () => <div data-testid="quick-clock" />,
}))

vi.mock('@tanstack/react-router', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@tanstack/react-router')>()
  return {
    ...actual,
    createFileRoute: () => (opts: Record<string, unknown>) => ({
      options: opts,
    }),
    useNavigate: () => vi.fn(),
    Link: ({ children, to }: { children: React.ReactNode; to: string }) => (
      <a href={to}>{children}</a>
    ),
  }
})

// ── Import AFTER mocks ────────────────────────────────────────────────────────

import { useOrganisation } from '@/lib/hooks/useOrganisation'
import { useDailyReport } from '@/lib/hooks/useAttendance'

const { Route } = await import('./index')
const AttendancePage = Route.options.component as React.ComponentType

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeEntry(overrides: Partial<DailyEntry> = {}): DailyEntry {
  return {
    employee_id: 'emp-1',
    employee_name: 'Budi Santoso',
    status: 'present',
    clock_in_at: '2026-03-19T01:00:00Z',
    clock_out_at: '2026-03-19T09:00:00Z',
    ...overrides,
  }
}

function setupDefaultMocks() {
  vi.mocked(useOrganisation).mockReturnValue({
    data: { id: 'org-1', name: 'Test', slug: 'test', plan: 'free', timezone: 'Asia/Jakarta' },
    isLoading: false,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any)

  vi.mocked(useDailyReport).mockReturnValue({
    data: [],
    isLoading: false,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any)
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('AttendancePage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    setupDefaultMocks()
  })

  it('renders attendance heading', () => {
    render(<AttendancePage />)
    expect(screen.getByText('Attendance')).toBeInTheDocument()
  })

  it('shows date picker', () => {
    render(<AttendancePage />)
    const datePicker = document.querySelector('input[type="date"]')
    expect(datePicker).toBeInTheDocument()
  })

  it('shows hero stats (clocked in, late, absent)', () => {
    const entries: DailyEntry[] = [
      makeEntry({ employee_id: 'e1', status: 'present' }),
      makeEntry({ employee_id: 'e2', status: 'late' }),
      makeEntry({ employee_id: 'e3', status: 'absent', clock_in_at: undefined, clock_out_at: undefined }),
    ]

    vi.mocked(useDailyReport).mockReturnValue({
      data: entries,
      isLoading: false,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any)

    render(<AttendancePage />)
    expect(screen.getByText('CLOCKED IN')).toBeInTheDocument()
    expect(screen.getByText('LATE')).toBeInTheDocument()
    expect(screen.getByText('ABSENT')).toBeInTheDocument()
  })

  it('shows employee list with attendance data', () => {
    vi.mocked(useDailyReport).mockReturnValue({
      data: [makeEntry({ employee_name: 'Ahmad Rashid' })],
      isLoading: false,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any)

    render(<AttendancePage />)
    expect(screen.getAllByText('Ahmad Rashid').length).toBeGreaterThan(0)
  })

  it('shows empty state when no entries', () => {
    vi.mocked(useDailyReport).mockReturnValue({
      data: [],
      isLoading: false,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any)

    render(<AttendancePage />)
    expect(screen.getByText('No clock-ins yet today')).toBeInTheDocument()
  })

  it('shows loading skeleton', () => {
    vi.mocked(useDailyReport).mockReturnValue({
      data: undefined,
      isLoading: true,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any)

    render(<AttendancePage />)
    const skeletons = document.querySelectorAll('.animate-pulse')
    expect(skeletons.length).toBeGreaterThan(0)
  })

  it('shows status squares for entries', () => {
    vi.mocked(useDailyReport).mockReturnValue({
      data: [
        makeEntry({ employee_id: 'e1', employee_name: 'A', status: 'present' }),
        makeEntry({ employee_id: 'e2', employee_name: 'B', status: 'late' }),
        makeEntry({ employee_id: 'e3', employee_name: 'C', status: 'absent', clock_in_at: undefined }),
      ],
      isLoading: false,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any)

    render(<AttendancePage />)
    const statuses = screen.getAllByTestId('status')
    expect(statuses.map((s) => s.textContent)).toEqual(
      expect.arrayContaining(['present', 'late', 'absent']),
    )
  })

  it('shows QuickClock component', () => {
    render(<AttendancePage />)
    expect(screen.getByTestId('quick-clock')).toBeInTheDocument()
  })

  it('shows column headers when entries exist', () => {
    vi.mocked(useDailyReport).mockReturnValue({
      data: [makeEntry()],
      isLoading: false,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any)

    render(<AttendancePage />)
    expect(screen.getByText('Employee')).toBeInTheDocument()
    expect(screen.getByText('Status')).toBeInTheDocument()
  })
})
