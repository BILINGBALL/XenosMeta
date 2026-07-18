import { create } from 'zustand'
import type { User, UpdateUserRequest, AssignGroupRequest, PaginatedData } from '@/types'
import { unwrapList } from '@/types'
import { fetchList, fetchOne, createItem, updateItem, deleteItem, postAction } from '@/lib/api-client'

interface UserState {
  users: User[]
  currentUser: User | null
  loading: boolean
  error: string | null
  message: string | null

  fetchUsers: () => Promise<void>
  fetchUser: (id: string) => Promise<void>
  updateUser: (id: string, data: UpdateUserRequest) => Promise<boolean>
  deleteUser: (id: string) => Promise<boolean>
  restoreUser: (id: string) => Promise<boolean>
  assignGroup: (data: AssignGroupRequest) => Promise<boolean>
  clearMessage: () => void
}

export const useUserStore = create<UserState>((set) => ({
  users: [],
  currentUser: null,
  loading: false,
  error: null,
  message: null,

  fetchUsers: async () => {
    set({ loading: true, error: null })
    try {
      const res = await fetchList<PaginatedData<User>>('/user/list')
      const raw = unwrapList(res.data)
      // 后端 roles 是 [{role: {...}}] 嵌套结构，拍平为 Role[]
      const users = raw.map((u: any) => ({
        ...u,
        roles: (u.roles || []).map((r: any) => r.role || r),
      }))
      set({ users, loading: false })
    } catch (e) {
      set({ error: (e as Error).message, loading: false })
    }
  },

  fetchUser: async (id) => {
    set({ loading: true, error: null })
    try {
      const res = await fetchOne<User>(`/user/${id}`)
      set({ currentUser: res.data, loading: false })
    } catch (e) {
      set({ error: (e as Error).message, loading: false })
    }
  },

  updateUser: async (id, data) => {
    set({ loading: true, error: null })
    try {
      await updateItem(`/user/${id}`, data)
      set({ loading: false, message: '用户更新成功' })
      return true
    } catch (e) {
      set({ error: (e as Error).message, loading: false })
      return false
    }
  },

  deleteUser: async (id) => {
    set({ loading: true, error: null })
    try {
      await deleteItem(`/user/${id}`)
      set({ loading: false, message: '用户删除成功' })
      return true
    } catch (e) {
      set({ error: (e as Error).message, loading: false })
      return false
    }
  },

  restoreUser: async (id) => {
    set({ loading: true, error: null })
    try {
      await updateItem(`/user/${id}/restore`, {})
      set({ loading: false, message: '用户恢复成功' })
      return true
    } catch (e) {
      set({ error: (e as Error).message, loading: false })
      return false
    }
  },

  assignGroup: async (data) => {
    set({ loading: true, error: null })
    try {
      await postAction('/user/assign-group', data)
      set({ loading: false, message: '群组分配成功' })
      return true
    } catch (e) {
      set({ error: (e as Error).message, loading: false })
      return false
    }
  },

  clearMessage: () => set({ message: null }),
}))
