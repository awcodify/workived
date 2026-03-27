import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import React from 'react'

// Mock TanStack Router
vi.mock('@tanstack/react-router', () => ({
  createFileRoute: () => () => ({ component: undefined }),
  Link: ({ children, to }: { children: React.ReactNode; to: string }) => (
    <a href={to}>{children}</a>
  ),
}))

// Mock data
const mockCalendarData = [
  {
    employee_id: 'emp1',
    employee_name: 'Ahmad Rizki',
    policy_name: 'Annual Leave',
    start_date: '2026-03-20',
    end_date: '2026-03-22',
    total_days: 2,
  },
  {
    employee_id: 'emp2',
    employee_name: 'Sarah Chen',
    policy_name: 'Sick Leave',
    start_date: '2026-03-21',
    end_date: '2026-03-21',
    total_days: 1,
  },
]

const mockHolidays = [
  { country_code: 'ID', date: '2026-03-23', name: 'Nyepi' },
]

vi.mock('@/lib/hooks/useLeave', () => ({
  useCalendar: vi.fn(() => ({ data: mockCalendarData, isLoading: false })),
}))

vi.mock('@/lib/hooks/useCalendarHolidays', () => ({
  useCalendarHolidays: vi.fn(() => ({ data: mockHolidays, isLoading: false })),
}))

vi.mock('@/lib/hooks/useOrganisation', () => ({
  useOrganisation: vi.fn(() => ({ data: { country_code: 'ID' } })),
}))

vi.mock('@/lib/hooks/useRole', () => ({
  useCanManageLeave: vi.fn(() => true),
}))

vi.mock('@/design/tokens', async () => {
  const actual = await vi.importActual('@/design/tokens')
  return actual
})

vi.mock('@/components/workived/shared/DateTime', () => ({
  DateTime: () => <div data-testid="datetime" />,
}))

vi.mock('@/components/workived/shared/NotificationBell', () => ({
  NotificationBell: () => <div data-testid="notification-bell" />,
}))

function renderWithProviders(ui: React.ReactElement) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(<QueryClientProvider client={qc}>{ui}</QueryClientProvider>)
}

describe('CalendarPage', () => {
  it('renders calendar title', async () => {
    const mod = await import('./index')
    const CalendarPage = (mod.Route as { options?: { component?: React.FC } })?.options?.component
    if (!CalendarPage) return
    renderWithProviders(<CalendarPage />)
    expect(screen.getByText('Calendar')).toBeInTheDocument()
  })

  it('renders manage holidays button for admins', async () => {
    const mod = await import('./index')
    const CalendarPage = (mod.Route as { options?: { component?: React.FC } })?.options?.component
    if (!CalendarPage) return
    renderWithProviders(<CalendarPage />)
    expect(screen.getByText('Manage Holidays')).toBeInTheDocument()
  })

  it('renders today button', async () => {
    const mod = await import('./index')
    const CalendarPage = (mod.Route as { options?: { component?: React.FC } })?.options?.component
    if (!CalendarPage) return
    renderWithProviders(<CalendarPage />)
    expect(screen.getByText('Today')).toBeInTheDocument()
  })

  it('renders day headers', async () => {
    const mod = await import('./index')
    const CalendarPage = (mod.Route as { options?: { component?: React.FC } })?.options?.component
    if (!CalendarPage) return
    renderWithProviders(<CalendarPage />)
    expect(screen.getByText('Sun')).toBeInTheDocument()
    expect(screen.getByText('Mon')).toBeInTheDocument()
    expect(screen.getByText('Sat')).toBeInTheDocument()
  })

  it('renders leave type legend', async () => {
    const mod = await import('./index')
    const CalendarPage = (mod.Route as { options?: { component?: React.FC } })?.options?.component
    if (!CalendarPage) return
    renderWithProviders(<CalendarPage />)
    expect(screen.getByText('Leave Types')).toBeInTheDocument()
    expect(screen.getByText('Annual Leave')).toBeInTheDocument()
    expect(screen.getByText('Sick Leave')).toBeInTheDocument()
  })

  it('shows country name from holidays', async () => {
    const mod = await import('./index')
    const CalendarPage = (mod.Route as { options?: { component?: React.FC } })?.options?.component
    if (!CalendarPage) return
    renderWithProviders(<CalendarPage />)
    expect(screen.getByText(/Holidays: Indonesia/)).toBeInTheDocument()
  })
})
