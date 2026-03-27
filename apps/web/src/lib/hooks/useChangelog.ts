import { useCallback, useSyncExternalStore } from 'react'
import { getLatestChangelogId } from '@/data/changelog'

const STORAGE_KEY = 'workived-changelog-last-seen'

function getLastSeenId(): number {
  try {
    const val = localStorage.getItem(STORAGE_KEY)
    return val ? parseInt(val, 10) : 0
  } catch {
    return 0
  }
}

function setLastSeenId(id: number): void {
  try {
    localStorage.setItem(STORAGE_KEY, String(id))
    // Dispatch storage event so other tabs/components update
    window.dispatchEvent(new Event('changelog-updated'))
  } catch {
    // localStorage unavailable
  }
}

// Subscribe to storage changes for useSyncExternalStore
function subscribe(callback: () => void): () => void {
  const handler = () => callback()
  window.addEventListener('changelog-updated', handler)
  window.addEventListener('storage', handler)
  return () => {
    window.removeEventListener('changelog-updated', handler)
    window.removeEventListener('storage', handler)
  }
}

function getSnapshot(): number {
  return getLastSeenId()
}

/**
 * Hook to track whether there are unread changelog entries.
 * Returns `hasUnread` boolean and `markAsRead` function.
 */
export function useChangelogUnread() {
  const lastSeen = useSyncExternalStore(subscribe, getSnapshot)
  const latestId = getLatestChangelogId()

  const hasUnread = latestId > lastSeen

  const markAsRead = useCallback(() => {
    setLastSeenId(latestId)
  }, [latestId])

  return { hasUnread, markAsRead }
}
