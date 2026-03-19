import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { SettingsMenu } from './SettingsMenu'
import { useAuthStore } from '@/lib/stores/auth'
import { useNavigate } from '@tanstack/react-router'

// Mock dependencies
vi.mock('@tanstack/react-router', () => ({
  useNavigate: vi.fn(),
}))

vi.mock('@/lib/stores/auth', () => ({
  useAuthStore: vi.fn(),
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
  })

  it('renders settings button', () => {
    render(<SettingsMenu currentModule="overview" />)
    
    expect(screen.getByText('Settings')).toBeInTheDocument()
  })

  it('opens dropdown when settings button is clicked', () => {
    render(<SettingsMenu currentModule="overview" />)
    
    const settingsButton = screen.getByText('Settings')
    fireEvent.click(settingsButton)
    
    expect(screen.getByText('Test User')).toBeInTheDocument()
    expect(screen.getByText('test@workived.com')).toBeInTheDocument()
    expect(screen.getByText('Company settings')).toBeInTheDocument()
    expect(screen.getByText('Team members')).toBeInTheDocument()
    expect(screen.getByText('Logout')).toBeInTheDocument()
  })

  it('navigates to company settings when Company settings is clicked', () => {
    render(<SettingsMenu currentModule="overview" />)
    fireEvent.click(screen.getByText('Settings'))
    fireEvent.click(screen.getByText('Company settings'))
    expect(mockNavigate).toHaveBeenCalledWith({ to: '/settings/company' })
  })

  it('navigates to team members when Team members is clicked', () => {
    render(<SettingsMenu currentModule="overview" />)
    fireEvent.click(screen.getByText('Settings'))
    fireEvent.click(screen.getByText('Team members'))
    expect(mockNavigate).toHaveBeenCalledWith({ to: '/settings/members' })
  })

  it('calls logout and navigates to login when logout is clicked', async () => {
    mockLogout.mockResolvedValue(undefined)
    
    render(<SettingsMenu currentModule="overview" />)
    
    // Open menu
    const settingsButton = screen.getByText('Settings')
    fireEvent.click(settingsButton)
    
    // Click logout
    const logoutButton = screen.getByText('Logout')
    fireEvent.click(logoutButton)
    
    // Wait for async logout to complete
    await vi.waitFor(() => {
      expect(mockLogout).toHaveBeenCalledTimes(1)
      expect(mockNavigate).toHaveBeenCalledWith({ to: '/login' })
    })
  })

  it('displays user information correctly', () => {
    render(<SettingsMenu currentModule="people" />)
    
    const settingsButton = screen.getByText('Settings')
    fireEvent.click(settingsButton)
    
    expect(screen.getByText('Test User')).toBeInTheDocument()
    expect(screen.getByText('test@workived.com')).toBeInTheDocument()
  })
})
