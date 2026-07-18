import { create } from 'zustand'
import type { Role, CreateRoleRequest, UpdateRoleRequest, AssignPermissionsRequest, PaginatedData } from '@/types'
import { unwrapList } from '@/types'
import { fetchList, fetchOne, createItem, updateItem, deleteItem, postAction } from '@/lib/api-client'

interface RoleState {
  roles: Role[]
  currentRole: Role | null
  loading: boolean
  error: string | null
  message: string | null

  fetchRoles: () => Promise<void>
  fetchRole: (id: string) => Promise<void>
  createRole: (data: CreateRoleRequest) => Promise<boolean>
  updateRole: (id: string, data: UpdateRoleRequest) => Promise<boolean>
  deleteRole: (id: string) => Promise<boolean>
  restoreRole: (id: string) => Promise<boolean>
  assignPermissions: (roleId: string, data: AssignPermissionsRequest) => Promise<boolean>
  clearMessage: () => void
}

export const useRoleStore = create<RoleState>((set) => ({
  roles: [],
  currentRole: null,
  loading: false,
  error: null,
  message: null,

  fetchRoles: async () => {
    set({ loading: true, error: null })
    try {
      const res = await fetchList<PaginatedData<Role>>('/role')
      set({ roles: unwrapList(res.data), loading: false })
    } catch (e) {
      set({ error: (e as Error).message, loading: false })
    }
  },

  fetchRole: async (id) => {
    set({ loading: true, error: null })
    try {
      const res = await fetchOne<Role>(`/role/${id}`)
      set({ currentRole: res.data, loading: false })
    } catch (e) {
      set({ error: (e as Error).message, loading: false })
    }
  },

  createRole: async (data) => {
    set({ loading: true, error: null })
    try {
      await createItem('/role', data)
      set({ loading: false, message: '角色创建成功' })
      return true
    } catch (e) {
      set({ error: (e as Error).message, loading: false })
      return false
    }
  },

  updateRole: async (id, data) => {
    set({ loading: true, error: null })
    try {
      await updateItem(`/role/${id}`, data)
      set({ loading: false, message: '角色更新成功' })
      return true
    } catch (e) {
      set({ error: (e as Error).message, loading: false })
      return false
    }
  },

  deleteRole: async (id) => {
    set({ loading: true, error: null })
    try {
      await deleteItem(`/role/${id}`)
      set({ loading: false, message: '角色删除成功' })
      return true
    } catch (e) {
      set({ error: (e as Error).message, loading: false })
      return false
    }
  },

  restoreRole: async (id) => {
    set({ loading: true, error: null })
    try {
      await updateItem(`/role/${id}/restore`, {})
      set({ loading: false, message: '角色恢复成功' })
      return true
    } catch (e) {
      set({ error: (e as Error).message, loading: false })
      return false
    }
  },

  assignPermissions: async (roleId, data) => {
    set({ loading: true, error: null })
    try {
      await postAction(`/role/${roleId}/permissions`, data)
      set({ loading: false, message: '权限分配成功' })
      return true
    } catch (e) {
      set({ error: (e as Error).message, loading: false })
      return false
    }
  },

  clearMessage: () => set({ message: null }),
}))
