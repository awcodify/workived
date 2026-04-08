import { render, screen, fireEvent } from '@testing-library/react-native'
import { useQuery } from '@tanstack/react-query'
import { LocationAnalyticsCard } from '../LocationAnalyticsCard'

jest.mock('@tanstack/react-query')
jest.mock('@/api/client')

const mockUseQuery = useQuery as jest.MockedFunction<typeof useQuery>

describe('LocationAnalyticsCard', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('shows loading indicator while fetching', () => {
    mockUseQuery.mockReturnValue({ data: undefined, isLoading: true } as any)

    render(<LocationAnalyticsCard />)

    // No empty state or data rows visible while loading
    expect(screen.queryByText('No clock-in data for this period')).toBeNull()
    expect(screen.queryByText('Office')).toBeNull()
  })

  it('shows empty state when total is 0', () => {
    mockUseQuery.mockReturnValue({
      data: { total: 0, breakdown: [], start_date: '2026-04-01', end_date: '2026-04-07' },
      isLoading: false,
    } as any)

    render(<LocationAnalyticsCard />)

    expect(screen.getByText('No clock-in data for this period')).toBeTruthy()
  })

  it('renders legend rows when data is available', () => {
    mockUseQuery.mockReturnValue({
      data: {
        total: 10,
        breakdown: [
          { type: 'office', count: 6, percentage: 60 },
          { type: 'wfh', count: 3, percentage: 30 },
          { type: 'remote', count: 1, percentage: 10 },
        ],
        start_date: '2026-04-01',
        end_date: '2026-04-07',
      },
      isLoading: false,
    } as any)

    render(<LocationAnalyticsCard />)

    expect(screen.getByText('Office')).toBeTruthy()
    expect(screen.getByText('WFH')).toBeTruthy()
    expect(screen.getAllByText('Remote').length).toBeGreaterThan(0)
    expect(screen.getByText('60%')).toBeTruthy()
    expect(screen.getByText('30%')).toBeTruthy()
    expect(screen.getByText('10%')).toBeTruthy()
  })

  it('shows total and date range subtitle', () => {
    mockUseQuery.mockReturnValue({
      data: {
        total: 5,
        breakdown: [{ type: 'office', count: 5, percentage: 100 }],
        start_date: '2026-04-01',
        end_date: '2026-04-07',
      },
      isLoading: false,
    } as any)

    render(<LocationAnalyticsCard />)

    expect(screen.getByText(/5 clock-ins/)).toBeTruthy()
  })

  it('renders Work Location heading', () => {
    mockUseQuery.mockReturnValue({ data: undefined, isLoading: false } as any)

    render(<LocationAnalyticsCard />)

    expect(screen.getByText('Work Location')).toBeTruthy()
  })

  it('renders Week and Month toggle buttons', () => {
    mockUseQuery.mockReturnValue({ data: undefined, isLoading: false } as any)

    render(<LocationAnalyticsCard />)

    expect(screen.getByText('Week')).toBeTruthy()
    expect(screen.getByText('Month')).toBeTruthy()
  })

  it('switches period when Month is tapped', () => {
    mockUseQuery.mockReturnValue({ data: undefined, isLoading: false } as any)

    render(<LocationAnalyticsCard />)

    fireEvent.press(screen.getByText('Month'))

    expect(mockUseQuery).toHaveBeenLastCalledWith(
      expect.objectContaining({ queryKey: ['location-analytics', 'this_month'] })
    )
  })

  it('maps unknown location type to grey fallback label', () => {
    mockUseQuery.mockReturnValue({
      data: {
        total: 2,
        breakdown: [{ type: 'unknown', count: 2, percentage: 100 }],
        start_date: '2026-04-01',
        end_date: '2026-04-07',
      },
      isLoading: false,
    } as any)

    render(<LocationAnalyticsCard />)

    expect(screen.getByText('Unknown')).toBeTruthy()
  })
})
