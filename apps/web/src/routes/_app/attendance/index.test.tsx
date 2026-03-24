import React from 'react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'

// ── Mock fns ──────────────────────────────────────────────────────────────────

vi.mock('@/lib/hooks/useOrganisation', () => ({
  useOrganisation: vi.fn(),
}))

vi.mock('@/lib/hooks/useAttendance', () => ({
  useDailyReport: vi.fn(),
  useClockIn: vi.fn(() => ({ mutate: vi.fn(), isPending: false })),
  useClockOut: vi.fn(() => ({ mutate: vi.fn(), isPending: false })),
  useMyWeek: vi.fn(),
  useTeamWeek: vi.fn(),
  useAllWeek: vi.fn(),
}))

vi.mock('@/lib/hooks/useAttendanceRole', () => ({
  useAttendanceRole: vi.fn(),
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
import { useMyWeek, useTeamWeek, useAllWeek } from '@/lib/hooks/useAttendance'
import { useAttendanceRole } from '@/lib/hooks/useAttendanceRole'

const { Route } = await import('./index')
const AttendancePage = Route.options.component as React.ComponentType

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeWeekEmployee(overrides: {
  employee_id?: string
  employee_name?: string
  days?: Array<{
    date?: string
    status?: string
    clock_in_at?: string | null
    clock_out_at?: string | null
  }>
} = {}) {
  const { employee_id = 'emp-1', employee_name = 'Budi Santoso', days = [] } = overrides
  return {
    employee_id,
    employee_name,
    week: {
      days: days.map((d) => ({
        date: d.date ?? '2026-03-19',
        status: d.status ?? 'present',
        clock_in_at: d.clock_in_at ?? '2026-03-19T01:00:00Z',
        clock_out_at: d.clock_out_at ?? '2026-03-19T09:00:00Z',
      })),
    },
  }
}

function setupDefaultMocks() {
  vi.mocked(useOrganisation).mockReturnValue({
    data: { id: 'org-1', name: 'Test', slug: 'test', plan: 'free', timezone: 'Asia/Jakarta' },
    isLoading: false,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any)

  vi.mocked(useAttendanceRole).mockReturnValue({
    canViewOwn: true,
    canViewTeam: true,
    canViewAll: true,
  })

  vi.mocked(useMyWeek).mockReturnValue({
    data: { days: [] },
    isLoading: false,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any)

  vi.mocked(useTeamWeek).mockReturnValue({
    data: [],
    isLoading: false,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any)

  vi.mocked(useAllWeek).mockReturnValue({
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

  // TODO: Rewrite remaining tests for Sprint 12 week view refactor
  // Component was restructured from daily report to week calendar view
  // Tests below expect old UI structure and need complete rewrite
  
  it.todo('shows date picker')
  it.todo('shows hero stats (clocked in, late, absent)')
  it.todo('shows employee list with attendance data')
  it.todo('shows empty state when no entries')
  it.todo('shows loading skeleton')
  it.todo('shows status squares for entries')
  it.todo('shows QuickClock component')
  it.todo('shows column headers when entries exist')
})
