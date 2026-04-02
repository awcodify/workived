import { useEffect, useState, useCallback, useRef } from 'react'
import { createPortal } from 'react-dom'
import { useTourStore } from '@/lib/stores/tour'
import { colors, typography } from '@/design/tokens'
import { ChevronLeft, ChevronRight, X, Sparkles } from 'lucide-react'

// ── Tour step definitions ────────────────────────────────────────

interface ModalStep {
  id: string
  type: 'modal'
  title: string
  description: string
  icon: string
}

interface SpotlightStep {
  id: string
  type: 'spotlight'
  target: string
  title: string
  description: string
}

type TourStep = ModalStep | SpotlightStep

const TOUR_STEPS: TourStep[] = [
  {
    id: 'welcome',
    type: 'modal',
    title: 'Welcome to Workived!',
    description:
      "Let\u2019s take a quick tour so you know where everything is.\nIt only takes a minute.",
    icon: '\uD83D\uDC4B',
  },
  // ── Dock navigation ──
  {
    id: 'dock',
    type: 'spotlight',
    target: '[data-tour="dock"]',
    title: 'Your Navigation Dock',
    description:
      'This is your main navigation. Switch between modules from here \u2014 each one has its own colour world.',
  },
  {
    id: 'overview-dock',
    type: 'spotlight',
    target: '[data-tour="dock-overview"]',
    title: 'Overview',
    description:
      'Your home base. See attendance, leave balance, claims budget, and team pulse at a glance.',
  },
  {
    id: 'attendance-dock',
    type: 'spotlight',
    target: '[data-tour="dock-attendance"]',
    title: 'Attendance',
    description:
      'Full attendance page with calendar view, weekly reports, and work schedule management.',
  },
  {
    id: 'tasks-dock',
    type: 'spotlight',
    target: '[data-tour="dock-tasks"]',
    title: 'Tasks',
    description:
      'Kanban board for your team. Drag tasks between columns, set priorities, and track progress.',
  },
  {
    id: 'leave-dock',
    type: 'spotlight',
    target: '[data-tour="dock-leave"]',
    title: 'Leave',
    description:
      'Request time off, check your balance, and review approvals.',
  },
  {
    id: 'claims-dock',
    type: 'spotlight',
    target: '[data-tour="dock-claims"]',
    title: 'Claims',
    description:
      'Submit expenses with receipts and track reimbursement status.',
  },
  {
    id: 'calendar-dock',
    type: 'spotlight',
    target: '[data-tour="dock-calendar"]',
    title: 'Calendar',
    description:
      'See leave, holidays, and team events all in one view.',
  },
  {
    id: 'people-dock',
    type: 'spotlight',
    target: '[data-tour="dock-people"]',
    title: 'People',
    description:
      'Your team directory with profiles, departments, and org chart.',
  },
  {
    id: 'settings-dock',
    type: 'spotlight',
    target: '[data-tour="dock-settings"]',
    title: 'Settings',
    description:
      'Company settings, team members, theme toggle, and your profile. You can also replay this tour from here.',
  },
  // ── Overview widgets ──
  {
    id: 'notification-bell',
    type: 'spotlight',
    target: '[data-tour="notification-bell"]',
    title: 'Notifications',
    description:
      'Stay on top of things. Leave approvals, claim updates, and team activity show up here.',
  },
  {
    id: 'attendance-card',
    type: 'spotlight',
    target: '[data-tour="attendance-card"]',
    title: 'Quick Clock In',
    description:
      'Clock in and out right from the overview. Your work schedule and hours are tracked here.',
  },
  {
    id: 'balances-column',
    type: 'spotlight',
    target: '[data-tour="balances-column"]',
    title: 'Leave & Claims',
    description:
      'Your annual leave balance and expense budget at a glance. Pending approvals appear here too.',
  },
  {
    id: 'team-pulse',
    type: 'spotlight',
    target: '[data-tour="team-pulse"]',
    title: 'Team Pulse',
    description:
      "See who\u2019s in, who\u2019s away, and who\u2019s running late \u2014 all in real time.",
  },
  {
    id: 'done',
    type: 'modal',
    title: "You\u2019re all set!",
    description:
      'Start by clocking in for today.\nYou can replay this tour anytime from Settings.',
    icon: '\uD83C\uDF89',
  },
]

// ── Helpers ──────────────────────────────────────────────────────

const SPOTLIGHT_PADDING = 8

