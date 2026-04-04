import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { renderHook } from '@testing-library/react'
import { useBodyScrollLock } from './useBodyScrollLock'

describe('useBodyScrollLock', () => {
  let originalOverflow: string

  beforeEach(() => {
    originalOverflow = document.body.style.overflow
  })

  afterEach(() => {
    document.body.style.overflow = originalOverflow
  })

  it('locks body scroll when mounted', () => {
    document.body.style.overflow = 'auto'
    
    renderHook(() => useBodyScrollLock())
    
    expect(document.body.style.overflow).toBe('hidden')
  })

  it('restores original overflow style when unmounted', () => {
    document.body.style.overflow = 'scroll'
    
    const { unmount } = renderHook(() => useBodyScrollLock())
    
    expect(document.body.style.overflow).toBe('hidden')
    
    unmount()
    
    expect(document.body.style.overflow).toBe('scroll')
  })

  it('handles empty original overflow', () => {
    document.body.style.overflow = ''
    
    const { unmount } = renderHook(() => useBodyScrollLock())
    
    expect(document.body.style.overflow).toBe('hidden')
    
    unmount()
    
    // Should restore to the computed style, which defaults to 'visible'
    expect(['', 'visible']).toContain(document.body.style.overflow)
  })
})