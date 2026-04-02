import { create } from 'zustand'
import { persist } from 'zustand/middleware'

interface TourState {
  hasCompleted: boolean
  isActive: boolean
  currentStep: number
  startTour: () => void
  nextStep: (totalSteps: number) => void
  prevStep: () => void
  skipTour: () => void
  completeTour: () => void
  resetTour: () => void
}

export const useTourStore = create<TourState>()(
  persist(
    (set) => ({
      hasCompleted: false,
      isActive: false,
      currentStep: 0,
      startTour: () => set({ isActive: true, currentStep: 0 }),
      nextStep: (totalSteps: number) =>
        set((s) => {
          if (s.currentStep >= totalSteps - 1) {
            return { isActive: false, hasCompleted: true, currentStep: 0 }
          }
          return { currentStep: s.currentStep + 1 }
        }),
      prevStep: () => set((s) => ({ currentStep: Math.max(0, s.currentStep - 1) })),
      skipTour: () => set({ isActive: false, hasCompleted: true, currentStep: 0 }),
      completeTour: () => set({ isActive: false, hasCompleted: true, currentStep: 0 }),
      resetTour: () => set({ hasCompleted: false, isActive: false, currentStep: 0 }),
    }),
    {
      name: 'workived-tour',
      partialize: (state) => ({ hasCompleted: state.hasCompleted }),
    }
  )
)
