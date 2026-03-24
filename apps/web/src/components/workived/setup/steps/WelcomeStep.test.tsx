import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { WelcomeStep } from './WelcomeStep'

describe('WelcomeStep', () => {
  it('renders welcome message', () => {
    const onNext = vi.fn()
    const onSkip = vi.fn()

    render(<WelcomeStep onNext={onNext} onSkip={onSkip} isSkipping={false} />)

    expect(screen.getByText(/Welcome to Workived!/i)).toBeInTheDocument()
    expect(screen.getByText(/Get Started/i)).toBeInTheDocument()
    expect(screen.getByText(/Skip for Now/i)).toBeInTheDocument()
  })

  it('calls onNext when Get Started is clicked', () => {
    const onNext = vi.fn()
    const onSkip = vi.fn()

    render(<WelcomeStep onNext={onNext} onSkip={onSkip} isSkipping={false} />)

    fireEvent.click(screen.getByText(/Get Started/i))

    expect(onNext).toHaveBeenCalledTimes(1)
    expect(onSkip).not.toHaveBeenCalled()
  })

  it('calls onSkip when Skip for Now is clicked', () => {
    const onNext = vi.fn()
    const onSkip = vi.fn()

    render(<WelcomeStep onNext={onNext} onSkip={onSkip} isSkipping={false} />)

    fireEvent.click(screen.getByText(/Skip for Now/i))

    expect(onSkip).toHaveBeenCalledTimes(1)
    expect(onNext).not.toHaveBeenCalled()
  })

  it('disables skip button when skipping', () => {
    const onNext = vi.fn()
    const onSkip = vi.fn()

    render(<WelcomeStep onNext={onNext} onSkip={onSkip} isSkipping={true} />)

    const skipButton = screen.getByText(/Skipping.../i).closest('button')
    expect(skipButton).toBeDisabled()
  })

  it('displays all 3 wizard steps', () => {
    const onNext = vi.fn()
    const onSkip = vi.fn()

    render(<WelcomeStep onNext={onNext} onSkip={onSkip} isSkipping={false} />)

    expect(screen.getAllByText(/Work Schedule/i).length).toBeGreaterThan(0)
    expect(screen.getAllByText(/Leave Policies/i).length).toBeGreaterThan(0)
    expect(screen.getAllByText(/Claim Categories/i).length).toBeGreaterThan(0)
    // Note: Invite Team step was removed from setup wizard
  })
})
