import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import type { LoginRequest, LoginResponse } from '@/types'
import { apiClient } from '@/lib/api-client'

// SSR-safe storage: Next.js 服务端无 localStorage，返回空操作
const storage = {
  getItem: (name: string) => {
    if (typeof window === 'undefined') return null
    return window.localStorage.getItem(name)
  },
  setItem: (name: string, value: string) => {
    if (typeof window !== 'undefined') window.localStorage.setItem(name, value)
  },
  removeItem: (name: string) => {
    if (typeof window !== 'undefined') window.localStorage.removeItem(name)
  },
}

interface AuthState {
  accessToken: string | null
  refreshToken: string | null
  user: Omit<LoginResponse, 'accessToken' | 'refreshToken' | 'expiresIn'> | null
  isLoggedIn: boolean
  hasHydrated: boolean
  loading: boolean
  error: string | null
  message: string | null

  login: (data: LoginRequest) => Promise<boolean>
  logout: () => Promise<void>
  setTokens: (access: string, refresh: string) => void
  clearError: () => void
  clearMessage: () => void
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      accessToken: null,
      refreshToken: null,
      user: null,
      isLoggedIn: false,
      hasHydrated: false,
      loading: false,
      error: null,
      message: null,

      login: async (data) => {
        set({ loading: true, error: null })
        try {
          const res = await apiClient.post<unknown, { data: LoginResponse }>(
            '/user/login',
            data
          )
          const { accessToken, refreshToken, expiresIn: _, ...user } = res.data
          set({
            accessToken,
            refreshToken,
            user,
            isLoggedIn: true,
            loading: false,
            error: null,
          })
          return true
        } catch (e) {
          const msg = e instanceof Error ? e.message : 'Login failed'
          set({ loading: false, error: msg })
          return false
        }
      },

      logout: async () => {
        const token = useAuthStore.getState().accessToken
        // Fire-and-forget via fetch — NOT apiClient, to avoid re-entering the 401 interceptor
        if (token) {
          fetch(`${process.env.NEXT_PUBLIC_API_URL || ''}/user/logout`, {
            method: 'POST',
            headers: { Authorization: `Bearer ${token}` },
          }).catch(() => {})
        }
        set({
          accessToken: null,
          refreshToken: null,
          user: null,
          isLoggedIn: false,
          error: null,
        })
      },

      setTokens: (access, refresh) =>
        set({ accessToken: access, refreshToken: refresh }),

      clearError: () => set({ error: null }),
      clearMessage: () => set({ message: null }),
    }),
    {
      name: 'auth-core-auth',
      storage: createJSONStorage(() => storage),
      partialize: (state) => ({
        accessToken: state.accessToken,
        refreshToken: state.refreshToken,
        user: state.user,
        isLoggedIn: state.isLoggedIn,
      }),
      onRehydrateStorage: () => (state) => {
        if (state) {
          state.hasHydrated = true
        }
      },
    }
  )
)
