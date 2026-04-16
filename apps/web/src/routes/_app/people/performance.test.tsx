import React from 'react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'

// ── Mocks ─────────────────────────────────────────────────────────────────────

vi.mock('@tanstack/react-router', () => ({
  createFileRoute: () => (opts: { component: React.ComponentType }) => ({ options: opts }),
  redirect: vi.fn((args: { to: string }) => args),
  useMatches: vi.fn(() => [{ pathname: '/people/performance' }]),
  Link: ({ children, ...props }: { children: React.ReactNode; [key: string]: unknown }) => <a {...props}>{children}</a>,
}))

vi.mock('@/lib/hooks/useReports', () => ({
  useCompanySummary: vi.fn(),
  useTeamScorecard: vi.fn(),
  useMyScorecard: vi.fn(),
  useEmployeeScorecard: vi.fn(),
  useScorecardConfig: vi.fn(),
}))

vi.mock('@/lib/api/client', () => ({
  apiClient: { get: vi.fn() },
}))

vi.mock('recharts', () => ({
  PieChart: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  Pie: () => null,
  Cell: () => null,
}))

vi.mock('@/design/tokens', () => ({
  moduleBackgrounds: { people: '#F5F0E8' },
  typography: { display: { size: '2rem', tracking: '-0.02em', lineHeight: 1.1 }, h2: { size: '1.25rem', tracking: '-0.01em', lineHeight: 1.2 }, fontMono: 'monospace' },
  colors: { accent: '#6357E8', err: '#D44040' },
  gradeColors: { A: '#12A05C', B: '#6357E8', C: '#C97B2A', D: '#D44040' },
  gradeColorsDim: { A: '#12A05C18', B: '#6357E818', C: '#C97B2A18', D: '#D4404018' },
  getAvatarColor: () => ({ bg: '#6357E818', text: '#6357E8' }),
}))

// ── Import after mocks ────────────────────────────────────────────────────────

import {
  useCompanySummary,
  useTeamScorecard,
  useMyScorecard,
  useScorecardConfig,
  useEmployeeScorecard,
} from '@/lib/hooks/useReports'
import { Route } from './performance'

const PerformancePage = Route.options.component as React.ComponentType

// ── Fixtures ──────────────────────────────────────────────────────────────────

function setupLoading() {
  vi.mocked(useCompanySummary).mockReturnValue({ data: undefined, isLoading: true, error: null } as ReturnType<typeof useCompanySummary>)
  vi.mocked(useTeamScorecard).mockReturnValue({ data: undefined, isLoading: true, error: null } as ReturnType<typeof useTeamScorecard>)
  vi.mocked(useMyScorecard).mockReturnValue({ data: undefined } as ReturnType<typeof useMyScorecard>)
  vi.mocked(useScorecardConfig).mockReturnValue({ data: undefined } as ReturnType<typeof useScorecardConfig>)
  vi.mocked(useEmployeeScorecard).mockReturnValue({ data: undefined, isLoading: false } as ReturnType<typeof useEmployeeScorecard>)
}

function setupEmpty() {
  vi.mocked(useCompanySummary).mockReturnValue({ data: undefined, isLoading: false, error: null } as ReturnType<typeof useCompanySummary>)
  vi.mocked(useTeamScorecard).mockReturnValue({ data: { employees: [], team_average: 0 }, isLoading: false, error: null } as ReturnType<typeof useTeamScorecard>)
  vi.mocked(useMyScorecard).mockReturnValue({ data: undefined } as ReturnType<typeof useMyScorecard>)
  vi.mocked(useScorecardConfig).mockReturnValue({ data: undefined } as ReturnType<typeof useScorecardConfig>)
  vi.mocked(useEmployeeScorecard).mockReturnValue({ data: undefined, isLoading: false } as ReturnType<typeof useEmployeeScorecard>)
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('PerformancePage', () => {
  beforeEach(() => {
    setupEmpty()
  })

  it('renders Performance heading', () => {
    render(<PerformancePage />)
    expect(screen.getByText('Performance')).toBeInTheDocument()
  })

  it('renders People tabs', () => {
    render(<PerformancePage />)
    expect(screen.getByText('Team')).toBeInTheDocument()
    expect(screen.getByText('Performance')).toBeInTheDocument()
  })

  it('shows loading skeleton when summary loading', () => {
    setupLoading()
    render(<PerformancePage />)
    // skeleton renders multiple pulse divs — just check no data text appears
    expect(screen.queryByText('Team Ranking')).not.toBeInTheDocument()
  })

  it('shows empty state when no employees', () => {
    render(<PerformancePage />)
    expect(screen.getByText('No employee data yet')).toBeInTheDocument()
  })

  it('shows period toggle buttons', () => {
    render(<PerformancePage />)
    expect(screen.getByText('This Month')).toBeInTheDocument()
    expect(screen.getByText('This Quarter')).toBeInTheDocument()
    expect(screen.getByText('This Year')).toBeInTheDocument()
  })

  it('period toggle changes active period', () => {
    render(<PerformancePage />)
    fireEvent.click(screen.getByText('This Quarter'))
    // After click, This Quarter button should have white background
    const btn = screen.getByText('This Quarter')
    expect(btn.style.background).toBe('#FFFFFF')
  })
})
