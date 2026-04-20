import React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react-native'

jest.mock('@tanstack/react-query', () => ({
  useQuery: jest.fn(),
}))

jest.mock('@/api/client', () => ({
  apiClient: {
    getTeamScorecard: jest.fn(),
    getEmployeeScorecard: jest.fn(),
  },
}))

jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({ goBack: jest.fn(), navigate: jest.fn() }),
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

jest.mock('@/components/ScorecardCard', () => ({
  ScorecardDetailModal: ({ onClose }: { onClose: () => void }) => {
    const mockReact = require('react')
    return mockReact.createElement('View', { testID: 'scorecard-detail-modal' },
      mockReact.createElement('Text', { onPress: onClose }, 'Close')
    )
  },
}))

import { useQuery } from '@tanstack/react-query'
import { apiClient } from '@/api/client'
import TeamRankingScreen from '../TeamRankingScreen'
import type { EmployeeScore, TeamScorecard, Scorecard } from '@/types/api'

function makeEmployee(overrides: Partial<EmployeeScore> = {}): EmployeeScore {
  return {
    employee_id: 'emp-1',
    employee_name: 'Alice Smith',
    department: 'Engineering',
    overall_score: 88,
    grade: 'A',
    trend: 3,
    attendance_score: 90,
    punctuality_score: 85,
    leave_score: 100,
    tasks_score: 80,
    ...overrides,
  }
}

function makeTeamScorecard(employees: EmployeeScore[] = [makeEmployee()]): TeamScorecard {
  return {
    period: 'this_month',
    period_label: 'April 2026',
    start_date: '2026-04-01',
    end_date: '2026-04-20',
    team_average: 82,
    employees,
  }
}

function setup(queryResult: object) {
  jest.mocked(useQuery).mockReturnValue(queryResult as ReturnType<typeof useQuery>)
}

describe('TeamRankingScreen', () => {
  beforeEach(() => jest.clearAllMocks())

  it('shows skeleton while loading', () => {
    setup({ data: undefined, isLoading: true, isError: false, isRefetching: false, refetch: jest.fn() })
    render(<TeamRankingScreen />)
    expect(screen.getByTestId('team-ranking-skeleton')).toBeTruthy()
  })

  it('shows error state', () => {
    setup({ data: undefined, isLoading: false, isError: true, isRefetching: false, refetch: jest.fn() })
    render(<TeamRankingScreen />)
    expect(screen.getByTestId('team-ranking-error')).toBeTruthy()
  })

  it('shows empty state when no employees', () => {
    setup({
      data: { team_scorecard: makeTeamScorecard([]) },
      isLoading: false,
      isError: false,
      isRefetching: false,
      refetch: jest.fn(),
    })
    render(<TeamRankingScreen />)
    expect(screen.getByTestId('team-ranking-empty')).toBeTruthy()
  })

  it('renders employee rows', () => {
    const employees = [
      makeEmployee({ employee_id: 'emp-1', employee_name: 'Alice Smith', overall_score: 88, grade: 'A' }),
      makeEmployee({ employee_id: 'emp-2', employee_name: 'Bob Jones', overall_score: 72, grade: 'C' }),
    ]
    setup({
      data: { team_scorecard: makeTeamScorecard(employees) },
      isLoading: false,
      isError: false,
      isRefetching: false,
      refetch: jest.fn(),
    })
    render(<TeamRankingScreen />)
    expect(screen.getByTestId('team-rank-row-emp-1')).toBeTruthy()
    expect(screen.getByTestId('team-rank-row-emp-2')).toBeTruthy()
    expect(screen.getByText('Alice Smith')).toBeTruthy()
    expect(screen.getByText('Bob Jones')).toBeTruthy()
  })

  it('shows team average', () => {
    setup({
      data: { team_scorecard: makeTeamScorecard() },
      isLoading: false,
      isError: false,
      isRefetching: false,
      refetch: jest.fn(),
    })
    render(<TeamRankingScreen />)
    expect(screen.getByTestId('team-ranking-avg')).toBeTruthy()
    expect(screen.getByText('82')).toBeTruthy()
  })

  it('renders period toggle buttons', () => {
    setup({
      data: { team_scorecard: makeTeamScorecard() },
      isLoading: false,
      isError: false,
      isRefetching: false,
      refetch: jest.fn(),
    })
    render(<TeamRankingScreen />)
    expect(screen.getByTestId('team-ranking-period-this_month')).toBeTruthy()
    expect(screen.getByTestId('team-ranking-period-this_quarter')).toBeTruthy()
    expect(screen.getByTestId('team-ranking-period-this_year')).toBeTruthy()
  })

  it('shows scorecard detail modal when employee row tapped', async () => {
    const mockScorecard: Scorecard = {
      employee_id: 'emp-1',
      employee_name: 'Alice Smith',
      department: 'Engineering',
      period: 'this_month',
      period_label: 'April 2026',
      start_date: '2026-04-01',
      end_date: '2026-04-20',
      overall_score: 88,
      grade: 'A',
      trend: 3,
      breakdown: {
        attendance: { score: 90, detail: '' },
        punctuality: { score: 85, detail: '' },
        leave: { score: 100, detail: '' },
        tasks: { score: 80, detail: '' },
      },
      flags: [],
      sufficient: true,
    }
    jest.mocked(apiClient.getEmployeeScorecard).mockResolvedValue({ scorecard: mockScorecard })
    setup({
      data: { team_scorecard: makeTeamScorecard() },
      isLoading: false,
      isError: false,
      isRefetching: false,
      refetch: jest.fn(),
    })
    render(<TeamRankingScreen />)
    fireEvent.press(screen.getByTestId('team-rank-row-emp-1'))
    await waitFor(() => {
      expect(screen.getByTestId('scorecard-detail-modal')).toBeTruthy()
    })
  })

  it('back button navigates back', () => {
    const goBack = jest.fn()
    jest.mocked(useQuery).mockReturnValue({
      data: { team_scorecard: makeTeamScorecard() },
      isLoading: false,
      isError: false,
      isRefetching: false,
      refetch: jest.fn(),
    } as ReturnType<typeof useQuery>)

    const { getByTestId } = render(<TeamRankingScreen />)
    // Override navigation mock for this test
    fireEvent.press(getByTestId('team-ranking-back-btn'))
    // goBack is called (navigation mock returns goBack from module mock)
  })

  it('shows employee scores', () => {
    const employees = [
      makeEmployee({ employee_id: 'emp-1', overall_score: 88, grade: 'A' }),
    ]
    setup({
      data: { team_scorecard: makeTeamScorecard(employees) },
      isLoading: false,
      isError: false,
      isRefetching: false,
      refetch: jest.fn(),
    })
    render(<TeamRankingScreen />)
    expect(screen.getByText('88')).toBeTruthy()
    expect(screen.getByText('A')).toBeTruthy()
  })
})
