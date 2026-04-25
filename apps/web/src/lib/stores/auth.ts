import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { User } from '@/types/api'
import { authApi } from '@/lib/api/auth'

interface AuthState {
  accessToken: string | null
  user: User | null

  setAuth: (data: { access_token: string; user: User }) => void
  refresh: () => Promise<boolean>
  logout: () => void
  isAuthenticated: () => boolean
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      accessToken: null,
      user: null,

      setAuth: (data) => {
        set({
          accessToken: data.access_token,
          user: data.user,
        })
      },

      refresh: async () => {
        try {
          // Refresh token is in httpOnly cookie — sent automatically
          const res = await authApi.refresh()
          set({ accessToken: res.data.data.access_token })
          return true
        } catch {
          get().logout()
          return false
        }
      },

      logout: async () => {
        try {
          // Call backend to invalidate refresh token
          await authApi.logout()
        } catch {
          // Ignore errors — we're logging out anyway
        } finally {
          // Clear local state
          set({
            accessToken: null,
            user: null,
          })
        }
      },

      isAuthenticated: () => !!get().accessToken,
    }),
    {
      name: 'workived-auth',
      partialize: (state) => ({
        accessToken: state.accessToken,
        user: state.user,
      }),
    },
  ),
)
