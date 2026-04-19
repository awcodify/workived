import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { TimePicker } from './TimePicker'

describe('TimePicker', () => {
  it('renders with label', () => {
    render(<TimePicker label="Test Time" />)
    expect(screen.getByText('Test Time')).toBeInTheDocument()
  })

  it('renders without label', () => {
    render(<TimePicker data-testid="time-picker" />)
    expect(screen.getByTestId('time-picker')).toBeInTheDocument()
  })

  it('displays value correctly', () => {
    render(<TimePicker value="14:30" data-testid="time-picker" />)
    const input = screen.getByTestId('time-picker') as HTMLInputElement
    expect(input.value).toBe('14:30')
  })

  it('calls onChange when value changes', () => {
    const onChange = vi.fn()
    render(<TimePicker onChange={onChange} data-testid="time-picker" />)
    const input = screen.getByTestId('time-picker') as HTMLInputElement
    fireEvent.change(input, { target: { value: '15:45' } })
    expect(onChange).toHaveBeenCalled()
  })

  it('shows error message when error prop is true', () => {
    render(
      <TimePicker
        error={true}
        errorMessage="Time is required"
        data-testid="time-picker"
      />
    )
    expect(screen.getByText('Time is required')).toBeInTheDocument()
  })

  it('does not show error message when error prop is false', () => {
    render(
      <TimePicker
        error={false}
        errorMessage="Time is required"
        data-testid="time-picker"
      />
    )
    expect(screen.queryByText('Time is required')).not.toBeInTheDocument()
  })

  it('opens picker when clicking on container', () => {
    const mockShowPicker = vi.fn()
    render(<TimePicker data-testid="time-picker" />)
    const input = screen.getByTestId('time-picker') as HTMLInputElement
    input.showPicker = mockShowPicker
    
    const container = input.parentElement
    if (container) {
      fireEvent.click(container)
      expect(mockShowPicker).toHaveBeenCalled()
    }
  })

  it('applies disabled state correctly', () => {
    render(<TimePicker disabled data-testid="time-picker" />)
    const input = screen.getByTestId('time-picker') as HTMLInputElement
    expect(input).toBeDisabled()
  })

  it('supports custom className', () => {
    render(<TimePicker className="custom-class" data-testid="time-picker" />)
    const input = screen.getByTestId('time-picker') as HTMLInputElement
    expect(input.className).toContain('custom-class')
  })

  it('supports custom style', () => {
    render(
      <TimePicker
        style={{ backgroundColor: 'blue' }}
        data-testid="time-picker"
      />
    )
    const input = screen.getByTestId('time-picker') as HTMLInputElement
    expect(input.style.backgroundColor).toBe('blue')
  })

  it('forwards ref correctly', () => {
    const ref = vi.fn()
    render(<TimePicker ref={ref} data-testid="time-picker" />)
    expect(ref).toHaveBeenCalled()
  })
})
