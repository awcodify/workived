import { describe, test, expect, vi, beforeEach } from 'vitest'
import { organisationsApi } from './organisations'
import { apiClient } from './client'

vi.mock('./client', () => ({
  apiClient: {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    delete: vi.fn(),
  },
}))

const mockGet = vi.mocked(apiClient.get)
const mockPost = vi.mocked(apiClient.post)
const mockPut = vi.mocked(apiClient.put)
const mockDelete = vi.mocked(apiClient.delete)

describe('organisationsApi', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('getMine', () => {
    test('calls GET /api/v1/organisations/me', async () => {
      mockGet.mockResolvedValueOnce({ data: { data: {} } })

      await organisationsApi.getMine()

      expect(mockGet).toHaveBeenCalledWith('/api/v1/organisations/me')
    })
  })

  describe('getDetail', () => {
    test('calls GET /api/v1/organisations/me', async () => {
      mockGet.mockResolvedValueOnce({ data: { data: {} } })

      await organisationsApi.getDetail()

      expect(mockGet).toHaveBeenCalledWith('/api/v1/organisations/me')
    })
  })

  describe('update', () => {
    test('calls PUT /api/v1/organisations/me with data', async () => {
      const payload = { name: 'New Name', timezone: 'Asia/Jakarta' }
      mockPut.mockResolvedValueOnce({ data: { data: {} } })

      await organisationsApi.update(payload)

      expect(mockPut).toHaveBeenCalledWith('/api/v1/organisations/me', payload)
    })
  })

  describe('transferOwnership', () => {
    test('calls POST /api/v1/organisations/me/transfer-ownership with data', async () => {
      const payload = { new_owner_user_id: 'user-123' }
      mockPost.mockResolvedValueOnce({ data: { data: { message: 'ok' } } })

      await organisationsApi.transferOwnership(payload)

      expect(mockPost).toHaveBeenCalledWith('/api/v1/organisations/me/transfer-ownership', payload)
    })
  })

  describe('create', () => {
    test('calls POST /api/v1/organisations with data', async () => {
      const payload = {
        name: 'Acme Corp',
        slug: 'acme',
        country_code: 'ID',
        timezone: 'Asia/Jakarta',
        currency_code: 'IDR',
      }
      mockPost.mockResolvedValueOnce({ data: { data: { access_token: 'tok', organisation: {} } } })

      await organisationsApi.create(payload)

      expect(mockPost).toHaveBeenCalledWith('/api/v1/organisations', payload)
    })
  })

  describe('invite', () => {
    test('calls POST /api/v1/organisations/invitations with data', async () => {
      const payload = { email: 'new@member.com', role: 'member' as const }
      mockPost.mockResolvedValueOnce({ data: { data: {} } })

      await organisationsApi.invite(payload)

      expect(mockPost).toHaveBeenCalledWith('/api/v1/organisations/invitations', payload)
    })
  })

  describe('listInvitations', () => {
    test('calls GET /api/v1/organisations/invitations', async () => {
      mockGet.mockResolvedValueOnce({ data: { data: [] } })

      await organisationsApi.listInvitations()

      expect(mockGet).toHaveBeenCalledWith('/api/v1/organisations/invitations')
    })
  })

  describe('revokeInvitation', () => {
    test('calls DELETE /api/v1/organisations/invitations/:id', async () => {
      const id = 'inv-456'
      mockDelete.mockResolvedValueOnce({ data: { data: { message: 'revoked' } } })

      await organisationsApi.revokeInvitation(id)

      expect(mockDelete).toHaveBeenCalledWith(`/api/v1/organisations/invitations/${id}`)
    })
  })

  describe('acceptInvitation', () => {
    test('calls POST /api/v1/invitations/accept with token data', async () => {
      const payload = { token: 'invite-token-abc' }
      mockPost.mockResolvedValueOnce({ data: { data: {} } })

      await organisationsApi.acceptInvitation(payload)

      expect(mockPost).toHaveBeenCalledWith('/api/v1/invitations/accept', payload)
    })
  })

  describe('listUnlinkedMembers', () => {
    test('calls GET /api/v1/organisations/members/unlinked', async () => {
      mockGet.mockResolvedValueOnce({ data: { data: [] } })

      await organisationsApi.listUnlinkedMembers()

      expect(mockGet).toHaveBeenCalledWith('/api/v1/organisations/members/unlinked')
    })
  })

  describe('listMembers', () => {
    test('calls GET /api/v1/organisations/members', async () => {
      mockGet.mockResolvedValueOnce({ data: { data: [] } })

      await organisationsApi.listMembers()

      expect(mockGet).toHaveBeenCalledWith('/api/v1/organisations/members')
    })
  })

  describe('getMyInvitations', () => {
    test('calls GET /api/v1/invitations/mine', async () => {
      mockGet.mockResolvedValueOnce({ data: { data: [] } })

      await organisationsApi.getMyInvitations()

      expect(mockGet).toHaveBeenCalledWith('/api/v1/invitations/mine')
    })
  })
})
