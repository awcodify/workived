import { useEffect, useState, useCallback, useRef } from 'react'
import { createPortal } from 'react-dom'
import { useTourStore } from '@/lib/stores/tour'
import { OverviewWelcomeIcon, OverviewDoneIcon } from './TourIcons'
import {
  SpotlightOverlay,
  SpotlightTooltip,
  ModalCard,
  getTargetRect,
  type TourStep,
  type ModalStep,
} from './TourEngine'
import { trackTourEvent } from '@/lib/tours/instrumentation'

// ── Overview tour step definitions ──────────────────────────────

export const TOUR_STEPS: TourStep[] = [
  {
    id: 'welcome',
    type: 'modal',
    title: 'Welcome to Workived!',
    description: "Let’s take a quick tour so you know where everything is.\nIt only takes a minute.",
    icon: <OverviewWelcomeIcon />,
  },
  {
    id: 'dock',
    type: 'spotlight',
    target: '[data-tour="dock"]',
    title: 'Your Navigation Dock',
    description: 'This is your main navigation. Switch between modules from here — each one has its own colour world.',
  },
  {
    id: 'overview-dock',
    type: 'spotlight',
    target: '[data-tour="dock-overview"]',
    title: 'Overview',
    description: 'Your home base. See attendance, leave balance, claims budget, and team pulse at a glance.',
  },
  {
    id: 'attendance-dock',
    type: 'spotlight',
    target: '[data-tour="dock-attendance"]',
    title: 'Attendance',
    description: 'Full attendance page with calendar view, weekly reports, and work schedule management.',
  },
  {
    id: 'tasks-dock',
    type: 'spotlight',
    target: '[data-tour="dock-tasks"]',
    title: 'Tasks',
    description: 'Kanban board for your team. Drag tasks between columns, set priorities, and track progress.',
  },
  {
    id: 'leave-dock',
    type: 'spotlight',
    target: '[data-tour="dock-leave"]',
    title: 'Leave',
    description: 'Request time off, check your balance, and review approvals.',
  },
  {
    id: 'claims-dock',
    type: 'spotlight',
    target: '[data-tour="dock-claims"]',
    title: 'Claims',
    description: 'Submit expenses with receipts and track reimbursement status.',
  },
  {
    id: 'calendar-dock',
    type: 'spotlight',
    target: '[data-tour="dock-calendar"]',
    title: 'Calendar',
    description: 'See leave, holidays, and team events all in one view.',
  },
  {
    id: 'dashboards-dock',
    type: 'spotlight',
    target: '[data-tour="dock-reports"]',
    title: 'Dashboards',
    description: 'Reports and analytics for your organisation — attendance trends, leave usage, headcount, and more.',
  },
  {
    id: 'people-dock',
    type: 'spotlight',
    target: '[data-tour="dock-people"]',
    title: 'People',
    description: 'Your team directory with profiles, departments, and org chart.',
  },
  {
    id: 'settings-dock',
    type: 'spotlight',
    target: '[data-tour="dock-settings"]',
    title: 'Settings',
    description: 'Company settings, team members, theme toggle, and your profile. You can also replay this tour from here.',
  },
  {
    id: 'notification-bell',
    type: 'spotlight',
    target: '[data-tour="notification-bell"]',
    title: 'Notifications',
    description: 'Company announcements and important updates land here. Tap the bell to see what needs your attention.',
  },
  {
    id: 'attendance-card',
    type: 'spotlight',
    target: '[data-tour="attendance-card"]',
    title: 'Quick Clock In',
    description: 'Clock in and out right from the overview. Your work schedule and hours are tracked here.',
  },
  {
    id: 'balances-column',
    type: 'spotlight',
    target: '[data-tour="balances-column"]',
    title: 'Leave & Claims',
    description: 'Your annual leave balance and expense budget at a glance. Pending approvals appear here too.',
  },
  {
    id: 'team-pulse',
    type: 'spotlight',
    target: '[data-tour="team-pulse"]',
    title: 'Team Pulse',
    description: "See who's in, who's away, and who's running late — all in real time.",
  },
  {
    id: 'done',
    type: 'modal',
    title: "You’re all set!",
    description: 'Start by clocking in for today.\nYou can replay this tour anytime from Settings.',
    icon: <OverviewDoneIcon />,
  },
]

// ── TourOverlay ──────────────────────────────────────────────────

export function TourOverlay() {
  const { isActive, currentStep, nextStep, prevStep, skipTour } = useTourStore()
  const [targetRect, setTargetRect] = useState<DOMRect | null>(null)
  const [isAnimating, setIsAnimating] = useState(false)
  const overlayRef = useRef<HTMLDivElement>(null)
  const prevStepRef = useRef<number>(-1)

  const step = TOUR_STEPS[currentStep]
  const totalSteps = TOUR_STEPS.length
  const isFirstStep = currentStep === 0
  const isLastStep = currentStep === totalSteps - 1

  const updateRect = useCallback(() => {
    if (!step || step.type !== 'spotlight') {
      setTargetRect(null)
      return
    }
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
      trackTourEvent('tour_started', { tour_id: 'overview', total_steps: totalSteps })
    }
    trackTourEvent('step_viewed', {
      tour_id: 'overview',
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
        trackTourEvent('tour_skipped', { tour_id: 'overview', step_index: currentStep })
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
      trackTourEvent('tour_completed', { tour_id: 'overview', total_steps: totalSteps })
    }
    nextStep(totalSteps)
  }

  const handleSkip = () => {
    trackTourEvent('tour_skipped', { tour_id: 'overview', step_index: currentStep })
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
      aria-label="Product tour"
    >
      {/* Overlay background */}
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

      {/* Content */}
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
