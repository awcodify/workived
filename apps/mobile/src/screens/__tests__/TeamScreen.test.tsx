import React from 'react'
import { render, screen, fireEvent } from '@testing-library/react-native'

jest.mock('@tanstack/react-query', () => ({
  useQuery: jest.fn(),
}))

jest.mock('@/api/client', () => ({
  apiClient: {
    getMobileHome: jest.fn(),
  },
}))

const mockNavigate = jest.fn()
jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({ navigate: mockNavigate, goBack: jest.fn() }),
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

jest.mock('@/contexts/AuthContext', () => ({
  useAuth: jest.fn(),
}))

jest.mock('@/components/ScorecardCard', () => ({
  ScorecardCard: () => {
    const mockReact = require('react')
    return mockReact.createElement('View', { testID: 'scorecard-card' })
  },
}))

jest.mock('@/components/LocationAnalyticsCard', () => ({
  LocationAnalyticsCard: () => {
    const mockReact = require('react')
    return mockReact.createElement('View', { testID: 'location-analytics-card' })
  },
}))

import { useQuery } from '@tanstack/react-query'
import { useAuth } from '@/contexts/AuthContext'
import TeamScreen from '../TeamScreen'
import type { MobileHomeData } from '@/types/api'

function makeHomeData(overrides: Partial<MobileHomeData> = {}): MobileHomeData {
  return {
    today: {
      date: '2026-04-20',
      day_of_week: 'Sunday',
      clock_in_time: null,
      clock_out_time: null,
      status: 'off',
      note: null,
    },
    week_attendance: {
      days: ['checked', 'checked', 'late', 'absent', 'absent'],
      percentage: 60,
    },
    pending_leaves: 0,
    pending_claims: 0,
    recent_attendance: [],
    ...overrides,
  }
}

function setup(homeResult: object, role = 'employee') {
  jest.mocked(useAuth).mockReturnValue({ user: { role }, isAuthenticated: true } as any)
  jest.mocked(useQuery).mockReturnValue(homeResult as ReturnType<typeof useQuery>)
}

describe('TeamScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockNavigate.mockClear()
  })

  it('shows skeleton while loading', () => {
    setup({ data: undefined, isLoading: true, isRefetching: false, refetch: jest.fn() })
    render(<TeamScreen />)
    expect(screen.getByTestId('team-screen-skeleton')).toBeTruthy()
  })

  it('renders week attendance card when data loaded', () => {
    setup({ data: makeHomeData(), isLoading: false, isRefetching: false, refetch: jest.fn() })
    render(<TeamScreen />)
    expect(screen.getByTestId('team-week-attendance')).toBeTruthy()
  })

  it('shows percentage text', () => {
    setup({ data: makeHomeData({ week_attendance: { days: ['checked', 'checked', 'late', 'absent', 'absent'], percentage: 60 } }), isLoading: false, isRefetching: false, refetch: jest.fn() })
    render(<TeamScreen />)
    expect(screen.getByText('60% on time')).toBeTruthy()
  })

  it('renders attendance correction nav button', () => {
    setup({ data: makeHomeData(), isLoading: false, isRefetching: false, refetch: jest.fn() })
    render(<TeamScreen />)
    expect(screen.getByTestId('team-correction-btn')).toBeTruthy()
  })

  it('navigates to AttendanceCorrection when button pressed', () => {
    setup({ data: makeHomeData(), isLoading: false, isRefetching: false, refetch: jest.fn() })
    render(<TeamScreen />)
    fireEvent.press(screen.getByTestId('team-correction-btn'))
    expect(mockNavigate).toHaveBeenCalledWith('AttendanceCorrection')
  })

  it('renders scorecard card', () => {
    setup({ data: makeHomeData(), isLoading: false, isRefetching: false, refetch: jest.fn() })
    render(<TeamScreen />)
    expect(screen.getByTestId('scorecard-card')).toBeTruthy()
  })

  it('shows team ranking button for manager', () => {
    setup({ data: makeHomeData(), isLoading: false, isRefetching: false, refetch: jest.fn() }, 'manager')
    render(<TeamScreen />)
    expect(screen.getByTestId('team-ranking-btn')).toBeTruthy()
  })

  it('hides team ranking button for regular employee', () => {
    setup({ data: makeHomeData(), isLoading: false, isRefetching: false, refetch: jest.fn() }, 'employee')
    render(<TeamScreen />)
    expect(screen.queryByTestId('team-ranking-btn')).toBeNull()
  })

  it('shows location analytics for manager', () => {
    setup({ data: makeHomeData(), isLoading: false, isRefetching: false, refetch: jest.fn() }, 'admin')
    render(<TeamScreen />)
    expect(screen.getByTestId('location-analytics-card')).toBeTruthy()
  })

  it('hides location analytics for regular employee', () => {
    setup({ data: makeHomeData(), isLoading: false, isRefetching: false, refetch: jest.fn() }, 'employee')
    render(<TeamScreen />)
    expect(screen.queryByTestId('location-analytics-card')).toBeNull()
  })

  it('prev week button decrements offset', () => {
    setup({ data: makeHomeData(), isLoading: false, isRefetching: false, refetch: jest.fn() })
    render(<TeamScreen />)
    fireEvent.press(screen.getByTestId('team-week-prev-btn'))
    expect(screen.getByText('Last Week')).toBeTruthy()
  })

  it('next week button disabled at current week', () => {
    setup({ data: makeHomeData(), isLoading: false, isRefetching: false, refetch: jest.fn() })
    render(<TeamScreen />)
    expect(screen.getByTestId('team-week-next-btn').props.accessibilityState?.disabled ??
           screen.getByTestId('team-week-next-btn').props.disabled).toBeTruthy()
  })

  it('navigates to TeamRanking when ranking button pressed', () => {
    setup({ data: makeHomeData(), isLoading: false, isRefetching: false, refetch: jest.fn() }, 'manager')
    render(<TeamScreen />)
    fireEvent.press(screen.getByTestId('team-ranking-btn'))
    expect(mockNavigate).toHaveBeenCalledWith('TeamRanking')
  })
})
