import { create } from 'zustand'
import type {
  DynamicTable, DynamicField, DynamicRecord,
  CreateTableRequest, UpdateTableRequest,
  CreateFieldRequest, UpdateFieldRequest,
  CreateRecordRequest, UpdateRecordRequest, ListRecordsRequest,
  FieldType, PaginatedData,
  FieldReference, CreateReferenceRequest, UpdateReferenceRequest, LookupRecordsRequest,
  TableMirror, CreateMirrorRequest, UpdateMirrorRequest, CategorizedMirrors,
} from '@/types'
import { unwrapList } from '@/types'
import { fetchList, fetchOne, createItem, updateItem, deleteItem, postAction } from '@/lib/api-client'

interface DynamicState {
  // Tables
  tables: DynamicTable[]
  currentTable: DynamicTable | null
  // Fields
  fields: DynamicField[]
  currentField: DynamicField | null
  // Records
  records: DynamicRecord[]
  currentRecord: DynamicRecord | null
  // References
  references: FieldReference[]
  currentReference: FieldReference | null
  // Mirrors
  mirrors: TableMirror[]
  currentMirror: TableMirror | null
  outgoingMirrors: TableMirror[]
  incomingMirrors: TableMirror[]
  // Lookup
  lookupResults: any[]
  // Common
  loading: boolean
  error: string | null
  message: string | null

  // Table actions
  fetchTables: () => Promise<void>
  fetchTable: (tableId: string) => Promise<void>
  createTable: (data: CreateTableRequest) => Promise<boolean>
  updateTable: (tableId: string, data: UpdateTableRequest) => Promise<boolean>
  deleteTable: (tableId: string) => Promise<boolean>
  restoreTable: (tableId: string) => Promise<boolean>

  // Field actions
  fetchFields: (tableId: string) => Promise<void>
  fetchField: (tableId: string, fieldId: string) => Promise<void>
  createField: (tableId: string, data: CreateFieldRequest) => Promise<boolean>
  updateField: (tableId: string, fieldId: string, data: UpdateFieldRequest) => Promise<boolean>
  deleteField: (tableId: string, fieldId: string) => Promise<boolean>
  restoreField: (tableId: string, fieldId: string) => Promise<boolean>

  // Record actions
  fetchRecords: (tableId: string, tenantId: string) => Promise<void>
  fetchRecord: (tableId: string, recordId: string) => Promise<void>
  createRecord: (tableId: string, data: CreateRecordRequest) => Promise<boolean>
  updateRecord: (tableId: string, recordId: string, data: UpdateRecordRequest) => Promise<boolean>
  deleteRecord: (tableId: string, recordId: string) => Promise<boolean>
  restoreRecord: (tableId: string, recordId: string) => Promise<boolean>

  // Reference actions
  fetchReferences: (tableId: string) => Promise<void>
  createReference: (tableId: string, data: CreateReferenceRequest) => Promise<boolean>
  updateReference: (tableId: string, refId: string, data: UpdateReferenceRequest) => Promise<boolean>
  deleteReference: (tableId: string, refId: string) => Promise<boolean>
  lookupRecords: (tableId: string, refId: string, params?: LookupRecordsRequest) => Promise<void>

  // Mirror actions
  fetchAllMirrors: () => Promise<void>
  fetchCategorizedMirrors: () => Promise<void>
  fetchMirrorsByTable: (tableId: string) => Promise<void>
  createMirror: (tableId: string, data: CreateMirrorRequest) => Promise<boolean>
  updateMirror: (mirrorId: string, data: UpdateMirrorRequest) => Promise<boolean>
  deleteMirror: (mirrorId: string) => Promise<boolean>
  fetchMirrorRecords: (mirrorId: string) => Promise<void>

  clearMessage: () => void
}

