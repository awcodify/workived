import { useState } from 'react'
import { useIsIOSSafari } from '@/lib/hooks/usePWA'
import { usePWAStore } from '@/lib/stores/pwa'
import { typography } from '@/design/tokens'
import { Share, X } from 'lucide-react'

const IOS_DISMISSED_KEY = 'workived-ios-install-dismissed'

function isDismissed(): boolean {
  try {
    return localStorage.getItem(IOS_DISMISSED_KEY) === 'true'
  } catch {
    return false
  }
}

/**
 * Instructional banner for iOS Safari.
 * iOS doesn't support beforeinstallprompt, so we guide the user.
 */
export function IOSInstallBanner() {
  const isIOS = useIsIOSSafari()
  const { isInstalled } = usePWAStore()
  const [dismissed, setDismissed] = useState(isDismissed)

  if (!isIOS || isInstalled || dismissed) return null

  const handleDismiss = () => {
    try {
      localStorage.setItem(IOS_DISMISSED_KEY, 'true')
    } catch {
      // noop
    }
    setDismissed(true)
  }

  return (
    <div
      className="fixed bottom-20 left-4 right-4 z-50 rounded-xl px-4 py-3"
      style={{
        background: 'rgba(30,30,35,0.95)',
        backdropFilter: 'blur(20px)',
        border: '1px solid rgba(255,255,255,0.12)',
        boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
        animation: 'slideUpFade 0.3s ease-out',
      }}
    >
      <div className="flex items-start gap-3">
        <div
          className="flex-shrink-0 w-10 h-10 rounded-lg flex items-center justify-center mt-0.5"
          style={{ background: 'rgba(99,87,232,0.2)' }}
        >
          <Share size={20} style={{ color: '#6357E8' }} />
        </div>

        <div className="flex-1 min-w-0">
          <p
            className="text-sm font-semibold"
            style={{
              color: 'rgba(255,255,255,0.95)',
              fontFamily: typography.fontFamily,
            }}
          >
            Install Workived
          </p>
          <p
            className="text-xs mt-1 leading-relaxed"
            style={{
              color: 'rgba(255,255,255,0.55)',
              fontFamily: typography.fontFamily,
            }}
          >
            Tap <Share size={12} className="inline -mt-0.5" style={{ color: '#6357E8' }} /> then "Add to Home Screen"
          </p>
        </div>

        <button
          onClick={handleDismiss}
          className="flex-shrink-0 p-1 rounded transition-all hover:opacity-60"
          aria-label="Dismiss"
        >
          <X size={16} style={{ color: 'rgba(255,255,255,0.4)' }} />
        </button>
      </div>
    </div>
  )
}
