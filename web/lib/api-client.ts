import axios, { AxiosError, InternalAxiosRequestConfig } from 'axios'
import { useAuthStore } from '@/stores/auth-store'

// 优先使用环境变量；如果没有设置，动态推导（与 index.html 的逻辑保持一致）
const BASE_URL = process.env.NEXT_PUBLIC_API_URL || (typeof window !== 'undefined' ? `http://${window.location.hostname}:3001/api` : '')

export const apiClient = axios.create({
  baseURL: BASE_URL,
  timeout: 15000,
  headers: { 'Content-Type': 'application/json' },
})

// ==================== Request interceptor — inject token ====================

apiClient.interceptors.request.use((config: InternalAxiosRequestConfig) => {
  const token = useAuthStore.getState().accessToken
  if (token && config.headers) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

// ==================== Auto-refresh logic ====================

let isRefreshing = false
let isLoggedOut = false
let pendingQueue: Array<{
  resolve: (token: string) => void
  reject: (err: Error) => void
}> = []

function processQueue(error: Error | null, token: string | null) {
  pendingQueue.forEach((p) => {
    if (error) p.reject(error)
    else p.resolve(token!)
  })
  pendingQueue = []
}

/**
 * Refresh 失败后，静默让所有 pending 请求"成功"返回 undefined。
 * 如果用 reject，调用方若没有充分 try-catch 会变成 React 错误覆盖层（红屏），
 * 尤其是并发请求时（多个 store 的 useEffect 同时触发），只有第一个 store 的
 * try-catch 能兜底，其余会冒泡成未捕获异常。
 * 做法：把所有 queued request 的 Authorization 清掉（无 token），
 * 并直接 resolve 原始配置（apiClient 执行后大概率还是会失败，
 * 因此改为返回 undefined，让调用方 `res?.data` 变成 undefined 即可）。
 */
function resolveQueueOnLogout() {
  pendingQueue.forEach((p) => p.resolve('__logged_out__'))
  pendingQueue = []
}

/**
 * 重置拦截器内部状态（isLoggedOut / isRefreshing / pendingQueue）。
 * 必须在用户重新登录成功后调用，否则上一次刷新失败留下的 isLoggedOut=true
 * 会导致后续所有 401 都直接跳过刷新逻辑，用户陷入"登录→15分钟后退出"死循环。
 */
export function resetAuthInterceptors() {
  isLoggedOut = false
  isRefreshing = false
  pendingQueue = []
}

apiClient.interceptors.response.use(
  (response) => response.data,
  async (error: AxiosError<{ message?: string }>) => {
    const originalRequest = error.config as InternalAxiosRequestConfig & { _retry?: boolean }

    // Only handle 401, and only if not already retrying + not already logged out
    if (error.response?.status !== 401 || originalRequest._retry || isLoggedOut) {
      const msg = error.response?.data?.message || error.message || 'Request failed'
      return Promise.reject(new Error(msg))
    }

    // Don't try to refresh on login/refresh/logout endpoints themselves
    if (originalRequest.url?.includes('/user/login') || originalRequest.url?.includes('/user/refresh') || originalRequest.url?.includes('/user/logout')) {
      return Promise.reject(new Error(error.response?.data?.message || '认证失败'))
    }

    const { refreshToken } = useAuthStore.getState()
    if (!refreshToken) {
      console.warn('[Auth] 401 but no refreshToken in store — logging out')
      isLoggedOut = true
      useAuthStore.getState().logout()
      return Promise.reject(new Error('登录已过期，请重新登录'))
    }

    // If already refreshing, queue this request
    if (isRefreshing) {
      return new Promise<unknown>((resolve, reject) => {
        pendingQueue.push({
          resolve: (token: string) => {
            // resolveQueueOnLogout 会传入 '__logged_out__'，表示 refresh 已失败、
            // 用户已登出，此时不再重试原始请求（又会 401），直接返回 undefined
            if (token === '__logged_out__') {
              resolve(undefined)
              return
            }
            originalRequest.headers!.Authorization = `Bearer ${token}`
            resolve(apiClient(originalRequest))
          },
          reject,
        })
      })
    }

    isRefreshing = true
    originalRequest._retry = true

    try {
      console.log('[Auth] Token expired, attempting refresh →', `${BASE_URL}/user/refresh`)
      const { data } = await axios.post(`${BASE_URL}/user/refresh`, { refreshToken })
      console.log('[Auth] Refresh response:', data)

      const newAccessToken = (data as { data?: { accessToken?: string } }).data?.accessToken
      const newRefreshToken = (data as { data?: { refreshToken?: string } }).data?.refreshToken

      if (!newAccessToken) {
        console.error('[Auth] Refresh succeeded but no accessToken in response data:', data)
        throw new Error('刷新失败')
      }

      console.log('[Auth] Refresh successful, updating tokens')
      useAuthStore.getState().setTokens(newAccessToken, newRefreshToken || refreshToken)

      processQueue(null, newAccessToken)

      originalRequest.headers!.Authorization = `Bearer ${newAccessToken}`
      return apiClient(originalRequest)
    } catch (refreshError) {
      console.warn('[Auth] Refresh failed (login elsewhere or invalid refreshToken):',
        refreshError instanceof Error ? refreshError.message : refreshError)

      // 先执行 logout（它内部会调用 resetAuthInterceptors 把 isLoggedOut=false 等清掉）
      useAuthStore.getState().logout()

      // logout 会触发 resetAuthInterceptors → 把 isLoggedOut 重置成 false，
      // 所以必须在 logout() 之后再设为 true，保证后续 401 不再进入刷新逻辑
      isLoggedOut = true
      isRefreshing = false

      // 静默释放所有 queued 请求：返回 undefined 而非 reject，避免冒泡成红屏
      resolveQueueOnLogout()

      // 原始请求也 resolve(undefined) 不 reject，让各 store 的 try-catch /
      // optional chaining (res?.data) 自然兜底，UI 会因为 isLoggedIn=false
      // 切换到未登录界面，不会出现报错 overlay
      return undefined
    }
  }
)

// ==================== Generic CRUD helpers ====================

export async function fetchList<T>(url: string, params?: Record<string, unknown>) {
  const res = await apiClient.get<unknown, { code: number; message: string; data: T; success: boolean }>(url, { params })
  return res
}

export async function fetchOne<T>(url: string) {
  const res = await apiClient.get<unknown, { code: number; message: string; data: T; success: boolean }>(url)
  return res
}

export async function createItem<T>(url: string, body: unknown) {
  const res = await apiClient.post<unknown, { code: number; message: string; data: T; success: boolean }>(url, body)
  return res
}

export async function updateItem<T>(url: string, body: unknown) {
  const res = await apiClient.put<unknown, { code: number; message: string; data: T; success: boolean }>(url, body)
  return res
}

export async function deleteItem<T>(url: string) {
  const res = await apiClient.delete<unknown, { code: number; message: string; data: T; success: boolean }>(url)
  return res
}

export async function postAction<T>(url: string, body?: unknown) {
  const res = await apiClient.post<unknown, { code: number; message: string; data: T; success: boolean }>(url, body)
  return res
}
