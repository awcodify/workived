import { createContext, useContext, useState, useEffect, ReactNode } from 'react'
import * as SecureStore from 'expo-secure-store'
import { apiClient } from '@/api/client'
import type { LoginRequest, LoginResponse } from '@/types/api'

interface AuthContextType {
  isAuthenticated: boolean
  isLoading: boolean
  user: LoginResponse['user'] | null
  login: (credentials: LoginRequest) => Promise<void>
  logout: () => Promise<void>
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [user, setUser] = useState<LoginResponse['user'] | null>(null)

  // Check for existing token on mount
  useEffect(() => {
    checkAuth()
  }, [])

  async function checkAuth() {
    try {
      const token = await SecureStore.getItemAsync('access_token')
      const userJson = await SecureStore.getItemAsync('user')
      
      if (token && userJson) {
        setUser(JSON.parse(userJson))
        setIsAuthenticated(true)
      }
    } catch (error) {
      console.error('Auth check failed:', error)
    } finally {
      setIsLoading(false)
    }
  }

  async function login(credentials: LoginRequest) {
    try {
      const response = await apiClient.login(credentials)
      
      // Validate response has required fields
      if (!response || !response.access_token || !response.user) {
        throw new Error('Invalid response from server')
      }
      
      // Store tokens and user data (SecureStore requires strings)
      await SecureStore.setItemAsync('access_token', response.access_token)
      
      // Backend sends refresh_token via httpOnly cookie (web) or in body (mobile)
      // For now, use access_token as refresh token until backend is updated
      if (response.refresh_token) {
        await SecureStore.setItemAsync('refresh_token', response.refresh_token)
      }
      
      await SecureStore.setItemAsync('user', JSON.stringify(response.user))
      
      setUser(response.user)
      setIsAuthenticated(true)
    } catch (error) {
      console.error('Login failed:', error)
      throw error
    }
  }

  async function logout() {
    try {
      await apiClient.logout()
    } catch (error) {
      console.error('Logout API call failed:', error)
    } finally {
      // Clear local state regardless of API call result
      await SecureStore.deleteItemAsync('access_token')
      await SecureStore.deleteItemAsync('refresh_token')
      await SecureStore.deleteItemAsync('user')
      
      setUser(null)
      setIsAuthenticated(false)
    }
  }

  return (
    <AuthContext.Provider value={{ isAuthenticated, isLoading, user, login, logout }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}
