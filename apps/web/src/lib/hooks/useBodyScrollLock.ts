import { useEffect } from 'react'

/**
 * Hook to lock body scroll when a modal is open
 * Automatically restores the original overflow style when unmounted
 */
export function useBodyScrollLock() {
  useEffect(() => {
    // Save original overflow style
    const originalStyle = window.getComputedStyle(document.body).overflow
    
    // Lock body scroll
    document.body.style.overflow = 'hidden'
    
    // Restore on cleanup
    return () => {
      document.body.style.overflow = originalStyle
    }
  }, [])
}
