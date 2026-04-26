import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { SettingsMenu } from './SettingsMenu'
import { useAuthStore } from '@/lib/stores/auth'
import { useNavigate } from '@tanstack/react-router'
import { useHasOrg } from '@/lib/hooks/useRole'

// Mock dependencies
vi.mock('@tanstack/react-router', () => ({
  useNavigate: vi.fn(),
}))

vi.mock('@/lib/stores/auth', () => ({
  useAuthStore: vi.fn(),
}))

vi.mock('@/lib/hooks/useRole', () => ({
  useHasOrg: vi.fn(),
}))

// Mock TanStack Query hooks that need a QueryClient
vi.mock('@/lib/hooks/useLeave', () => ({
  useLeaveNotificationCount: () => ({ data: 0 }),
}))
vi.mock('@/lib/hooks/useClaims', () => ({
  useClaimNotificationCount: () => ({ data: 0 }),
}))
vi.mock('@/lib/hooks/useAttendance', () => ({
  useCorrectionNotificationCount: () => ({ data: 0 }),
}))
vi.mock('@/lib/hooks/useChangelog', () => ({
  useChangelogUnread: () => ({ hasUnread: false }),
}))

describe('SettingsMenu', () => {
  const mockLogout = vi.fn()
  const mockNavigate = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(useNavigate).mockReturnValue(mockNavigate)
    vi.mocked(useAuthStore).mockReturnValue({
      user: {
        id: '123',
        email: 'test@workived.com',
        full_name: 'Test User',
        role: 'admin',
        organisation_id: 'org-1',
        is_active: true,
        created_at: '2026-01-01',
        updated_at: '2026-01-01',
      },
      logout: mockLogout,
      accessToken: 'token',
      setAuth: vi.fn(),
      refresh: vi.fn(),
      isAuthenticated: vi.fn(() => true),
    })
    // Default: user has an org
    vi.mocked(useHasOrg).mockReturnValue(true)
  })

  it('renders settings button', () => {
    render(<SettingsMenu currentModule="overview" />)

    expect(screen.getByTestId('settings-menu-btn')).toBeInTheDocument()
  })

  it('opens dropdown when settings button is clicked', () => {
    render(<SettingsMenu currentModule="overview" />)

    const settingsButton = screen.getByTestId('settings-menu-btn')
    fireEvent.click(settingsButton)
    
    expect(screen.getByText('Test User')).toBeInTheDocument()
    expect(screen.getByText('test@workived.com')).toBeInTheDocument()
    expect(screen.getByText('My profile')).toBeInTheDocument()
    expect(screen.getByText('Company settings')).toBeInTheDocument()
    expect(screen.getByText('Team members')).toBeInTheDocument()
    expect(screen.getByText('Logout')).toBeInTheDocument()
  })

  it('navigates to profile when My profile is clicked', () => {
    render(<SettingsMenu currentModule="overview" />)
    fireEvent.click(screen.getByTestId('settings-menu-btn'))
    fireEvent.click(screen.getByText('My profile'))
    expect(mockNavigate).toHaveBeenCalledWith({ to: '/profile' })
  })

  it('navigates to company settings when Company settings is clicked', () => {
    render(<SettingsMenu currentModule="overview" />)
    fireEvent.click(screen.getByTestId('settings-menu-btn'))
    fireEvent.click(screen.getByText('Company settings'))
    expect(mockNavigate).toHaveBeenCalledWith({ to: '/settings/company' })
  })

  it('navigates to team members when Team members is clicked', () => {
    render(<SettingsMenu currentModule="overview" />)
    fireEvent.click(screen.getByTestId('settings-menu-btn'))
    fireEvent.click(screen.getByText('Team members'))
    expect(mockNavigate).toHaveBeenCalledWith({ to: '/settings/members' })
  })

  it('calls logout and navigates to login when logout is clicked', async () => {
    mockLogout.mockResolvedValue(undefined)
    
    render(<SettingsMenu currentModule="overview" />)
    
    // Open menu
    const settingsButton = screen.getByTestId('settings-menu-btn')
    fireEvent.click(settingsButton)
    
    // Click logout
    const logoutButton = screen.getByText('Logout')
    fireEvent.click(logoutButton)
    
    // Wait for async logout to complete
    await vi.waitFor(() => {
      expect(mockLogout).toHaveBeenCalledTimes(1)
      expect(mockNavigate).toHaveBeenCalledWith({ to: '/login', search: { redirect: undefined } })
    })
  })

  it('displays user information correctly', () => {
    render(<SettingsMenu currentModule="people" />)

    const settingsButton = screen.getByTestId('settings-menu-btn')
    fireEvent.click(settingsButton)

    expect(screen.getByText('Test User')).toBeInTheDocument()
    expect(screen.getByText('test@workived.com')).toBeInTheDocument()
  })

  describe('when user has no org', () => {
    beforeEach(() => {
      vi.mocked(useHasOrg).mockReturnValue(false)
    })

    it('hides Team members menu item', () => {
      render(<SettingsMenu currentModule="overview" />)
      fireEvent.click(screen.getByTestId('settings-menu-btn'))
      expect(screen.queryByText('Team members')).toBeNull()
    })

    it('still navigates to /settings/company when Company settings is clicked', () => {
      render(<SettingsMenu currentModule="overview" />)
      fireEvent.click(screen.getByTestId('settings-menu-btn'))
      fireEvent.click(screen.getByText('Company settings'))
      expect(mockNavigate).toHaveBeenCalledWith({ to: '/settings/company' })
    })
  })

  describe('when user has an org', () => {
    it('shows Team members menu item', () => {
      render(<SettingsMenu currentModule="overview" />)
      fireEvent.click(screen.getByTestId('settings-menu-btn'))
      expect(screen.getByText('Team members')).toBeInTheDocument()
    })

    it('navigates to /settings/company when Company settings is clicked', () => {
      render(<SettingsMenu currentModule="overview" />)
      fireEvent.click(screen.getByTestId('settings-menu-btn'))
      fireEvent.click(screen.getByText('Company settings'))
      expect(mockNavigate).toHaveBeenCalledWith({ to: '/settings/company' })
    })
  })

  describe('Replay tour submenu', () => {
    it('shows Replay tour button', () => {
      render(<SettingsMenu currentModule="overview" />)
      fireEvent.click(screen.getByTestId('settings-menu-btn'))
      expect(screen.getByTestId('settings-menu-replay-tour-btn')).toBeInTheDocument()
      expect(screen.getByText('Replay tour')).toBeInTheDocument()
    })

    it('hides sub-options before clicking Replay tour', () => {
      render(<SettingsMenu currentModule="overview" />)
      fireEvent.click(screen.getByTestId('settings-menu-btn'))
      expect(screen.queryByText('Overview tour')).not.toBeInTheDocument()
      expect(screen.queryByText('Task board tour')).not.toBeInTheDocument()
    })

    it('reveals sub-options after clicking Replay tour', () => {
      render(<SettingsMenu currentModule="overview" />)
      fireEvent.click(screen.getByTestId('settings-menu-btn'))
      fireEvent.click(screen.getByTestId('settings-menu-replay-tour-btn'))
      expect(screen.getByText('Overview tour')).toBeInTheDocument()
      expect(screen.getByText('Task board tour')).toBeInTheDocument()
    })

    it('navigates to /overview and starts tour when Overview tour clicked', () => {
      render(<SettingsMenu currentModule="overview" />)
      fireEvent.click(screen.getByTestId('settings-menu-btn'))
      fireEvent.click(screen.getByTestId('settings-menu-replay-tour-btn'))
      fireEvent.click(screen.getByTestId('settings-menu-overview-tour-btn'))
      expect(mockNavigate).toHaveBeenCalledWith({ to: '/overview' })
    })

    it('navigates to /tasks and starts tour when Task board tour clicked', () => {
      render(<SettingsMenu currentModule="overview" />)
      fireEvent.click(screen.getByTestId('settings-menu-btn'))
      fireEvent.click(screen.getByTestId('settings-menu-replay-tour-btn'))
      fireEvent.click(screen.getByTestId('settings-menu-task-board-tour-btn'))
      expect(mockNavigate).toHaveBeenCalledWith({ to: '/tasks' })
    })
  })
})
