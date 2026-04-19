import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { TimePicker } from './TimePicker'

describe('TimePicker', () => {
  it('renders with label', () => {
    render(<TimePicker label="Test Time" />)
    expect(screen.getByText('Test Time')).toBeInTheDocument()
  })

  it('renders hidden input with data-testid', () => {
    render(<TimePicker data-testid="time-picker" />)
    expect(screen.getByTestId('time-picker')).toBeInTheDocument()
  })

  it('renders segmented inputs (HH, MM)', () => {
    render(<TimePicker data-testid="time-picker" />)
    expect(screen.getByLabelText('Hour')).toBeInTheDocument()
    expect(screen.getByLabelText('Minute')).toBeInTheDocument()
  })

  it('shows segment placeholders', () => {
    render(<TimePicker data-testid="time-picker" />)
    expect(screen.getByLabelText('Hour')).toHaveAttribute('placeholder', 'HH')
    expect(screen.getByLabelText('Minute')).toHaveAttribute('placeholder', 'MM')
  })

  it('displays value correctly split across segments', () => {
    render(<TimePicker value="14:30" onChange={() => {}} data-testid="time-picker" />)
    expect(screen.getByLabelText('Hour')).toHaveValue('14')
    expect(screen.getByLabelText('Minute')).toHaveValue('30')
  })

  it('fires onChange when typing hour', () => {
    const onChange = vi.fn()
    render(<TimePicker onChange={onChange} data-testid="time-picker" />)
    fireEvent.change(screen.getByLabelText('Hour'), { target: { value: '09' } })
    expect(onChange).toHaveBeenCalled()
  })

  it('only accepts digits in segments', () => {
    render(<TimePicker data-testid="time-picker" />)
    fireEvent.change(screen.getByLabelText('Hour'), { target: { value: 'ab' } })
    expect(screen.getByTestId('time-picker')).toHaveValue('')
  })

  it('shows error message when error prop is true', () => {
    render(
      <TimePicker error={true} errorMessage="Time is required" data-testid="time-picker" />
    )
    expect(screen.getByText('Time is required')).toBeInTheDocument()
  })

  it('does not show error message when error prop is false', () => {
    render(
      <TimePicker error={false} errorMessage="Time is required" data-testid="time-picker" />
    )
    expect(screen.queryByText('Time is required')).not.toBeInTheDocument()
  })

  it('opens dropdown on segment focus', () => {
    render(<TimePicker data-testid="time-picker" />)
    fireEvent.focus(screen.getByLabelText('Hour'))
    expect(screen.getByTestId('time-picker-dropdown')).toBeInTheDocument()
  })

  it('selects hour from dropdown hour column', () => {
    const onChange = vi.fn()
    render(<TimePicker onChange={onChange} data-testid="time-picker" />)
    fireEvent.focus(screen.getByLabelText('Hour'))
    const hourCol = screen.getByTestId('time-picker-hours')
    const btn = Array.from(hourCol.querySelectorAll('button')).find(b => b.textContent === '09')!
    fireEvent.click(btn)
    expect(onChange).toHaveBeenCalled()
  })

  it('selects minute from dropdown minute column', () => {
    const onChange = vi.fn()
    render(<TimePicker value="09:00" onChange={onChange} data-testid="time-picker" />)
    fireEvent.focus(screen.getByLabelText('Minute'))
    const minCol = screen.getByTestId('time-picker-minutes')
    const btn = Array.from(minCol.querySelectorAll('button')).find(b => b.textContent === '30')!
    fireEvent.click(btn)
    expect(onChange).toHaveBeenCalled()
  })

  it('shows separate hour and minute columns', () => {
    render(<TimePicker data-testid="time-picker" />)
    fireEvent.focus(screen.getByLabelText('Hour'))
    expect(screen.getByTestId('time-picker-hours')).toBeInTheDocument()
    expect(screen.getByTestId('time-picker-minutes')).toBeInTheDocument()
    // Hours 00-23
    const hourBtns = screen.getByTestId('time-picker-hours').querySelectorAll('button')
    expect(hourBtns).toHaveLength(24)
    // Minutes in 5-min steps: 00,05,10,...,55
    const minBtns = screen.getByTestId('time-picker-minutes').querySelectorAll('button')
    expect(minBtns).toHaveLength(12)
  })

  it('closes dropdown on Escape', () => {
    render(<TimePicker data-testid="time-picker" />)
    fireEvent.focus(screen.getByLabelText('Hour'))
    expect(screen.getByTestId('time-picker-dropdown')).toBeInTheDocument()
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(screen.queryByTestId('time-picker-dropdown')).not.toBeInTheDocument()
  })

  it('applies disabled state to all segments', () => {
    render(<TimePicker disabled data-testid="time-picker" />)
    expect(screen.getByLabelText('Hour')).toBeDisabled()
    expect(screen.getByLabelText('Minute')).toBeDisabled()
  })

  it('does not open dropdown when disabled', () => {
    render(<TimePicker disabled data-testid="time-picker" />)
    fireEvent.focus(screen.getByLabelText('Hour'))
    expect(screen.queryByTestId('time-picker-dropdown')).not.toBeInTheDocument()
  })

  it('supports custom className on segment container', () => {
    render(<TimePicker className="custom-class" data-testid="time-picker" />)
    const segContainer = screen.getByTestId('time-picker-segments')
    expect(segContainer.className).toContain('custom-class')
  })

  it('forwards ref correctly', () => {
    const ref = vi.fn()
    render(<TimePicker ref={ref} data-testid="time-picker" />)
    expect(ref).toHaveBeenCalled()
  })
})
