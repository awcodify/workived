import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, act } from '@testing-library/react'
import { TaskTourOverlay, TASK_TOUR_STEPS } from './TaskTourOverlay'
import { useTaskTourStore } from '@/lib/stores/taskTour'

describe('TaskTourOverlay', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    useTaskTourStore.setState({ hasCompleted: false, isActive: false, currentStep: 0 })
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('renders nothing when tour is inactive', () => {
    const { container } = render(<TaskTourOverlay />)
    expect(container.innerHTML).toBe('')
  })

  it(‘renders welcome modal on step 0’, () => {
    useTaskTourStore.setState({ isActive: true, currentStep: 0 })
    render(<TaskTourOverlay />)
    expect(screen.getByText(‘Your Task Board’)).toBeInTheDocument()
    // During countdown buttons are locked — next btn shows the number
    expect(screen.getByTestId(‘tour-next-btn’)).toBeInTheDocument()
    expect(screen.getByText(‘Skip tour’)).toBeInTheDocument()
  })

  it(‘disables next and skip buttons for 5 seconds on first step’, () => {
    useTaskTourStore.setState({ isActive: true, currentStep: 0 })
    render(<TaskTourOverlay />)
    expect(screen.getByTestId(‘tour-next-btn’)).toBeDisabled()
    expect(screen.getByTestId(‘tour-skip-btn’)).toBeDisabled()
  })

  it(‘shows countdown number on next button during lock’, () => {
    useTaskTourStore.setState({ isActive: true, currentStep: 0 })
    render(<TaskTourOverlay />)
    expect(screen.getByTestId(‘tour-next-btn’)).toHaveTextContent(‘5’)
  })

  it(‘enables buttons and shows Lets go after 5 seconds’, () => {
    useTaskTourStore.setState({ isActive: true, currentStep: 0 })
    render(<TaskTourOverlay />)
    act(() => { vi.advanceTimersByTime(5000) })
    expect(screen.getByTestId(‘tour-next-btn’)).not.toBeDisabled()
    expect(screen.getByTestId(‘tour-skip-btn’)).not.toBeDisabled()
    expect(screen.getByText("Let’s go")).toBeInTheDocument()
  })

  it(‘advances to next step on clicking Lets go after countdown’, () => {
    useTaskTourStore.setState({ isActive: true, currentStep: 0 })
    render(<TaskTourOverlay />)
    act(() => { vi.advanceTimersByTime(5000) })
    fireEvent.click(screen.getByTestId(‘tour-next-btn’))
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

  it('skips tour on Skip tour click after countdown', () => {
    useTaskTourStore.setState({ isActive: true, currentStep: 0 })
    render(<TaskTourOverlay />)
    act(() => { vi.advanceTimersByTime(5000) })
    fireEvent.click(screen.getByTestId('tour-skip-btn'))
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
    expect(allText).toContain('assignee')
    expect(allText).toContain('priority')
    expect(allText).toContain('label')
    expect(allText).toContain('collapse')
  })

  it('includes steps for collapsed column, assignee, column selector, priority and label', () => {
    const ids = TASK_TOUR_STEPS.map((s) => s.id)
    expect(ids).toContain('tasks-collapsed-column')
    expect(ids).toContain('tasks-assignee-filter')
    expect(ids).toContain('tasks-column-selector')
    expect(ids).toContain('tasks-priority-filter')
    expect(ids).toContain('tasks-label-filter')
  })

  it('shows collapsed column step content when active', () => {
    const idx = TASK_TOUR_STEPS.findIndex((s) => s.id === 'tasks-collapsed-column')
    useTaskTourStore.setState({ isActive: true, currentStep: idx })
    render(<TaskTourOverlay />)
    expect(screen.getByText('Collapsed columns')).toBeInTheDocument()
  })

  it('shows column selector step content when active', () => {
    const idx = TASK_TOUR_STEPS.findIndex((s) => s.id === 'tasks-column-selector')
    useTaskTourStore.setState({ isActive: true, currentStep: idx })
    render(<TaskTourOverlay />)
    expect(screen.getByText('Column visibility')).toBeInTheDocument()
  })

  it('shows priority filter step content when active', () => {
    const idx = TASK_TOUR_STEPS.findIndex((s) => s.id === 'tasks-priority-filter')
    useTaskTourStore.setState({ isActive: true, currentStep: idx })
    render(<TaskTourOverlay />)
    expect(screen.getByText('Filter by priority')).toBeInTheDocument()
  })

  it('shows assignee filter step content when active', () => {
    const idx = TASK_TOUR_STEPS.findIndex((s) => s.id === 'tasks-assignee-filter')
    useTaskTourStore.setState({ isActive: true, currentStep: idx })
    render(<TaskTourOverlay />)
    expect(screen.getByText('Filter by assignee')).toBeInTheDocument()
  })

  it('shows label filter step content when active', () => {
    const idx = TASK_TOUR_STEPS.findIndex((s) => s.id === 'tasks-label-filter')
    useTaskTourStore.setState({ isActive: true, currentStep: idx })
    render(<TaskTourOverlay />)
    expect(screen.getByText('Filter by label')).toBeInTheDocument()
  })
})
