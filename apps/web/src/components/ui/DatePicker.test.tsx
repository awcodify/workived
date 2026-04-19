import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { DatePicker } from './DatePicker'

describe('DatePicker', () => {
  it('renders with label', () => {
    render(<DatePicker label="Test Date" />)
    expect(screen.getByText('Test Date')).toBeInTheDocument()
  })

  it('renders without label', () => {
    render(<DatePicker data-testid="date-picker" />)
    expect(screen.getByTestId('date-picker')).toBeInTheDocument()
  })

  it('displays value correctly', () => {
    render(<DatePicker value="2026-04-19" data-testid="date-picker" />)
    const input = screen.getByTestId('date-picker') as HTMLInputElement
    expect(input.value).toBe('2026-04-19')
  })

  it('calls onChange when value changes', () => {
    const onChange = vi.fn()
    render(<DatePicker onChange={onChange} data-testid="date-picker" />)
    const input = screen.getByTestId('date-picker') as HTMLInputElement
    fireEvent.change(input, { target: { value: '2026-04-20' } })
    expect(onChange).toHaveBeenCalled()
  })

  it('shows error message when error prop is true', () => {
    render(
      <DatePicker
        error={true}
        errorMessage="Date is required"
        data-testid="date-picker"
      />
    )
    expect(screen.getByText('Date is required')).toBeInTheDocument()
  })

  it('does not show error message when error prop is false', () => {
    render(
      <DatePicker
        error={false}
        errorMessage="Date is required"
        data-testid="date-picker"
      />
    )
    expect(screen.queryByText('Date is required')).not.toBeInTheDocument()
  })

  it('opens picker when clicking on container', () => {
    const mockShowPicker = vi.fn()
    render(<DatePicker data-testid="date-picker" />)
    const input = screen.getByTestId('date-picker') as HTMLInputElement
    input.showPicker = mockShowPicker
    
    const container = input.parentElement
    if (container) {
      fireEvent.click(container)
      expect(mockShowPicker).toHaveBeenCalled()
    }
  })

  it('applies disabled state correctly', () => {
    render(<DatePicker disabled data-testid="date-picker" />)
    const input = screen.getByTestId('date-picker') as HTMLInputElement
    expect(input).toBeDisabled()
  })

  it('supports custom className', () => {
    render(<DatePicker className="custom-class" data-testid="date-picker" />)
    const input = screen.getByTestId('date-picker') as HTMLInputElement
    expect(input.className).toContain('custom-class')
  })

  it('supports custom style', () => {
    render(
      <DatePicker
        style={{ backgroundColor: 'red' }}
        data-testid="date-picker"
      />
    )
    const input = screen.getByTestId('date-picker') as HTMLInputElement
    expect(input.style.backgroundColor).toBe('red')
  })

  it('forwards ref correctly', () => {
    const ref = vi.fn()
    render(<DatePicker ref={ref} data-testid="date-picker" />)
    expect(ref).toHaveBeenCalled()
  })
})
