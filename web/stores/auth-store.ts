import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import type { LoginRequest, LoginResponse } from '@/types'
import { apiClient, resetAuthInterceptors } from '@/lib/api-client'

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
  setHasHydrated: (v: boolean) => void
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
          // 登录成功后必须重置拦截器内部状态：上一次刷新失败留下的 isLoggedOut=true
          // 会导致后续 401 直接跳过刷新，陷入"登录→15分钟退出"死循环
          resetAuthInterceptors()
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
        // 登出时同步清理拦截器状态，避免状态残留
        resetAuthInterceptors()
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

      setHasHydrated: (v: boolean) => set({ hasHydrated: v }),

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
        // Zustand v5: 直接修改 state.hasHydrated 不会触发重新渲染
        // 必须通过 set() 调用（即 store action）来更新
        state?.setHasHydrated(true)
      },
    }
  )
)
