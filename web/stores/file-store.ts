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
  displayName?: string | null
  mimeType: string
  size: number
  currentVersion: number
  tags?: string[]
  description?: string | null
  sha256?: string | null
  uploadedBy?: string | null
  deletedAt?: string | null
  createdAt: string
  updatedAt: string
}

export interface FileVersionItem {
  id: string
  versionId: string
  fileId: string
  version: number
  objectKey: string
  filename: string
  mimeType: string
  size: number
  uploadedBy?: string | null
  createdAt: string
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
  uploadProgress: number | null

  // Active file list
  fetchFiles: (p?: number, sortBy?: string, sortOrder?: string) => Promise<void>
  fetchTags: () => Promise<void>
  uploadFile: (file: File, tags?: string[], description?: string, displayName?: string) => Promise<boolean>
  deleteFile: (fileId: string) => Promise<boolean>
  renameFile: (fileId: string, name: string) => Promise<boolean>
  updateFile: (fileId: string, data: { tags?: string[]; description?: string; filename?: string }) => Promise<boolean>
  getDownloadUrl: (fileId: string) => Promise<string>
  getContentUrl: (fileId: string) => string
  getThumbnailUrl: (fileId: string, width?: number) => string
  setSearch: (search: string) => void
  setSelectedTags: (tags: string[]) => void
  clearError: () => void

  // Version actions
  getVersions: (fileId: string) => Promise<FileVersionItem[]>
  uploadNewVersion: (fileId: string, file: File, displayName?: string) => Promise<boolean>
  getVersionDownloadUrl: (fileId: string, version: number) => Promise<string>

  // Trash actions
  trashFiles: FileItem[]
  trashTotal: number
  trashPage: number
  trashLoading: boolean
  fetchTrash: (p?: number, search?: string) => Promise<void>
  restoreFiles: (fileIds: string[]) => Promise<boolean>
  permanentDeleteFiles: (fileIds: string[]) => Promise<boolean>
  emptyTrash: () => Promise<boolean>
}

const BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'https://www.oxth.com/api'

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
  uploadProgress: null,

  trashFiles: [],
  trashTotal: 0,
  trashPage: 1,
  trashLoading: false,

  fetchFiles: async (p?: number, sortBy?: string, sortOrder?: string) => {
    const { pageSize, search, selectedTags } = get()
    const page = p ?? get().page
    set({ loading: true, error: null })
    try {
      const res: any = await apiClient.post('/file/list', {
        page,
        pageSize,
        search: search || undefined,
        tags: selectedTags.length > 0 ? selectedTags : undefined,
        sortBy: sortBy || 'createdAt',
        sortOrder: sortOrder || 'desc',
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

  uploadFile: async (file, tags, description, displayName) => {
    set({ loading: true, error: null, uploadProgress: 0 })
    try {
      const formData = new FormData()
      formData.append('file', file, file.name)
      if (tags?.length) formData.append('tags', JSON.stringify(tags))
      if (description) formData.append('description', description)
      if (displayName) formData.append('displayName', displayName)
      const uploadHeaders: any = { 'Content-Type': undefined }
      await apiClient.post('/file/upload', formData, {
        headers: uploadHeaders,
        transformRequest: [(d: any) => d],
        onUploadProgress: (e: ProgressEvent) => {
          if (e.total) {
            set({ uploadProgress: Math.round((e.loaded / e.total) * 100) })
          }
        },
      } as any)
      set({ uploadProgress: null })
      await get().fetchFiles(1)
      await get().fetchTags()
      return true
    } catch (e: any) {
      set({ error: e?.response?.data?.message || e.message || '上传失败', uploadProgress: null })
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

  renameFile: async (fileId, name) => {
    set({ loading: true, error: null })
    try {
      await apiClient.patch(`/file/${fileId}/rename`, { name })
      await get().fetchFiles()
      return true
    } catch (e: any) {
      set({ error: e?.response?.data?.message || e.message || '重命名失败' })
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

  getDownloadUrl: async (fileId: string): Promise<string> => {
    try {
      const res: any = await apiClient.get(`/file/${fileId}/download`)
      return (res as any).data || ''
    } catch {
      return ''
    }
  },

  getContentUrl: (fileId: string): string => {
    const apiBase = process.env.NEXT_PUBLIC_API_URL || 'https://www.oxth.com/api'
    return `${apiBase}/file/${fileId}/content`
  },

  /** Get content URL with auth token injected as query param — for <img>/<video> tags */
  getThumbnailUrl: (fileId: string, width: number = 200): string => {
    const apiBase = process.env.NEXT_PUBLIC_API_URL || 'https://www.oxth.com/api'
    return `${apiBase}/file/${fileId}/thumbnail?w=${width}`
  },

  setSearch: (search) => set({ search }),
  setSelectedTags: (tags) => set({ selectedTags: tags }),
  clearError: () => set({ error: null }),

  // Version actions
  getVersions: async (fileId: string): Promise<FileVersionItem[]> => {
    try {
      const res: any = await apiClient.get(`/file/${fileId}/versions`)
      return Array.isArray((res as any).data) ? (res as any).data : (res as any).data?.items || []
    } catch {
      return []
    }
  },

  uploadNewVersion: async (fileId: string, file: File, displayName?: string): Promise<boolean> => {
    set({ loading: true, error: null })
    try {
      const formData = new FormData()
      formData.append('file', file, file.name)
      if (displayName) formData.append('displayName', displayName)
      const uploadHeaders: any = { 'Content-Type': undefined }
      await apiClient.post(`/file/${fileId}/version`, formData, { headers: uploadHeaders, transformRequest: [(d: any) => d] })
      await get().fetchFiles()
      return true
    } catch (e: any) {
      set({ error: e?.response?.data?.message || e.message || '上传新版本失败' })
      return false
    }
  },

  getVersionDownloadUrl: async (fileId: string, version: number): Promise<string> => {
    try {
      const res: any = await apiClient.get(`/file/${fileId}/versions/${version}/download`)
      return (res as any).data || ''
    } catch {
      return ''
    }
  },

  // Trash actions
  fetchTrash: async (p?: number, search?: string) => {
    const page = p ?? get().trashPage
    set({ trashLoading: true })
    try {
      const res: any = await apiClient.post('/file/trash/list', {
        page,
        pageSize: get().pageSize,
        search: search || undefined,
      })
      const data = res.data || res
      set({
        trashFiles: data.items || [],
        trashTotal: data.total || 0,
        trashPage: data.page || page,
        trashLoading: false,
      })
    } catch (e: any) {
      set({ error: e?.response?.data?.message || e.message || '回收站加载失败', trashLoading: false })
    }
  },

  restoreFiles: async (fileIds: string[]): Promise<boolean> => {
    set({ loading: true, error: null })
    try {
      await apiClient.post('/file/trash/restore', { fileIds })
      await get().fetchTrash(get().trashPage)
      await get().fetchFiles()
      return true
    } catch (e: any) {
      set({ error: e?.response?.data?.message || e.message || '恢复失败' })
      return false
    }
  },

  permanentDeleteFiles: async (fileIds: string[]): Promise<boolean> => {
    set({ loading: true, error: null })
    try {
      await apiClient.post('/file/trash/permanent-delete', { fileIds })
      await get().fetchTrash(1)
      return true
    } catch (e: any) {
      set({ error: e?.response?.data?.message || e.message || '永久删除失败' })
      return false
    }
  },

  emptyTrash: async (): Promise<boolean> => {
    set({ loading: true, error: null })
    try {
      await apiClient.post('/file/trash/empty')
      await get().fetchTrash(1)
      await get().fetchFiles()
      return true
    } catch (e: any) {
      set({ error: e?.response?.data?.message || e.message || '清空回收站失败' })
      return false
    }
  },
}))
