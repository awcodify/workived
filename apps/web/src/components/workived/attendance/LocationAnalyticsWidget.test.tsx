import { render, screen, fireEvent } from '@testing-library/react'
import { vi, describe, it, expect, beforeEach } from 'vitest'
import { LocationAnalyticsWidget } from './LocationAnalyticsWidget'

vi.mock('@/design/tokens', () => ({
  moduleThemes: {
    attendance: {
      surface: '#fff',
      border: '#e5e7eb',
      text: '#111',
      textMuted: '#6b7280',
      accent: '#6357E8',
      accentText: '#fff',
    },
  },
  colors: {
    ok: '#12A05C',
    accent: '#6357E8',
    warn: '#C97B2A',
    err: '#D44040',
  },
}))

vi.mock('@/lib/hooks/useAttendance', () => ({
  useLocationAnalytics: vi.fn(),
}))

vi.mock('recharts', () => ({
  PieChart: ({ children }: { children: React.ReactNode }) => <div data-testid="pie-chart">{children}</div>,
  Pie: ({ children }: { children: React.ReactNode }) => <div data-testid="pie">{children}</div>,
  Cell: () => <div data-testid="cell" />,
  Tooltip: () => null,
  ResponsiveContainer: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="responsive-container">{children}</div>
  ),
}))

vi.mock('@/components/workived/shared/Skeleton', () => ({
  Skeleton: ({ height, width }: { height?: number; width?: number | string }) => (
    <div data-testid="skeleton" style={{ height, width }} />
  ),
}))

import { useLocationAnalytics } from '@/lib/hooks/useAttendance'

const mockUseLocationAnalytics = useLocationAnalytics as ReturnType<typeof vi.fn>

describe('LocationAnalyticsWidget', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders loading skeletons while fetching', () => {
    mockUseLocationAnalytics.mockReturnValue({ data: undefined, isLoading: true })

    render(<LocationAnalyticsWidget />)

    expect(screen.getAllByTestId('skeleton').length).toBeGreaterThan(0)
  })

  it('renders empty state when total is 0', () => {
    mockUseLocationAnalytics.mockReturnValue({
      data: { total: 0, breakdown: [], start_date: '2026-04-01', end_date: '2026-04-07' },
      isLoading: false,
    })

    render(<LocationAnalyticsWidget />)

    expect(screen.getByText(/no clock-in data/i)).toBeInTheDocument()
  })

  it('renders chart and legend when data is available', () => {
    mockUseLocationAnalytics.mockReturnValue({
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
    })

    render(<LocationAnalyticsWidget />)

    expect(screen.getByTestId('pie-chart')).toBeInTheDocument()
    expect(screen.getByText('Office')).toBeInTheDocument()
    expect(screen.getByText('WFH')).toBeInTheDocument()
    expect(screen.getByText('Remote')).toBeInTheDocument()
    expect(screen.getByText('60%')).toBeInTheDocument()
    expect(screen.getByText('30%')).toBeInTheDocument()
    expect(screen.getByText('10%')).toBeInTheDocument()
  })

  it('shows total and date range in header when data is available', () => {
    mockUseLocationAnalytics.mockReturnValue({
      data: {
        total: 5,
        breakdown: [{ type: 'office', count: 5, percentage: 100 }],
        start_date: '2026-04-01',
        end_date: '2026-04-07',
      },
      isLoading: false,
    })

    render(<LocationAnalyticsWidget />)

    expect(screen.getByText(/5 clock-ins/i)).toBeInTheDocument()
  })

  it('toggles between week and month periods', () => {
    mockUseLocationAnalytics.mockReturnValue({ data: undefined, isLoading: false })

    render(<LocationAnalyticsWidget />)

    const monthButton = screen.getByRole('button', { name: 'Month' })
    fireEvent.click(monthButton)

    expect(mockUseLocationAnalytics).toHaveBeenLastCalledWith('this_month')
  })

  it('renders Work Location heading', () => {
    mockUseLocationAnalytics.mockReturnValue({ data: undefined, isLoading: false })

    render(<LocationAnalyticsWidget />)

    expect(screen.getByText('Work Location')).toBeInTheDocument()
  })

  it('renders period toggle buttons', () => {
    mockUseLocationAnalytics.mockReturnValue({ data: undefined, isLoading: false })

    render(<LocationAnalyticsWidget />)

    expect(screen.getByRole('button', { name: 'Week' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Month' })).toBeInTheDocument()
  })

  it('applies custom className', () => {
    mockUseLocationAnalytics.mockReturnValue({ data: undefined, isLoading: false })

    const { container } = render(<LocationAnalyticsWidget className="custom-class" />)

    expect(container.firstChild).toHaveClass('custom-class')
  })
})
