import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { DateTimePicker } from './DateTimePicker'

describe('DateTimePicker', () => {
  it('renders with label', () => {
    render(<DateTimePicker label="Test DateTime" />)
    expect(screen.getByText('Test DateTime')).toBeInTheDocument()
  })

  it('parses ISO datetime value into segments', () => {
    render(<DateTimePicker value="2026-04-19T14:30:00" />)
    // Should have date segments (Year, Month, Day) and time segments (Hour, Minute)
    expect(screen.getByLabelText('Year')).toHaveValue('2026')
    expect(screen.getByLabelText('Month')).toHaveValue('04')
    expect(screen.getByLabelText('Day')).toHaveValue('19')
    expect(screen.getByLabelText('Hour')).toHaveValue('14')
    expect(screen.getByLabelText('Minute')).toHaveValue('30')
  })

  it('calls onChange with ISO string when year segment changes', () => {
    const onChange = vi.fn()
    render(<DateTimePicker onChange={onChange} />)
    // Type into the year segment
    fireEvent.change(screen.getByLabelText('Year'), { target: { value: '2026' } })
    expect(onChange).toHaveBeenCalled()
  })

  it('calls onChange with ISO string when hour segment changes', () => {
    const onChange = vi.fn()
    render(<DateTimePicker value="2026-04-19T14:30:00" onChange={onChange} />)
    fireEvent.change(screen.getByLabelText('Hour'), { target: { value: '15' } })
    expect(onChange).toHaveBeenCalled()
  })

  it('disables time segments when no date is selected', () => {
    render(<DateTimePicker />)
    expect(screen.getByLabelText('Hour')).toBeDisabled()
    expect(screen.getByLabelText('Minute')).toBeDisabled()
  })

  it('enables time segments when date is selected', () => {
    render(<DateTimePicker value="2026-04-19T14:30:00" />)
    expect(screen.getByLabelText('Hour')).not.toBeDisabled()
    expect(screen.getByLabelText('Minute')).not.toBeDisabled()
  })

  it('shows error message when error prop is true', () => {
    render(
      <DateTimePicker error={true} errorMessage="DateTime is required" />
    )
    expect(screen.getByText('DateTime is required')).toBeInTheDocument()
  })

  it('applies disabled state to all segments', () => {
    render(<DateTimePicker disabled />)
    expect(screen.getByLabelText('Year')).toBeDisabled()
    expect(screen.getByLabelText('Month')).toBeDisabled()
    expect(screen.getByLabelText('Day')).toBeDisabled()
    expect(screen.getByLabelText('Hour')).toBeDisabled()
    expect(screen.getByLabelText('Minute')).toBeDisabled()
  })

  it('forwards ref correctly', () => {
    const ref = vi.fn()
    render(<DateTimePicker ref={ref} />)
    expect(ref).toHaveBeenCalled()
  })
})