function getTargetRect(selector: string): DOMRect | null {
  const el = document.querySelector(selector)
  if (!el) return null
  const rect = el.getBoundingClientRect()
  if (rect.width === 0 && rect.height === 0) return null
  return rect
}

// ── TourOverlay ──────────────────────────────────────────────────

export function TourOverlay() {
  const { isActive, currentStep, nextStep, prevStep, skipTour } = useTourStore()
  const [targetRect, setTargetRect] = useState<DOMRect | null>(null)
  const [isAnimating, setIsAnimating] = useState(false)
  const overlayRef = useRef<HTMLDivElement>(null)

  const step = TOUR_STEPS[currentStep]
  const totalSteps = TOUR_STEPS.length
  const isFirstStep = currentStep === 0
  const isLastStep = currentStep === totalSteps - 1

  // Compute target rect for spotlight steps
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
    // Update immediately + on scroll/resize
    updateRect()
    window.addEventListener('resize', updateRect)
    window.addEventListener('scroll', updateRect, true)
    return () => {
      window.removeEventListener('resize', updateRect)
      window.removeEventListener('scroll', updateRect, true)
    }
  }, [isActive, updateRect])

  // Animate on step change
  useEffect(() => {
    if (!isActive) return
    setIsAnimating(true)
    const timer = setTimeout(() => setIsAnimating(false), 250)
    return () => clearTimeout(timer)
  }, [currentStep, isActive])

  // Keyboard navigation
  useEffect(() => {
    if (!isActive) return
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        skipTour()
      } else if (e.key === 'ArrowRight' || e.key === 'Enter') {
        nextStep(totalSteps)
      } else if (e.key === 'ArrowLeft' && !isFirstStep) {
        prevStep()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isActive, isFirstStep, nextStep, prevStep, skipTour, totalSteps])

  if (!isActive || !step) return null

  const isModal = step.type === 'modal' || (step.type === 'spotlight' && !targetRect)

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
          onClick={() => nextStep(totalSteps)}
        />
      ) : (
        <SpotlightOverlay rect={targetRect!} onClick={() => nextStep(totalSteps)} />
      )}

      {/* Content */}
      {isModal ? (
        <ModalCard
          step={step as ModalStep}
          currentStep={currentStep}
          totalSteps={totalSteps}
          isFirstStep={isFirstStep}
          isLastStep={isLastStep}
          onNext={() => nextStep(totalSteps)}
          onPrev={prevStep}
          onSkip={skipTour}
        />
      ) : (
        <SpotlightTooltip
          rect={targetRect!}
          step={step}
          currentStep={currentStep}
          totalSteps={totalSteps}
          isFirstStep={isFirstStep}
          isLastStep={isLastStep}
          onNext={() => nextStep(totalSteps)}
          onPrev={prevStep}
          onSkip={skipTour}
        />
      )}
    </div>,
    document.body
  )
}

// ── Spotlight Overlay (box-shadow cutout) ────────────────────────

function SpotlightOverlay({
  rect,
  onClick,
}: {
  rect: DOMRect
  onClick: () => void
}) {
  return (
    <>
      {/* Click-blocker behind the spotlight */}
      <div
        style={{ position: 'absolute', inset: 0 }}
        onClick={onClick}
      />
      {/* Spotlight hole via box-shadow */}
      <div
        style={{
          position: 'fixed',
          top: rect.top - SPOTLIGHT_PADDING,
          left: rect.left - SPOTLIGHT_PADDING,
          width: rect.width + SPOTLIGHT_PADDING * 2,
          height: rect.height + SPOTLIGHT_PADDING * 2,
          borderRadius: 16,
          boxShadow: '0 0 0 9999px rgba(0, 0, 0, 0.6)',
          pointerEvents: 'none',
          transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
          zIndex: 1,
        }}
      />
    </>
  )
}

// ── Modal Card (Welcome / Done) ──────────────────────────────────

