import { useEffect, useState } from 'react'
import { useRouter } from '@tanstack/react-router'
import { useIsFetching } from '@tanstack/react-query'

/**
 * Global loading bar that appears at the top of the page.
 * Shows during:
 * - Link clicks (immediate feedback)
 * - Route transitions (handled by TanStack Router)
 * - Data fetching (handled by React Query)
 */
export function LoadingBar() {
  const router = useRouter()
  const isFetching = useIsFetching()
  const [isLoading, setIsLoading] = useState(false)
  const [progress, setProgress] = useState(0)
  const [key, setKey] = useState(0) // Force remount on new navigation

  // Show loading bar immediately on link click for instant feedback
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement
      // Check if clicked element or its parent is a navigation link
      const link = target.closest('a[href]')
      if (link && !link.getAttribute('href')?.startsWith('http')) {
        // Internal navigation detected - force remount to reset state
        setIsLoading(false)
        setProgress(0)
        setKey(prev => prev + 1) // Force remount
        // Start fresh on next tick
        requestAnimationFrame(() => {
          setIsLoading(true)
          setProgress(5)
        })
      }
    }

    document.addEventListener('click', handleClick, true) // Use capture phase for earliest detection
    return () => document.removeEventListener('click', handleClick, true)
  }, [])

  // Subscribe to router loading state
  useEffect(() => {
    const unsubscribe = router.subscribe('onBeforeLoad', () => {
      setIsLoading(true)
      setProgress(20)
    })

    return unsubscribe
  }, [router])

  // Track when navigation completes
  useEffect(() => {
    const unsubscribe = router.subscribe('onLoad', () => {
      setProgress(100)
      setTimeout(() => {
        setIsLoading(false)
        setProgress(0)
      }, 200)
    })

    return unsubscribe
  }, [router])

  // Show loading bar when React Query is fetching
  useEffect(() => {
    if (isFetching > 0 && !isLoading) {
      setIsLoading(true)
      setProgress(30)
    } else if (isFetching === 0 && isLoading) {
      setProgress(100)
      setTimeout(() => {
        setIsLoading(false)
        setProgress(0)
      }, 200)
    }
  }, [isFetching, isLoading])

  // Simulate progress when loading (prevents stuck appearance)
  useEffect(() => {
    if (!isLoading || progress >= 90) return

    const timer = setInterval(() => {
      setProgress((prev) => {
        if (prev >= 90) return prev
        return prev + Math.random() * 10
      })
    }, 500)

    return () => clearInterval(timer)
  }, [isLoading, progress])

  if (!isLoading && progress === 0) return null

  return (
    <div
      key={key}
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        height: 3,
        zIndex: 9999,
        pointerEvents: 'none',
      }}
    >
      <div
        style={{
          height: '100%',
          background: 'linear-gradient(90deg, #3b82f6 0%, #8b5cf6 50%, #ec4899 100%)',
          width: `${progress}%`,
          transition: progress === 100 ? 'width 0.2s ease-out' : 'width 0.3s ease',
          boxShadow: '0 0 10px rgba(59, 130, 246, 0.3)',
        }}
      />
    </div>
  )
}
