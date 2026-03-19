import { describe, test, expect, vi, beforeEach } from 'vitest'
import { authApi } from './auth'
import { apiClient } from './client'

vi.mock('./client', () => ({
  apiClient: {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    delete: vi.fn(),
  },
}))

const mockPost = vi.mocked(apiClient.post)

describe('authApi', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('register', () => {
    test('calls POST /api/v1/auth/register with provided data', async () => {
      const payload = { email: 'a@b.com', password: 's3cret!', full_name: 'Ahmad Test' }
      const response = { data: { data: { id: '1', email: 'a@b.com', full_name: 'Ahmad Test', is_verified: false, is_active: true } } }
      mockPost.mockResolvedValueOnce(response)

      const result = await authApi.register(payload)

      expect(mockPost).toHaveBeenCalledWith('/api/v1/auth/register', payload)
      expect(result).toEqual(response)
    })
  })

  describe('login', () => {
    test('calls POST /api/v1/auth/login with credentials', async () => {
      const payload = { email: 'a@b.com', password: 's3cret!' }
      const response = { data: { data: { access_token: 'tok', user: { id: '1', email: 'a@b.com', full_name: 'Ahmad', is_verified: true, is_active: true } } } }
      mockPost.mockResolvedValueOnce(response)

      const result = await authApi.login(payload)

      expect(mockPost).toHaveBeenCalledWith('/api/v1/auth/login', payload)
      expect(result).toEqual(response)
    })
  })

  describe('refresh', () => {
    test('calls POST /api/v1/auth/refresh with no payload', async () => {
      const response = { data: { data: { access_token: 'new-tok' } } }
      mockPost.mockResolvedValueOnce(response)

      const result = await authApi.refresh()

      expect(mockPost).toHaveBeenCalledWith('/api/v1/auth/refresh')
      expect(result).toEqual(response)
    })
  })

  describe('logout', () => {
    test('calls POST /api/v1/auth/logout with no payload', async () => {
      const response = { data: { data: null } }
      mockPost.mockResolvedValueOnce(response)

      const result = await authApi.logout()

      expect(mockPost).toHaveBeenCalledWith('/api/v1/auth/logout')
      expect(result).toEqual(response)
    })
  })
})
