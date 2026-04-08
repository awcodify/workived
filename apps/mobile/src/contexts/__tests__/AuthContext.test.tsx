import { renderHook, act, waitFor } from '@testing-library/react-native'
import { AuthProvider, useAuth } from '../AuthContext'
import * as SecureStore from 'expo-secure-store'
import { apiClient } from '@/api/client'

// Mock dependencies
jest.mock('expo-secure-store')
jest.mock('@/api/client')

const mockSecureStore = SecureStore as jest.Mocked<typeof SecureStore>
const mockApiClient = apiClient as jest.Mocked<typeof apiClient>

describe('AuthContext', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('useAuth hook', () => {
    it('throws error when used outside AuthProvider', () => {
      // Suppress console error for this test
      const originalError = console.error
      console.error = jest.fn()

      expect(() => {
        renderHook(() => useAuth())
      }).toThrow('useAuth must be used within an AuthProvider')

      console.error = originalError
    })

    it('provides auth context when used inside AuthProvider', () => {
      mockSecureStore.getItemAsync.mockResolvedValue(null)

      const { result } = renderHook(() => useAuth(), {
        wrapper: AuthProvider,
      })

      expect(result.current).toHaveProperty('isAuthenticated')
      expect(result.current).toHaveProperty('isLoading')
      expect(result.current).toHaveProperty('user')
      expect(result.current).toHaveProperty('login')
      expect(result.current).toHaveProperty('logout')
    })
  })

  describe('checkAuth', () => {
    it('sets isAuthenticated to true when token and user exist', async () => {
      const mockUser = {
        id: '123',
        email: 'test@example.com',
        name: 'Test User',
        role: 'employee',
      }

      mockSecureStore.getItemAsync.mockImplementation((key) => {
        if (key === 'access_token') return Promise.resolve('mock-token')
        if (key === 'user') return Promise.resolve(JSON.stringify(mockUser))
        return Promise.resolve(null)
      })

      const { result } = renderHook(() => useAuth(), {
        wrapper: AuthProvider,
      })

      // Initially loading
      expect(result.current.isLoading).toBe(true)

      // Wait for auth check to complete
      await waitFor(() => {
        expect(result.current.isLoading).toBe(false)
      })

      expect(result.current.isAuthenticated).toBe(true)
      expect(result.current.user).toEqual(mockUser)
    })

    it('sets isAuthenticated to false when no token exists', async () => {
      mockSecureStore.getItemAsync.mockResolvedValue(null)

      const { result } = renderHook(() => useAuth(), {
        wrapper: AuthProvider,
      })

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false)
      })

      expect(result.current.isAuthenticated).toBe(false)
      expect(result.current.user).toBeNull()
    })

    it('handles auth check errors gracefully', async () => {
      mockSecureStore.getItemAsync.mockRejectedValue(new Error('Storage error'))

      const consoleSpy = jest.spyOn(console, 'error').mockImplementation()

      const { result } = renderHook(() => useAuth(), {
        wrapper: AuthProvider,
      })

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false)
      })

      expect(result.current.isAuthenticated).toBe(false)
      expect(consoleSpy).toHaveBeenCalledWith('Auth check failed:', expect.any(Error))

      consoleSpy.mockRestore()
    })
  })

  describe('login', () => {
    it('stores tokens and user data on successful login', async () => {
      mockSecureStore.getItemAsync.mockResolvedValue(null)
      
      const mockLoginResponse = {
        access_token: 'new-access-token',
        // refresh_token is optional - backend may send via httpOnly cookie
        refresh_token: 'new-refresh-token',
        user: {
          id: '123',
          email: 'test@example.com',
          name: 'Test User',
          role: 'employee',
        },
      }

      mockApiClient.login.mockResolvedValue(mockLoginResponse)
      mockSecureStore.setItemAsync.mockResolvedValue()

      const { result } = renderHook(() => useAuth(), {
        wrapper: AuthProvider,
      })

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false)
      })

      await act(async () => {
        await result.current.login({
          email: 'test@example.com',
          password: 'password123',
        })
      })

      expect(mockApiClient.login).toHaveBeenCalledWith({
        email: 'test@example.com',
        password: 'password123',
      })

      expect(mockSecureStore.setItemAsync).toHaveBeenCalledWith(
        'access_token',
        'new-access-token'
      )
      
      // refresh_token storage is conditional
      if (mockLoginResponse.refresh_token) {
        expect(mockSecureStore.setItemAsync).toHaveBeenCalledWith(
          'refresh_token',
          'new-refresh-token'
        )
      }
      
      expect(mockSecureStore.setItemAsync).toHaveBeenCalledWith(
        'user',
        JSON.stringify(mockLoginResponse.user)
      )

      expect(result.current.isAuthenticated).toBe(true)
      expect(result.current.user).toEqual(mockLoginResponse.user)
    })

    it('throws error on login failure', async () => {
      mockSecureStore.getItemAsync.mockResolvedValue(null)
      const loginError = new Error('Invalid credentials')
      mockApiClient.login.mockRejectedValue(loginError)

      const { result } = renderHook(() => useAuth(), {
        wrapper: AuthProvider,
      })

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false)
      })

      await expect(
        act(async () => {
          await result.current.login({
            email: 'test@example.com',
            password: 'wrong-password',
          })
        })
      ).rejects.toThrow('Invalid credentials')

      expect(result.current.isAuthenticated).toBe(false)
    })
  })

  describe('logout', () => {
    it('clears tokens and user data on logout', async () => {
      const mockUser = {
        id: '123',
        email: 'test@example.com',
        name: 'Test User',
        role: 'employee',
      }

      // Setup authenticated state
      mockSecureStore.getItemAsync.mockImplementation((key) => {
        if (key === 'access_token') return Promise.resolve('mock-token')
        if (key === 'user') return Promise.resolve(JSON.stringify(mockUser))
        return Promise.resolve(null)
      })

      mockApiClient.logout.mockResolvedValue()
      mockSecureStore.deleteItemAsync.mockResolvedValue()

      const { result } = renderHook(() => useAuth(), {
        wrapper: AuthProvider,
      })

      await waitFor(() => {
        expect(result.current.isAuthenticated).toBe(true)
      })

      await act(async () => {
        await result.current.logout()
      })

      expect(mockApiClient.logout).toHaveBeenCalled()
      expect(mockSecureStore.deleteItemAsync).toHaveBeenCalledWith('access_token')
      expect(mockSecureStore.deleteItemAsync).toHaveBeenCalledWith('refresh_token')
      expect(mockSecureStore.deleteItemAsync).toHaveBeenCalledWith('user')

      expect(result.current.isAuthenticated).toBe(false)
      expect(result.current.user).toBeNull()
    })

    it('clears local state even if API call fails', async () => {
      const mockUser = {
        id: '123',
        email: 'test@example.com',
        name: 'Test User',
        role: 'employee',
      }

      mockSecureStore.getItemAsync.mockImplementation((key) => {
        if (key === 'access_token') return Promise.resolve('mock-token')
        if (key === 'user') return Promise.resolve(JSON.stringify(mockUser))
        return Promise.resolve(null)
      })

      mockApiClient.logout.mockRejectedValue(new Error('Network error'))
      mockSecureStore.deleteItemAsync.mockResolvedValue()

      const consoleSpy = jest.spyOn(console, 'error').mockImplementation()

      const { result } = renderHook(() => useAuth(), {
        wrapper: AuthProvider,
      })

      await waitFor(() => {
        expect(result.current.isAuthenticated).toBe(true)
      })

      await act(async () => {
        await result.current.logout()
      })

      // Should still clear local state
      expect(result.current.isAuthenticated).toBe(false)
      expect(result.current.user).toBeNull()
      expect(consoleSpy).toHaveBeenCalledWith(
        'Logout API call failed:',
        expect.any(Error)
      )

      consoleSpy.mockRestore()
    })
  })
})
