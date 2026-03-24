import { CheckCircle2 } from 'lucide-react'
import { colors } from '@/design/tokens'

interface AlreadyCompletedStepProps {
  completedAt?: string
  onContinue: () => void
}

export function AlreadyCompletedStep({ completedAt, onContinue }: AlreadyCompletedStepProps) {
  const formatDate = (dateString?: string) => {
    if (!dateString) return 'previously'
    try {
      const date = new Date(dateString)
      return date.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      })
    } catch {
      return 'previously'
    }
  }

  return (
    <div className="flex min-h-[70vh] flex-col items-center justify-center text-center">
      {/* Icon */}
      <div
        className="mb-8 flex items-center justify-center"
        style={{
          width: 96,
          height: 96,
          borderRadius: '50%',
          background: colors.accentDim,
        }}
      >
        <CheckCircle2 className="h-14 w-14" style={{ color: colors.accent }} />
      </div>

      {/* Title */}
      <h1
        className="mb-4 text-5xl font-bold"
        style={{
          color: colors.ink900,
          letterSpacing: '-0.02em',
        }}
      >
        Setup Already Complete
      </h1>

      {/* Description */}
      <p className="mb-2 text-lg" style={{ color: colors.ink600 }}>
        You've already completed the setup wizard {formatDate(completedAt)}.
      </p>
      <p className="mb-12 text-base" style={{ color: colors.ink500 }}>
        Your work schedules, leave policies, and claim categories are all configured.
      </p>

      {/* Continue Button */}
      <button
        onClick={onContinue}
        className="px-8 py-3 text-base font-semibold transition-opacity hover:opacity-90"
        style={{
          borderRadius: 12,
          background: colors.accent,
          color: colors.ink0,
          boxShadow: '0 2px 12px 0 rgba(99,87,232,0.2)',
        }}
      >
        Go to Overview
      </button>
    </div>
  )
}
