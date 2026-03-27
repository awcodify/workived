import { useRegisterSW } from 'virtual:pwa-register/react'
import { typography } from '@/design/tokens'
import { RefreshCw } from 'lucide-react'

/**
 * Service worker update prompt.
 * Shows a banner when a new version is available (registerType: 'prompt').
 */
export function PWAUpdatePrompt() {
  const {
    needRefresh: [needRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    onRegisteredSW(_swUrl, registration) {
      // Check for updates every hour
      if (registration) {
        setInterval(() => {
          registration.update()
        }, 60 * 60 * 1000)
      }
    },
  })

  if (!needRefresh) return null

  return (
    <div
      className="fixed top-4 left-4 right-4 md:left-auto md:right-6 md:w-80 z-50 rounded-xl px-4 py-3 flex items-center gap-3"
      style={{
        background: 'rgba(30,30,35,0.95)',
        backdropFilter: 'blur(20px)',
        border: '1px solid rgba(255,255,255,0.12)',
        boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
        animation: 'slideDownFade 0.3s ease-out',
      }}
    >
      <div
        className="flex-shrink-0 w-10 h-10 rounded-lg flex items-center justify-center"
        style={{ background: 'rgba(16,185,129,0.2)' }}
      >
        <RefreshCw size={20} style={{ color: '#10B981' }} />
      </div>

      <div className="flex-1 min-w-0">
        <p
          className="text-sm font-semibold"
          style={{
            color: 'rgba(255,255,255,0.95)',
            fontFamily: typography.fontFamily,
          }}
        >
          New version available
        </p>
        <p
          className="text-xs"
          style={{
            color: 'rgba(255,255,255,0.55)',
            fontFamily: typography.fontFamily,
          }}
        >
          Refresh to get the latest updates
        </p>
      </div>

      <button
        onClick={() => updateServiceWorker(true)}
        className="flex-shrink-0 px-3 py-1.5 rounded-lg text-xs font-bold transition-all hover:opacity-80"
        style={{
          background: '#10B981',
          color: '#FFFFFF',
          fontFamily: typography.fontFamily,
        }}
      >
        Update
      </button>

      <style>{`
        @keyframes slideDownFade {
          from {
            opacity: 0;
            transform: translateY(-8px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
      `}</style>
    </div>
  )
}
