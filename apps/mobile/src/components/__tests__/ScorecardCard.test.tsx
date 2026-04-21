import React from 'react'
import { render, screen, fireEvent } from '@testing-library/react-native'

jest.mock('@tanstack/react-query', () => ({
  useQuery: jest.fn(),
}))

jest.mock('@/api/client', () => ({
  apiClient: { getMyScorecard: jest.fn() },
}))

jest.mock('@expo/vector-icons', () => ({
  Ionicons: ({ name, testID }: { name: string; testID?: string }) => {
    const mockReact = require('react')
    return mockReact.createElement('Text', { testID: testID || `icon-${name}` }, name)
  },
}))

import { useQuery } from '@tanstack/react-query'
import { ScorecardCard } from '../ScorecardCard'
import type { Scorecard } from '@/types/api'

function makeScorecard(overrides: Partial<Scorecard> = {}): Scorecard {
  return {
    employee_id: 'emp-1',
    employee_name: 'Alice',
    department: 'Engineering',
    period: 'this_month',
    period_label: 'April 2026',
    start_date: '2026-04-01',
    end_date: '2026-04-20',
    overall_score: 82,
    grade: 'B',
    trend: 5,
    breakdown: {
      attendance: { score: 90, detail: '18/20 days present' },
      punctuality: { score: 85, detail: '2 late arrivals' },
      leave: { score: 100, detail: 'No excess leave' },
      tasks: { score: 75, detail: '9/12 tasks completed' },
    },
    flags: [],
    sufficient: true,
    ...overrides,
  }
}

function setup(queryResult: object) {
  jest.mocked(useQuery).mockReturnValue(queryResult as ReturnType<typeof useQuery>)
}

describe('ScorecardCard', () => {
  beforeEach(() => jest.clearAllMocks())

  it('shows skeleton while loading', () => {
    setup({ data: undefined, isLoading: true, isError: false })
    render(<ScorecardCard />)
    expect(screen.getByTestId('scorecard-skeleton')).toBeTruthy()
  })

  it('renders nothing on error', () => {
    setup({ data: undefined, isLoading: false, isError: true })
    const { toJSON } = render(<ScorecardCard />)
    expect(toJSON()).toBeNull()
  })

  it('shows insufficient data state', () => {
    setup({
      data: { scorecard: makeScorecard({ sufficient: false }) },
      isLoading: false,
      isError: false,
    })
    render(<ScorecardCard />)
    expect(screen.getByTestId('scorecard-insufficient')).toBeTruthy()
    expect(screen.getByText(/Insufficient data/i)).toBeTruthy()
  })

  it('renders scorecard card with score, grade and bars', () => {
    setup({
      data: { scorecard: makeScorecard() },
      isLoading: false,
      isError: false,
    })
    render(<ScorecardCard />)
    expect(screen.getByTestId('scorecard-card')).toBeTruthy()
    expect(screen.getByText('82')).toBeTruthy()
    expect(screen.getByText('B')).toBeTruthy()
    expect(screen.getByTestId('scorecard-bar-Attendance')).toBeTruthy()
    expect(screen.getByTestId('scorecard-bar-Punctuality')).toBeTruthy()
    expect(screen.getByTestId('scorecard-bar-Leave')).toBeTruthy()
    expect(screen.getByTestId('scorecard-bar-Tasks')).toBeTruthy()
  })

  it('shows period label', () => {
    setup({
      data: { scorecard: makeScorecard() },
      isLoading: false,
      isError: false,
    })
    render(<ScorecardCard />)
    expect(screen.getByText('April 2026')).toBeTruthy()
  })

  it('shows positive trend', () => {
    setup({
      data: { scorecard: makeScorecard({ trend: 8 }) },
      isLoading: false,
      isError: false,
    })
    render(<ScorecardCard />)
    expect(screen.getByText('+8')).toBeTruthy()
  })

  it('shows negative trend', () => {
    setup({
      data: { scorecard: makeScorecard({ trend: -3 }) },
      isLoading: false,
      isError: false,
    })
    render(<ScorecardCard />)
    expect(screen.getByText('-3')).toBeTruthy()
  })

  it('shows flag pills when flags present', () => {
    setup({
      data: {
        scorecard: makeScorecard({
          flags: [
            { type: 'late', message: 'Late 4 times', severity: 'warning' },
            { type: 'tasks', message: 'Low task completion', severity: 'alert' },
          ],
        }),
      },
      isLoading: false,
      isError: false,
    })
    render(<ScorecardCard />)
    expect(screen.getByText('Late 4 times')).toBeTruthy()
    expect(screen.getByText('Low task completion')).toBeTruthy()
  })

  it('opens detail modal when card is tapped', () => {
    setup({
      data: { scorecard: makeScorecard() },
      isLoading: false,
      isError: false,
    })
    render(<ScorecardCard />)
    fireEvent.press(screen.getByTestId('scorecard-card'))
    expect(screen.getByTestId('scorecard-detail-modal')).toBeTruthy()
  })

  it('detail modal shows all category breakdowns', () => {
    setup({
      data: { scorecard: makeScorecard() },
      isLoading: false,
      isError: false,
    })
    render(<ScorecardCard />)
    fireEvent.press(screen.getByTestId('scorecard-card'))
    expect(screen.getByTestId('scorecard-category-attendance')).toBeTruthy()
    expect(screen.getByTestId('scorecard-category-punctuality')).toBeTruthy()
    expect(screen.getByTestId('scorecard-category-leave')).toBeTruthy()
    expect(screen.getByTestId('scorecard-category-tasks')).toBeTruthy()
  })

  it('closes detail modal when close button tapped', () => {
    setup({
      data: { scorecard: makeScorecard() },
      isLoading: false,
      isError: false,
    })
    render(<ScorecardCard />)
    fireEvent.press(screen.getByTestId('scorecard-card'))
    fireEvent.press(screen.getByTestId('scorecard-detail-close-btn'))
    expect(screen.queryByTestId('scorecard-detail-modal')).toBeNull()
  })

  it('detail modal shows flags', () => {
    setup({
      data: {
        scorecard: makeScorecard({
          flags: [{ type: 'late', message: 'Late 4 times', severity: 'alert' }],
        }),
      },
      isLoading: false,
      isError: false,
    })
    render(<ScorecardCard />)
    fireEvent.press(screen.getByTestId('scorecard-card'))
    expect(screen.getByTestId('scorecard-flag-0')).toBeTruthy()
  })
})
