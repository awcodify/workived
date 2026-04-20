import React from 'react'
import { render, screen, fireEvent } from '@testing-library/react-native'

jest.mock('@tanstack/react-query', () => ({
  useQuery: jest.fn(),
}))

jest.mock('@/api/client', () => ({
  apiClient: { getMyCorrections: jest.fn() },
}))

const mockGoBack = jest.fn()
jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({ goBack: mockGoBack, navigate: jest.fn() }),
}))

jest.mock('react-native-safe-area-context', () => ({
  SafeAreaView: ({ children, testID }: { children: unknown; testID?: string }) => {
    const mockReact = require('react')
    return mockReact.createElement('View', { testID }, children)
  },
}))

jest.mock('@expo/vector-icons', () => ({
  Ionicons: ({ name }: { name: string }) => {
    const mockReact = require('react')
    return mockReact.createElement('Text', {}, name)
  },
}))

jest.mock('@/components/CorrectionBottomSheet', () => ({
  CorrectionBottomSheet: ({ visible, onClose }: { visible: boolean; onClose: () => void }) => {
    const mockReact = require('react')
    if (!visible) return null
    return mockReact.createElement('View', { testID: 'correction-sheet' },
      mockReact.createElement('Text', { testID: 'correction-close-btn', onPress: onClose }, 'Close')
    )
  },
}))

import { useQuery } from '@tanstack/react-query'
import AttendanceCorrectionScreen from '../AttendanceCorrectionScreen'
import type { AttendanceCorrection } from '@/types/api'

function makeCorrection(overrides: Partial<AttendanceCorrection> = {}): AttendanceCorrection {
  return {
    id: 'cor-1',
    organisation_id: 'org-1',
    employee_id: 'emp-1',
    employee_name: 'Alice',
    date: '2026-04-18T00:00:00Z',
    reason: 'Forgot to clock in due to network issue',
    status: 'pending',
    created_at: '2026-04-18T10:00:00Z',
    updated_at: '2026-04-18T10:00:00Z',
    ...overrides,
  }
}

function setup(result: object) {
  jest.mocked(useQuery).mockReturnValue(result as ReturnType<typeof useQuery>)
}

describe('AttendanceCorrectionScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockGoBack.mockClear()
  })

  it('renders screen', () => {
    setup({ data: { data: [] }, isLoading: false, isRefetching: false, refetch: jest.fn() })
    render(<AttendanceCorrectionScreen />)
    expect(screen.getByTestId('attendance-correction-screen')).toBeTruthy()
  })

  it('shows skeleton while loading', () => {
    setup({ data: undefined, isLoading: true, isRefetching: false, refetch: jest.fn() })
    render(<AttendanceCorrectionScreen />)
    expect(screen.getByTestId('correction-screen-skeleton')).toBeTruthy()
  })

  it('shows empty state when no corrections', () => {
    setup({ data: { data: [] }, isLoading: false, isRefetching: false, refetch: jest.fn() })
    render(<AttendanceCorrectionScreen />)
    expect(screen.getByTestId('correction-screen-empty')).toBeTruthy()
  })

  it('renders request button', () => {
    setup({ data: { data: [] }, isLoading: false, isRefetching: false, refetch: jest.fn() })
    render(<AttendanceCorrectionScreen />)
    expect(screen.getByTestId('correction-screen-request-btn')).toBeTruthy()
  })

  it('opens bottom sheet when request button pressed', () => {
    setup({ data: { data: [] }, isLoading: false, isRefetching: false, refetch: jest.fn() })
    render(<AttendanceCorrectionScreen />)
    fireEvent.press(screen.getByTestId('correction-screen-request-btn'))
    expect(screen.getByTestId('correction-sheet')).toBeTruthy()
  })

  it('closes bottom sheet when onClose called', () => {
    setup({ data: { data: [] }, isLoading: false, isRefetching: false, refetch: jest.fn() })
    render(<AttendanceCorrectionScreen />)
    fireEvent.press(screen.getByTestId('correction-screen-request-btn'))
    fireEvent.press(screen.getByTestId('correction-close-btn'))
    expect(screen.queryByTestId('correction-sheet')).toBeNull()
  })

  it('renders correction cards when data exists', () => {
    setup({ data: { data: [makeCorrection()] }, isLoading: false, isRefetching: false, refetch: jest.fn() })
    render(<AttendanceCorrectionScreen />)
    expect(screen.getByTestId('correction-item-cor-1')).toBeTruthy()
  })

  it('shows pending status badge', () => {
    setup({ data: { data: [makeCorrection({ status: 'pending' })] }, isLoading: false, isRefetching: false, refetch: jest.fn() })
    render(<AttendanceCorrectionScreen />)
    expect(screen.getByText('Pending')).toBeTruthy()
  })

  it('shows approved status badge', () => {
    setup({ data: { data: [makeCorrection({ status: 'approved' })] }, isLoading: false, isRefetching: false, refetch: jest.fn() })
    render(<AttendanceCorrectionScreen />)
    expect(screen.getByText('Approved')).toBeTruthy()
  })

  it('shows rejected status badge', () => {
    setup({ data: { data: [makeCorrection({ status: 'rejected' })] }, isLoading: false, isRefetching: false, refetch: jest.fn() })
    render(<AttendanceCorrectionScreen />)
    expect(screen.getByText('Rejected')).toBeTruthy()
  })

  it('shows rejection reason when rejected', () => {
    setup({
      data: { data: [makeCorrection({ status: 'rejected', rejection_reason: 'Not enough evidence' })] },
      isLoading: false, isRefetching: false, refetch: jest.fn(),
    })
    render(<AttendanceCorrectionScreen />)
    expect(screen.getByText('Not enough evidence')).toBeTruthy()
  })

  it('shows requested times when provided', () => {
    setup({
      data: {
        data: [makeCorrection({
          requested_clock_in: '2026-04-18T09:00:00Z',
          requested_clock_out: '2026-04-18T18:00:00Z',
        })],
      },
      isLoading: false, isRefetching: false, refetch: jest.fn(),
    })
    render(<AttendanceCorrectionScreen />)
    expect(screen.getByTestId('correction-item-cor-1')).toBeTruthy()
  })

  it('shows reason text', () => {
    setup({ data: { data: [makeCorrection()] }, isLoading: false, isRefetching: false, refetch: jest.fn() })
    render(<AttendanceCorrectionScreen />)
    expect(screen.getByText('Forgot to clock in due to network issue')).toBeTruthy()
  })

  it('back button calls goBack', () => {
    setup({ data: { data: [] }, isLoading: false, isRefetching: false, refetch: jest.fn() })
    render(<AttendanceCorrectionScreen />)
    fireEvent.press(screen.getByTestId('correction-screen-back-btn'))
    expect(mockGoBack).toHaveBeenCalled()
  })
})
