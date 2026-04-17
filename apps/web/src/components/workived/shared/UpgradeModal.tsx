import { X, Sparkles } from 'lucide-react'
import { colors } from '@/design/tokens'
import { useUpgradeStore } from '@/lib/stores/upgrade'

export function UpgradeModal() {
  const { open, message, hide } = useUpgradeStore()

  if (!open) return null

  return (
    <div
      data-testid="upgrade-modal"
      className="fixed inset-0 z-[70] flex items-center justify-center"
      style={{ background: 'rgba(0,0,0,0.45)' }}
      onClick={hide}
    >
      <div
        className="relative w-full max-w-md mx-4 rounded-2xl p-8"
        style={{
          background: colors.ink0,
          boxShadow: '0 24px 48px rgba(0,0,0,0.12), 0 12px 24px rgba(0,0,0,0.08)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <button
          data-testid="upgrade-modal-close-btn"
          onClick={hide}
          className="absolute top-4 right-4 rounded-lg p-1.5 transition-colors hover:bg-gray-100"
          style={{ color: colors.ink500 }}
        >
          <X size={18} />
        </button>

        <div className="text-center">
          <div
            className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full"
            style={{ background: `${colors.accent}15` }}
          >
            <Sparkles size={28} style={{ color: colors.accent }} />
          </div>

          <h2 className="text-xl font-extrabold tracking-tight mb-2" style={{ color: colors.ink900 }}>
            Upgrade to Pro
          </h2>

          <p className="text-sm mb-6" style={{ color: colors.ink500 }}>
            {message}
          </p>

          <div
            className="rounded-xl p-5 mb-6 text-left"
            style={{ background: colors.ink50, border: `1px solid ${colors.ink150}` }}
          >
            <p className="text-xs font-bold uppercase tracking-wider mb-3" style={{ color: colors.ink500 }}>
              Pro includes
            </p>
            <ul className="space-y-2.5">
              {[
                'Unlimited employees',
                'GPS geofenced attendance',
                'Custom leave types',
                'Department-level policies',
                'Priority support',
              ].map((feature) => (
                <li key={feature} className="flex items-center gap-2 text-sm" style={{ color: colors.ink700 }}>
                  <span
                    className="inline-block h-1.5 w-1.5 rounded-full shrink-0"
                    style={{ background: colors.accent }}
                  />
                  {feature}
                </li>
              ))}
            </ul>
          </div>

          <button
            data-testid="upgrade-modal-contact-btn"
            onClick={() => {
              window.location.href = 'mailto:my@workived.com?subject=Upgrade%20to%20Pro'
              hide()
            }}
            className="w-full rounded-lg px-6 py-3 font-semibold text-white transition-colors hover:opacity-90"
            style={{ background: colors.accent }}
          >
            Contact Us to Upgrade
          </button>

          <button
            data-testid="upgrade-modal-later-btn"
            onClick={hide}
            className="mt-3 w-full rounded-lg px-6 py-2 text-sm font-medium transition-colors hover:bg-gray-50"
            style={{ color: colors.ink500 }}
          >
            Maybe later
          </button>
        </div>
      </div>
    </div>
  )
}
