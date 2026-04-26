import { describe, it, expect, beforeEach } from 'vitest'
import { useTaskTourStore } from './taskTour'

const TOTAL = 8

describe('useTaskTourStore', () => {
  beforeEach(() => {
    useTaskTourStore.setState({ hasCompleted: false, isActive: false, currentStep: 0 })
  })

  it('starts with tour inactive', () => {
    const { hasCompleted, isActive, currentStep } = useTaskTourStore.getState()
    expect(hasCompleted).toBe(false)
    expect(isActive).toBe(false)
    expect(currentStep).toBe(0)
  })

  it('startTour activates tour at step 0', () => {
    useTaskTourStore.getState().startTour()
    const { isActive, currentStep } = useTaskTourStore.getState()
    expect(isActive).toBe(true)
    expect(currentStep).toBe(0)
  })

  it('nextStep increments step', () => {
    useTaskTourStore.setState({ isActive: true, currentStep: 2 })
    useTaskTourStore.getState().nextStep(TOTAL)
    expect(useTaskTourStore.getState().currentStep).toBe(3)
  })

  it('nextStep on last step completes tour', () => {
    useTaskTourStore.setState({ isActive: true, currentStep: TOTAL - 1 })
    useTaskTourStore.getState().nextStep(TOTAL)
    const { isActive, hasCompleted, currentStep } = useTaskTourStore.getState()
    expect(isActive).toBe(false)
    expect(hasCompleted).toBe(true)
    expect(currentStep).toBe(0)
  })

  it('prevStep decrements step', () => {
    useTaskTourStore.setState({ isActive: true, currentStep: 3 })
    useTaskTourStore.getState().prevStep()
    expect(useTaskTourStore.getState().currentStep).toBe(2)
  })

  it('prevStep does not go below 0', () => {
    useTaskTourStore.setState({ isActive: true, currentStep: 0 })
    useTaskTourStore.getState().prevStep()
    expect(useTaskTourStore.getState().currentStep).toBe(0)
  })

  it('skipTour marks completed and deactivates', () => {
    useTaskTourStore.setState({ isActive: true, currentStep: 3 })
    useTaskTourStore.getState().skipTour()
    const { isActive, hasCompleted } = useTaskTourStore.getState()
    expect(isActive).toBe(false)
    expect(hasCompleted).toBe(true)
  })

  it('completeTour marks completed and deactivates', () => {
    useTaskTourStore.setState({ isActive: true, currentStep: TOTAL - 1 })
    useTaskTourStore.getState().completeTour()
    expect(useTaskTourStore.getState().isActive).toBe(false)
    expect(useTaskTourStore.getState().hasCompleted).toBe(true)
  })

  it('resetTour clears completion and deactivates', () => {
    useTaskTourStore.setState({ hasCompleted: true, isActive: false, currentStep: 0 })
    useTaskTourStore.getState().resetTour()
    const { hasCompleted, isActive } = useTaskTourStore.getState()
    expect(hasCompleted).toBe(false)
    expect(isActive).toBe(false)
  })
})