function ModalCard({
  step,
  currentStep,
  totalSteps,
  isFirstStep,
  isLastStep,
  onNext,
  onPrev,
  onSkip,
}: {
  step: ModalStep
  currentStep: number
  totalSteps: number
  isFirstStep: boolean
  isLastStep: boolean
  onNext: () => void
  onPrev: () => void
  onSkip: () => void
}) {
  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        pointerEvents: 'none',
        padding: 24,
      }}
    >
      <div
        style={{
          background: '#FFFFFF',
          borderRadius: 20,
          padding: '40px 36px 32px',
          maxWidth: 400,
          width: '100%',
          textAlign: 'center',
          pointerEvents: 'auto',
          boxShadow: '0 24px 64px rgba(0, 0, 0, 0.25), 0 8px 24px rgba(0, 0, 0, 0.15)',
          animation: 'tour-card-in 0.3s cubic-bezier(0.34, 1.56, 0.64, 1)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Icon */}
        <div style={{ fontSize: 48, marginBottom: 16, lineHeight: 1 }}>
          {step.icon}
        </div>

        {/* Title */}
        <h2
          style={{
            fontSize: typography.h1.size,
            fontWeight: typography.h1.weight,
            letterSpacing: typography.h1.tracking,
            lineHeight: typography.h1.lineHeight,
            color: colors.ink900,
            marginBottom: 12,
          }}
        >
          {step.title}
        </h2>

        {/* Description */}
        <p
          style={{
            fontSize: typography.body.size,
            fontWeight: 400,
            color: colors.ink500,
            lineHeight: 1.6,
            whiteSpace: 'pre-line',
            marginBottom: 28,
          }}
        >
          {step.description}
        </p>

        {/* Step dots */}
        <StepDots current={currentStep} total={totalSteps} />

        {/* Actions */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 12,
            marginTop: 24,
          }}
        >
          {!isFirstStep && (
            <button
              onClick={onPrev}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 4,
                padding: '10px 18px',
                borderRadius: 12,
                border: `1px solid ${colors.ink150}`,
                background: 'transparent',
                color: colors.ink500,
                fontSize: 14,
                fontWeight: 600,
                cursor: 'pointer',
                transition: 'all 0.15s',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = colors.ink50
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'transparent'
              }}
            >
              <ChevronLeft size={16} />
              Back
            </button>
          )}

          <button
            onClick={onNext}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              padding: '10px 24px',
              borderRadius: 12,
              border: 'none',
              background: colors.accent,
              color: '#FFFFFF',
              fontSize: 14,
              fontWeight: 700,
              cursor: 'pointer',
              transition: 'all 0.15s',
              boxShadow: `0 4px 12px ${colors.accent}40`,
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = 'translateY(-1px)'
              e.currentTarget.style.boxShadow = `0 6px 16px ${colors.accent}60`
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = 'translateY(0)'
              e.currentTarget.style.boxShadow = `0 4px 12px ${colors.accent}40`
            }}
          >
            {isFirstStep && <Sparkles size={16} />}
            {isFirstStep ? "Let\u2019s go" : isLastStep ? 'Start exploring' : 'Next'}
            {!isFirstStep && !isLastStep && <ChevronRight size={16} />}
          </button>
        </div>

        {/* Skip link */}
        {!isLastStep && (
          <button
            onClick={onSkip}
            style={{
              marginTop: 16,
              padding: '4px 8px',
              background: 'transparent',
              border: 'none',
              color: colors.ink300,
              fontSize: 13,
              fontWeight: 500,
              cursor: 'pointer',
              transition: 'color 0.15s',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.color = colors.ink500
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.color = colors.ink300
            }}
          >
            Skip tour
          </button>
        )}
      </div>
    </div>
  )
}

// ── Spotlight Tooltip ────────────────────────────────────────────

