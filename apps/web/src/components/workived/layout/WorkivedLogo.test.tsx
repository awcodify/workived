import { render, screen } from '@testing-library/react'
import { WorkivedLogo } from '@/components/workived/layout/WorkivedLogo'

describe('WorkivedLogo', () => {
  it('renders SVG logo', () => {
    const { container } = render(<WorkivedLogo />)
    const svg = container.querySelector('svg')
    expect(svg).toBeInTheDocument()
  })

  it('shows wordmark "Workived" by default', () => {
    render(<WorkivedLogo />)
    expect(screen.getByText('Workived')).toBeInTheDocument()
  })

  it('hides wordmark when showWordmark is false', () => {
    render(<WorkivedLogo showWordmark={false} />)
    expect(screen.queryByText('Workived')).not.toBeInTheDocument()
  })

  it('renders with default size of 40', () => {
    const { container } = render(<WorkivedLogo />)
    const svg = container.querySelector('svg')
    expect(svg).toBeInTheDocument()
    expect(svg!.getAttribute('width')).toBe('40')
    expect(svg!.getAttribute('height')).toBe('40')
  })

  it('renders W letter in SVG', () => {
    const { container } = render(<WorkivedLogo />)
    const text = container.querySelector('text')
    expect(text).toBeInTheDocument()
    expect(text!.textContent).toBe('W')
  })

  it('renders accent bar', () => {
    const { container } = render(<WorkivedLogo />)
    const rects = container.querySelectorAll('rect')
    // Background rect + accent bar = 2
    expect(rects.length).toBe(2)
  })

  it('applies custom size', () => {
    const { container } = render(<WorkivedLogo size={64} />)
    const svg = container.querySelector('svg')
    expect(svg!.getAttribute('width')).toBe('64')
    expect(svg!.getAttribute('height')).toBe('64')
  })

  it('renders gradient variant with linearGradient', () => {
    const { container } = render(<WorkivedLogo variant="gradient" />)
    const gradient = container.querySelector('linearGradient')
    expect(gradient).toBeInTheDocument()
  })

  it('renders dark variant without gradient', () => {
    const { container } = render(<WorkivedLogo variant="dark" />)
    const gradient = container.querySelector('linearGradient')
    expect(gradient).not.toBeInTheDocument()
  })
})
