import { describe, it, expect, beforeEach } from 'vitest'
import { useTourStore } from './tour'

describe('useTourStore', () => {
  beforeEach(() => {
    useTourStore.setState({
      hasCompleted: false,
      isActive: false,
      currentStep: 0,
    })
  })

  it('starts with tour inactive and not completed', () => {
    const state = useTourStore.getState()
    expect(state.isActive).toBe(false)
    expect(state.hasCompleted).toBe(false)
    expect(state.currentStep).toBe(0)
  })

  it('startTour sets isActive and resets step', () => {
    useTourStore.getState().startTour()
    const state = useTourStore.getState()
    expect(state.isActive).toBe(true)
    expect(state.currentStep).toBe(0)
  })

  it('nextStep increments currentStep', () => {
    useTourStore.getState().startTour()
    useTourStore.getState().nextStep(15)
    expect(useTourStore.getState().currentStep).toBe(1)
  })

  it('nextStep on last step completes tour', () => {
    useTourStore.setState({ isActive: true, currentStep: 14 })
    useTourStore.getState().nextStep(15)
    const state = useTourStore.getState()
    expect(state.isActive).toBe(false)
    expect(state.hasCompleted).toBe(true)
    expect(state.currentStep).toBe(0)
  })

  it('prevStep decrements currentStep', () => {
    useTourStore.setState({ isActive: true, currentStep: 3 })
    useTourStore.getState().prevStep()
    expect(useTourStore.getState().currentStep).toBe(2)
  })

  it('prevStep does not go below 0', () => {
    useTourStore.setState({ isActive: true, currentStep: 0 })
    useTourStore.getState().prevStep()
    expect(useTourStore.getState().currentStep).toBe(0)
  })

  it('skipTour marks completed and deactivates', () => {
    useTourStore.setState({ isActive: true, currentStep: 2 })
    useTourStore.getState().skipTour()
    const state = useTourStore.getState()
    expect(state.isActive).toBe(false)
    expect(state.hasCompleted).toBe(true)
    expect(state.currentStep).toBe(0)
  })

  it('completeTour marks completed and deactivates', () => {
    useTourStore.setState({ isActive: true, currentStep: 6 })
    useTourStore.getState().completeTour()
    const state = useTourStore.getState()
    expect(state.isActive).toBe(false)
    expect(state.hasCompleted).toBe(true)
  })

  it('resetTour clears all state', () => {
    useTourStore.setState({ isActive: true, hasCompleted: true, currentStep: 5 })
    useTourStore.getState().resetTour()
    const state = useTourStore.getState()
    expect(state.isActive).toBe(false)
    expect(state.hasCompleted).toBe(false)
    expect(state.currentStep).toBe(0)
  })
})
