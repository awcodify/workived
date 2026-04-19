import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { DateTimePicker } from './DateTimePicker'

describe('DateTimePicker', () => {
  it('renders with label', () => {
    render(<DateTimePicker label="Test DateTime" />)
    expect(screen.getByText('Test DateTime')).toBeInTheDocument()
  })

  it('parses ISO datetime value into separate date and time', () => {
    render(<DateTimePicker value="2026-04-19T14:30:00" />)
    // Date input should show date part
    const inputs = screen.getAllByRole('textbox')
    expect(inputs.length).toBeGreaterThan(0)
  })

  it('calls onChange with ISO string when date changes', () => {
    const onChange = vi.fn()
    render(<DateTimePicker onChange={onChange} />)
    
    const dateInput = screen.getAllByRole('textbox')[0] as HTMLInputElement
    fireEvent.change(dateInput, { target: { value: '2026-04-20' } })
    
    expect(onChange).toHaveBeenCalledWith(expect.stringContaining('2026-04-20'))
  })

  it('calls onChange with ISO string when time changes', () => {
    const onChange = vi.fn()
    render(<DateTimePicker value="2026-04-19T14:30:00" onChange={onChange} />)
    
    const timeInput = screen.getAllByRole('textbox')[1] as HTMLInputElement
    fireEvent.change(timeInput, { target: { value: '15:45' } })
    
    expect(onChange).toHaveBeenCalledWith(expect.stringContaining('15:45'))
  })

  it('disables time input when no date is selected', () => {
    render(<DateTimePicker />)
    const inputs = screen.getAllByRole('textbox')
    const timeInput = inputs[1] as HTMLInputElement
    expect(timeInput).toBeDisabled()
  })

  it('enables time input when date is selected', () => {
    render(<DateTimePicker value="2026-04-19T14:30:00" />)
    const inputs = screen.getAllByRole('textbox')
    const timeInput = inputs[1] as HTMLInputElement
    expect(timeInput).not.toBeDisabled()
  })

  it('clears time when date is cleared', () => {
    const onChange = vi.fn()
    render(<DateTimePicker value="2026-04-19T14:30:00" onChange={onChange} />)
    
    const dateInput = screen.getAllByRole('textbox')[0] as HTMLInputElement
    fireEvent.change(dateInput, { target: { value: '' } })
    
    expect(onChange).toHaveBeenCalledWith('')
  })

  it('shows error message when error prop is true', () => {
    render(
      <DateTimePicker
        error={true}
        errorMessage="DateTime is required"
      />
    )
    expect(screen.getByText('DateTime is required')).toBeInTheDocument()
  })

  it('applies disabled state to both inputs', () => {
    render(<DateTimePicker disabled />)
    const inputs = screen.getAllByRole('textbox')
    inputs.forEach(input => {
      expect(input).toBeDisabled()
    })
  })

  it('forwards ref correctly', () => {
    const ref = vi.fn()
    render(<DateTimePicker ref={ref} />)
    expect(ref).toHaveBeenCalled()
  })
})
