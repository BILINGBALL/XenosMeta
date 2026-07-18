import { create } from 'zustand'
import type { Tenant, CreateTenantRequest, UpdateTenantRequest, PaginatedData } from '@/types'
import { unwrapList } from '@/types'
import { fetchList, fetchOne, createItem, updateItem, deleteItem } from '@/lib/api-client'

interface TenantState {
  tenants: Tenant[]
  currentTenant: Tenant | null
  loading: boolean
  error: string | null
  message: string | null

  fetchTenants: () => Promise<void>
  fetchTenant: (id: string) => Promise<void>
  createTenant: (data: CreateTenantRequest) => Promise<boolean>
  updateTenant: (id: string, data: UpdateTenantRequest) => Promise<boolean>
  deleteTenant: (id: string) => Promise<boolean>
  restoreTenant: (id: string) => Promise<boolean>
  clearMessage: () => void
}

export const useTenantStore = create<TenantState>((set) => ({
  tenants: [],
  currentTenant: null,
  loading: false,
  error: null,
  message: null,

  fetchTenants: async () => {
    set({ loading: true, error: null })
    try {
      const res = await fetchList<PaginatedData<Tenant>>('/tenant')
      set({ tenants: unwrapList(res.data), loading: false })
    } catch (e) {
      set({ error: (e as Error).message, loading: false })
    }
  },

  fetchTenant: async (id) => {
    set({ loading: true, error: null })
    try {
      const res = await fetchOne<Tenant>(`/tenant/${id}`)
      set({ currentTenant: res.data, loading: false })
    } catch (e) {
      set({ error: (e as Error).message, loading: false })
    }
  },

  createTenant: async (data) => {
    set({ loading: true, error: null })
    try {
      await createItem('/tenant/create', data)
      set({ loading: false, message: '租户创建成功' })
      return true
    } catch (e) {
      set({ error: (e as Error).message, loading: false })
      return false
    }
  },

  updateTenant: async (id, data) => {
    set({ loading: true, error: null })
    try {
      await updateItem(`/tenant/${id}`, data)
      set({ loading: false, message: '租户更新成功' })
      return true
    } catch (e) {
      set({ error: (e as Error).message, loading: false })
      return false
    }
  },

  deleteTenant: async (id) => {
    set({ loading: true, error: null })
    try {
      await deleteItem(`/tenant/${id}`)
      set({ loading: false, message: '租户删除成功' })
      return true
    } catch (e) {
      set({ error: (e as Error).message, loading: false })
      return false
    }
  },

  restoreTenant: async (id) => {
    set({ loading: true, error: null })
    try {
      await updateItem(`/tenant/${id}/restore`, {})
      set({ loading: false, message: '租户恢复成功' })
      return true
    } catch (e) {
      set({ error: (e as Error).message, loading: false })
      return false
    }
  },

  clearMessage: () => set({ message: null }),
}))
