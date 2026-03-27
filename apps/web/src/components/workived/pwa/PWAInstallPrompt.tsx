import { usePWAStore } from '@/lib/stores/pwa'
import { useShouldShowInstallPrompt } from '@/lib/hooks/usePWA'
import { typography } from '@/design/tokens'
import { Download, X } from 'lucide-react'

/**
 * Install prompt banner for Chrome/Edge/Android.
 * Shown on 2nd session, mobile only, after auth.
 */
export function PWAInstallPrompt() {
  const shouldShow = useShouldShowInstallPrompt()
  const { deferredPrompt, setDeferredPrompt, setDismissed } = usePWAStore()

  if (!shouldShow) return null

  const handleInstall = async () => {
    if (!deferredPrompt) return
    await deferredPrompt.prompt()
    const { outcome } = await deferredPrompt.userChoice
    if (outcome === 'accepted') {
      setDeferredPrompt(null)
    }
    setDismissed(true)
  }

  const handleDismiss = () => {
    setDismissed(true)
  }

  return (
    <div
      className="fixed bottom-20 left-4 right-4 md:left-auto md:right-6 md:bottom-24 md:w-80 z-50 rounded-xl px-4 py-3 flex items-center gap-3"
      style={{
        background: 'rgba(30,30,35,0.95)',
        backdropFilter: 'blur(20px)',
        border: '1px solid rgba(255,255,255,0.12)',
        boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
        animation: 'slideUpFade 0.3s ease-out',
      }}
    >
      <div
        className="flex-shrink-0 w-10 h-10 rounded-lg flex items-center justify-center"
        style={{ background: 'rgba(99,87,232,0.2)' }}
      >
        <Download size={20} style={{ color: '#6357E8' }} />
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
          className="text-xs"
          style={{
            color: 'rgba(255,255,255,0.55)',
            fontFamily: typography.fontFamily,
          }}
        >
          Add to home screen for quick access
        </p>
      </div>

      <button
        onClick={handleInstall}
        className="flex-shrink-0 px-3 py-1.5 rounded-lg text-xs font-bold transition-all hover:opacity-80"
        style={{
          background: '#6357E8',
          color: '#FFFFFF',
          fontFamily: typography.fontFamily,
        }}
      >
        Install
      </button>

      <button
        onClick={handleDismiss}
        className="flex-shrink-0 p-1 rounded transition-all hover:opacity-60"
        aria-label="Dismiss install prompt"
      >
        <X size={16} style={{ color: 'rgba(255,255,255,0.4)' }} />
      </button>
    </div>
  )
}
