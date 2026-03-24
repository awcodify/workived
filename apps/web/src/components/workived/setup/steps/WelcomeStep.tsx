import { Loader2 } from 'lucide-react'
import { colors } from '@/design/tokens'
import { WorkivedLogo } from '@/components/workived/layout/WorkivedLogo'

interface WelcomeStepProps {
  onNext: () => void
  onSkip: () => void
  isSkipping: boolean
}

export function WelcomeStep({ onNext, onSkip, isSkipping }: WelcomeStepProps) {
  return (
    <div className="flex flex-col items-center text-center">
      <div className="mb-10">
        <WorkivedLogo size={96} showWordmark={false} variant="gradient" />
      </div>

      <h1 className="mb-6 text-5xl font-bold" style={{ color: colors.ink900, letterSpacing: '-0.02em', lineHeight: '1.1' }}>
        Welcome to Workived!
      </h1>

      <p className="mb-10 max-w-2xl text-lg leading-relaxed" style={{ color: colors.ink500 }}>
        Let's set up your organization in just a few minutes. We'll help you configure work
        schedules, leave policies, and claim categories.
      </p>

      <div
        className="mb-12 w-full max-w-3xl"
        style={{
          background: colors.ink0,
          border: `1px solid ${colors.ink150}`,
          borderRadius: 18,
          boxShadow: '0 2px 12px 0 rgba(0,0,0,0.06)',
          padding: '32px 28px',
        }}
      >
        <div className="grid gap-8 text-left sm:grid-cols-3">
          {[
            { step: '1', title: 'Work Schedule', desc: 'Set office hours and work days' },
            { step: '2', title: 'Leave Policies', desc: 'Annual leave, sick leave, and more' },
            { step: '3', title: 'Claim Categories', desc: 'Transport, meals, and expenses' },
          ].map((item) => (
            <div key={item.step} className="flex items-start gap-4">
              <div
                className="flex h-10 w-10 shrink-0 items-center justify-center text-base font-bold"
                style={{ 
                  borderRadius: 12,
                  background: colors.accentDim, 
                  color: colors.accent 
                }}
              >
                {item.step}
              </div>
              <div>
                <h3 className="mb-1 text-base font-semibold" style={{ color: colors.ink900 }}>
                  {item.title}
                </h3>
                <p className="text-sm leading-relaxed" style={{ color: colors.ink500 }}>
                  {item.desc}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="flex gap-4">
        <button
          onClick={onNext}
          className="px-10 py-4 text-base font-semibold transition-all hover:opacity-90"
          style={{
            borderRadius: 12,
            background: `linear-gradient(135deg, ${colors.accentMid} 0%, ${colors.accent} 100%)`,
            color: colors.ink0,
            boxShadow: '0 4px 14px 0 rgba(99,87,232,0.25)',
          }}
        >
          Get Started
        </button>

        <button
          onClick={onSkip}
          disabled={isSkipping}
          className="px-10 py-4 text-base font-semibold transition-all disabled:opacity-50 hover:bg-opacity-60"
          style={{
            borderRadius: 12,
            border: `1px solid ${colors.ink150}`,
            background: colors.ink0,
            color: colors.ink700,
          }}
        >
          {isSkipping ? (
            <>
              <Loader2 className="inline h-4 w-4 animate-spin mr-2" />
              Skipping...
            </>
          ) : (
            'Skip for Now'
          )}
        </button>
      </div>

      <p className="mt-8 text-sm" style={{ color: colors.ink300 }}>
        You can always complete this setup later from your organization settings
      </p>
    </div>
  )
}
