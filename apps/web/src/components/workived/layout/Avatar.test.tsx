import { render, screen } from '@testing-library/react'
import { Avatar } from '@/components/workived/layout/Avatar'
import { getAvatarColor } from '@/design/tokens'

describe('Avatar', () => {
  it('renders initials from full name', () => {
    render(<Avatar name="John Doe" id="abc" />)
    expect(screen.getByText('JD')).toBeInTheDocument()
  })

  it('renders single initial for single name', () => {
    render(<Avatar name="Ahmad" id="abc" />)
    expect(screen.getByText('A')).toBeInTheDocument()
  })

  it('uses size prop for width and height', () => {
    render(<Avatar name="John Doe" id="abc" size={48} />)
    const el = screen.getByText('JD')
    expect(el.style.width).toBe('48px')
    expect(el.style.height).toBe('48px')
  })

  it('defaults size to 32', () => {
    render(<Avatar name="John Doe" id="abc" />)
    const el = screen.getByText('JD')
    expect(el.style.width).toBe('32px')
    expect(el.style.height).toBe('32px')
  })

  it('sets borderRadius to 12 when size >= 40', () => {
    render(<Avatar name="John Doe" id="abc" size={40} />)
    const el = screen.getByText('JD')
    expect(el.style.borderRadius).toBe('12px')
  })

  it('sets borderRadius to 9 when size < 40', () => {
    render(<Avatar name="John Doe" id="abc" size={32} />)
    const el = screen.getByText('JD')
    expect(el.style.borderRadius).toBe('9px')
  })

  it('uses getAvatarColor for bg and text color', () => {
    const { bg, text } = getAvatarColor('abc')
    render(<Avatar name="John Doe" id="abc" />)
    const el = screen.getByText('JD')
    // jsdom converts hex to rgb, so use toHaveStyle which handles both
    expect(el).toHaveStyle({ background: bg, color: text })
  })
})
