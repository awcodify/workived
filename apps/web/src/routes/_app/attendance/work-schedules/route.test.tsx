import React from 'react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import type { WorkScheduleListItem } from '@/types/api'

// ── Mocks ────────────────────────────────────────────────────────────────────

const mockCreateMutate = vi.fn()
const mockUpdateMutate = vi.fn()
const mockDeactivateMutate = vi.fn()

vi.mock('@/lib/hooks/useAttendance', () => ({
  useWorkSchedules: vi.fn(),
  useCreateWorkSchedule: vi.fn(),
  useUpdateWorkSchedule: vi.fn(),
  useDeactivateWorkSchedule: vi.fn(),
}))

vi.mock('@/lib/api/attendance', () => ({
  attendanceApi: {
    countEmployeesBySchedule: vi.fn(() => Promise.resolve({ data: { data: { count: 0 } } })),
  },
}))

vi.mock('@tanstack/react-router', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@tanstack/react-router')>()
  return {
    ...actual,
    createFileRoute: () => (opts: Record<string, unknown>) => ({
      options: opts,
    }),
    Link: ({ children, to }: { children: React.ReactNode; to: string }) => (
      <a href={to}>{children}</a>
    ),
  }
})

import {
  useWorkSchedules,
  useCreateWorkSchedule,
  useUpdateWorkSchedule,
  useDeactivateWorkSchedule,
} from '@/lib/hooks/useAttendance'

// ── Helpers ──────────────────────────────────────────────────────────────────

function makeSchedule(overrides: Partial<WorkScheduleListItem> = {}): WorkScheduleListItem {
  return {
    id: 'ws-1',
    name: 'Standard 9-5',
    work_days: [1, 2, 3, 4, 5],
    start_time: '09:00:00',
    end_time: '17:00:00',
    is_default: true,
    ...overrides,
  }
}

function setupMocks(schedules: WorkScheduleListItem[] = []) {
  vi.mocked(useWorkSchedules).mockReturnValue({
    data: schedules,
    isLoading: false,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any)

  vi.mocked(useCreateWorkSchedule).mockReturnValue({
    mutate: mockCreateMutate,
    isPending: false,
    isError: false,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any)

  vi.mocked(useUpdateWorkSchedule).mockReturnValue({
    mutate: mockUpdateMutate,
    isPending: false,
    isError: false,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any)

  vi.mocked(useDeactivateWorkSchedule).mockReturnValue({
    mutate: mockDeactivateMutate,
    isPending: false,
    isError: false,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any)
}

const { Route } = await import('./route')
const WorkSchedulesPage = Route.options.component as React.ComponentType

// ── Tests ────────────────────────────────────────────────────────────────────

describe('WorkSchedulesPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders empty state when no schedules', () => {
    setupMocks([])
    render(<WorkSchedulesPage />)
    expect(screen.getByText('No work schedules yet')).toBeTruthy()
  })

  it('renders schedule cards', () => {
    setupMocks([
      makeSchedule(),
      makeSchedule({ id: 'ws-2', name: 'Night Shift', is_default: false }),
    ])
    render(<WorkSchedulesPage />)
    expect(screen.getByText('Standard 9-5')).toBeTruthy()
    expect(screen.getByText('Night Shift')).toBeTruthy()
  })

  it('shows Default badge on default schedule', () => {
    setupMocks([makeSchedule()])
    render(<WorkSchedulesPage />)
    expect(screen.getByText('Default')).toBeTruthy()
  })

  it('shows work days and times', () => {
    setupMocks([makeSchedule()])
    render(<WorkSchedulesPage />)
    // "Mon, Tue, Wed, Thu, Fri · 09:00 – 17:00"
    expect(screen.getByText(/Mon.*Fri/)).toBeTruthy()
    expect(screen.getByText(/09:00/)).toBeTruthy()
  })

  it('does not show deactivate button for default schedule', () => {
    setupMocks([makeSchedule({ is_default: true })])
    render(<WorkSchedulesPage />)
    expect(screen.queryByTitle('Deactivate schedule')).toBeNull()
  })

  it('shows deactivate button for non-default schedule', () => {
    setupMocks([makeSchedule({ is_default: false })])
    render(<WorkSchedulesPage />)
    expect(screen.getByTitle('Deactivate schedule')).toBeTruthy()
  })

  it('opens create modal when Add Schedule is clicked', () => {
    setupMocks([])
    render(<WorkSchedulesPage />)
    fireEvent.click(screen.getByText('Add Schedule'))
    expect(screen.getByText('New Schedule')).toBeTruthy()
    expect(screen.getByText('Create Schedule')).toBeTruthy()
  })

  it('opens edit modal when edit button is clicked', () => {
    setupMocks([makeSchedule()])
    render(<WorkSchedulesPage />)
    fireEvent.click(screen.getByTitle('Edit schedule'))
    expect(screen.getByText('Edit Schedule')).toBeTruthy()
    expect(screen.getByDisplayValue('Standard 9-5')).toBeTruthy()
  })

  it('calls createMutation on form submit', async () => {
    setupMocks([])
    render(<WorkSchedulesPage />)
    fireEvent.click(screen.getByText('Add Schedule'))

    const nameInput = screen.getByPlaceholderText('e.g., Night Shift')
    fireEvent.change(nameInput, { target: { value: 'Morning Shift' } })

    fireEvent.click(screen.getByText('Create Schedule'))

    await waitFor(() => {
      expect(mockCreateMutate).toHaveBeenCalledWith(
        expect.objectContaining({ name: 'Morning Shift' }),
        expect.any(Object),
      )
    })
  })

  it('shows loading state', () => {
    vi.mocked(useWorkSchedules).mockReturnValue({
      data: undefined,
      isLoading: true,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any)
    setupMocks()
    vi.mocked(useWorkSchedules).mockReturnValue({
      data: undefined,
      isLoading: true,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any)
    render(<WorkSchedulesPage />)
    // Should show skeleton placeholders (animated divs)
    expect(screen.queryByText('No work schedules yet')).toBeNull()
  })

  it('renders back link to attendance', () => {
    setupMocks([])
    render(<WorkSchedulesPage />)
    const backLink = screen.getByText('Back to Attendance')
    expect(backLink.closest('a')?.getAttribute('href')).toBe('/attendance')
  })
})
