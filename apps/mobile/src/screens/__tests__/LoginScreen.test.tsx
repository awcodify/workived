import { render, screen, fireEvent, waitFor } from '@testing-library/react-native'
import { Alert } from 'react-native'
import LoginScreen from '../LoginScreen'
import { useAuth } from '@/contexts/AuthContext'

// Mock dependencies
jest.mock('@/contexts/AuthContext')

const mockLogin = jest.fn()
const mockUseAuth = useAuth as jest.MockedFunction<typeof useAuth>

describe('LoginScreen', () => {
  let alertSpy: jest.SpyInstance

  beforeEach(() => {
    jest.clearAllMocks()
    alertSpy = jest.spyOn(Alert, 'alert')
    mockUseAuth.mockReturnValue({
      login: mockLogin,
      logout: jest.fn(),
      isAuthenticated: false,
      isLoading: false,
      user: null,
    })
  })

  afterEach(() => {
    alertSpy.mockRestore()
  })

  it('renders login form correctly', () => {
    render(<LoginScreen />)

    expect(screen.getByText('Welcome to Workived')).toBeTruthy()
    expect(screen.getByText('Sign in to continue')).toBeTruthy()
    expect(screen.getByPlaceholderText('your.email@company.com')).toBeTruthy()
    expect(screen.getByPlaceholderText('Enter your password')).toBeTruthy()
    expect(screen.getByText('Sign In')).toBeTruthy()
  })

  it('shows alert when email or password is empty', async () => {
    render(<LoginScreen />)

    const loginButton = screen.getByText('Sign In')
    fireEvent.press(loginButton)

    await waitFor(() => {
      expect(alertSpy).toHaveBeenCalledWith(
        'Error',
        'Please enter email and password'
      )
    })
    expect(mockLogin).not.toHaveBeenCalled()
  })

  it('calls login with email and password', async () => {
    mockLogin.mockResolvedValueOnce(undefined)
    render(<LoginScreen />)

    const emailInput = screen.getByPlaceholderText('your.email@company.com')
    const passwordInput = screen.getByPlaceholderText('Enter your password')
    const loginButton = screen.getByText('Sign In')

    fireEvent.changeText(emailInput, 'test@example.com')
    fireEvent.changeText(passwordInput, 'password123')
    fireEvent.press(loginButton)

    await waitFor(() => {
      expect(mockLogin).toHaveBeenCalledWith({
        email: 'test@example.com',
        password: 'password123',
      })
    })
  })

  it('shows loading state while logging in', async () => {
    mockLogin.mockImplementation(() => new Promise((resolve) => setTimeout(resolve, 100)))
    render(<LoginScreen />)

    const emailInput = screen.getByPlaceholderText('your.email@company.com')
    const passwordInput = screen.getByPlaceholderText('Enter your password')
    const loginButton = screen.getByText('Sign In')

    fireEvent.changeText(emailInput, 'test@example.com')
    fireEvent.changeText(passwordInput, 'password123')
    fireEvent.press(loginButton)

    // Should show loading indicator
    await waitFor(() => {
      expect(screen.queryByText('Sign In')).toBeNull()
    })
  })

  it('shows error alert on login failure', async () => {
    const errorMessage = 'Invalid credentials'
    mockLogin.mockRejectedValueOnce({
      response: {
        data: {
          error: {
            message: errorMessage,
          },
        },
      },
    })

    render(<LoginScreen />)

    const emailInput = screen.getByPlaceholderText('your.email@company.com')
    const passwordInput = screen.getByPlaceholderText('Enter your password')
    const loginButton = screen.getByText('Sign In')

    fireEvent.changeText(emailInput, 'test@example.com')
    fireEvent.changeText(passwordInput, 'wrong-password')
    fireEvent.press(loginButton)

    await waitFor(() => {
      expect(alertSpy).toHaveBeenCalledWith('Login Failed', errorMessage)
    })
  })

  it('toggles password visibility', () => {
    render(<LoginScreen />)

    const passwordInput = screen.getByPlaceholderText('Enter your password')
    const eyeIcon = screen.getByTestId('toggle-password-visibility')

    // Initially password should be hidden (secureTextEntry = true)
    expect(passwordInput.props.secureTextEntry).toBe(true)

    // Toggle to show password
    fireEvent.press(eyeIcon)

    // Password should now be visible
    expect(passwordInput.props.secureTextEntry).toBe(false)

    // Toggle back to hide
    fireEvent.press(eyeIcon)
    expect(passwordInput.props.secureTextEntry).toBe(true)
  })

  it('shows default error message when API error has no message', async () => {
    mockLogin.mockRejectedValueOnce(new Error('Network error'))

    render(<LoginScreen />)

    const emailInput = screen.getByPlaceholderText('your.email@company.com')
    const passwordInput = screen.getByPlaceholderText('Enter your password')
    const loginButton = screen.getByText('Sign In')

    fireEvent.changeText(emailInput, 'test@example.com')
    fireEvent.changeText(passwordInput, 'password123')
    fireEvent.press(loginButton)

    await waitFor(() => {
      expect(alertSpy).toHaveBeenCalledWith(
        'Login Failed',
        'Invalid email or password'
      )
    })
  })

  it('disables inputs and button while loading', async () => {
    mockLogin.mockImplementation(() => new Promise((resolve) => setTimeout(resolve, 100)))
    render(<LoginScreen />)

    const emailInput = screen.getByPlaceholderText('your.email@company.com')
    const passwordInput = screen.getByPlaceholderText('Enter your password')
    const loginButton = screen.getByText('Sign In')

    fireEvent.changeText(emailInput, 'test@example.com')
    fireEvent.changeText(passwordInput, 'password123')
    fireEvent.press(loginButton)

    // Should show loading indicator (Sign In text is replaced)
    await waitFor(() => {
      expect(screen.queryByText('Sign In')).toBeNull()
    })

    // Wait for login to complete
    await waitFor(() => {
      expect(mockLogin).toHaveBeenCalled()
    })
  })
})
