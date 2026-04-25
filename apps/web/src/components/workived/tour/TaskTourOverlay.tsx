import { useEffect, useState, useCallback, useRef } from 'react'
import { createPortal } from 'react-dom'
import { useTaskTourStore } from '@/lib/stores/taskTour'
import {
  SpotlightOverlay,
  SpotlightTooltip,
  ModalCard,
  getTargetRect,
  type TourStep,
  type ModalStep,
} from './TourEngine'
import { trackTourEvent } from '@/lib/tours/instrumentation'

// ── Task board tour steps ────────────────────────────────────────

export const TASK_TOUR_STEPS: TourStep[] = [
  {
    id: 'tasks-welcome',
    type: 'modal',
    title: 'Your Task Board',
    description: "Here's a quick walkthrough of how the board works.\nTakes about 30 seconds.",
    icon: '📋',
  },
  {
    id: 'tasks-board',
    type: 'spotlight',
    target: '[data-tour="tasks-board"]',
    title: 'Board layout',
    description: 'Cards flow left to right through workflow columns. Each column is a stage — backlog, in progress, review, done. Your team customises these.',
  },
  {
    id: 'tasks-first-column',
    type: 'spotlight',
    target: '[data-tour="tasks-first-column"]',
    title: 'Columns & state changes',
    description: 'The number above the column name is the live task count. Drag a card to the last column to auto-complete it — the board tracks that state change for you.',
  },
  {
    id: 'tasks-add-btn',
    type: 'spotlight',
    target: '[data-tour="tasks-add-btn"]',
    title: 'Creating tasks',
    description: "Click '+ Add' to create a task inline, or open the full editor for details like due date, priority, labels, and file attachments.",
  },
  {
    id: 'tasks-filter-bar',
    type: 'spotlight',
    target: '[data-tour="tasks-filter-bar"]',
    title: 'Filters & search',
    description: 'Filter by assignee, priority, or label. Search updates instantly across titles and descriptions. Use "All Tasks" for a sortable table view.',
  },
  {
    id: 'tasks-view-tabs',
    type: 'spotlight',
    target: '[data-tour="tasks-view-tabs"]',
    title: 'Views & approvals',
    description: "Switch between All, Tasks, and Approvals. Leave requests and expense claims from your team appear under Approvals — approve or reject without leaving this page.",
  },
  {
    id: 'tasks-workload',
    type: 'spotlight',
    target: '[data-tour="tasks-workload"]',
    title: 'Team workload',
    description: 'These badges show who is available, busy, or on leave right now. Click any badge to see which team members are in that state before assigning work.',
  },
  {
    id: 'tasks-done',
    type: 'modal',
    title: "Board unlocked.",
    description: "Drag cards to move them, click any card to open full details.\nYou can replay this tour anytime from Settings.",
    icon: '🚀',
  },
]

// ── TaskTourOverlay ──────────────────────────────────────────────

export function TaskTourOverlay() {
  const { isActive, currentStep, nextStep, prevStep, skipTour } = useTaskTourStore()
  const [targetRect, setTargetRect] = useState<DOMRect | null>(null)
  const [isAnimating, setIsAnimating] = useState(false)
  const overlayRef = useRef<HTMLDivElement>(null)
  const prevStepRef = useRef<number>(-1)

  const step = TASK_TOUR_STEPS[currentStep]
  const totalSteps = TASK_TOUR_STEPS.length
  const isFirstStep = currentStep === 0
  const isLastStep = currentStep === totalSteps - 1

  const updateRect = useCallback(() => {
    if (!step || step.type !== 'spotlight') {
      setTargetRect(null)
      return
    }
    const el = document.querySelector(step.target)
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
    const rect = getTargetRect(step.target)
    setTargetRect(rect)
  }, [step])

  useEffect(() => {
    if (!isActive) return
    updateRect()
    window.addEventListener('resize', updateRect)
    window.addEventListener('scroll', updateRect, true)
    return () => {
      window.removeEventListener('resize', updateRect)
      window.removeEventListener('scroll', updateRect, true)
    }
  }, [isActive, updateRect])

  // Animation on step change
  useEffect(() => {
    if (!isActive) return
    setIsAnimating(true)
    const timer = setTimeout(() => setIsAnimating(false), 250)
    return () => clearTimeout(timer)
  }, [currentStep, isActive])

  // Instrumentation
  useEffect(() => {
    if (!isActive) return
    if (currentStep === prevStepRef.current) return
    prevStepRef.current = currentStep

    if (currentStep === 0) {
      trackTourEvent('tour_started', { tour_id: 'tasks', total_steps: totalSteps })
    }
    trackTourEvent('step_viewed', {
      tour_id: 'tasks',
      step_index: currentStep,
      step_id: step?.id,
      total_steps: totalSteps,
    })
  }, [isActive, currentStep, step, totalSteps])

  // Keyboard navigation
  useEffect(() => {
    if (!isActive) return
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        trackTourEvent('tour_skipped', { tour_id: 'tasks', step_index: currentStep })
        skipTour()
      } else if (e.key === 'ArrowRight' || e.key === 'Enter') {
        nextStep(totalSteps)
      } else if (e.key === 'ArrowLeft' && !isFirstStep) {
        prevStep()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isActive, isFirstStep, currentStep, nextStep, prevStep, skipTour, totalSteps])

  if (!isActive || !step) return null

  const isModal = step.type === 'modal' || (step.type === 'spotlight' && !targetRect)

  const handleNext = () => {
    if (isLastStep) {
      trackTourEvent('tour_completed', { tour_id: 'tasks', total_steps: totalSteps })
    }
    nextStep(totalSteps)
  }

  const handleSkip = () => {
    trackTourEvent('tour_skipped', { tour_id: 'tasks', step_index: currentStep })
    skipTour()
  }

  return createPortal(
    <div
      ref={overlayRef}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 99999,
        transition: 'opacity 0.25s ease',
        opacity: isAnimating ? 0.6 : 1,
      }}
      aria-modal="true"
      role="dialog"
      aria-label="Task board tour"
    >
      {isModal ? (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            background: 'rgba(0, 0, 0, 0.65)',
            backdropFilter: 'blur(4px)',
            WebkitBackdropFilter: 'blur(4px)',
          }}
          onClick={handleNext}
        />
      ) : (
        <SpotlightOverlay rect={targetRect!} onClick={handleNext} />
      )}

      {isModal ? (
        <ModalCard
          step={step as ModalStep}
          currentStep={currentStep}
          totalSteps={totalSteps}
          isFirstStep={isFirstStep}
          isLastStep={isLastStep}
          onNext={handleNext}
          onPrev={prevStep}
          onSkip={handleSkip}
        />
      ) : (
        <SpotlightTooltip
          rect={targetRect!}
          step={step}
          currentStep={currentStep}
          totalSteps={totalSteps}
          isFirstStep={isFirstStep}
          isLastStep={isLastStep}
          onNext={handleNext}
          onPrev={prevStep}
          onSkip={handleSkip}
        />
      )}
    </div>,
    document.body
  )
}
