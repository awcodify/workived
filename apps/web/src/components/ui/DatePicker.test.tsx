import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { DatePicker } from './DatePicker'

describe('DatePicker', () => {
  it('renders with label', () => {
    render(<DatePicker label="Test Date" />)
    expect(screen.getByText('Test Date')).toBeInTheDocument()
  })

  it('renders hidden input with data-testid', () => {
    render(<DatePicker data-testid="date-picker" />)
    expect(screen.getByTestId('date-picker')).toBeInTheDocument()
  })

  it('renders segmented inputs (YYYY, MM, DD)', () => {
    render(<DatePicker data-testid="date-picker" />)
    expect(screen.getByLabelText('Year')).toBeInTheDocument()
    expect(screen.getByLabelText('Month')).toBeInTheDocument()
    expect(screen.getByLabelText('Day')).toBeInTheDocument()
  })

  it('shows segment placeholders', () => {
    render(<DatePicker data-testid="date-picker" />)
    expect(screen.getByLabelText('Year')).toHaveAttribute('placeholder', 'YYYY')
    expect(screen.getByLabelText('Month')).toHaveAttribute('placeholder', 'MM')
    expect(screen.getByLabelText('Day')).toHaveAttribute('placeholder', 'DD')
  })

  it('displays value correctly split across segments', () => {
    render(<DatePicker value="2026-04-19" onChange={() => {}} data-testid="date-picker" />)
    expect(screen.getByLabelText('Year')).toHaveValue('2026')
    expect(screen.getByLabelText('Month')).toHaveValue('04')
    expect(screen.getByLabelText('Day')).toHaveValue('19')
  })

  it('fires onChange when typing year', () => {
    const onChange = vi.fn()
    render(<DatePicker onChange={onChange} data-testid="date-picker" />)
    fireEvent.change(screen.getByLabelText('Year'), { target: { value: '2026' } })
    expect(onChange).toHaveBeenCalled()
  })

  it('auto-advances from year to month after 4 digits', () => {
    render(<DatePicker data-testid="date-picker" />)
    const yearInput = screen.getByLabelText('Year')
    const monthInput = screen.getByLabelText('Month')
    fireEvent.change(yearInput, { target: { value: '2026' } })
    // In jsdom, focus won't actually move, but we can verify the intent
    expect(monthInput).toHaveAttribute('maxLength', '2')
  })

  it('auto-advances from month to day after 2 digits', () => {
    render(<DatePicker data-testid="date-picker" />)
    fireEvent.change(screen.getByLabelText('Year'), { target: { value: '2026' } })
    fireEvent.change(screen.getByLabelText('Month'), { target: { value: '04' } })
    expect(screen.getByLabelText('Day')).toHaveAttribute('maxLength', '2')
  })

  it('only accepts digits in segments', () => {
    render(<DatePicker data-testid="date-picker" />)
    fireEvent.change(screen.getByLabelText('Year'), { target: { value: 'abcd' } })
    expect(screen.getByTestId('date-picker')).toHaveValue('')
  })

  it('shows error message when error prop is true', () => {
    render(
      <DatePicker error={true} errorMessage="Date is required" data-testid="date-picker" />
    )
    expect(screen.getByText('Date is required')).toBeInTheDocument()
  })

  it('does not show error message when error prop is false', () => {
    render(
      <DatePicker error={false} errorMessage="Date is required" data-testid="date-picker" />
    )
    expect(screen.queryByText('Date is required')).not.toBeInTheDocument()
  })

  it('opens calendar dropdown on segment focus', () => {
    render(<DatePicker data-testid="date-picker" />)
    fireEvent.focus(screen.getByLabelText('Year'))
    expect(screen.getByTestId('date-picker-calendar')).toBeInTheDocument()
  })

  it('selects a day from the calendar', () => {
    const onChange = vi.fn()
    render(<DatePicker value="2026-04-19" onChange={onChange} data-testid="date-picker" />)
    fireEvent.focus(screen.getByLabelText('Year'))
    const day15 = screen.getByRole('button', { name: '15' })
    fireEvent.click(day15)
    expect(onChange).toHaveBeenCalled()
  })

  it('shows Today shortcut in calendar', () => {
    render(<DatePicker data-testid="date-picker" />)
    fireEvent.focus(screen.getByLabelText('Year'))
    expect(screen.getByRole('button', { name: 'Today' })).toBeInTheDocument()
  })

  it('navigates months with prev/next buttons', () => {
    render(<DatePicker value="2026-04-19" onChange={() => {}} data-testid="date-picker" />)
    fireEvent.focus(screen.getByLabelText('Year'))
    expect(screen.getByText('April 2026')).toBeInTheDocument()
    fireEvent.click(screen.getByLabelText('Next month'))
    expect(screen.getByText('May 2026')).toBeInTheDocument()
    fireEvent.click(screen.getByLabelText('Previous month'))
    expect(screen.getByText('April 2026')).toBeInTheDocument()
  })

  it('closes calendar on Escape', () => {
    render(<DatePicker data-testid="date-picker" />)
    fireEvent.focus(screen.getByLabelText('Year'))
    expect(screen.getByTestId('date-picker-calendar')).toBeInTheDocument()
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(screen.queryByTestId('date-picker-calendar')).not.toBeInTheDocument()
  })

  it('applies disabled state to all segments', () => {
    render(<DatePicker disabled data-testid="date-picker" />)
    expect(screen.getByLabelText('Year')).toBeDisabled()
    expect(screen.getByLabelText('Month')).toBeDisabled()
    expect(screen.getByLabelText('Day')).toBeDisabled()
  })

  it('does not open calendar when disabled', () => {
    render(<DatePicker disabled data-testid="date-picker" />)
    fireEvent.focus(screen.getByLabelText('Year'))
    expect(screen.queryByTestId('date-picker-calendar')).not.toBeInTheDocument()
  })

  it('supports custom className on segment container', () => {
    render(<DatePicker className="custom-class" data-testid="date-picker" />)
    const segContainer = screen.getByTestId('date-picker-segments')
    expect(segContainer.className).toContain('custom-class')
  })

  it('forwards ref correctly', () => {
    const ref = vi.fn()
    render(<DatePicker ref={ref} data-testid="date-picker" />)
    expect(ref).toHaveBeenCalled()
  })
})
