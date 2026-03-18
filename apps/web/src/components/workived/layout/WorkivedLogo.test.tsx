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
})
