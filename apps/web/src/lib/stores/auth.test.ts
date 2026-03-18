vi.mock('@/lib/api/auth', () => ({
  authApi: {
    refresh: vi.fn(),
    logout: vi.fn(),
  },
}))

import { useAuthStore } from './auth'
import type { User } from '@/types/api'
import { authApi } from '@/lib/api/auth'

const mockUser: User = {
  id: 'user-1',
  email: 'ahmad@workived.com',
  full_name: 'Ahmad Founder',
  is_verified: true,
  is_active: true,
}

beforeEach(() => {
  useAuthStore.setState({ accessToken: null, user: null })
  vi.clearAllMocks()
})

describe('useAuthStore', () => {
  it('has null token and user in initial state', () => {
    const state = useAuthStore.getState()
    expect(state.accessToken).toBeNull()
    expect(state.user).toBeNull()
  })

  it('setAuth sets token and user', () => {
    useAuthStore.getState().setAuth({
      access_token: 'jwt-token-123',
      user: mockUser,
    })

    const state = useAuthStore.getState()
    expect(state.accessToken).toBe('jwt-token-123')
    expect(state.user).toEqual(mockUser)
  })

  it('isAuthenticated returns true when token exists', () => {
    useAuthStore.setState({ accessToken: 'some-token' })
    expect(useAuthStore.getState().isAuthenticated()).toBe(true)
  })

  it('isAuthenticated returns false when no token', () => {
    expect(useAuthStore.getState().isAuthenticated()).toBe(false)
  })

  it('logout clears token and user', async () => {
    vi.mocked(authApi.logout).mockResolvedValue(undefined as never)

    useAuthStore.setState({ accessToken: 'token', user: mockUser })

    await useAuthStore.getState().logout()

    const state = useAuthStore.getState()
    expect(state.accessToken).toBeNull()
    expect(state.user).toBeNull()
  })

  it('refresh updates token on success', async () => {
    vi.mocked(authApi.refresh).mockResolvedValue({
      data: { data: { access_token: 'new-token' } },
    } as never)

    useAuthStore.setState({ accessToken: 'old-token', user: mockUser })

    const result = await useAuthStore.getState().refresh()

    expect(result).toBe(true)
    expect(useAuthStore.getState().accessToken).toBe('new-token')
  })

  it('refresh calls logout on failure', async () => {
    vi.mocked(authApi.refresh).mockRejectedValue(new Error('expired'))
    vi.mocked(authApi.logout).mockResolvedValue(undefined as never)

    useAuthStore.setState({ accessToken: 'old-token', user: mockUser })

    const result = await useAuthStore.getState().refresh()

    expect(result).toBe(false)
    expect(useAuthStore.getState().accessToken).toBeNull()
    expect(useAuthStore.getState().user).toBeNull()
  })
})
