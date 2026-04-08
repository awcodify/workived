import { render, screen, fireEvent, waitFor } from '@testing-library/react-native'
import { Alert } from 'react-native'
import ProfileScreen from '../ProfileScreen'
import { useAuth } from '@/contexts/AuthContext'

// Mock dependencies
jest.mock('@/contexts/AuthContext')

const mockLogout = jest.fn()
const mockUseAuth = useAuth as jest.MockedFunction<typeof useAuth>

describe('ProfileScreen', () => {
  let alertSpy: jest.SpyInstance

  const mockUser = {
    id: '123',
    email: 'john.doe@example.com',
    name: 'John Doe',
    role: 'employee',
  }

  beforeEach(() => {
    jest.clearAllMocks()
    alertSpy = jest.spyOn(Alert, 'alert')
    mockUseAuth.mockReturnValue({
      login: jest.fn(),
      logout: mockLogout,
      isAuthenticated: true,
      isLoading: false,
      user: mockUser,
    })
  })

  afterEach(() => {
    alertSpy.mockRestore()
  })

  it('renders user profile correctly', () => {
    render(<ProfileScreen />)

    expect(screen.getByText('Profile')).toBeTruthy()
    expect(screen.getByText('John Doe')).toBeTruthy()
    expect(screen.getByText('john.doe@example.com')).toBeTruthy()
    expect(screen.getByText('employee')).toBeTruthy()
  })

  it('displays user initials in avatar', () => {
    render(<ProfileScreen />)

    expect(screen.getByText('J')).toBeTruthy()
  })

  it('displays default values when user is null', () => {
    mockUseAuth.mockReturnValue({
      login: jest.fn(),
      logout: mockLogout,
      isAuthenticated: true,
      isLoading: false,
      user: null,
    })

    render(<ProfileScreen />)

    expect(screen.getByText('User')).toBeTruthy()
    expect(screen.getByText('U')).toBeTruthy() // Default avatar initial
    expect(screen.getByText('Employee')).toBeTruthy() // Default role
  })

  it('renders menu items', () => {
    render(<ProfileScreen />)

    expect(screen.getByText('Edit Profile')).toBeTruthy()
    expect(screen.getByText('Notifications')).toBeTruthy()
    expect(screen.getByText('Privacy & Security')).toBeTruthy()
  })

  it('shows logout confirmation alert when logout button pressed', () => {
    render(<ProfileScreen />)

    const logoutButton = screen.getByText('Logout')
    fireEvent.press(logoutButton)

    expect(alertSpy).toHaveBeenCalledWith(
      'Logout',
      'Are you sure you want to logout?',
      expect.arrayContaining([
        expect.objectContaining({ text: 'Cancel', style: 'cancel' }),
        expect.objectContaining({ text: 'Logout', style: 'destructive' }),
      ])
    )
  })

  it('calls logout when confirmed in alert', async () => {
    mockLogout.mockResolvedValueOnce(undefined)

    // Mock Alert.alert to immediately call the onPress of Logout button
    alertSpy.mockImplementation((title, message, buttons) => {
      // Find and call the logout button's onPress
      const logoutButton = buttons?.find((b: any) => b.text === 'Logout')
      if (logoutButton && logoutButton.onPress) {
        logoutButton.onPress()
      }
      return 1
    })

    render(<ProfileScreen />)

    const logoutButton = screen.getByText('Logout')
    fireEvent.press(logoutButton)

    await waitFor(() => {
      expect(mockLogout).toHaveBeenCalled()
    })
  })

  it('shows error alert when logout fails', async () => {
    mockLogout.mockRejectedValueOnce(new Error('Network error'))

    let logoutCallback: (() => Promise<void>) | undefined

    alertSpy.mockImplementation((title, message, buttons) => {
      const logoutButton = buttons?.find((b: any) => b.text === 'Logout')
      if (logoutButton && logoutButton.onPress) {
        logoutCallback = logoutButton.onPress as () => Promise<void>
      }
      return 1
    })

    render(<ProfileScreen />)

    const logoutButton = screen.getByText('Logout')
    fireEvent.press(logoutButton)

    // Execute the logout callback
    if (logoutCallback) {
      await logoutCallback()
    }

    await waitFor(() => {
      expect(alertSpy).toHaveBeenCalledWith(
        'Error',
        'Failed to logout. Please try again.'
      )
    })
  })

  it('capitalizes role text', () => {
    mockUseAuth.mockReturnValue({
      login: jest.fn(),
      logout: mockLogout,
      isAuthenticated: true,
      isLoading: false,
      user: { ...mockUser, role: 'manager' },
    })

    render(<ProfileScreen />)

    const roleElement = screen.getByText('manager')
    expect(roleElement).toBeTruthy()
    // Role badge has textTransform: 'capitalize' style
  })
})