function SpotlightTooltip({
  rect,
  step,
  currentStep,
  totalSteps,
  isFirstStep,
  isLastStep,
  onNext,
  onPrev,
  onSkip,
}: {
  rect: DOMRect
  step: TourStep
  currentStep: number
  totalSteps: number
  isFirstStep: boolean
  isLastStep: boolean
  onNext: () => void
  onPrev: () => void
  onSkip: () => void
}) {
  const tooltipRef = useRef<HTMLDivElement>(null)
  const [tooltipPos, setTooltipPos] = useState<{ top: number; left: number }>({
    top: 0,
    left: 0,
  })

  useEffect(() => {
    if (!tooltipRef.current) return
    const tooltipRect = tooltipRef.current.getBoundingClientRect()
    const viewportW = window.innerWidth
    const tooltipW = tooltipRect.width

    // Position above the spotlight element
    let top = rect.top - SPOTLIGHT_PADDING - tooltipRect.height - 16
    let left = rect.left + rect.width / 2 - tooltipW / 2

    // If tooltip goes off-screen top, position below instead
    if (top < 16) {
      top = rect.bottom + SPOTLIGHT_PADDING + 16
    }

    // Clamp horizontal
    left = Math.max(16, Math.min(left, viewportW - tooltipW - 16))

    setTooltipPos({ top, left })
  }, [rect])

  return (
    <div
      ref={tooltipRef}
      style={{
        position: 'fixed',
        top: tooltipPos.top,
        left: tooltipPos.left,
        zIndex: 2,
        background: '#FFFFFF',
        borderRadius: 16,
        padding: '24px 28px 20px',
        maxWidth: 340,
        width: '100%',
        boxShadow:
          '0 16px 48px rgba(0, 0, 0, 0.2), 0 4px 16px rgba(0, 0, 0, 0.1)',
        pointerEvents: 'auto',
        animation: 'tour-card-in 0.25s cubic-bezier(0.34, 1.56, 0.64, 1)',
      }}
      onClick={(e) => e.stopPropagation()}
    >
      {/* Skip button (top-right) */}
      <button
        onClick={onSkip}
        style={{
          position: 'absolute',
          top: 12,
          right: 12,
          background: 'transparent',
          border: 'none',
          color: colors.ink300,
          cursor: 'pointer',
          padding: 4,
          borderRadius: 8,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          transition: 'color 0.15s',
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.color = colors.ink500
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.color = colors.ink300
        }}
        aria-label="Skip tour"
      >
        <X size={16} />
      </button>

      {/* Title */}
      <h3
        style={{
          fontSize: typography.h2.size,
          fontWeight: typography.h2.weight,
          letterSpacing: typography.h2.tracking,
          lineHeight: typography.h2.lineHeight,
          color: colors.ink900,
          marginBottom: 8,
          paddingRight: 24,
        }}
      >
        {step.title}
      </h3>

      {/* Description */}
      <p
        style={{
          fontSize: typography.body.size,
          fontWeight: 400,
          color: colors.ink500,
          lineHeight: 1.55,
          marginBottom: 20,
        }}
      >
        {step.description}
      </p>

      {/* Step dots */}
      <StepDots current={currentStep} total={totalSteps} />

      {/* Navigation */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginTop: 16,
        }}
      >
        <button
          onClick={onPrev}
          disabled={isFirstStep}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 4,
            padding: '8px 14px',
            borderRadius: 10,
            border: `1px solid ${isFirstStep ? colors.ink100 : colors.ink150}`,
            background: 'transparent',
            color: isFirstStep ? colors.ink150 : colors.ink500,
            fontSize: 13,
            fontWeight: 600,
            cursor: isFirstStep ? 'default' : 'pointer',
            transition: 'all 0.15s',
          }}
          onMouseEnter={(e) => {
            if (!isFirstStep) e.currentTarget.style.background = colors.ink50
          }}
          onMouseLeave={(e) => {
            if (!isFirstStep) e.currentTarget.style.background = 'transparent'
          }}
        >
          <ChevronLeft size={14} />
          Back
        </button>

        <button
          onClick={onNext}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 4,
            padding: '8px 18px',
            borderRadius: 10,
            border: 'none',
            background: colors.accent,
            color: '#FFFFFF',
            fontSize: 13,
            fontWeight: 700,
            cursor: 'pointer',
            transition: 'all 0.15s',
            boxShadow: `0 3px 10px ${colors.accent}40`,
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.transform = 'translateY(-1px)'
            e.currentTarget.style.boxShadow = `0 5px 14px ${colors.accent}60`
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.transform = 'translateY(0)'
            e.currentTarget.style.boxShadow = `0 3px 10px ${colors.accent}40`
          }}
        >
          {isLastStep ? 'Finish' : 'Next'}
          {!isLastStep && <ChevronRight size={14} />}
        </button>
      </div>
    </div>
  )
}

// ── Step indicator dots ──────────────────────────────────────────

function StepDots({ current, total }: { current: number; total: number }) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 6,
      }}
    >
      {Array.from({ length: total }, (_, i) => (
        <div
          key={i}
          style={{
            width: i === current ? 20 : 7,
            height: 7,
            borderRadius: 4,
            background: i === current ? colors.accent : colors.ink150,
            transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
          }}
        />
      ))}
    </div>
  )
}

// ── CSS keyframe injection ───────────────────────────────────────

const TOUR_STYLES = `
@keyframes tour-card-in {
  from {
    opacity: 0;
    transform: scale(0.92) translateY(8px);
  }
  to {
    opacity: 1;
    transform: scale(1) translateY(0);
  }
}
`

// Inject styles once
if (typeof document !== 'undefined') {
  const id = 'workived-tour-styles'
  if (!document.getElementById(id)) {
    const style = document.createElement('style')
    style.id = id
    style.textContent = TOUR_STYLES
    document.head.appendChild(style)
  }
}

export { TOUR_STEPS }