export const useDynamicStore = create<DynamicState>((set) => ({
  tables: [],
  currentTable: null,
  fields: [],
  currentField: null,
  records: [],
  currentRecord: null,
  references: [],
  currentReference: null,
  mirrors: [],
  currentMirror: null,
  outgoingMirrors: [],
  incomingMirrors: [],
  lookupResults: [],
  loading: false,
  error: null,
  message: null,

  // ==================== Tables ====================

  fetchTables: async () => {
    set({ loading: true, error: null })
    try {
      const res = await fetchList<PaginatedData<DynamicTable>>('/dynamic/tables')
      set({ tables: unwrapList(res.data), loading: false })
    } catch (e) {
      set({ error: (e as Error).message, loading: false })
    }
  },

  fetchTable: async (tableId) => {
    set({ loading: true, error: null })
    try {
      const res = await fetchOne<DynamicTable>(`/dynamic/tables/${tableId}`)
      set({ currentTable: res.data, loading: false })
    } catch (e) {
      set({ error: (e as Error).message, loading: false })
    }
  },

  createTable: async (data) => {
    set({ loading: true, error: null })
    try {
      await createItem('/dynamic/tables', data)
      set({ loading: false, message: '表格创建成功' })
      return true
    } catch (e) {
      set({ error: (e as Error).message, loading: false })
      return false
    }
  },

  updateTable: async (tableId, data) => {
    set({ loading: true, error: null })
    try {
      await updateItem(`/dynamic/tables/${tableId}`, data)
      set({ loading: false, message: '表格更新成功' })
      return true
    } catch (e) {
      set({ error: (e as Error).message, loading: false })
      return false
    }
  },

  deleteTable: async (tableId) => {
    set({ loading: true, error: null })
    try {
      await deleteItem(`/dynamic/tables/${tableId}`)
      set({ loading: false, message: '表格删除成功' })
      return true
    } catch (e) {
      set({ error: (e as Error).message, loading: false })
      return false
    }
  },

  restoreTable: async (tableId) => {
    set({ loading: true, error: null })
    try {
      await updateItem(`/dynamic/tables/${tableId}/restore`, {})
      set({ loading: false, message: '表格恢复成功' })
      return true
    } catch (e) {
      set({ error: (e as Error).message, loading: false })
      return false
    }
  },

  // ==================== Fields ====================

  fetchFields: async (tableId) => {
    set({ loading: true, error: null })
    try {
      const res = await fetchList<PaginatedData<DynamicField>>(`/dynamic/tables/${tableId}/fields`)
      set({ fields: unwrapList(res.data), loading: false })
    } catch (e) {
      set({ error: (e as Error).message, loading: false })
    }
  },

  fetchField: async (tableId, fieldId) => {
    set({ loading: true, error: null })
    try {
      const res = await fetchOne<DynamicField>(`/dynamic/tables/${tableId}/fields/${fieldId}`)
      set({ currentField: res.data, loading: false })
    } catch (e) {
      set({ error: (e as Error).message, loading: false })
    }
  },

  createField: async (tableId, data) => {
    set({ loading: true, error: null })
    try {
      await createItem(`/dynamic/tables/${tableId}/fields`, data)
      set({ loading: false, message: '字段创建成功' })
      return true
    } catch (e) {
      set({ error: (e as Error).message, loading: false })
      return false
    }
  },

  updateField: async (tableId, fieldId, data) => {
    set({ loading: true, error: null })
    try {
      await updateItem(`/dynamic/tables/${tableId}/fields/${fieldId}`, data)
      set({ loading: false, message: '字段更新成功' })
      return true
    } catch (e) {
      set({ error: (e as Error).message, loading: false })
      return false
    }
  },

  deleteField: async (tableId, fieldId) => {
    set({ loading: true, error: null })
    try {
      await deleteItem(`/dynamic/tables/${tableId}/fields/${fieldId}`)
      set({ loading: false, message: '字段删除成功' })
      return true
    } catch (e) {
      set({ error: (e as Error).message, loading: false })
      return false
    }
  },

  restoreField: async (tableId, fieldId) => {
    set({ loading: true, error: null })
    try {
      await updateItem(`/dynamic/tables/${tableId}/fields/${fieldId}/restore`, {})
      set({ loading: false, message: '字段恢复成功' })
      return true
    } catch (e) {
      set({ error: (e as Error).message, loading: false })
      return false
    }
  },

  // ==================== Records ====================

  fetchRecords: async (tableId, tenantId) => {
    set({ loading: true, error: null })
    try {
      const res = await postAction<PaginatedData<DynamicRecord>>(`/dynamic/tables/${tableId}/records/list`, { tenantId })
      set({ records: unwrapList(res.data), loading: false })
    } catch (e) {
      set({ error: (e as Error).message, loading: false })
    }
  },

  fetchRecord: async (tableId, recordId) => {
    set({ loading: true, error: null })
    try {
      const res = await fetchOne<DynamicRecord>(`/dynamic/tables/${tableId}/records/${recordId}`)
      set({ currentRecord: res.data, loading: false })
    } catch (e) {
      set({ error: (e as Error).message, loading: false })
    }
  },

  createRecord: async (tableId, data) => {
    set({ loading: true, error: null })
    try {
      await createItem(`/dynamic/tables/${tableId}/records`, data)
      set({ loading: false, message: '记录创建成功' })
      return true
    } catch (e) {
      set({ error: (e as Error).message, loading: false })
      return false
    }
  },

  updateRecord: async (tableId, recordId, data) => {
    set({ loading: true, error: null })
    try {
      await updateItem(`/dynamic/tables/${tableId}/records/${recordId}`, data)
      set({ loading: false, message: '记录更新成功' })
      return true
    } catch (e) {
      set({ error: (e as Error).message, loading: false })
      return false
    }
  },

  deleteRecord: async (tableId, recordId) => {
    set({ loading: true, error: null })
    try {
      await deleteItem(`/dynamic/tables/${tableId}/records/${recordId}`)
      set({ loading: false, message: '记录删除成功' })
      return true
    } catch (e) {
      set({ error: (e as Error).message, loading: false })
      return false
    }
  },

  restoreRecord: async (tableId, recordId) => {
    set({ loading: true, error: null })
    try {
      await updateItem(`/dynamic/tables/${tableId}/records/${recordId}/restore`, {})
      set({ loading: false, message: '记录恢复成功' })
      return true
    } catch (e) {
      set({ error: (e as Error).message, loading: false })
      return false
    }
  },

  // ==================== References ====================

  fetchReferences: async (tableId) => {
    set({ loading: true, error: null })
    try {
      const res = await fetchList<FieldReference[]>(`/dynamic/tables/${tableId}/references`)
      set({ references: (res as any).data || res || [], loading: false })
    } catch (e) {
      set({ error: (e as Error).message, loading: false })
    }
  },

  createReference: async (tableId, data) => {
    set({ loading: true, error: null })
    try {
      await createItem(`/dynamic/tables/${tableId}/references`, data)
      set({ loading: false, message: '引用配置创建成功' })
      return true
    } catch (e) {
      set({ error: (e as Error).message, loading: false })
      return false
    }
  },

  updateReference: async (tableId, refId, data) => {
    set({ loading: true, error: null })
    try {
      await updateItem(`/dynamic/tables/${tableId}/references/${refId}`, data)
      set({ loading: false, message: '引用配置更新成功' })
      return true
    } catch (e) {
      set({ error: (e as Error).message, loading: false })
      return false
    }
  },

  deleteReference: async (tableId, refId) => {
    set({ loading: true, error: null })
    try {
      await deleteItem(`/dynamic/tables/${tableId}/references/${refId}`)
      set({ loading: false, message: '引用配置删除成功' })
      return true
    } catch (e) {
      set({ error: (e as Error).message, loading: false })
      return false
    }
  },

  lookupRecords: async (tableId, refId, params) => {
    set({ loading: true, error: null })
    try {
      const res = await postAction<any>(`/dynamic/tables/${tableId}/references/${refId}/lookup`, params || {})
      set({ lookupResults: (res as any).data?.items || (res as any).data || [], loading: false })
    } catch (e) {
      set({ error: (e as Error).message, loading: false })
    }
  },

  // ==================== Mirrors ====================

  fetchAllMirrors: async () => {
    set({ loading: true, error: null })
    try {
      const res = await fetchList<any>('/dynamic/mirrors')
      const data = res.data
      set({ mirrors: Array.isArray(data) ? data : (data as any)?.items ?? [], loading: false })
    } catch (e) {
      set({ error: (e as Error).message, loading: false })
    }
  },

  fetchCategorizedMirrors: async () => {
    set({ loading: true, error: null })
    try {
      const res = await fetchList<CategorizedMirrors>('/dynamic/mirrors/categorized')
      const data = res.data
      set({
        outgoingMirrors: data?.outgoing ?? [],
        incomingMirrors: data?.incoming ?? [],
        loading: false,
      })
    } catch (e) {
      set({ error: (e as Error).message, loading: false })
    }
  },

  fetchMirrorsByTable: async (tableId) => {
    set({ loading: true, error: null })
    try {
      const res = await fetchList<any>(`/dynamic/tables/${tableId}/mirrors`)
      const data = res.data
      set({ mirrors: Array.isArray(data) ? data : (data as any)?.items ?? [], loading: false })
    } catch (e) {
      set({ error: (e as Error).message, loading: false })
    }
  },

  createMirror: async (tableId, data) => {
    set({ loading: true, error: null })
    try {
      await createItem(`/dynamic/tables/${tableId}/mirrors`, data)
      set({ loading: false, message: '镜像创建成功' })
      return true
    } catch (e) {
      set({ error: (e as Error).message, loading: false })
      return false
    }
  },

  updateMirror: async (mirrorId, data) => {
    set({ loading: true, error: null })
    try {
      await updateItem(`/dynamic/mirrors/${mirrorId}`, data)
      set({ loading: false, message: '镜像更新成功' })
      return true
    } catch (e) {
      set({ error: (e as Error).message, loading: false })
      return false
    }
  },

  deleteMirror: async (mirrorId) => {
    set({ loading: true, error: null })
    try {
      await deleteItem(`/dynamic/mirrors/${mirrorId}`)
      set({ loading: false, message: '镜像删除成功' })
      return true
    } catch (e) {
      set({ error: (e as Error).message, loading: false })
      return false
    }
  },

  fetchMirrorRecords: async (mirrorId) => {
    set({ loading: true, error: null })
    try {
      const res = await postAction<any>(`/dynamic/mirrors/${mirrorId}/records/list`, {})
      set({ records: unwrapList((res as any).data), loading: false })
    } catch (e) {
      set({ error: (e as Error).message, loading: false })
    }
  },

  clearMessage: () => set({ message: null }),
}))
