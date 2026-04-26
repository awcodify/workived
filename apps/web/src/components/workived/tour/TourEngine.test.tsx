import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { ModalCard, SpotlightTooltip, StepDots, getTargetRect } from './TourEngine'
import type { ModalStep, SpotlightStep } from './TourEngine'

const welcomeStep: ModalStep = {
  id: 'welcome',
  type: 'modal',
  title: 'Hello there',
  description: 'A test modal step.',
  icon: '👋',
}

const spotlightStep: SpotlightStep = {
  id: 'my-step',
  type: 'spotlight',
  target: '[data-tour="test-target"]',
  title: 'Spotlight title',
  description: 'Spotlight description.',
}

const mockRect = new DOMRect(100, 200, 300, 50)

// ── getTargetRect ────────────────────────────────────────────────

describe('getTargetRect', () => {
  it('returns null when element not found', () => {
    expect(getTargetRect('[data-tour="nonexistent"]')).toBeNull()
  })

  it('returns null when element has zero dimensions', () => {
    const el = document.createElement('div')
    el.setAttribute('data-tour', 'zero-size')
    document.body.appendChild(el)
    // jsdom getBoundingClientRect returns 0,0,0,0
    expect(getTargetRect('[data-tour="zero-size"]')).toBeNull()
    document.body.removeChild(el)
  })

  it('returns rect when element has non-zero dimensions', () => {
    const el = document.createElement('div')
    el.setAttribute('data-tour', 'has-size')
    document.body.appendChild(el)
    vi.spyOn(el, 'getBoundingClientRect').mockReturnValue(new DOMRect(10, 20, 100, 40))
    expect(getTargetRect('[data-tour="has-size"]')).not.toBeNull()
    document.body.removeChild(el)
    vi.restoreAllMocks()
  })
})

// ── StepDots ─────────────────────────────────────────────────────

describe('StepDots', () => {
  it('renders correct number of dots', () => {
    const { container } = render(<StepDots current={0} total={5} />)
    // container > wrapper-div > N dot-divs
    const wrapper = container.firstElementChild as HTMLElement
    expect(wrapper.children.length).toBe(5)
  })

  it('active dot is wider than inactive', () => {
    const { container } = render(<StepDots current={2} total={4} />)
    const wrapper = container.firstElementChild as HTMLElement
    const dots = Array.from(wrapper.children) as HTMLElement[]
    expect(dots[2].style.width).toBe('20px')
    expect(dots[0].style.width).toBe('7px')
  })
})

// ── ModalCard ────────────────────────────────────────────────────

describe('ModalCard', () => {
  const defaultProps = {
    step: welcomeStep,
    currentStep: 0,
    totalSteps: 5,
    isFirstStep: true,
    isLastStep: false,
    onNext: vi.fn(),
    onPrev: vi.fn(),
    onSkip: vi.fn(),
  }

  it('renders title and description', () => {
    render(<ModalCard {...defaultProps} />)
    expect(screen.getByText('Hello there')).toBeInTheDocument()
    expect(screen.getByText('A test modal step.')).toBeInTheDocument()
  })

  it('shows Lets go on first step', () => {
    render(<ModalCard {...defaultProps} />)
    expect(screen.getByText("Let’s go")).toBeInTheDocument()
  })

  it('shows Start exploring on last step', () => {
    render(
      <ModalCard
        {...defaultProps}
        isFirstStep={false}
        isLastStep={true}
        currentStep={4}
      />
    )
    expect(screen.getByText('Start exploring')).toBeInTheDocument()
  })

  it('shows Skip tour when not on last step', () => {
    render(<ModalCard {...defaultProps} />)
    expect(screen.getByText('Skip tour')).toBeInTheDocument()
  })

  it('hides Skip tour on last step', () => {
    render(<ModalCard {...defaultProps} isFirstStep={false} isLastStep={true} currentStep={4} />)
    expect(screen.queryByText('Skip tour')).not.toBeInTheDocument()
  })

  it('hides Back on first step', () => {
    render(<ModalCard {...defaultProps} isFirstStep={true} />)
    expect(screen.queryByText('Back')).not.toBeInTheDocument()
  })

  it('shows Back when not first step', () => {
    render(<ModalCard {...defaultProps} isFirstStep={false} currentStep={2} />)
    expect(screen.getByText('Back')).toBeInTheDocument()
  })

  it('calls onNext when primary button clicked', () => {
    const onNext = vi.fn()
    render(<ModalCard {...defaultProps} onNext={onNext} />)
    fireEvent.click(screen.getByTestId('tour-next-btn'))
    expect(onNext).toHaveBeenCalledOnce()
  })

  it('calls onSkip when Skip tour clicked', () => {
    const onSkip = vi.fn()
    render(<ModalCard {...defaultProps} onSkip={onSkip} />)
    fireEvent.click(screen.getByTestId('tour-skip-btn'))
    expect(onSkip).toHaveBeenCalledOnce()
  })

  it('calls onPrev when Back clicked', () => {
    const onPrev = vi.fn()
    render(<ModalCard {...defaultProps} isFirstStep={false} currentStep={2} onPrev={onPrev} />)
    fireEvent.click(screen.getByTestId('tour-prev-btn'))
    expect(onPrev).toHaveBeenCalledOnce()
  })
})

// ── SpotlightTooltip ─────────────────────────────────────────────

describe('SpotlightTooltip', () => {
  const defaultProps = {
    rect: mockRect,
    step: spotlightStep,
    currentStep: 2,
    totalSteps: 8,
    isFirstStep: false,
    isLastStep: false,
    onNext: vi.fn(),
    onPrev: vi.fn(),
    onSkip: vi.fn(),
  }

  it('renders title and description', () => {
    render(<SpotlightTooltip {...defaultProps} />)
    expect(screen.getByText('Spotlight title')).toBeInTheDocument()
    expect(screen.getByText('Spotlight description.')).toBeInTheDocument()
  })

  it('shows Next button', () => {
    render(<SpotlightTooltip {...defaultProps} />)
    expect(screen.getByTestId('tour-spotlight-next-btn')).toBeInTheDocument()
  })

  it('shows Finish on last step', () => {
    render(<SpotlightTooltip {...defaultProps} isLastStep={true} />)
    expect(screen.getByText('Finish')).toBeInTheDocument()
  })

  it('calls onSkip when X clicked', () => {
    const onSkip = vi.fn()
    render(<SpotlightTooltip {...defaultProps} onSkip={onSkip} />)
    fireEvent.click(screen.getByTestId('tour-spotlight-skip-btn'))
    expect(onSkip).toHaveBeenCalledOnce()
  })

  it('calls onNext when Next clicked', () => {
    const onNext = vi.fn()
    render(<SpotlightTooltip {...defaultProps} onNext={onNext} />)
    fireEvent.click(screen.getByTestId('tour-spotlight-next-btn'))
    expect(onNext).toHaveBeenCalledOnce()
  })

  it('calls onPrev when Back clicked', () => {
    const onPrev = vi.fn()
    render(<SpotlightTooltip {...defaultProps} onPrev={onPrev} />)
    fireEvent.click(screen.getByTestId('tour-spotlight-prev-btn'))
    expect(onPrev).toHaveBeenCalledOnce()
  })
})
