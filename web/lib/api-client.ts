import axios, { AxiosError, InternalAxiosRequestConfig } from 'axios'
import { useAuthStore } from '@/stores/auth-store'

const BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'https://www.oxth.com/api'

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

apiClient.interceptors.response.use(
  (response) => response.data,
  async (error: AxiosError<{ message?: string }>) => {
    const originalRequest = error.config as InternalAxiosRequestConfig & { _retry?: boolean }

    // Only handle 401, and only if not already retrying
    if (error.response?.status !== 401 || originalRequest._retry) {
      const msg = error.response?.data?.message || error.message || 'Request failed'
      return Promise.reject(new Error(msg))
    }

    // Don't try to refresh on login/refresh endpoints themselves
    if (originalRequest.url?.includes('/user/login') || originalRequest.url?.includes('/user/refresh')) {
      return Promise.reject(new Error(error.response?.data?.message || '认证失败'))
    }

    const { refreshToken } = useAuthStore.getState()
    if (!refreshToken) {
      // No refresh token — force logout
      useAuthStore.getState().logout()
      return Promise.reject(new Error('登录已过期，请重新登录'))
    }

    // If already refreshing, queue this request
    if (isRefreshing) {
      return new Promise<unknown>((resolve, reject) => {
        pendingQueue.push({
          resolve: (token: string) => {
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
      const { data } = await axios.post(`${BASE_URL}/user/refresh`, { refreshToken })
      const newAccessToken = (data as { data?: { accessToken?: string } }).data?.accessToken
      const newRefreshToken = (data as { data?: { refreshToken?: string } }).data?.refreshToken

      if (!newAccessToken) throw new Error('刷新失败')

      useAuthStore.getState().setTokens(newAccessToken, newRefreshToken || refreshToken)

      processQueue(null, newAccessToken)

      originalRequest.headers!.Authorization = `Bearer ${newAccessToken}`
      return apiClient(originalRequest)
    } catch (refreshError) {
      processQueue(refreshError as Error, null)
      useAuthStore.getState().logout()
      return Promise.reject(new Error('登录已过期，请重新登录'))
    } finally {
      isRefreshing = false
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
