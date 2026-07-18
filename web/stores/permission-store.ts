import { create } from 'zustand'
import type { Permission, CreatePermissionRequest, UpdatePermissionRequest, PaginatedData } from '@/types'
import { unwrapList } from '@/types'
import { fetchList, fetchOne, createItem, updateItem, deleteItem } from '@/lib/api-client'

interface PermissionState {
  permissions: Permission[]
  currentPermission: Permission | null
  loading: boolean
  error: string | null
  message: string | null

  fetchPermissions: () => Promise<void>
  fetchPermission: (id: string) => Promise<void>
  createPermission: (data: CreatePermissionRequest) => Promise<boolean>
  updatePermission: (id: string, data: UpdatePermissionRequest) => Promise<boolean>
  deletePermission: (id: string) => Promise<boolean>
  clearMessage: () => void
}

export const usePermissionStore = create<PermissionState>((set) => ({
  permissions: [],
  currentPermission: null,
  loading: false,
  error: null,
  message: null,

  fetchPermissions: async () => {
    set({ loading: true, error: null })
    try {
      const res = await fetchList<PaginatedData<Permission>>('/permission')
      set({ permissions: unwrapList(res.data), loading: false })
    } catch (e) {
      set({ error: (e as Error).message, loading: false })
    }
  },

  fetchPermission: async (id) => {
    set({ loading: true, error: null })
    try {
      const res = await fetchOne<Permission>(`/permission/${id}`)
      set({ currentPermission: res.data, loading: false })
    } catch (e) {
      set({ error: (e as Error).message, loading: false })
    }
  },

  createPermission: async (data) => {
    set({ loading: true, error: null })
    try {
      await createItem('/permission', data)
      set({ loading: false, message: '权限创建成功' })
      return true
    } catch (e) {
      set({ error: (e as Error).message, loading: false })
      return false
    }
  },

  updatePermission: async (id, data) => {
    set({ loading: true, error: null })
    try {
      await updateItem(`/permission/${id}`, data)
      set({ loading: false, message: '权限更新成功' })
      return true
    } catch (e) {
      set({ error: (e as Error).message, loading: false })
      return false
    }
  },

  deletePermission: async (id) => {
    set({ loading: true, error: null })
    try {
      await deleteItem(`/permission/${id}`)
      set({ loading: false, message: '权限删除成功' })
      return true
    } catch (e) {
      set({ error: (e as Error).message, loading: false })
      return false
    }
  },

  clearMessage: () => set({ message: null }),
}))
