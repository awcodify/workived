import { create } from 'zustand'

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

interface PWAState {
  /** The deferred install prompt event (Chrome/Edge/Android) */
  deferredPrompt: BeforeInstallPromptEvent | null
  /** Whether the install prompt has been dismissed this session */
  dismissed: boolean
  /** Whether the app is already installed */
  isInstalled: boolean

  setDeferredPrompt: (event: BeforeInstallPromptEvent | null) => void
  setDismissed: (dismissed: boolean) => void
  setIsInstalled: (installed: boolean) => void
}

export const usePWAStore = create<PWAState>()((set) => ({
  deferredPrompt: null,
  dismissed: false,
  isInstalled: false,

  setDeferredPrompt: (event) => set({ deferredPrompt: event }),
  setDismissed: (dismissed) => set({ dismissed }),
  setIsInstalled: (installed) => set({ isInstalled: installed }),
}))
