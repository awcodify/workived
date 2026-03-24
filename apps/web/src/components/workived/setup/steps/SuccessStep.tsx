import { CheckCircle2, ArrowRight } from 'lucide-react'
import { colors } from '@/design/tokens'

interface SuccessStepProps {
  onContinue: () => void
}

export function SuccessStep({ onContinue }: SuccessStepProps) {
  return (
    <div className="flex flex-col items-center text-center">
      <div 
        className="mb-8 flex h-28 w-28 items-center justify-center"
        style={{ 
          borderRadius: 64,
          background: `linear-gradient(135deg, ${colors.ok} 0%, #0D7A45 100%)`,
          boxShadow: '0 8px 24px 0 rgba(39,174,96,0.3)',
        }}
      >
        <CheckCircle2 className="h-16 w-16" style={{ color: colors.ink0 }} />
      </div>

      <h1 className="mb-6 text-5xl font-bold" style={{ color: colors.ink900, letterSpacing: '-0.02em', lineHeight: '1.1' }}>
        All Set! 🎉
      </h1>

      <p className="mb-12 max-w-2xl text-lg leading-relaxed" style={{ color: colors.ink500 }}>
        Your organization is ready to go! We've set up your work schedule, leave policies, and
        claim categories. Your team invitations are on their way.
      </p>

      <div className="mb-12 grid gap-6 text-left sm:grid-cols-3">
        {[
          {
            icon: '📅',
            title: 'Work Schedule',
            desc: 'Office hours configured',
          },
          {
            icon: '🏖️',
            title: 'Leave Policies',
            desc: 'Time-off rules ready',
          },
          {
            icon: '💰',
            title: 'Claim Categories',
            desc: 'Expense types set up',
          },
        ].map((item) => (
          <div
            key={item.title}
            className="p-6"
            style={{ 
              borderRadius: 18,
              border: `1px solid ${colors.ink150}`, 
              background: colors.ink0,
              boxShadow: '0 2px 12px 0 rgba(0,0,0,0.06)',
            }}
          >
            <div className="mb-3 text-4xl">{item.icon}</div>
            <h3 className="mb-1 text-base font-semibold" style={{ color: colors.ink900 }}>{item.title}</h3>
            <p className="text-sm" style={{ color: colors.ink500 }}>{item.desc}</p>
          </div>
        ))}
      </div>

      <button
        onClick={onContinue}
        className="flex items-center gap-2 px-10 py-4 text-base font-semibold transition-all hover:opacity-90"
        style={{ 
          borderRadius: 12,
          background: `linear-gradient(135deg, ${colors.accentMid} 0%, ${colors.accent} 100%)`, 
          color: colors.ink0,
          boxShadow: '0 4px 14px 0 rgba(99,87,232,0.25)',
        }}
      >
        Go to Dashboard
        <ArrowRight className="h-5 w-5" />
      </button>

      <p className="mt-8 text-sm" style={{ color: colors.ink300 }}>
        You can always adjust these settings later from your organization settings
      </p>
    </div>
  )
}
