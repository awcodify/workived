import { render, screen } from '@testing-library/react'
import { userEvent } from '@testing-library/user-event'
import { describe, it, expect, vi } from 'vitest'

const mockPrompt = vi.fn().mockResolvedValue(undefined)
const mockUserChoice = Promise.resolve({ outcome: 'accepted' as const })
const mockSetDeferredPrompt = vi.fn()
const mockSetDismissed = vi.fn()

let mockShouldShow = false

vi.mock('@/lib/hooks/usePWA', () => ({
  useShouldShowInstallPrompt: () => mockShouldShow,
}))

vi.mock('@/lib/stores/pwa', () => ({
  usePWAStore: () => ({
    deferredPrompt: {
      prompt: mockPrompt,
      userChoice: mockUserChoice,
    },
    setDeferredPrompt: mockSetDeferredPrompt,
    setDismissed: mockSetDismissed,
  }),
}))

vi.mock('@/design/tokens', () => ({
  typography: { fontFamily: "'Plus Jakarta Sans', sans-serif" },
}))

import { PWAInstallPrompt } from './PWAInstallPrompt'

describe('PWAInstallPrompt', () => {
  it('renders nothing when shouldShow is false', () => {
    mockShouldShow = false
    const { container } = render(<PWAInstallPrompt />)
    expect(container.firstChild).toBeNull()
  })

  it('renders install banner when shouldShow is true', () => {
    mockShouldShow = true
    render(<PWAInstallPrompt />)
    expect(screen.getByText('Install Workived')).toBeInTheDocument()
    expect(screen.getByText('Install')).toBeInTheDocument()
  })

  it('calls prompt on install click', async () => {
    mockShouldShow = true
    render(<PWAInstallPrompt />)
    await userEvent.click(screen.getByText('Install'))
    expect(mockPrompt).toHaveBeenCalled()
  })

  it('dismisses on X click', async () => {
    mockShouldShow = true
    render(<PWAInstallPrompt />)
    await userEvent.click(screen.getByLabelText('Dismiss install prompt'))
    expect(mockSetDismissed).toHaveBeenCalledWith(true)
  })
})
