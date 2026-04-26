import { useLayoutEffect, useState, useRef } from 'react'
import type { ReactNode } from 'react'
import { colors, typography } from '@/design/tokens'
import { ChevronLeft, ChevronRight, X, Sparkles } from 'lucide-react'

// ── Types ────────────────────────────────────────────────────────

export interface ModalStep {
  id: string
  type: 'modal'
  title: string
  description: string
  icon: ReactNode
}

export interface SpotlightStep {
  id: string
  type: 'spotlight'
  target: string
  title: string
  description: string
}

export type TourStep = ModalStep | SpotlightStep

// ── Helpers ──────────────────────────────────────────────────────

export const SPOTLIGHT_PADDING = 8

export function getTargetRect(selector: string): DOMRect | null {
  const el = document.querySelector(selector)
  if (!el) return null
  const rect = el.getBoundingClientRect()
  if (rect.width === 0 && rect.height === 0) return null
  return rect
}

// ── Spotlight Overlay (box-shadow cutout) ────────────────────────

export function SpotlightOverlay({
  rect,
  onClick,
}: {
  rect: DOMRect
  onClick: () => void
}) {
  return (
    <>
      <div style={{ position: 'absolute', inset: 0 }} onClick={onClick} />
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

// ── Spotlight Tooltip ────────────────────────────────────────────

export function SpotlightTooltip({
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
  const [tooltipPos, setTooltipPos] = useState<{ top: number; left: number }>({ top: 0, left: 0 })

  // useLayoutEffect ensures DOM is painted before we measure the tooltip's own dimensions.
  // We use fallback dimensions so positioning works even in test environments (jsdom returns 0s).
  useLayoutEffect(() => {
    if (!tooltipRef.current) return
    const tooltipRect = tooltipRef.current.getBoundingClientRect()
    const tooltipW = tooltipRect.width || 340
    const tooltipH = tooltipRect.height || 180
    const viewportW = window.innerWidth || 1280
    const viewportH = window.innerHeight || 768

    // Default: position above the highlighted element
    let top = rect.top - SPOTLIGHT_PADDING - tooltipH - 16
    let left = rect.left + rect.width / 2 - tooltipW / 2

    // If it doesn't fit above: try below, then clamp to top of viewport.
    // Key fix: for bottom-of-screen elements (dock), "below" would be off-screen,
    // so we clamp rather than overflow the viewport.
    if (top < 16) {
      const below = rect.bottom + SPOTLIGHT_PADDING + 16
      if (below + tooltipH <= viewportH - 16) {
        top = below
      } else {
        top = 16
      }
    }

    // Clamp horizontal to stay within viewport
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
        boxShadow: '0 16px 48px rgba(0, 0, 0, 0.2), 0 4px 16px rgba(0, 0, 0, 0.1)',
        pointerEvents: 'auto',
        animation: 'tour-card-in 0.25s cubic-bezier(0.34, 1.56, 0.64, 1)',
      }}
      onClick={(e) => e.stopPropagation()}
    >
      {/* Skip button */}
      <button
        data-testid="tour-spotlight-skip-btn"
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
        onMouseEnter={(e) => { e.currentTarget.style.color = colors.ink500 }}
        onMouseLeave={(e) => { e.currentTarget.style.color = colors.ink300 }}
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
          data-testid="tour-spotlight-prev-btn"
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
          onMouseEnter={(e) => { if (!isFirstStep) e.currentTarget.style.background = colors.ink50 }}
          onMouseLeave={(e) => { if (!isFirstStep) e.currentTarget.style.background = 'transparent' }}
        >
          <ChevronLeft size={14} />
          Back
        </button>

        <button
          data-testid="tour-spotlight-next-btn"
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

// ── Modal Card (Welcome / Done) ──────────────────────────────────

export function ModalCard({
  step,
  currentStep,
  totalSteps,
  isFirstStep,
  isLastStep,
  onNext,
  onPrev,
  onSkip,
  preview,
  countdown,
}: {
  step: ModalStep
  currentStep: number
  totalSteps: number
  isFirstStep: boolean
  isLastStep: boolean
  onNext: () => void
  onPrev: () => void
  onSkip: () => void
  preview?: ReactNode
  countdown?: number
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
          maxWidth: preview ? 480 : 400,
          width: '100%',
          textAlign: 'center',
          pointerEvents: 'auto',
          boxShadow: '0 24px 64px rgba(0, 0, 0, 0.25), 0 8px 24px rgba(0, 0, 0, 0.15)',
          animation: 'tour-card-in 0.3s cubic-bezier(0.34, 1.56, 0.64, 1)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'center', alignItems: 'center' }}>{step.icon}</div>

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

        <p
          style={{
            fontSize: typography.body.size,
            fontWeight: 400,
            color: colors.ink500,
            lineHeight: 1.6,
            whiteSpace: 'pre-line',
            marginBottom: preview ? 20 : 28,
          }}
        >
          {step.description}
        </p>

        {preview && (
          <div
            style={{
              display: 'flex',
              justifyContent: 'center',
              marginBottom: 24,
              borderRadius: 12,
              overflow: 'hidden',
              background: '#FDF4E3',
              padding: 16,
            }}
          >
            {preview}
          </div>
        )}

        <StepDots current={currentStep} total={totalSteps} />

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
              data-testid="tour-prev-btn"
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
              onMouseEnter={(e) => { e.currentTarget.style.background = colors.ink50 }}
              onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent' }}
            >
              <ChevronLeft size={16} />
              Back
            </button>
          )}

          <button
            data-testid="tour-next-btn"
            onClick={onNext}
            disabled={!!countdown && countdown > 0}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 6,
              padding: '10px 24px',
              minWidth: 96,
              borderRadius: 12,
              border: 'none',
              background: countdown && countdown > 0 ? colors.ink100 : colors.accent,
              color: countdown && countdown > 0 ? colors.ink300 : '#FFFFFF',
              fontSize: countdown && countdown > 0 ? 20 : 14,
              fontWeight: 700,
              cursor: countdown && countdown > 0 ? 'not-allowed' : 'pointer',
              transition: 'all 0.15s',
              boxShadow: countdown && countdown > 0 ? 'none' : `0 4px 12px ${colors.accent}40`,
            }}
            onMouseEnter={(e) => {
              if (countdown && countdown > 0) return
              e.currentTarget.style.transform = 'translateY(-1px)'
              e.currentTarget.style.boxShadow = `0 6px 16px ${colors.accent}60`
            }}
            onMouseLeave={(e) => {
              if (countdown && countdown > 0) return
              e.currentTarget.style.transform = 'translateY(0)'
              e.currentTarget.style.boxShadow = `0 4px 12px ${colors.accent}40`
            }}
          >
            {countdown && countdown > 0 ? (
              countdown
            ) : (
              <>
                {isFirstStep && <Sparkles size={16} />}
                {isFirstStep ? "Let’s go" : isLastStep ? 'Start exploring' : 'Next'}
                {!isFirstStep && !isLastStep && <ChevronRight size={16} />}
              </>
            )}
          </button>
        </div>

        {!isLastStep && (
          <button
            data-testid="tour-skip-btn"
            onClick={onSkip}
            disabled={!!countdown && countdown > 0}
            style={{
              marginTop: 16,
              padding: '4px 8px',
              background: 'transparent',
              border: 'none',
              color: countdown && countdown > 0 ? colors.ink150 : colors.ink300,
              fontSize: 13,
              fontWeight: 500,
              cursor: countdown && countdown > 0 ? 'not-allowed' : 'pointer',
              transition: 'color 0.15s',
            }}
            onMouseEnter={(e) => {
              if (countdown && countdown > 0) return
              e.currentTarget.style.color = colors.ink500
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.color = countdown && countdown > 0 ? colors.ink150 : colors.ink300
            }}
          >
            Skip tour
          </button>
        )}
      </div>
    </div>
  )
}

// ── Step indicator dots ──────────────────────────────────────────

export function StepDots({ current, total }: { current: number; total: number }) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 6,
        flexWrap: 'wrap',
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

if (typeof document !== 'undefined') {
  const id = 'workived-tour-styles'
  if (!document.getElementById(id)) {
    const style = document.createElement('style')
    style.id = id
    style.textContent = `
@keyframes tour-card-in {
  from { opacity: 0; transform: scale(0.92) translateY(8px); }
  to   { opacity: 1; transform: scale(1) translateY(0); }
}
`
    document.head.appendChild(style)
  }
}
