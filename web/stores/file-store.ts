import { create } from 'zustand'
import { apiClient } from '@/lib/api-client'

export interface FileItem {
  id: string
  fileId: string
  tenantId: string
  groupId?: string | null
  bucket: string
  objectKey: string
  filename: string
  mimeType: string
  size: number
  tags?: string[]
  description?: string | null
  uploadedBy?: string | null
  createdAt: string
  updatedAt: string
}

interface FileState {
  files: FileItem[]
  total: number
  page: number
  pageSize: number
  loading: boolean
  error: string | null
  search: string
  selectedTags: string[]
  allTags: string[]

  fetchFiles: (p?: number) => Promise<void>
  fetchTags: () => Promise<void>
  uploadFile: (file: File, tags?: string[], description?: string) => Promise<boolean>
  deleteFile: (fileId: string) => Promise<boolean>
  updateFile: (fileId: string, data: { tags?: string[]; description?: string }) => Promise<boolean>
  getDownloadUrl: (fileId: string) => string
  setSearch: (search: string) => void
  setSelectedTags: (tags: string[]) => void
  clearError: () => void
}

export const useFileStore = create<FileState>((set, get) => ({
  files: [],
  total: 0,
  page: 1,
  pageSize: 20,
  loading: false,
  error: null,
  search: '',
  selectedTags: [],
  allTags: [],

  fetchFiles: async (p?: number) => {
    const { pageSize, search, selectedTags } = get()
    const page = p ?? get().page
    set({ loading: true, error: null })
    try {
      const res: any = await apiClient.post('/file/list', {
        page,
        pageSize,
        search: search || undefined,
        tags: selectedTags.length > 0 ? selectedTags : undefined,
      })
      const data = res.data
      set({
        files: data.items || [],
        total: data.total || 0,
        page: data.page || page,
        loading: false,
      })
    } catch (e: any) {
      set({ error: e?.response?.data?.message || e.message || '加载失败', loading: false })
    }
  },

  fetchTags: async () => {
    try {
      const res: any = await apiClient.get('/file/tags')
      set({ allTags: Array.isArray(res.data) ? res.data : res.data?.items || [] })
    } catch { /* ignore */ }
  },

  uploadFile: async (file, tags, description) => {
    set({ loading: true, error: null })
    try {
      const formData = new FormData()
      formData.append('file', file)
      if (tags?.length) formData.append('tags', JSON.stringify(tags))
      if (description) formData.append('description', description)
      await apiClient.post('/file/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })
      await get().fetchFiles(1)
      await get().fetchTags()
      return true
    } catch (e: any) {
      set({ error: e?.response?.data?.message || e.message || '上传失败' })
      return false
    }
  },

  deleteFile: async (fileId) => {
    set({ loading: true, error: null })
    try {
      await apiClient.delete(`/file/${fileId}`)
      await get().fetchFiles()
      return true
    } catch (e: any) {
      set({ error: e?.response?.data?.message || e.message || '删除失败' })
      return false
    }
  },

  updateFile: async (fileId, data) => {
    set({ loading: true, error: null })
    try {
      await apiClient.put(`/file/${fileId}`, data)
      await get().fetchFiles()
      await get().fetchTags()
      return true
    } catch (e: any) {
      set({ error: e?.response?.data?.message || e.message || '更新失败' })
      return false
    }
  },

  getDownloadUrl: (fileId) => {
    return `${apiClient.defaults.baseURL}/file/${fileId}/download`
  },

  setSearch: (search) => {
    set({ search })
    // Debounce would be better, but immediate is fine for explicit submit
  },

  setSelectedTags: (tags) => {
    set({ selectedTags: tags })
  },

  clearError: () => set({ error: null }),
}))
