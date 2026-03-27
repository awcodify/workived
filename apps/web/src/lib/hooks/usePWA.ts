import { useEffect } from 'react'
import { usePWAStore } from '@/lib/stores/pwa'

const SESSION_COUNT_KEY = 'workived-pwa-sessions'

function getSessionCount(): number {
  try {
    return parseInt(localStorage.getItem(SESSION_COUNT_KEY) || '0', 10)
  } catch {
    return 0
  }
}

function incrementSessionCount(): void {
  try {
    const count = getSessionCount() + 1
    localStorage.setItem(SESSION_COUNT_KEY, String(count))
  } catch {
    // localStorage unavailable
  }
}

/**
 * Initialises PWA install prompt listeners.
 * Call once at the app root level.
 */
export function usePWAInstall() {
  const { setDeferredPrompt, setIsInstalled } = usePWAStore()

  useEffect(() => {
    // Track session count for showing prompt on 2nd session
    incrementSessionCount()

    // Listen for beforeinstallprompt (Chrome, Edge, Android)
    const handleBeforeInstall = (e: Event) => {
      e.preventDefault()
      setDeferredPrompt(e as never)
    }

    // Detect if already installed
    const handleAppInstalled = () => {
      setIsInstalled(true)
      setDeferredPrompt(null)
    }

    // Check if running in standalone mode (already installed)
    if (window.matchMedia('(display-mode: standalone)').matches) {
      setIsInstalled(true)
    }

    window.addEventListener('beforeinstallprompt', handleBeforeInstall)
    window.addEventListener('appinstalled', handleAppInstalled)

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstall)
      window.removeEventListener('appinstalled', handleAppInstalled)
    }
  }, [setDeferredPrompt, setIsInstalled])

  return { sessionCount: getSessionCount() }
}

/** Whether we should show the install prompt (2nd+ session, not dismissed, not installed) */
export function useShouldShowInstallPrompt(): boolean {
  const { deferredPrompt, dismissed, isInstalled } = usePWAStore()
  const sessionCount = getSessionCount()

  // Show on 2nd+ session, only if we have a prompt event, not dismissed, not installed
  return !!deferredPrompt && sessionCount >= 2 && !dismissed && !isInstalled
}

/** Whether this is iOS (needs instructional banner instead of prompt) */
export function useIsIOSSafari(): boolean {
  if (typeof navigator === 'undefined') return false
  const ua = navigator.userAgent
  const isIOS = /iPad|iPhone|iPod/.test(ua)
  const isStandalone = window.matchMedia('(display-mode: standalone)').matches
  return isIOS && !isStandalone
}
