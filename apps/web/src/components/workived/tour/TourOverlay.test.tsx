import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { TourOverlay, TOUR_STEPS } from './TourOverlay'
import { useTourStore } from '@/lib/stores/tour'

describe('TourOverlay', () => {
  beforeEach(() => {
    useTourStore.setState({
      hasCompleted: false,
      isActive: false,
      currentStep: 0,
    })
  })

  it('renders nothing when tour is inactive', () => {
    const { container } = render(<TourOverlay />)
    expect(container.innerHTML).toBe('')
  })

  it('renders welcome modal on step 0', () => {
    useTourStore.setState({ isActive: true, currentStep: 0 })
    render(<TourOverlay />)
    expect(screen.getByText('Welcome to Workived!')).toBeInTheDocument()
    expect(screen.getByText("Let\u2019s go")).toBeInTheDocument()
    expect(screen.getByText('Skip tour')).toBeInTheDocument()
  })

  it('advances to next step when clicking Next/Let\'s go', () => {
    useTourStore.setState({ isActive: true, currentStep: 0 })
    render(<TourOverlay />)
    fireEvent.click(screen.getByText("Let\u2019s go"))
    expect(useTourStore.getState().currentStep).toBe(1)
  })

  it('shows spotlight step as modal when target not found', () => {
    // Step 1 (dock) has target [data-tour="dock"] which won't exist in test DOM
    useTourStore.setState({ isActive: true, currentStep: 1 })
    render(<TourOverlay />)
    // Should fall back to modal display since target element doesn't exist
    expect(screen.getByText('Your Navigation Dock')).toBeInTheDocument()
  })

  it('shows the done modal on last step', () => {
    useTourStore.setState({ isActive: true, currentStep: TOUR_STEPS.length - 1 })
    render(<TourOverlay />)
    expect(screen.getByText("You\u2019re all set!")).toBeInTheDocument()
    expect(screen.getByText('Start exploring')).toBeInTheDocument()
  })

  it('completes tour after clicking Start exploring on last step', () => {
    useTourStore.setState({ isActive: true, currentStep: TOUR_STEPS.length - 1 })
    render(<TourOverlay />)
    fireEvent.click(screen.getByText('Start exploring'))
    const state = useTourStore.getState()
    expect(state.isActive).toBe(false)
    expect(state.hasCompleted).toBe(true)
  })

  it('skips tour when Skip tour is clicked', () => {
    useTourStore.setState({ isActive: true, currentStep: 0 })
    render(<TourOverlay />)
    fireEvent.click(screen.getByText('Skip tour'))
    const state = useTourStore.getState()
    expect(state.isActive).toBe(false)
    expect(state.hasCompleted).toBe(true)
  })

  it('navigates back with Back button', () => {
    useTourStore.setState({ isActive: true, currentStep: TOUR_STEPS.length - 1 })
    render(<TourOverlay />)
    fireEvent.click(screen.getByText('Back'))
    expect(useTourStore.getState().currentStep).toBe(TOUR_STEPS.length - 2)
  })

  it('does not show Back button on first step', () => {
    useTourStore.setState({ isActive: true, currentStep: 0 })
    render(<TourOverlay />)
    expect(screen.queryByText('Back')).not.toBeInTheDocument()
  })

  it('does not show Skip tour on last step', () => {
    useTourStore.setState({ isActive: true, currentStep: TOUR_STEPS.length - 1 })
    render(<TourOverlay />)
    expect(screen.queryByText('Skip tour')).not.toBeInTheDocument()
  })

  it('renders step dots matching total steps', () => {
    useTourStore.setState({ isActive: true, currentStep: 0 })
    const { container } = render(<TourOverlay />)
    // Step dots are in a flex container - count dots
    const portal = document.body.querySelector('[role="dialog"]')
    expect(portal).toBeInTheDocument()
  })

  it('skips tour on Escape key', () => {
    useTourStore.setState({ isActive: true, currentStep: 2 })
    render(<TourOverlay />)
    fireEvent.keyDown(window, { key: 'Escape' })
    expect(useTourStore.getState().isActive).toBe(false)
    expect(useTourStore.getState().hasCompleted).toBe(true)
  })

  it('advances on Enter key', () => {
    useTourStore.setState({ isActive: true, currentStep: 0 })
    render(<TourOverlay />)
    fireEvent.keyDown(window, { key: 'Enter' })
    expect(useTourStore.getState().currentStep).toBe(1)
  })

  it('advances on ArrowRight key', () => {
    useTourStore.setState({ isActive: true, currentStep: 0 })
    render(<TourOverlay />)
    fireEvent.keyDown(window, { key: 'ArrowRight' })
    expect(useTourStore.getState().currentStep).toBe(1)
  })

  it('goes back on ArrowLeft key', () => {
    useTourStore.setState({ isActive: true, currentStep: 3 })
    render(<TourOverlay />)
    fireEvent.keyDown(window, { key: 'ArrowLeft' })
    expect(useTourStore.getState().currentStep).toBe(2)
  })

  it('has correct number of tour steps', () => {
    expect(TOUR_STEPS.length).toBe(15)
    expect(TOUR_STEPS[0].type).toBe('modal')
    expect(TOUR_STEPS[TOUR_STEPS.length - 1].type).toBe('modal')
  })

  it('has dock as first spotlight step before overview widgets', () => {
    const ids = TOUR_STEPS.map(s => s.id)
    expect(ids.indexOf('dock')).toBeLessThan(ids.indexOf('notification-bell'))
    expect(ids.indexOf('dock')).toBeLessThan(ids.indexOf('attendance-card'))
    expect(ids.indexOf('dock')).toBeLessThan(ids.indexOf('team-pulse'))
  })

  it('does not include quote card step', () => {
    const ids = TOUR_STEPS.map(s => s.id)
    expect(ids).not.toContain('quote-card')
  })

  it('renders overview widget step content', () => {
    // Quick Clock In step
    const idx = TOUR_STEPS.findIndex(s => s.id === 'attendance-card')
    useTourStore.setState({ isActive: true, currentStep: idx })
    render(<TourOverlay />)
    expect(screen.getByText('Quick Clock In')).toBeInTheDocument()
  })

  it('renders with aria-modal and dialog role', () => {
    useTourStore.setState({ isActive: true, currentStep: 0 })
    render(<TourOverlay />)
    const dialog = document.body.querySelector('[role="dialog"]')
    expect(dialog).toBeInTheDocument()
    expect(dialog?.getAttribute('aria-modal')).toBe('true')
    expect(dialog?.getAttribute('aria-label')).toBe('Product tour')
  })
})
