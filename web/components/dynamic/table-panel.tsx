'use client'

import { useState, useEffect, useMemo, useCallback, useRef } from 'react'
import { useDynamicStore } from '@/stores/dynamic-store'
import { useAuthStore } from '@/stores/auth-store'
import { SectionWrapper } from '@/components/shared/section-wrapper'
import { ActionButton } from '@/components/shared/action-button'
import { FormField } from '@/components/shared/form-field'
import { ToastListener } from '@/components/shared/toast-listener'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { DialogFooter } from '@/components/ui/dialog'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { RefreshCw, Plus, Eye, Edit, Trash2, Columns, Search, Settings, Layers } from 'lucide-react'
import { toast } from 'sonner'
import type { DynamicTable, DynamicField, DynamicRecord, FieldType, FieldReference, TableMirror } from '@/types'
import { fetchList, postAction } from '@/lib/api-client'
import { unwrapList } from '@/types'
import { MirrorPanel } from '@/components/dynamic/mirror-panel'
import { MultiFilePicker } from '@/components/file/multi-file-picker'
import { useGroupStore } from '@/stores/group-store'

const FIELD_TYPES: { value: FieldType; label: string }[] = [
  { value: 'text', label: '文本' }, { value: 'number', label: '数字' },
  { value: 'date', label: '日期' }, { value: 'select', label: '下拉选择' },
  { value: 'checkbox', label: '复选框' }, { value: 'user', label: '人员' },
  { value: 'attachment', label: '附件' }, { value: 'reference', label: '引用' },
]

// ============================================================
// Helpers
// ============================================================

function coerceValue(v: unknown): string {
  if (v === null || v === undefined) return ''
  if (typeof v === 'boolean') return v ? 'true' : 'false'
  if (typeof v === 'string') return v
  return JSON.stringify(v)
}

function defaultFieldValue(type: FieldType, options?: string[]): string {
  switch (type) {
    case 'number': return '0'
    case 'checkbox': return 'false'
    case 'date': return new Date().toISOString().split('T')[0]
    case 'select': return options?.[0] ?? ''
    default: return ''
  }
}

function formatRecordPreview(
  data: Record<string, unknown> | null | undefined,
  fields: DynamicField[],
  refFieldIds: Set<string>,
  labelMap: Record<string, string>,
): string {
  if (!data) return '—'
  const entries = Object.entries(data)
  if (entries.length === 0) return '—'
  const nameMap = new Map(fields.map((f) => [f.name, f]))
  const visible = entries.slice(0, 10)
  const overflow = entries.length > 10 ? `  ...+${entries.length - 10}` : ''
  return visible
    .map(([k, v]) => {
      const field = nameMap.get(k)
      let displayVal: string
      if (field && refFieldIds.has(k)) {
        const labelKey = `${k}:${coerceValue(v)}`
        displayVal = labelMap[labelKey] || coerceValue(v)
      } else {
        displayVal = coerceValue(v)
      }
      const truncated = displayVal.length > 36 ? displayVal.slice(0, 36) + '…' : displayVal
      return `${k}: ${truncated || '—'}`
    })
    .join('\n')
    + overflow
}

function buildDefaultValues(fieldList: DynamicField[]): Record<string, string> {
  const vals: Record<string, string> = {}
  for (const f of fieldList) vals[f.name] = defaultFieldValue(f.type, f.options ?? [])
  return vals
}

// ============================================================
// ReferencePicker — searchable combobox
// ============================================================

