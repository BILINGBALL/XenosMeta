import { create } from 'zustand'
import type { Group, CreateGroupRequest, CreateRootGroupRequest, UpdateGroupRequest, PaginatedData } from '@/types'
import { unwrapList } from '@/types'
import { fetchList, fetchOne, createItem, updateItem, deleteItem } from '@/lib/api-client'

interface GroupState {
  groups: Group[]
  currentGroup: Group | null
  groupTree: Group | null
  loading: boolean
  error: string | null
  message: string | null

  fetchGroups: (tenantId: string) => Promise<void>
  fetchGroup: (id: string) => Promise<void>
  fetchRootGroup: (tenantId: string) => Promise<void>
  fetchGroupTree: (tenantId: string, groupId?: string) => Promise<void>
  createRootGroup: (data: CreateRootGroupRequest) => Promise<boolean>
  createGroup: (data: CreateGroupRequest) => Promise<boolean>
  updateGroup: (id: string, data: UpdateGroupRequest) => Promise<boolean>
  deleteGroup: (id: string) => Promise<boolean>
  restoreGroup: (id: string) => Promise<boolean>
  clearMessage: () => void
}

export const useGroupStore = create<GroupState>((set) => ({
  groups: [],
  currentGroup: null,
  groupTree: null,
  loading: false,
  error: null,
  message: null,

  fetchGroups: async (tenantId) => {
    set({ loading: true, error: null })
    try {
      const res = await fetchList<PaginatedData<Group>>(`/group/list/${tenantId}`)
      set({ groups: unwrapList(res.data), loading: false })
    } catch (e) {
      set({ error: (e as Error).message, loading: false })
    }
  },

  fetchGroup: async (id) => {
    set({ loading: true, error: null })
    try {
      const res = await fetchOne<Group>(`/group/${id}`)
      set({ currentGroup: res.data, loading: false })
    } catch (e) {
      set({ error: (e as Error).message, loading: false })
    }
  },

  fetchRootGroup: async (tenantId) => {
    set({ loading: true, error: null })
    try {
      const res = await fetchOne<Group>(`/group/root/${tenantId}`)
      set({ currentGroup: res.data, loading: false })
    } catch (e) {
      set({ error: (e as Error).message, loading: false })
    }
  },

  fetchGroupTree: async (tenantId, groupId?) => {
    set({ loading: true, error: null })
    try {
      const url = groupId
        ? `/group/tree/${tenantId}/${groupId}`
        : `/group/tree/${tenantId}`
      const res = await fetchOne<Group>(url)
      set({ groupTree: res.data, loading: false })
    } catch (e) {
      set({ error: (e as Error).message, loading: false })
    }
  },

  createRootGroup: async (data) => {
    set({ loading: true, error: null })
    try {
      await createItem('/group/root', data)
      set({ loading: false, message: '根群组创建成功' })
      return true
    } catch (e) {
      set({ error: (e as Error).message, loading: false })
      return false
    }
  },

  createGroup: async (data) => {
    set({ loading: true, error: null })
    try {
      await createItem('/group', data)
      set({ loading: false, message: '群组创建成功' })
      return true
    } catch (e) {
      set({ error: (e as Error).message, loading: false })
      return false
    }
  },

  updateGroup: async (id, data) => {
    set({ loading: true, error: null })
    try {
      await updateItem(`/group/${id}`, data)
      set({ loading: false, message: '群组更新成功' })
      return true
    } catch (e) {
      set({ error: (e as Error).message, loading: false })
      return false
    }
  },

  deleteGroup: async (id) => {
    set({ loading: true, error: null })
    try {
      await deleteItem(`/group/${id}`)
      set({ loading: false, message: '群组删除成功' })
      return true
    } catch (e) {
      set({ error: (e as Error).message, loading: false })
      return false
    }
  },

  restoreGroup: async (id) => {
    set({ loading: true, error: null })
    try {
      await updateItem(`/group/${id}/restore`, {})
      set({ loading: false, message: '群组恢复成功' })
      return true
    } catch (e) {
      set({ error: (e as Error).message, loading: false })
      return false
    }
  },

  clearMessage: () => set({ message: null }),
}))
