import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import {
  Skeleton,
  RequestSkeleton,
  RequestTableSkeleton,
  BalanceCardSkeleton,
  TeamMemberSkeleton,
  ListSkeleton,
} from './Skeleton'

describe('Skeleton', () => {
  it('renders with default props', () => {
    const { container } = render(<Skeleton />)
    const skeleton = container.firstChild as HTMLElement
    expect(skeleton).toHaveStyle({ width: '100%', height: '16px' })
    expect(skeleton.className).toContain('animate-pulse')
  })

  it('renders with custom width and height', () => {
    const { container } = render(<Skeleton width={200} height={50} />)
    const skeleton = container.firstChild as HTMLElement
    expect(skeleton).toHaveStyle({ width: '200px', height: '50px' })
  })

  it('renders with custom borderRadius', () => {
    const { container } = render(<Skeleton borderRadius={8} />)
    const skeleton = container.firstChild as HTMLElement
    expect(skeleton).toHaveStyle({ borderRadius: '8px' })
  })

  it('applies custom className', () => {
    const { container } = render(<Skeleton className="custom-class" />)
    const skeleton = container.firstChild as HTMLElement
    expect(skeleton.className).toContain('custom-class')
  })

  it('applies custom style', () => {
    const { container } = render(<Skeleton style={{ opacity: 0.5 }} />)
    const skeleton = container.firstChild as HTMLElement
    expect(skeleton).toHaveStyle({ opacity: '0.5' })
  })
})

describe('RequestSkeleton', () => {
  it('renders with default props', () => {
    const { container } = render(<RequestSkeleton />)
    expect(container.querySelector('.animate-pulse')).toBeTruthy()
  })

  it('renders without bottom border when isLast is true', () => {
    const { container } = render(<RequestSkeleton isLast={true} />)
    const wrapper = container.firstChild as HTMLElement
    // When border is 'none', browsers may render it differently
    expect(wrapper.style.borderBottom === 'none' || wrapper.style.borderBottom === 'medium').toBe(true)
  })

  it('renders with bottom border when isLast is false', () => {
    const { container } = render(<RequestSkeleton isLast={false} />)
    const wrapper = container.firstChild as HTMLElement
    expect(wrapper.style.borderBottom).toContain('1px')
  })
})

describe('RequestTableSkeleton', () => {
  it('renders default count of skeletons', () => {
    const { container } = render(<RequestTableSkeleton />)
    const skeletons = container.querySelectorAll('.animate-pulse')
    expect(skeletons.length).toBeGreaterThan(0)
  })

  it('renders custom count of skeletons', () => {
    const { container } = render(<RequestTableSkeleton count={5} />)
    // Each RequestSkeleton contains multiple animate-pulse elements, so we check for the parent divs
    const parentDivs = container.querySelectorAll('div[style*="padding"]')
    expect(parentDivs.length).toBeGreaterThanOrEqual(5)
  })

  it('applies custom surface and border colors', () => {
    const { container } = render(
      <RequestTableSkeleton surfaceColor="#FFFFFF" borderColor="#000000" />
    )
    const wrapper = container.firstChild as HTMLElement
    expect(wrapper).toHaveStyle({ background: '#FFFFFF' })
    // Browsers convert hex colors to rgb format
    expect(wrapper.style.border).toContain('rgb(0, 0, 0)')
  })
})

describe('BalanceCardSkeleton', () => {
  it('renders with default props', () => {
    const { container } = render(<BalanceCardSkeleton />)
    const skeletons = container.querySelectorAll('.animate-pulse')
    expect(skeletons.length).toBeGreaterThan(0)
  })

  it('applies custom surface and border colors', () => {
    const { container } = render(
      <BalanceCardSkeleton surfaceColor="#F0F0F0" borderColor="#CCCCCC" />
    )
    const wrapper = container.firstChild as HTMLElement
    expect(wrapper).toHaveStyle({ background: '#F0F0F0' })
    // Browsers convert hex colors to rgb format
    expect(wrapper.style.border).toContain('rgb(204, 204, 204)')
  })

  it('renders header, number, progress bar, and stats skeletons', () => {
    const { container } = render(<BalanceCardSkeleton />)
    const skeletons = container.querySelectorAll('.animate-pulse')
    // Should have multiple skeleton elements for different parts
    expect(skeletons.length).toBeGreaterThanOrEqual(4)
  })
})

describe('TeamMemberSkeleton', () => {
  it('renders avatar and text skeletons', () => {
    const { container } = render(<TeamMemberSkeleton />)
    const skeletons = container.querySelectorAll('.animate-pulse')
    // Should have avatar + 2+ text skeletons
    expect(skeletons.length).toBeGreaterThanOrEqual(3)
  })
})

describe('ListSkeleton', () => {
  it('renders default count of items', () => {
    const { container } = render(<ListSkeleton />)
    const skeletons = container.querySelectorAll('.animate-pulse')
    expect(skeletons.length).toBe(3) // default count
  })

  it('renders custom count of items', () => {
    const { container } = render(<ListSkeleton count={5} />)
    const skeletons = container.querySelectorAll('.animate-pulse')
    expect(skeletons.length).toBe(5)
  })

  it('applies custom item height', () => {
    const { container } = render(<ListSkeleton itemHeight={100} />)
    const skeleton = container.querySelector('.animate-pulse') as HTMLElement
    expect(skeleton).toHaveStyle({ height: '100px' })
  })
})