function ReferencePicker({
  reference,
  value,
  onChange,
  readOnly = false,
  excludeRecordId,
}: {
  reference: FieldReference
  value: string
  onChange: (value: string) => void
  readOnly?: boolean
  excludeRecordId?: string
}) {
  const store = useDynamicStore()
  const [search, setSearch] = useState('')
  const [open, setOpen] = useState(false)
  const timerRef = useRef<ReturnType<typeof setTimeout>>(undefined)
  const resolvedRef = useRef<string>('')

  const lookupResults = store.lookupResults

  // 根据 sourceFields/displayField 拼接 label（不依赖后端 _label）
  const getLabel = useCallback((r: any) => {
    if (!r) return ''
    const srcFields = reference.sourceFields as string[]
    if (reference.displayField) {
      return String(r.data?.[reference.displayField] ?? r.recordId ?? '')
    }
    const parts = srcFields.map(f => {
      const val = r.data?.[f]
      return val != null ? String(val) : ''
    }).filter(Boolean)
    return parts.length > 0 ? parts.join(' - ') : r.recordId ?? ''
  }, [reference.sourceFields, reference.displayField])

  const filteredResults = useMemo(() => {
    const base = excludeRecordId ? lookupResults.filter((r: any) => r.recordId !== excludeRecordId) : lookupResults
    return base.map((r: any) => ({ ...r, _label: getLabel(r) }))
  }, [lookupResults, excludeRecordId, getLabel])

  const doLookup = useCallback((keyword: string) => {
    if (timerRef.current) clearTimeout(timerRef.current)
    timerRef.current = setTimeout(() => {
      store.lookupRecords(reference.sourceTableId, reference.refId, { search: keyword || undefined, page: 1, pageSize: 20 })
    }, 250)
  }, [store, reference.refId, reference.sourceTableId])

  // When in readOnly mode with a value, resolve the label on mount
  useEffect(() => {
    if (!readOnly || !value) return
    // Only fire if we haven't already resolved for this ref+value
    const key = `${reference.refId}:${value}`
    if (resolvedRef.current === key) return
    resolvedRef.current = key
    // 已知精确 recordId，直接用 recordId 精准查询，无需模糊搜索
    store.lookupRecords(reference.sourceTableId, reference.refId, { recordId: value, page: 1, pageSize: 1 })
  }, [readOnly, value, reference.refId, reference.sourceTableId, store])

  const handleOpen = () => {
    if (readOnly) return
    setOpen(true)
    store.lookupResults.length = 0
    doLookup('')
  }

  // 已选值的 label 缓存
  const [resolvedLabel, setResolvedLabel] = useState('')

  // value 变化时：发请求精准查对应记录
  useEffect(() => {
    if (!value) { setResolvedLabel(''); return }
    store.lookupRecords(reference.sourceTableId, reference.refId, { recordId: value, page: 1, pageSize: 1 })
  }, [value, reference.refId, reference.sourceTableId])

  // lookupResults 更新时：匹配 label
  useEffect(() => {
    if (!value) return
    const found = lookupResults.find((r: any) => r.recordId === value)
    if (found) setResolvedLabel(getLabel(found))
  }, [lookupResults, value])

  const selectedLabel = resolvedLabel

  if (readOnly) {
    return (
      <div className="h-8 flex items-center rounded-md border border-transparent bg-muted/60 px-2.5 text-sm">
        {selectedLabel || '—'}
      </div>
    )
  }

  return (
    <div className="relative">
      <button
        type="button"
        onClick={handleOpen}
        className="w-full flex items-center justify-between gap-1.5 rounded-lg border border-input bg-background h-8 px-3 text-sm text-left whitespace-nowrap transition-colors outline-none hover:bg-muted/30"
      >
        <span className={selectedLabel ? '' : 'text-muted-foreground'}>
          {selectedLabel || '搜索并选择…'}
        </span>
        <Search className="size-4 text-muted-foreground shrink-0" />
      </button>

      {open && (
        <div className="absolute z-50 mt-1 w-full rounded-lg border border-input bg-popover shadow-md">
          <div className="p-2">
            <Input
              autoFocus
              placeholder="输入关键词搜索…"
              value={search}
              onChange={(e) => { setSearch(e.target.value); doLookup(e.target.value) }}
              className="h-7 text-sm"
            />
          </div>
          <div className="max-h-48 overflow-y-auto border-t">
            {filteredResults.length === 0 ? (
              <div className="px-3 py-4 text-xs text-muted-foreground text-center">无匹配记录</div>
            ) : (
              filteredResults.map((r: any) => (
                <button
                  key={r.recordId}
                  type="button"
                  className="w-full text-left px-3 py-2 text-sm hover:bg-accent hover:text-accent-foreground transition-colors border-b border-border last:border-b-0"
                  onClick={() => {
                    onChange(reference.valueField === 'recordId' ? r.recordId : r._value)
                    setOpen(false)
                    setSearch('')
                  }}
                >
                  <span className="font-medium">{r._label}</span>
                  {r.recordId && <span className="text-xs text-muted-foreground ml-2 font-mono">{r.recordId}</span>}
                </button>
              ))
            )}
          </div>
          <div className="border-t px-2 py-1">
            <button
              type="button"
              className="text-xs text-muted-foreground hover:text-foreground w-full text-center py-1"
              onClick={() => setOpen(false)}
            >
              关闭
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

// ============================================================
// RecordForm
// ============================================================

function RecordForm({
  fields,
  values,
  onChange,
  readOnly = false,
  references,
  excludeRecordId,
}: {
  fields: DynamicField[]
  values: Record<string, any>
  onChange?: (name: string, value: any) => void
  readOnly?: boolean
  references: FieldReference[]
  excludeRecordId?: string
}) {
  if (fields.length === 0) {
    return <p className="text-sm text-muted-foreground py-4 text-center">该表暂无字段定义，请先添加字段</p>
  }

  const refMap = useMemo(() => {
    const m: Record<string, FieldReference> = {}
    for (const r of references) m[r.fieldId] = r
    return m
  }, [references])

  return (
    <div className="space-y-3 max-h-96 overflow-auto pr-1">
      {fields.map((f) => {
        const v = values[f.name] ?? (f.type === 'attachment' ? [] : '')
        const fieldId = `rf-${f.fieldId}`

        if (f.type === 'reference') {
          const ref = refMap[f.fieldId]
          return (
            <div key={fieldId} className="grid gap-1.5">
              <Label>{f.name}</Label>
              {ref ? (
                <ReferencePicker reference={ref} value={v} onChange={(x) => onChange?.(f.name, x)} readOnly={readOnly} excludeRecordId={excludeRecordId} />
              ) : (
                <div className="h-8 flex items-center rounded-md border border-transparent bg-muted/60 px-2.5 text-sm text-muted-foreground">
                  未配置引用（请先为此字段创建引用配置）
                </div>
              )}
            </div>
          )
        }

        switch (f.type) {
          case 'text':
            if (readOnly) {
              return (
                <div key={fieldId} className="grid gap-1">
                  <Label className="text-xs text-muted-foreground">{f.name}</Label>
                  <div className="h-8 flex items-center rounded-md border border-transparent bg-muted/60 px-2.5 text-sm">{v || '—'}</div>
                </div>
              )
            }
            return <FormField key={fieldId} label={f.name} id={fieldId} value={v} onChange={(x) => onChange?.(f.name, x)} placeholder={f.name} />

          case 'attachment': {
            const vList = Array.isArray(v) ? v : (v ? [v] : [])
            return (
              <div key={fieldId} className="grid gap-1.5">
                <Label>{f.name}</Label>
                <MultiFilePicker
                  value={vList}
                  onChange={(x) => onChange?.(f.name, x)}
                  readOnly={readOnly}
                />
              </div>
            )
          }

          case 'number':
          case 'date':
          case 'user': {
            const typeMap: Record<string, string> = { number: 'number', date: 'date', user: 'text' }
            const placeholderMap: Record<string, string> = { user: '用户 ID' }
            const labelSuffix = f.type === 'user' ? ' (user)' : ''
            return (
              <div key={fieldId} className="grid gap-1.5">
                <Label htmlFor={fieldId}>{f.name}{labelSuffix}</Label>
                {readOnly ? (
                  <div className="h-8 flex items-center rounded-md border border-transparent bg-muted/60 px-2.5 text-sm">{v || '—'}</div>
                ) : (
                  <Input id={fieldId} type={typeMap[f.type] ?? 'text'} value={v} onChange={(e) => onChange?.(f.name, e.target.value)} placeholder={placeholderMap[f.type] ?? ''} />
                )}
              </div>
            )
          }

          case 'select': {
            const opts = f.options ?? []
            return (
              <div key={fieldId} className="grid gap-1.5">
                <Label>{f.name}</Label>
                {readOnly ? (
                  <div className="h-8 flex items-center rounded-md border border-transparent bg-muted/60 px-2.5 text-sm">{v || '—'}</div>
                ) : (
                  <Select value={v} onValueChange={(x) => onChange?.(f.name, x ?? '')}>
                    <SelectTrigger className="w-full"><SelectValue placeholder={`选择${f.name}`} /></SelectTrigger>
                    <SelectContent>
                      {opts.map((o) => <SelectItem key={o} value={o}>{o}</SelectItem>)}
                    </SelectContent>
                  </Select>
                )}
              </div>
            )
          }

          case 'checkbox':
            return (
              <div key={fieldId} className="flex items-center gap-2">
                <input id={fieldId} type="checkbox" checked={v === 'true'} onChange={(e) => onChange?.(f.name, e.target.checked ? 'true' : 'false')} disabled={readOnly} className="h-4 w-4" />
                <Label htmlFor={fieldId}>{f.name}</Label>
              </div>
            )

          default:
            return null
        }
      })}
    </div>
  )
}

// ============================================================
// ReferenceConfigForm — renders source table fields as checkboxes
// ============================================================

function ReferenceConfigForm({
  sourceTableId,
  sourceFields,
  onToggleField,
  displayField,
  onSetDisplayField,
  allFields,
  loading,
}: {
  sourceTableId: string
  sourceFields: Set<string>
  onToggleField: (fieldName: string) => void
  displayField: string
  onSetDisplayField: (fieldName: string) => void
  allFields: DynamicField[]
  loading: boolean
}) {
  const [mirrors, setMirrors] = useState<any[]>([])

  useEffect(() => {
    if (!sourceTableId) return
    fetchList<any[]>(`/dynamic/tables/${sourceTableId}/mirrors`).then((res: any) => {
      setMirrors(unwrapList(res.data) || [])
    }).catch(() => setMirrors([]))
  }, [sourceTableId])

  if (!sourceTableId) {
    return <p className="text-sm text-muted-foreground py-4 text-center">请先选择引用目标表</p>
  }

  if (loading) {
    return <p className="text-sm text-muted-foreground py-4 text-center">加载目标表字段…</p>
  }

  return (
    <div className="border rounded-lg p-3 max-h-64 overflow-y-auto space-y-1">
      {mirrors.length > 0 && (
        <p className="text-xs text-amber-600 dark:text-amber-400 mb-2">
          该表有 {mirrors.length} 个镜像，请确认用户对所选字段有访问权限
        </p>
      )}
      {allFields.map((f) => {
        const checked = sourceFields.has(f.name)
        const isDisplay = displayField === f.name
        return (
          <label
            key={f.fieldId}
            className={`flex items-center gap-2 text-sm rounded px-2 py-1.5 cursor-pointer transition-colors ${
              checked ? 'bg-primary/10 text-primary font-medium' : 'hover:bg-muted'
            }`}
          >
            <input
              type="checkbox"
              checked={checked}
              onChange={() => onToggleField(f.name)}
              className="h-4 w-4 shrink-0"
            />
            <span className="flex-1">{f.name}</span>
            <Badge variant="outline" className="text-[10px] h-4 px-1">{f.type}</Badge>
            {checked && (
              <button
                type="button"
                onClick={(e) => {
                  e.preventDefault()
                  onSetDisplayField(isDisplay ? '' : f.name)
                }}
                className={`text-[10px] px-1.5 py-0.5 rounded border transition-colors ${
                  isDisplay
                    ? 'bg-primary text-primary-foreground border-primary'
                    : 'border-border text-muted-foreground hover:border-primary/50'
                }`}
              >
                {isDisplay ? '★ 优先展示' : '☆ 设为展示'}
              </button>
            )}
          </label>
        )
      })}
    </div>
  )
}

// ============================================================
// TablePanel
// ============================================================

export function TablePanel() {
  const isLoggedIn = useAuthStore((s) => s.isLoggedIn)
  const store = useDynamicStore()
  const { tables, fields, records, loading, references, lookupResults, mirrors, outgoingMirrors, incomingMirrors, recordsTotal, recordsPage, recordsPageSize } = store
  const { groups } = useGroupStore()

  const [mainTab, setMainTab] = useState('tables')

  // table
  const [selectedTableId, setSelectedTableId] = useState('')
  const [showCreateTable, setShowCreateTable] = useState(false)
  const [showTableDetail, setShowTableDetail] = useState<DynamicTable | null>(null)
  const [showEditTable, setShowEditTable] = useState<DynamicTable | null>(null)
  const [tName, setTName] = useState('')
  const [tTenantId, setTTenantId] = useState('')

  // field
  const [showCreateField, setShowCreateField] = useState(false)
  const [showEditField, setShowEditField] = useState<DynamicField | null>(null)
  const [fName, setFName] = useState('')
  const [fType, setFType] = useState<FieldType>('text')
  const [fOptions, setFOptions] = useState('')
  const [pendingFieldId, setPendingFieldId] = useState('')

  // reference config dialog
  const [showRefConfig, setShowRefConfig] = useState(false)
  const [refSourceTableId, setRefSourceTableId] = useState('')
  const [refSourceFields, setRefSourceFields] = useState<Set<string>>(new Set())
  const [refDisplayField, setRefDisplayField] = useState('')
  const [refValueField, setRefValueField] = useState('recordId')
  const [sourceTableFields, setSourceTableFields] = useState<DynamicField[]>([])
  const [sourceFieldsLoading, setSourceFieldsLoading] = useState(false)

  // record
  const [showCreateRecord, setShowCreateRecord] = useState(false)
  const [showEditRecord, setShowEditRecord] = useState<DynamicRecord | null>(null)
  const [showRecordDetail, setShowRecordDetail] = useState<DynamicRecord | null>(null)
  const [rFormData, setRFormData] = useState<Record<string, string>>({})
  const [rTenantId, setRTenantId] = useState('')

  // mirror detail dialog
  const [mirrorDetail, setMirrorDetail] = useState<TableMirror | null>(null)
  const [mirrorDetailFields, setMirrorDetailFields] = useState<DynamicField[]>([])

  const openMirrorDetail = async (m: TableMirror) => {
    setMirrorDetail(m)
    try {
      const res = await fetchList<any>(`/dynamic/tables/${m.sourceTableId}/fields`)
      const items = unwrapList(res?.data ?? res)
      setMirrorDetailFields(items as DynamicField[])
    } catch {
      setMirrorDetailFields([])
    }
  }

  // 当前用户的租户信息
  const [myTenantId, setMyTenantId] = useState('')
  const [myTenantName, setMyTenantName] = useState('')
  useEffect(() => {
    if (isLoggedIn) {
      fetchList<any>('/user/my-tenant').then((res: any) => {
        if (res?.data?.id) { setMyTenantId(res.data.id); setMyTenantName(res.data.tenantName as string) }
      }).catch(() => {})
    }
  }, [isLoggedIn])

  // derived
  const selectedTable = useMemo(() => tables.find((t) => t.tableId === selectedTableId), [tables, selectedTableId])
  const fTenantId = selectedTable?.tenantId ?? ''
  const defaultTenantId = (myTenantId || tables[0]?.tenantId) ?? ''
  const groupNameMap = useMemo(() => {
    const m = new Map<string, string>()
    for (const g of groups) m.set(g.id, g.groupName)
    return m
  }, [groups])

  // reference field resolution
  const [labelMap, setLabelMap] = useState<Record<string, string>>({})

  const refFieldIds = useMemo(() => {
    const s = new Set<string>()
    for (const f of fields) { if (f.type === 'reference') s.add(f.name) }
    return s
  }, [fields])

  const fieldToRefMap = useMemo(() => {
    const m = new Map<string, FieldReference>()
    for (const ref of references) {
      const f = fields.find((xf) => xf.fieldId === ref.fieldId)
      if (f) m.set(f.name, ref)
    }
    return m
  }, [fields, references])

  const recordRefKey = useMemo(() => {
    if (!selectedTableId) return ''
    return `${selectedTableId}|${records.map((r) => r.recordId).join(',')}|${references.map((r) => r.refId).join(',')}`
  }, [selectedTableId, records, references])

  // 根据 FieldReference 的 sourceFields/displayField 拼接 label
  function computeLabel(r: any, ref: FieldReference) {
    if (!r) return ''
    const data = r.data ?? {}
    if (ref.displayField) {
      return String(data[ref.displayField] ?? r.recordId ?? '')
    }
    const srcFields = ref.sourceFields ?? []
    const parts = srcFields.map((f: string) => {
      const val = data[f]
      return val != null ? String(val) : ''
    }).filter(Boolean)
    return parts.length > 0 ? parts.join(' - ') : r.recordId ?? ''
  }

  // Pre-resolve reference field labels for record preview
  useEffect(() => {
    if (!selectedTableId || records.length === 0 || references.length === 0 || fields.length === 0) {
      setLabelMap({})
      return
    }

    let cancelled = false

    const resolveLabels = async () => {
      const seen = new Set<string>()
      const tasks: Array<{ fieldName: string; ref: FieldReference; rawValue: string }> = []

      for (const record of records) {
        if (!record.data) continue
        for (const [key, rawValue] of Object.entries(record.data)) {
          const ref = fieldToRefMap.get(key)
          if (!ref) continue
          const val = coerceValue(rawValue)
          if (!val) continue
          const dedupKey = `${ref.refId}:${val}`
          if (seen.has(dedupKey)) continue
          seen.add(dedupKey)
          tasks.push({ fieldName: key, ref, rawValue: val })
        }
      }

      if (tasks.length === 0) { setLabelMap({}); return }

      const results = await Promise.all(
        tasks.map(async (t) => {
          try {
            const res = await postAction<any>(
              `/dynamic/tables/${t.ref.sourceTableId}/references/${t.ref.refId}/lookup`,
              { recordId: t.rawValue, page: 1, pageSize: 1 },
            )
            const items = (res as any).data?.items || (res as any).data || []
            const match = items.find((r: any) => r.recordId === t.rawValue)
            const label = computeLabel(match, t.ref)
            return { key: `${t.fieldName}:${t.rawValue}`, label: label || t.rawValue }
          } catch {
            return { key: `${t.fieldName}:${t.rawValue}`, label: t.rawValue }
          }
        }),
      )

      if (cancelled) return
      const newMap: Record<string, string> = {}
      for (const { key, label } of results) { newMap[key] = label }
      setLabelMap((prev) => {
        if (JSON.stringify(prev) === JSON.stringify(newMap)) return prev
        return newMap
      })
    }

    resolveLabels()
    return () => { cancelled = true }
  }, [recordRefKey, fields, fieldToRefMap])

  useEffect(() => { if (isLoggedIn) { store.fetchTables(); store.fetchAllMirrors(); store.fetchCategorizedMirrors() } }, [isLoggedIn])

  useEffect(() => {
    if (selectedTableId) store.fetchReferences(selectedTableId)
  }, [selectedTableId])

  useEffect(() => {
    if (selectedTableId) {
      store.fetchMirrorsByTable(selectedTableId)
    } else {
      store.fetchAllMirrors()
    }
    store.fetchCategorizedMirrors()
  }, [selectedTableId])

  useEffect(() => {
    if (!refSourceTableId) {
      setSourceTableFields([])
      setRefSourceFields(new Set())
      setRefDisplayField('')
      return
    }
    setSourceFieldsLoading(true)
    fetchList<any>(`/dynamic/tables/${refSourceTableId}/fields`)
      .then((res: any) => {
        const items = unwrapList(res?.data ?? res)
        setSourceTableFields(items as any[])
      })
      .catch(() => setSourceTableFields([]))
      .finally(() => setSourceFieldsLoading(false))
  }, [refSourceTableId])

  const refreshRecords = (tid?: string) => {
    if (!selectedTableId) return
    const t = tid ?? selectedTable?.tenantId ?? rTenantId ?? defaultTenantId
    const s = useDynamicStore.getState()
    store.fetchRecords(selectedTableId, t, s.recordsPage, s.recordsPageSize, s.recordsSortField, s.recordsSortOrder)
  }

  const selectTable = (t: DynamicTable) => {
    setSelectedTableId(t.tableId)
    store.fetchFields(t.tableId)
    store.fetchRecords(t.tableId, t.tenantId, 1, 20)
    store.fetchReferences(t.tableId)
    store.fetchMirrorsByTable(t.tableId)
    setRTenantId(t.tenantId)
  }

  // ---- TABLE CRUD ----
  const handleCreateTable = async () => {
    if (!tName || !tTenantId) { toast.error('表名和租户ID为必填'); return }
    const ok = await store.createTable({ name: tName, tenantId: tTenantId })
    if (ok) { setShowCreateTable(false); store.fetchTables() }
  }
  const handleUpdateTable = async () => {
    if (!showEditTable) return
    const ok = await store.updateTable(showEditTable.tableId, { name: tName })
    if (ok) { setShowEditTable(null); store.fetchTables() }
  }

  // ---- FIELD CRUD ----
  const openCreateField = () => {
    if (!selectedTableId) { toast.error('请先选择一张表'); return }
    store.fetchFields(selectedTableId)
    setFName(''); setFType('text'); setFOptions(''); setShowCreateField(true)
  }
  const handleCreateField = async () => {
    if (!selectedTableId || !fName) { toast.error('字段名不能为空'); return }
    const opts = fType === 'select' && fOptions.trim() ? fOptions.split(',').map((s) => s.trim()).filter(Boolean) : undefined
    const ok = await store.createField(selectedTableId, { name: fName, type: fType, options: opts, tenantId: fTenantId || defaultTenantId })
    if (ok) {
      setShowCreateField(false)
      if (fType === 'reference') {
        await store.fetchFields(selectedTableId)
        const updated = useDynamicStore.getState().fields
        const newField = updated.find((f: DynamicField) => f.type === 'reference' && f.name === fName)
        if (newField) {
          setPendingFieldId(newField.fieldId)
          setRefSourceTableId('')
          setRefSourceFields(new Set())
          setRefDisplayField('')
          setRefValueField('recordId')
          setSourceTableFields([])
          setShowRefConfig(true)
          return
        }
      }
      store.fetchFields(selectedTableId)
    }
  }
  const handleUpdateField = async () => {
    if (!showEditField || !selectedTableId) return
    const opts = fType === 'select' && fOptions.trim() ? fOptions.split(',').map((s) => s.trim()).filter(Boolean) : undefined
    const ok = await store.updateField(selectedTableId, showEditField.fieldId, { name: fName, type: fType, options: opts })
    if (ok) { setShowEditField(null); store.fetchFields(selectedTableId) }
  }
  const openEditField = (f: DynamicField) => {
    setShowEditField(f); setFName(f.name); setFType(f.type); setFOptions(f.options?.join(', ') ?? '')
  }

  const handleSaveRefConfig = async () => {
    if (!selectedTableId || !pendingFieldId) { toast.error('无法确定字段'); return }
    if (!refSourceTableId) { toast.error('请选择引用目标表'); return }
    if (refSourceFields.size === 0) { toast.error('请至少勾选一个源字段'); return }

    const existing = references.find((r) => r.fieldId === pendingFieldId)
    let ok: boolean
    if (existing) {
      // update existing reference
      ok = await store.updateReference(selectedTableId, existing.refId, {
        sourceFields: Array.from(refSourceFields),
        displayField: refDisplayField,
        valueField: refValueField || 'recordId',
      })
    } else {
      // create new reference
      ok = await store.createReference(selectedTableId, {
        fieldId: pendingFieldId,
        sourceTableId: refSourceTableId,
        sourceFields: Array.from(refSourceFields),
        displayField: refDisplayField,
        valueField: refValueField || 'recordId',
      })
    }
    if (ok) {
      setShowRefConfig(false)
      setPendingFieldId('')
      store.fetchFields(selectedTableId)
      store.fetchReferences(selectedTableId)
    }
  }

  const toggleRefField = (fieldName: string) => {
    setRefSourceFields((prev) => {
      const next = new Set(prev)
      if (next.has(fieldName)) {
        next.delete(fieldName)
        // 如果取消的是当前展示字段，清除它
        if (refDisplayField === fieldName) setRefDisplayField('')
      } else {
        next.add(fieldName)
      }
      return next
    })
  }

  // ---- open ref config for an existing reference field ----
  const openRefConfigForField = async (fieldId: string) => {
    const existing = references.find((r) => r.fieldId === fieldId)
    setPendingFieldId(fieldId)
    if (existing) {
      setRefSourceTableId(existing.sourceTableId)
      setRefSourceFields(new Set(existing.sourceFields))
      setRefDisplayField(existing.displayField || '')
      setRefValueField(existing.valueField || 'recordId')
    } else {
      setRefSourceTableId('')
      setRefSourceFields(new Set())
      setRefDisplayField('')
      setRefValueField('recordId')
      setSourceTableFields([])
    }
    setShowRefConfig(true)
  }

  // ---- RECORD CRUD ----
  const openCreateRecord = () => {
    if (!selectedTableId) { toast.error('请先选择一张表'); return }
    store.fetchFields(selectedTableId)
    store.fetchReferences(selectedTableId)
    setRFormData(buildDefaultValues(fields))
    setRTenantId(defaultTenantId)
    setShowCreateRecord(true)
  }
  const handleCreateRecord = async () => {
    if (!selectedTableId) return
    const ok = await store.createRecord(selectedTableId, { data: { ...rFormData }, tenantId: rTenantId || defaultTenantId })
    if (ok) { setShowCreateRecord(false); refreshRecords() }
  }
  const handleUpdateRecord = async () => {
    if (!showEditRecord || !selectedTableId) return
    const ok = await store.updateRecord(selectedTableId, showEditRecord.recordId, { data: { ...rFormData } })
    if (ok) { setShowEditRecord(null); refreshRecords() }
  }
  const openEditRecord = (r: DynamicRecord) => {
    setShowEditRecord(r)
    store.fetchReferences(selectedTableId)
    const defaults = buildDefaultValues(fields)
    if (r.data) for (const [k, v] of Object.entries(r.data)) defaults[k] = coerceValue(v)
    setRFormData(defaults)
  }
  const openDetail = (r: DynamicRecord) => {
    setShowRecordDetail(r)
    store.fetchReferences(selectedTableId)
    const defaults = buildDefaultValues(fields)
    if (r.data) for (const [k, v] of Object.entries(r.data)) defaults[k] = coerceValue(v)
    setRFormData(defaults)
  }

  if (!isLoggedIn) return null

  const tableName = selectedTable?.name ?? '(未选择)'

  return (
    <SectionWrapper title="动态表管理" description={`${tables.length} 个表 · ${fields.length} 个字段 · ${records.length} 条记录`} badge="dynamic:*">
      <ToastListener store={useDynamicStore} />

      {/* ===== TABLE SELECTOR ===== */}
      <div className="flex items-center gap-3 mb-3 p-2 bg-muted/50 rounded text-sm flex-wrap">
        <span className="text-muted-foreground">当前表:</span>
        <Select value={selectedTableId} onValueChange={(v) => { const t = tables.find((x) => x.tableId === v); if (t) selectTable(t) }}>
          <SelectTrigger className="w-56">
            <SelectValue placeholder="选择一张表…">{selectedTable?.name}</SelectValue>
          </SelectTrigger>
          <SelectContent>
            {tables.map((t) => <SelectItem key={t.tableId} value={t.tableId}>{t.name}</SelectItem>)}
          </SelectContent>
        </Select>
        <span className="text-muted-foreground">租户:</span>
        <code className="bg-muted px-1.5 py-0.5 rounded font-mono text-xs">{myTenantName || myTenantId || fTenantId || defaultTenantId || '-'}</code>
      </div>

      <Tabs value={mainTab} onValueChange={setMainTab}>
        <TabsList className="w-full mb-4">
          <TabsTrigger value="tables" className="flex-1">📋 表管理 ({tables.length})</TabsTrigger>
          <TabsTrigger value="fields" className="flex-1">📝 字段 ({fields.length})</TabsTrigger>
          <TabsTrigger value="records" className="flex-1">📄 记录 ({records.length})</TabsTrigger>
          <TabsTrigger value="mirrors" className="flex-1">🪞 镜像 ({mirrors.length})</TabsTrigger>
        </TabsList>

        {/* ===== TABLES ===== */}
        <TabsContent value="tables">
          <div className="space-y-3">
            <div className="flex gap-2 flex-wrap">
              <ActionButton onClick={() => { store.fetchTables(); store.fetchAllMirrors(); store.fetchCategorizedMirrors() }} loading={loading} variant="outline"><RefreshCw className="h-3 w-3 mr-1" />刷新</ActionButton>
              <ActionButton onClick={() => { setTName(''); setTTenantId(defaultTenantId); setShowCreateTable(true) }}><Plus className="h-3 w-3 mr-1" />新建表</ActionButton>
            </div>
            <div className="max-h-80 overflow-auto rounded border">
              <Table>
                <TableHeader><TableRow><TableHead>表名</TableHead><TableHead>Table ID</TableHead><TableHead>所属群组</TableHead><TableHead>租户</TableHead><TableHead>操作</TableHead></TableRow></TableHeader>
                <TableBody>
                  {/* Regular tables */}
                  {tables.map((t) => (
                    <TableRow key={t.tableId} className={selectedTableId === t.tableId ? 'bg-muted/50' : ''}>
                      <TableCell className="font-medium cursor-pointer hover:underline" onClick={() => selectTable(t)}>{t.name}</TableCell>
                      <TableCell className="font-mono text-xs">{t.tableId}</TableCell>
                      <TableCell className="text-xs">{groupNameMap.get(t.groupId) || t.groupId}</TableCell>
                      <TableCell className="font-mono text-xs max-w-32 truncate">{t.tenantId}</TableCell>
                      <TableCell>
                        <div className="flex gap-0.5">
                          <ActionButton variant="ghost" size="icon-sm" onClick={() => selectTable(t)} title="选择此表"><Columns className="h-3 w-3" /></ActionButton>
                          <ActionButton variant="ghost" size="icon-sm" onClick={() => setShowTableDetail(t)} title="详情"><Eye className="h-3 w-3" /></ActionButton>
                          <ActionButton variant="ghost" size="icon-sm" onClick={() => { setShowEditTable(t); setTName(t.name) }} title="编辑"><Edit className="h-3 w-3" /></ActionButton>
                          <ActionButton variant="ghost" size="icon-sm" onClick={async () => { await store.deleteTable(t.tableId); store.fetchTables() }} title="删除"><Trash2 className="h-3 w-3" /></ActionButton>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                  {/* Table mirrors — shown as pseudo-tables */}
                </TableBody>
              </Table>
            </div>

            {/* 我分享给别人的镜像 */}
            {outgoingMirrors.length > 0 && (
              <div className="pt-2">
                <h3 className="text-xs font-medium text-muted-foreground mb-1 px-1">📤 我分享的镜像</h3>
                <div className="rounded border border-dashed">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-muted/30">
                        <TableHead>镜像名</TableHead><TableHead>源表</TableHead><TableHead>目标群组</TableHead><TableHead>操作</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {outgoingMirrors.map((m: any) => {
                        const srcTbl = tables.find(t => t.tableId === m.sourceTableId)
                        return (
                          <TableRow key={`out-${m.mirrorId}`}>
                            <TableCell className="font-medium text-sm">{m.name}</TableCell>
                            <TableCell className="text-xs cursor-pointer hover:underline" onClick={() => { const t = tables.find(x => x.tableId === m.sourceTableId); if (t) selectTable(t) }}>
                              {srcTbl?.name || m.sourceTableId}
                            </TableCell>
                            <TableCell className="text-xs">{groupNameMap.get(m.groupId || '') || m.groupId || '—'}</TableCell>
                            <TableCell>
                              <div className="flex gap-0.5">
                                <ActionButton variant="ghost" size="icon-sm" onClick={() => openMirrorDetail(m)} title="查看镜像详情"><Eye className="h-3 w-3" /></ActionButton>
                                <ActionButton variant="ghost" size="icon-sm" onClick={async () => { await store.deleteMirror(m.mirrorId); store.fetchAllMirrors(); store.fetchCategorizedMirrors() }} title="删除镜像"><Trash2 className="h-3 w-3" /></ActionButton>
                              </div>
                            </TableCell>
                          </TableRow>
                        )
                      })}
                    </TableBody>
                  </Table>
                </div>
              </div>
            )}

            {/* 别人分享给我的镜像 */}
            {incomingMirrors.length > 0 && (
              <div className="pt-2">
                <h3 className="text-xs font-medium text-muted-foreground mb-1 px-1">📥 分享给我的镜像</h3>
                <div className="rounded border border-dashed">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-muted/30">
                        <TableHead>镜像名</TableHead><TableHead>源表</TableHead><TableHead>来源群组</TableHead><TableHead>操作</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {incomingMirrors.map((m: any) => {
                        const srcTbl = tables.find(t => t.tableId === m.sourceTableId)
                        return (
                          <TableRow key={`in-${m.mirrorId}`}>
                            <TableCell className="font-medium text-sm">{m.name}</TableCell>
                            <TableCell className="text-xs cursor-pointer hover:underline" onClick={() => { const t = tables.find(x => x.tableId === m.sourceTableId); if (t) selectTable(t) }}>
                              {srcTbl?.name || m.sourceTableId}
                            </TableCell>
                            <TableCell className="text-xs">{groupNameMap.get(m.sourceGroupId || '') || m.sourceGroupId || '—'}</TableCell>
                            <TableCell>
                              <div className="flex gap-0.5">
                                <ActionButton variant="ghost" size="icon-sm" onClick={() => openMirrorDetail(m)} title="查看镜像详情"><Eye className="h-3 w-3" /></ActionButton>
                                <ActionButton variant="ghost" size="icon-sm" onClick={async () => { await store.deleteMirror(m.mirrorId); store.fetchAllMirrors(); store.fetchCategorizedMirrors() }} title="删除镜像"><Trash2 className="h-3 w-3" /></ActionButton>
                              </div>
                            </TableCell>
                          </TableRow>
                        )
                      })}
                    </TableBody>
                  </Table>
                </div>
              </div>
            )}

            {/* 没有任何镜像时的提示 */}
            {outgoingMirrors.length === 0 && incomingMirrors.length === 0 && (
              <div className="pt-2">
                <h3 className="text-xs font-medium text-muted-foreground mb-1 px-1">🪞 镜像表</h3>
                <div className="rounded border border-dashed p-4 text-center text-xs text-muted-foreground">
                  暂无镜像 — 创建镜像可将表共享给其他群组
                </div>
              </div>
            )}
          </div>
        </TabsContent>

        {/* ===== FIELDS ===== */}
        <TabsContent value="fields">
          <div className="space-y-3">
            {!selectedTableId ? (
              <p className="text-sm text-muted-foreground py-4 text-center">请先在上方下拉框中选择一张表</p>
            ) : (
              <>
                <div className="flex gap-2">
                  <ActionButton onClick={() => store.fetchFields(selectedTableId)} loading={loading} variant="outline"><RefreshCw className="h-3 w-3 mr-1" />刷新</ActionButton>
                  <ActionButton onClick={openCreateField}><Plus className="h-3 w-3 mr-1" />新建字段</ActionButton>
                </div>
                <div className="max-h-80 overflow-auto rounded border">
                  <Table>
                    <TableHeader><TableRow><TableHead>字段名</TableHead><TableHead>Field ID</TableHead><TableHead>类型</TableHead><TableHead>操作</TableHead></TableRow></TableHeader>
                    <TableBody>
                      {fields.length === 0 && <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground py-8">暂无字段</TableCell></TableRow>}
                      {fields.map((f) => (
                        <TableRow key={f.fieldId}>
                          <TableCell className="font-medium">{f.name}</TableCell>
                          <TableCell className="font-mono text-xs">{f.fieldId}</TableCell>
                          <TableCell><Badge variant="outline">{f.type}</Badge></TableCell>
                          <TableCell>
                            <div className="flex gap-0.5">
                              <ActionButton variant="ghost" size="icon-sm" onClick={() => openEditField(f)} title="编辑"><Edit className="h-3 w-3" /></ActionButton>
                              {f.type === 'reference' && (
                                <ActionButton variant="ghost" size="icon-sm" onClick={() => openRefConfigForField(f.fieldId)} title="引用配置"><Settings className="h-3 w-3" /></ActionButton>
                              )}
                              <ActionButton variant="ghost" size="icon-sm" onClick={async () => { await store.deleteField(selectedTableId, f.fieldId); store.fetchFields(selectedTableId) }} title="删除"><Trash2 className="h-3 w-3" /></ActionButton>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </>
            )}
          </div>
        </TabsContent>

        {/* ===== RECORDS ===== */}
        <TabsContent value="records">
          <div className="space-y-3">
            {!selectedTableId ? (
              <p className="text-sm text-muted-foreground py-4 text-center">请先在上方下拉框中选择一张表</p>
            ) : (
              <>
                <div className="flex gap-2">
                  <ActionButton onClick={() => refreshRecords()} loading={loading} variant="outline"><RefreshCw className="h-3 w-3 mr-1" />刷新</ActionButton>
                  <ActionButton onClick={openCreateRecord}><Plus className="h-3 w-3 mr-1" />新建记录</ActionButton>
                </div>
                <div className="max-h-80 overflow-auto rounded border">
                  <Table>
                    <TableHeader><TableRow><TableHead>Record ID</TableHead><TableHead>数据预览</TableHead><TableHead>操作</TableHead></TableRow></TableHeader>
                    <TableBody>
                      {records.length === 0 && <TableRow><TableCell colSpan={3} className="text-center text-muted-foreground py-8">暂无记录</TableCell></TableRow>}
                      {records.map((r) => (
                        <TableRow key={r.recordId}>
                          <TableCell className="font-mono text-xs">{r.recordId}</TableCell>
                          <TableCell className="text-xs max-w-64 whitespace-pre-line">{formatRecordPreview(r.data, fields, refFieldIds, labelMap)}</TableCell>
                          <TableCell>
                            <div className="flex gap-0.5">
                              <ActionButton variant="ghost" size="icon-sm" onClick={() => openDetail(r)} title="详情"><Eye className="h-3 w-3" /></ActionButton>
                              <ActionButton variant="ghost" size="icon-sm" onClick={() => openEditRecord(r)} title="编辑"><Edit className="h-3 w-3" /></ActionButton>
                              <ActionButton variant="ghost" size="icon-sm" onClick={async () => { await store.deleteRecord(selectedTableId, r.recordId); refreshRecords() }} title="删除"><Trash2 className="h-3 w-3" /></ActionButton>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
                {/* Pagination */}
                {recordsTotal > recordsPageSize && (
                  <div className="flex items-center justify-between text-sm text-muted-foreground">
                    <span>共 {recordsTotal} 条记录，第 {recordsPage}/{Math.ceil(recordsTotal / recordsPageSize)} 页</span>
                    <div className="flex gap-1">
                      <ActionButton
                        variant="outline"
                        size="sm"
                        disabled={recordsPage <= 1}
                        onClick={() => {
                          const s = useDynamicStore.getState()
                          const t = selectedTable?.tenantId ?? rTenantId ?? defaultTenantId
                          store.fetchRecords(selectedTableId, t, s.recordsPage - 1, recordsPageSize, s.recordsSortField, s.recordsSortOrder)
                        }}
                      >
                        上一页
                      </ActionButton>
                      <ActionButton
                        variant="outline"
                        size="sm"
                        disabled={recordsPage >= Math.ceil(recordsTotal / recordsPageSize)}
                        onClick={() => {
                          const s = useDynamicStore.getState()
                          const t = selectedTable?.tenantId ?? rTenantId ?? defaultTenantId
                          store.fetchRecords(selectedTableId, t, s.recordsPage + 1, recordsPageSize, s.recordsSortField, s.recordsSortOrder)
                        }}
                      >
                        下一页
                      </ActionButton>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        </TabsContent>

        {/* ===== MIRRORS ===== */}
        <TabsContent value="mirrors">
          <MirrorPanel
            selectedTableId={selectedTableId}
            selectedTableName={tableName}
            tenantId={fTenantId || defaultTenantId}
            tables={tables}
            fields={fields}
            mirrors={mirrors}
            onRefresh={() => selectedTableId ? store.fetchMirrorsByTable(selectedTableId) : store.fetchAllMirrors()}
          />
        </TabsContent>
      </Tabs>

      {/* ===== TABLE DIALOGS ===== */}
      <Dialog open={showCreateTable} onOpenChange={setShowCreateTable}>
        <DialogContent>
          <DialogHeader><DialogTitle>创建动态表</DialogTitle><DialogDescription>创建一个新的动态业务表</DialogDescription></DialogHeader>
          <div className="space-y-3">
            <FormField label="表名 *" id="ct-name" value={tName} onChange={setTName} placeholder="例如: 合同表、客户表" required />
            <FormField label="租户 ID *" id="ct-tid" value={tTenantId} onChange={setTTenantId} placeholder="默认已填入当前租户" required />
          </div>
          <DialogFooter><ActionButton onClick={handleCreateTable} loading={loading}>创建</ActionButton></DialogFooter>
        </DialogContent>
      </Dialog>
      <Dialog open={!!showEditTable} onOpenChange={(v) => { if (!v) setShowEditTable(null) }}>
        <DialogContent>
          <DialogHeader><DialogTitle>编辑表 — {showEditTable?.name}</DialogTitle></DialogHeader>
          <div className="space-y-3"><FormField label="表名" id="et-name" value={tName} onChange={setTName} /></div>
          <DialogFooter><ActionButton onClick={handleUpdateTable} loading={loading}>保存</ActionButton></DialogFooter>
        </DialogContent>
      </Dialog>
      <Dialog open={!!showTableDetail} onOpenChange={(v) => { if (!v) setShowTableDetail(null) }}>
        <DialogContent className="max-w-xl">
          <DialogHeader><DialogTitle>表详情 — {showTableDetail?.name}</DialogTitle></DialogHeader>
          <pre className="bg-muted rounded p-3 text-xs overflow-auto max-h-96 font-mono">{JSON.stringify(showTableDetail, null, 2)}</pre>
        </DialogContent>
      </Dialog>

      {/* ===== MIRROR DETAIL DIALOG ===== */}
      <Dialog open={!!mirrorDetail} onOpenChange={(v) => { if (!v) { setMirrorDetail(null); setMirrorDetailFields([]) } }}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>镜像详情 — {mirrorDetail?.name}</DialogTitle>
            {mirrorDetail?.description && <DialogDescription>{mirrorDetail.description}</DialogDescription>}
          </DialogHeader>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <span className="text-muted-foreground">源表：</span>
                <span className="font-medium">{mirrorDetail?.sourceTable?.name || mirrorDetail?.sourceTableId || '—'}</span>
              </div>
              <div>
                <span className="text-muted-foreground">镜像 ID：</span>
                <code className="bg-muted px-1 py-0.5 rounded text-xs">{mirrorDetail?.mirrorId}</code>
              </div>
              <div>
                <span className="text-muted-foreground">来源群组：</span>
                <span>{mirrorDetail?.sourceGroup?.groupName || mirrorDetail?.sourceGroupId || '—'}</span>
              </div>
              <div>
                <span className="text-muted-foreground">目标群组：</span>
                <span>{mirrorDetail?.targetGroup?.groupName || mirrorDetail?.groupId || '—'}</span>
              </div>
            </div>
            <div>
              <span className="text-sm text-muted-foreground">可见字段：</span>
              <div className="mt-1 flex flex-wrap gap-1">
                {(mirrorDetail?.visibleFields || []).length === 0 ? (
                  <span className="text-xs text-muted-foreground">—</span>
                ) : (
                  (mirrorDetail?.visibleFields || []).map((fid) => {
                    const field = mirrorDetailFields.find((f) => f.fieldId === fid)
                    return (
                      <Badge key={fid} variant="secondary" className="text-xs">
                        {field ? `${field.name} (${field.type})` : fid}
                      </Badge>
                    )
                  })
                )}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3 text-xs text-muted-foreground">
              <div>创建时间：{mirrorDetail?.createdAt ? new Date(mirrorDetail.createdAt).toLocaleString() : '—'}</div>
              <div>更新时间：{mirrorDetail?.updatedAt ? new Date(mirrorDetail.updatedAt).toLocaleString() : '—'}</div>
            </div>
          </div>
          <DialogFooter>
            <ActionButton variant="outline" onClick={() => { const t = tables.find(x => x.tableId === mirrorDetail?.sourceTableId); if (t) selectTable(t); setMirrorDetail(null); setMirrorDetailFields([]) }}>
              查看源表
            </ActionButton>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ===== FIELD DIALOGS ===== */}
      <Dialog open={showCreateField} onOpenChange={setShowCreateField}>
        <DialogContent>
          <DialogHeader><DialogTitle>创建字段 — {tableName}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <FormField label="字段名 *" id="cf-name" value={fName} onChange={setFName} placeholder="例如: 合同编号" required />
            <div className="grid grid-cols-2 gap-2">
              <div className="grid gap-1.5">
                <Label>字段类型</Label>
                <Select value={fType} onValueChange={(v) => setFType((v || 'text') as FieldType)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{FIELD_TYPES.map((ft) => <SelectItem key={ft.value} value={ft.value}>{ft.label}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <FormField label="租户 ID" id="cf-tid" value={fTenantId} onChange={() => {}} placeholder="自动填入" />
            </div>
            {fType === 'select' && <FormField label="选项 (逗号分隔)" id="cf-opts" value={fOptions} onChange={setFOptions} placeholder="选项A, 选项B" />}
          </div>
          <DialogFooter><ActionButton onClick={handleCreateField} loading={loading}>创建</ActionButton></DialogFooter>
        </DialogContent>
      </Dialog>
      <Dialog open={!!showEditField} onOpenChange={(v) => { if (!v) setShowEditField(null) }}>
        <DialogContent>
          <DialogHeader><DialogTitle>编辑字段 — {showEditField?.name}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <FormField label="字段名" id="ef-name" value={fName} onChange={setFName} />
            <div className="grid gap-1.5">
              <Label>字段类型</Label>
              <Select value={fType} onValueChange={(v) => setFType((v || 'text') as FieldType)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{FIELD_TYPES.map((ft) => <SelectItem key={ft.value} value={ft.value}>{ft.label}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            {fType === 'select' && <FormField label="选项 (逗号分隔)" id="ef-opts" value={fOptions} onChange={setFOptions} />}
          </div>
          <DialogFooter><ActionButton onClick={handleUpdateField} loading={loading}>保存</ActionButton></DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ===== REFERENCE CONFIG DIALOG ===== */}
      <Dialog open={showRefConfig} onOpenChange={(v) => { if (!v) { setShowRefConfig(false); setPendingFieldId('') } }}>
        <DialogContent className="max-w-lg">
          {showRefConfig && (
          <>
          <DialogHeader>
            <DialogTitle>{references.find((r) => r.fieldId === pendingFieldId) ? '编辑引用' : '配置引用'}</DialogTitle>
            <DialogDescription>选择引用目标表，勾选源字段，并可指定优先展示字段</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="grid gap-1.5">
              <Label>引用目标表</Label>
              <Select value={refSourceTableId} onValueChange={(v) => {
                  if (!v) return
                  if (v === refSourceTableId) return
                  setRefSourceTableId(v)
                  setRefSourceFields(new Set())
                  setRefDisplayField('')
                  setSourceTableFields([])
                }}>
                  <SelectTrigger><SelectValue placeholder="选择引用的表…">{tables.find((t) => t.tableId === refSourceTableId)?.name}</SelectValue></SelectTrigger>
                  <SelectContent>
                    {tables.map((t) => <SelectItem key={t.tableId} value={t.tableId}>{t.name}</SelectItem>)}
                  </SelectContent>
                </Select>
            </div>

            <div className="grid gap-1.5">
              <Label>源字段（勾选用于搜索/拼接，并可指定优先展示字段）</Label>
              <ReferenceConfigForm
                sourceTableId={refSourceTableId}
                sourceFields={refSourceFields}
                displayField={refDisplayField}
                onToggleField={toggleRefField}
                onSetDisplayField={setRefDisplayField}
                allFields={sourceTableFields}
                loading={sourceFieldsLoading}
              />
              {refSourceFields.size > 0 && (
                <p className="text-xs text-muted-foreground">已选 {refSourceFields.size} 个字段{refDisplayField ? `，优先展示「${refDisplayField}」` : ''}</p>
              )}
            </div>

            <FormField label="值字段" id="ref-value" value={refValueField} onChange={setRefValueField} placeholder="recordId" />
            <p className="text-xs text-muted-foreground -mt-2">
              实际存储到 record.data 中的字段名。"recordId" 表示存储记录的 recordId
            </p>
          </div>
          <DialogFooter>
            <ActionButton variant="outline" onClick={() => { setShowRefConfig(false); setPendingFieldId(''); store.fetchFields(selectedTableId) }}>
              跳过
            </ActionButton>
            <ActionButton onClick={handleSaveRefConfig} loading={loading}>保存引用配置</ActionButton>
          </DialogFooter>
          </>
          )}
        </DialogContent>
      </Dialog>

      {/* ===== RECORD DIALOGS ===== */}
      <Dialog open={showCreateRecord} onOpenChange={setShowCreateRecord}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>创建记录 — {tableName}</DialogTitle></DialogHeader>
          <RecordForm fields={fields} values={rFormData} onChange={(n, v) => setRFormData((p) => ({ ...p, [n]: v }))} references={references} />
          <DialogFooter><ActionButton onClick={handleCreateRecord} loading={loading}>创建</ActionButton></DialogFooter>
        </DialogContent>
      </Dialog>
      <Dialog open={!!showEditRecord} onOpenChange={(v) => { if (!v) setShowEditRecord(null) }}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>编辑记录 — {showEditRecord?.recordId}</DialogTitle></DialogHeader>
          <RecordForm fields={fields} values={rFormData} onChange={(n, v) => setRFormData((p) => ({ ...p, [n]: v }))} references={references} excludeRecordId={showEditRecord?.recordId} />
          <DialogFooter><ActionButton onClick={handleUpdateRecord} loading={loading}>保存</ActionButton></DialogFooter>
        </DialogContent>
      </Dialog>
      <Dialog open={!!showRecordDetail} onOpenChange={(v) => { if (!v) setShowRecordDetail(null) }}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>记录详情 — {showRecordDetail?.recordId}</DialogTitle></DialogHeader>
          <RecordForm fields={fields} values={rFormData} readOnly references={references} />
        </DialogContent>
      </Dialog>
    </SectionWrapper>
  )
}
