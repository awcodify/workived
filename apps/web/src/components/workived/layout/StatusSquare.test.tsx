import { render, screen } from '@testing-library/react'
import { StatusSquare } from '@/components/workived/layout/StatusSquare'

describe('StatusSquare', () => {
  it('renders "Active" label for status "active" with green color', () => {
    render(<StatusSquare status="active" />)
    expect(screen.getByText('Active')).toBeInTheDocument()
    expect(screen.getByText('Active').style.color).toBe('rgb(18, 160, 92)')
  })

  it('renders "Late" label for status "late" with warn color', () => {
    render(<StatusSquare status="late" />)
    expect(screen.getByText('Late')).toBeInTheDocument()
    expect(screen.getByText('Late').style.color).toBe('rgb(201, 123, 42)')
  })

  it('renders "Absent" label for status "absent" with red color', () => {
    render(<StatusSquare status="absent" />)
    expect(screen.getByText('Absent')).toBeInTheDocument()
    expect(screen.getByText('Absent').style.color).toBe('rgb(212, 64, 64)')
  })

  it('renders fallback for unknown status using status string as label', () => {
    render(<StatusSquare status="something_new" />)
    expect(screen.getByText('something_new')).toBeInTheDocument()
    expect(screen.getByText('something_new').style.color).toBe('rgb(176, 174, 190)')
  })

  it('renders a small square indicator with borderRadius 2px', () => {
    render(<StatusSquare status="active" />)
    const label = screen.getByText('Active')
    const square = label.querySelector('span')
    expect(square).not.toBeNull()
    expect(square!.style.borderRadius).toBe('2px')
    expect(square!.style.background).toBe('rgb(18, 160, 92)')
  })
})
