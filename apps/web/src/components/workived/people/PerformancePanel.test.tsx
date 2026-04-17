import React from 'react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'

vi.mock('@tanstack/react-router', () => ({
  Link: ({ children, ...props }: { children: React.ReactNode; [key: string]: unknown }) => (
    <a {...props}>{children}</a>
  ),
}))

vi.mock('@/lib/hooks/useReports', () => ({
  useCompanySummary: vi.fn(),
  useScorecardConfig: vi.fn(),
}))

vi.mock('@/components/workived/layout/Avatar', () => ({
  Avatar: ({ name }: { name: string }) => <div>{name[0]}</div>,
}))

vi.mock('@/design/tokens', () => ({
  gradeColors: { A: '#34D399', B: '#60A5FA', C: '#F59E0B', D: '#EF4444' },
  gradeColorsDim: { A: 'rgba(52,211,153,0.15)', B: 'rgba(96,165,250,0.15)', C: 'rgba(245,158,11,0.15)', D: 'rgba(239,68,68,0.15)' },
  typography: { fontMono: 'monospace' },
  colors: { accent: '#6357E8' },
}))

import { useCompanySummary, useScorecardConfig } from '@/lib/hooks/useReports'
import { PerformancePanel } from './PerformancePanel'

const theme = {
  text: '#0F0E13',
  textMuted: '#72708A',
  surface: '#FFFFFF',
  surfaceHover: '#F9FAFB',
  border: '#E5E7EB',
}

const mockSummary = {
  attendance_rate: 92,
  punctuality_rate: 85,
  task_completion_rate: 78,
  leave_utilization: 40,
  avg_score: 83,
  period_label: 'April 2026',
  top_performer: { name: 'Alice Smith', employee_id: 'e-1', score: 96 },
  most_improved: { name: 'Bob Jones', employee_id: 'e-2', score: 78, trend: 8 },
  needs_attention_count: 0,
  department_breakdown: [],
}

describe('PerformancePanel', () => {
  beforeEach(() => {
    vi.mocked(useCompanySummary).mockReturnValue({ data: mockSummary, isLoading: false } as ReturnType<typeof useCompanySummary>)
    vi.mocked(useScorecardConfig).mockReturnValue({ data: undefined } as ReturnType<typeof useScorecardConfig>)
  })

  it('renders panel heading', () => {
    render(<PerformancePanel theme={theme} />)
    expect(screen.getByText('Performance')).toBeInTheDocument()
  })

  it('shows avg score', () => {
    render(<PerformancePanel theme={theme} />)
    expect(screen.getByText('83')).toBeInTheDocument()
  })

  it('shows key metrics', () => {
    render(<PerformancePanel theme={theme} />)
    expect(screen.getByText('92%')).toBeInTheDocument()
    expect(screen.getByText('85%')).toBeInTheDocument()
    expect(screen.getByText('78%')).toBeInTheDocument()
  })

  it('shows top performer', () => {
    render(<PerformancePanel theme={theme} />)
    expect(screen.getByText('Alice Smith')).toBeInTheDocument()
    expect(screen.getByText('96')).toBeInTheDocument()
  })

  it('shows most improved', () => {
    render(<PerformancePanel theme={theme} />)
    expect(screen.getByText('Bob Jones')).toBeInTheDocument()
  })

  it('shows Full scorecard CTA link', () => {
    render(<PerformancePanel theme={theme} />)
    expect(screen.getByText('Full scorecard')).toBeInTheDocument()
  })

  it('shows loading state', () => {
    vi.mocked(useCompanySummary).mockReturnValue({ data: undefined, isLoading: true } as ReturnType<typeof useCompanySummary>)
    render(<PerformancePanel theme={theme} />)
    expect(screen.queryByText('83')).not.toBeInTheDocument()
  })

  it('shows empty state when no data', () => {
    vi.mocked(useCompanySummary).mockReturnValue({ data: undefined, isLoading: false } as ReturnType<typeof useCompanySummary>)
    render(<PerformancePanel theme={theme} />)
    expect(screen.getByText('No performance data yet')).toBeInTheDocument()
  })

  it('period toggle switches period', () => {
    render(<PerformancePanel theme={theme} />)
    fireEvent.click(screen.getByText('Qr'))
    expect(vi.mocked(useCompanySummary)).toHaveBeenCalledWith('this_quarter')
  })

  it('shows needs attention when count > 0', () => {
    vi.mocked(useCompanySummary).mockReturnValue({
      data: { ...mockSummary, needs_attention_count: 2 },
      isLoading: false,
    } as ReturnType<typeof useCompanySummary>)
    render(<PerformancePanel theme={theme} />)
    expect(screen.getByText(/2 employees need attention/)).toBeInTheDocument()
  })
})
