import React from 'react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import type { WorkScheduleListItem } from '@/types/api'
import { WorkSchedulesPanel } from './WorkSchedulesPanel'

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

const onClose = vi.fn()

// ── Tests ────────────────────────────────────────────────────────────────────

describe('WorkSchedulesPanel', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders empty state when no schedules', () => {
    setupMocks([])
    render(<WorkSchedulesPanel onClose={onClose} />)
    expect(screen.getByText('No work schedules yet')).toBeTruthy()
  })

  it('renders schedule cards', () => {
    setupMocks([
      makeSchedule(),
      makeSchedule({ id: 'ws-2', name: 'Night Shift', is_default: false }),
    ])
    render(<WorkSchedulesPanel onClose={onClose} />)
    expect(screen.getByText('Standard 9-5')).toBeTruthy()
    expect(screen.getByText('Night Shift')).toBeTruthy()
  })

  it('shows Default badge on default schedule', () => {
    setupMocks([makeSchedule()])
    render(<WorkSchedulesPanel onClose={onClose} />)
    expect(screen.getByText('Default')).toBeTruthy()
  })

  it('shows work days and times', () => {
    setupMocks([makeSchedule()])
    render(<WorkSchedulesPanel onClose={onClose} />)
    expect(screen.getByText(/Mon.*Fri/)).toBeTruthy()
    expect(screen.getByText(/09:00/)).toBeTruthy()
  })

  it('does not show deactivate button for default schedule', () => {
    setupMocks([makeSchedule({ is_default: true })])
    render(<WorkSchedulesPanel onClose={onClose} />)
    expect(screen.queryByTitle('Deactivate schedule')).toBeNull()
  })

  it('shows deactivate button for non-default schedule', () => {
    setupMocks([makeSchedule({ is_default: false })])
    render(<WorkSchedulesPanel onClose={onClose} />)
    expect(screen.getByTitle('Deactivate schedule')).toBeTruthy()
  })

  it('opens create modal when Add Schedule is clicked', () => {
    setupMocks([])
    render(<WorkSchedulesPanel onClose={onClose} />)
    fireEvent.click(screen.getByText('Add Schedule'))
    expect(screen.getByText('New Schedule')).toBeTruthy()
    expect(screen.getByText('Create Schedule')).toBeTruthy()
  })

  it('opens edit modal when edit button is clicked', () => {
    setupMocks([makeSchedule()])
    render(<WorkSchedulesPanel onClose={onClose} />)
    fireEvent.click(screen.getByTitle('Edit schedule'))
    expect(screen.getByText('Edit Schedule')).toBeTruthy()
    expect(screen.getByDisplayValue('Standard 9-5')).toBeTruthy()
  })

  it('calls createMutation on form submit', async () => {
    setupMocks([])
    render(<WorkSchedulesPanel onClose={onClose} />)
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
    setupMocks()
    vi.mocked(useWorkSchedules).mockReturnValue({
      data: undefined,
      isLoading: true,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any)
    render(<WorkSchedulesPanel onClose={onClose} />)
    expect(screen.queryByText('No work schedules yet')).toBeNull()
  })

  it('calls onClose when X button is clicked', () => {
    setupMocks([])
    render(<WorkSchedulesPanel onClose={onClose} />)
    // The X button is in the header
    const buttons = screen.getAllByRole('button')
    // First button should be the close button (X icon)
    const closeButton = buttons.find(b => b.querySelector('svg.lucide-x'))
    if (closeButton) fireEvent.click(closeButton)
    expect(onClose).toHaveBeenCalled()
  })
})
