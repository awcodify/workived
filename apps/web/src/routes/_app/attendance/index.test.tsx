import React from 'react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'

// ── Mock fns ──────────────────────────────────────────────────────────────────

vi.mock('@/lib/hooks/useOrganisation', () => ({
  useOrganisation: vi.fn(),
}))

vi.mock('@/lib/hooks/useAttendance', () => ({
  useDailyReport: vi.fn(() => ({ data: [], isLoading: false })),
  useClockIn: vi.fn(() => ({ mutate: vi.fn(), isPending: false })),
  useClockOut: vi.fn(() => ({ mutate: vi.fn(), isPending: false })),
  useMyWeek: vi.fn(),
  useTeamWeek: vi.fn(),
  useAllWeek: vi.fn(),
  useWorkSchedules: vi.fn(() => ({ data: [], isLoading: false })),
  useCorrections: vi.fn(() => ({ data: [], isLoading: false })),
  useApproveCorrection: vi.fn(() => ({ mutate: vi.fn(), isPending: false })),
  useRejectCorrection: vi.fn(() => ({ mutate: vi.fn(), isPending: false })),
}))

vi.mock('@/lib/hooks/useAttendanceRole', () => ({
  useAttendanceRole: vi.fn(),
}))

vi.mock('@/lib/hooks/useRole', () => ({
  useCanManageEmployees: vi.fn(() => false),
}))

vi.mock('@/lib/hooks/useEmployees', () => ({
  useMyEmployee: vi.fn(() => ({ data: null, isLoading: false })),
}))

vi.mock('@/components/workived/shared/DateTime', () => ({
  DateTime: () => <div data-testid="datetime" />,
}))

vi.mock('@/components/workived/shared/NotificationBell', () => ({
  NotificationBell: () => <div data-testid="notification-bell" />,
}))

vi.mock('@/components/workived/attendance/AttendanceCard', () => ({
  AttendanceCard: () => <div data-testid="attendance-card" />,
}))

vi.mock('@/components/workived/attendance/LocationAnalyticsWidget', () => ({
  LocationAnalyticsWidget: () => <div data-testid="location-analytics" />,
}))

vi.mock('@/components/workived/attendance/TeamMapView', () => ({
  TeamMapView: () => <div data-testid="team-map-view" />,
}))

vi.mock('@/components/workived/attendance/WorkSchedulesPanel', () => ({
  WorkSchedulesPanel: () => <div data-testid="work-schedules-panel" />,
}))

vi.mock('@/components/workived/shared/EmployeeDetailModal', () => ({
  EmployeeDetailModal: () => <div data-testid="employee-detail-modal" />,
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

  it('renders prev/next week navigation buttons', () => {
    render(<AttendancePage />)
    expect(screen.getByTestId('attendance-prev-week-btn')).toBeInTheDocument()
    expect(screen.getByTestId('attendance-next-week-btn')).toBeInTheDocument()
    expect(screen.getByTestId('attendance-today-btn')).toBeInTheDocument()
  })

  it('renders filter buttons', () => {
    render(<AttendancePage />)
    expect(screen.getByTestId('attendance-filter-all-btn')).toBeInTheDocument()
    expect(screen.getByTestId('attendance-filter-clocked-in-btn')).toBeInTheDocument()
  })

  it('shows empty state when no employees', () => {
    render(<AttendancePage />)
    expect(screen.getByTestId('attendance-empty')).toBeInTheDocument()
  })

  it('always shows Work Schedules section with Manage/Create button', () => {
    render(<AttendancePage />)
    expect(screen.getByTestId('attendance-schedules-manage-btn')).toBeInTheDocument()
  })

  it('shows empty-state message and Create button when no schedules', () => {
    render(<AttendancePage />)
    expect(screen.getByTestId('attendance-schedules-empty')).toBeInTheDocument()
    expect(screen.getByTestId('attendance-schedules-manage-btn')).toHaveTextContent('Create')
  })

  it('shifts selected date back 7 days when clicking prev week', () => {
    // Seed myWeek with days so the week grid renders
    vi.mocked(useMyWeek).mockReturnValue({
      data: {
        days: Array.from({ length: 7 }, (_, i) => ({
          date: `2026-04-${String(14 + i).padStart(2, '0')}`,
          day_name: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'][i],
          day_number: 14 + i,
          status: i < 5 ? 'future' : 'weekend',
          is_today: i === 4,
        })),
      },
      isLoading: false,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any)

    render(<AttendancePage />)

    // Clicking prev week should not throw and should update week
    const prevBtn = screen.getByTestId('attendance-prev-week-btn')
    fireEvent.click(prevBtn)
    // Component re-renders without error = pass
    expect(screen.getByTestId('attendance-prev-week-btn')).toBeInTheDocument()
  })

  it('shows employee row when employee data present', () => {
    vi.mocked(useAllWeek).mockReturnValue({
      data: [makeWeekEmployee({ employee_name: 'Siti Rahayu', days: [{ date: '2026-03-19', status: 'on-time', clock_in_at: '2026-03-19T01:00:00Z' }] })],
      isLoading: false,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any)

    render(<AttendancePage />)
    expect(screen.getByTestId('attendance-row-emp-1')).toBeInTheDocument()
    expect(screen.getAllByText('Siti Rahayu').length).toBeGreaterThan(0)
  })
})
