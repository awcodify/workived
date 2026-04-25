import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { TaskTourOverlay, TASK_TOUR_STEPS } from './TaskTourOverlay'
import { useTaskTourStore } from '@/lib/stores/taskTour'

describe('TaskTourOverlay', () => {
  beforeEach(() => {
    useTaskTourStore.setState({ hasCompleted: false, isActive: false, currentStep: 0 })
  })

  it('renders nothing when tour is inactive', () => {
    const { container } = render(<TaskTourOverlay />)
    expect(container.innerHTML).toBe('')
  })

  it('renders welcome modal on step 0', () => {
    useTaskTourStore.setState({ isActive: true, currentStep: 0 })
    render(<TaskTourOverlay />)
    expect(screen.getByText('Your Task Board')).toBeInTheDocument()
    expect(screen.getByText("Let’s go")).toBeInTheDocument()
    expect(screen.getByText('Skip tour')).toBeInTheDocument()
  })

  it('advances to next step on clicking Lets go', () => {
    useTaskTourStore.setState({ isActive: true, currentStep: 0 })
    render(<TaskTourOverlay />)
    fireEvent.click(screen.getByText("Let’s go"))
    expect(useTaskTourStore.getState().currentStep).toBe(1)
  })

  it('shows spotlight step as modal when target element not in DOM', () => {
    // Step 1 targets [data-tour="tasks-board"] which won't exist in test DOM
    useTaskTourStore.setState({ isActive: true, currentStep: 1 })
    render(<TaskTourOverlay />)
    expect(screen.getByText('Board layout')).toBeInTheDocument()
  })

  it('shows done modal on last step', () => {
    useTaskTourStore.setState({ isActive: true, currentStep: TASK_TOUR_STEPS.length - 1 })
    render(<TaskTourOverlay />)
    expect(screen.getByText('Board unlocked.')).toBeInTheDocument()
    expect(screen.getByText('Start exploring')).toBeInTheDocument()
  })

  it('completes tour after clicking Start exploring on last step', () => {
    useTaskTourStore.setState({ isActive: true, currentStep: TASK_TOUR_STEPS.length - 1 })
    render(<TaskTourOverlay />)
    fireEvent.click(screen.getByText('Start exploring'))
    const state = useTaskTourStore.getState()
    expect(state.isActive).toBe(false)
    expect(state.hasCompleted).toBe(true)
  })

  it('skips tour on Skip tour click', () => {
    useTaskTourStore.setState({ isActive: true, currentStep: 0 })
    render(<TaskTourOverlay />)
    fireEvent.click(screen.getByText('Skip tour'))
    const state = useTaskTourStore.getState()
    expect(state.isActive).toBe(false)
    expect(state.hasCompleted).toBe(true)
  })

  it('navigates back on Back button', () => {
    useTaskTourStore.setState({ isActive: true, currentStep: TASK_TOUR_STEPS.length - 1 })
    render(<TaskTourOverlay />)
    fireEvent.click(screen.getByText('Back'))
    expect(useTaskTourStore.getState().currentStep).toBe(TASK_TOUR_STEPS.length - 2)
  })

  it('does not show Back on first step', () => {
    useTaskTourStore.setState({ isActive: true, currentStep: 0 })
    render(<TaskTourOverlay />)
    expect(screen.queryByText('Back')).not.toBeInTheDocument()
  })

  it('does not show Skip tour on last step', () => {
    useTaskTourStore.setState({ isActive: true, currentStep: TASK_TOUR_STEPS.length - 1 })
    render(<TaskTourOverlay />)
    expect(screen.queryByText('Skip tour')).not.toBeInTheDocument()
  })

  it('skips on Escape key', () => {
    useTaskTourStore.setState({ isActive: true, currentStep: 2 })
    render(<TaskTourOverlay />)
    fireEvent.keyDown(window, { key: 'Escape' })
    expect(useTaskTourStore.getState().isActive).toBe(false)
    expect(useTaskTourStore.getState().hasCompleted).toBe(true)
  })

  it('advances on Enter key', () => {
    useTaskTourStore.setState({ isActive: true, currentStep: 0 })
    render(<TaskTourOverlay />)
    fireEvent.keyDown(window, { key: 'Enter' })
    expect(useTaskTourStore.getState().currentStep).toBe(1)
  })

  it('goes back on ArrowLeft key when not first step', () => {
    useTaskTourStore.setState({ isActive: true, currentStep: 3 })
    render(<TaskTourOverlay />)
    fireEvent.keyDown(window, { key: 'ArrowLeft' })
    expect(useTaskTourStore.getState().currentStep).toBe(2)
  })

  it('has at least 6 spotlight steps', () => {
    const spotlightSteps = TASK_TOUR_STEPS.filter((s) => s.type === 'spotlight')
    expect(spotlightSteps.length).toBeGreaterThanOrEqual(6)
  })

  it('has modal as first and last step', () => {
    expect(TASK_TOUR_STEPS[0].type).toBe('modal')
    expect(TASK_TOUR_STEPS[TASK_TOUR_STEPS.length - 1].type).toBe('modal')
  })

  it('renders aria-modal dialog with correct label', () => {
    useTaskTourStore.setState({ isActive: true, currentStep: 0 })
    render(<TaskTourOverlay />)
    const dialog = document.body.querySelector('[role="dialog"]')
    expect(dialog).toBeInTheDocument()
    expect(dialog?.getAttribute('aria-label')).toBe('Task board tour')
  })

  it('dispatches tour instrumentation events', () => {
    const listener = vi.fn()
    window.addEventListener('workived:tour_event', listener)

    useTaskTourStore.setState({ isActive: true, currentStep: 0 })
    render(<TaskTourOverlay />)

    // Should have fired tour_started + step_viewed on mount
    expect(listener.mock.calls.some((c) => (c[0] as CustomEvent).detail.event === 'tour_started')).toBe(true)
    expect(listener.mock.calls.some((c) => (c[0] as CustomEvent).detail.tour_id === 'tasks')).toBe(true)

    window.removeEventListener('workived:tour_event', listener)
  })

  it('covers all required topic areas in step descriptions', () => {
    const allText = TASK_TOUR_STEPS.map((s) => `${s.title} ${s.description}`).join(' ').toLowerCase()
    expect(allText).toContain('column')
    expect(allText).toContain('drag')
    expect(allText).toContain('filter')
    expect(allText).toContain('approv')
    expect(allText).toContain('workload')
  })
})
