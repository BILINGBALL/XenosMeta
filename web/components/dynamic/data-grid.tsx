'use client'

import { useState, useEffect, useMemo, useCallback } from 'react'
import { useDynamicStore } from '@/stores/dynamic-store'
import type { DynamicField, DynamicRecord, FieldReference, DynamicTable } from '@/types'
import { postAction } from '@/lib/api-client'
import { unwrapList } from '@/types'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Skeleton } from '@/components/ui/skeleton'
import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, ExternalLink, ArrowUpDown, Share2 } from 'lucide-react'

// ===== Helpers =====

function coerceValue(v: unknown): string {
  if (v === null || v === undefined) return ''
  if (typeof v === 'boolean') return v ? 'true' : 'false'
  return String(v)
}

function formatCellValue(value: unknown, field: DynamicField): string {
  const s = coerceValue(value)
  if (!s) return '—'
  switch (field.type) {
    case 'date':
      return s.length > 10 ? s : s
    case 'number':
      if (!isNaN(Number(s)) && s.includes('.') && s.length > 10) return Number(s).toFixed(2)
      return s
    default:
      return s
  }
}

// ===== Reference Label Resolution =====

function computeLabel(record: any, ref: FieldReference): string {
  if (!record?.data) return ''
  const srcFields = ref.sourceFields as string[] || []
  if (ref.displayField) {
    return String(record.data[ref.displayField] ?? record.recordId ?? '')
  }
  const parts = srcFields.map((f: string) => {
    const val = record.data?.[f]
    return val != null ? String(val) : ''
  }).filter(Boolean)
  return parts.length > 0 ? parts.join(' - ') : (record.recordId ?? '')
}

function useReferenceLabels(
  records: DynamicRecord[],
  fields: DynamicField[],
  references: FieldReference[],
) {
  const [labelMap, setLabelMap] = useState<Record<string, string>>({})
  const [loadingRefs, setLoadingRefs] = useState(false)

  useEffect(() => {
    if (!records.length || !references.length || !fields.length) {
      setLabelMap({})
      return
    }

    const refFieldIds = new Set(fields.filter(f => f.type === 'reference').map(f => f.fieldId))
    const refMap = new Map<string, FieldReference>()
    for (const ref of references) refMap.set(ref.fieldId, ref)

    let cancelled = false

    async function resolve() {
      setLoadingRefs(true)
      // Collect all unique (refId, recordId) pairs
      const toResolve = new Map<string, { fieldName: string; ref: FieldReference; recordId: string }>()
      for (const record of records) {
        if (!record.data) continue
        for (const [key, rawValue] of Object.entries(record.data)) {
          const field = fields.find(f => f.name === key)
          if (!field || !refFieldIds.has(field.fieldId)) continue
          const ref = refMap.get(field.fieldId)
          if (!ref) continue
          const val = coerceValue(rawValue)
          if (!val) continue
          const dedupKey = `${ref.refId}:${val}`
          if (!toResolve.has(dedupKey)) {
            toResolve.set(dedupKey, { fieldName: key, ref, recordId: val })
          }
        }
      }

      if (toResolve.size === 0) { setLoadingRefs(false); return }

      const results = await Promise.all(
        Array.from(toResolve.values()).map(async ({ fieldName, ref, recordId }) => {
          try {
            const res: any = await postAction(
              `/dynamic/tables/${ref.sourceTableId}/references/${ref.refId}/lookup`,
              { recordId, page: 1, pageSize: 1 },
            )
            const items = res?.data?.items || res?.data || []
            const match = items.find((r: any) => r.recordId === recordId)
            const label = computeLabel(match, ref)
            return { key: `${fieldName}:${recordId}`, label: label || recordId }
          } catch {
            return { key: `${fieldName}:${recordId}`, label: recordId }
          }
        }),
      )

      if (cancelled) return
      const newMap: Record<string, string> = {}
      for (const { key, label } of results) newMap[key] = label
      setLabelMap(prev => (JSON.stringify(prev) === JSON.stringify(newMap) ? prev : newMap))
      setLoadingRefs(false)
    }

    resolve()
    return () => { cancelled = true }
  }, [records, fields, references])

  return { labelMap, loadingRefs }
}

// ===== Reference Detail Dialog =====

function ReferenceDetailDialog({
  open,
  onOpenChange,
  record,
  ref,
  fieldName,
}: {
  open: boolean
  onOpenChange: (v: boolean) => void
  record: any | null
  ref: FieldReference | null
  fieldName: string
}) {
  if (!record || !ref) return null
  const data = record.data || {}
  const srcFields = (ref.sourceFields as string[]) || []
  const allFields = Object.keys(data)

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <span>{fieldName} 详情</span>
            <Badge variant="outline" className="text-xs font-mono">{record.recordId}</Badge>
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-2 max-h-96 overflow-auto">
          {(allFields.length > 0 ? allFields : srcFields).map((key) => {
            const val = data[key]
            const isSrcField = srcFields.includes(key)
            return (
              <div key={key} className="flex items-start gap-3 py-1.5 border-b border-muted last:border-0">
                <span className={`text-xs shrink-0 w-24 font-medium ${isSrcField ? 'text-foreground' : 'text-muted-foreground'}`}>
                  {key}
                  {isSrcField && <span className="ml-1 text-primary">*</span>}
                </span>
                <span className="text-sm break-all">{val != null ? String(val) : '—'}</span>
              </div>
            )
          })}
        </div>
      </DialogContent>
    </Dialog>
  )
}

// ===== Skeleton =====

function RowSkeleton({ cols }: { cols: number }) {
  return (
    <>
      {Array.from({ length: 8 }).map((_, i) => (
        <TableRow key={i}>
          {Array.from({ length: cols }).map((_, j) => (
            <TableCell key={j}><Skeleton className="h-4 w-full" /></TableCell>
          ))}
        </TableRow>
      ))}
    </>
  )
}

// ===== Main DataGrid Component =====

interface DataGridProps {
  table: DynamicTable
  mirrorId?: string
}

export function DataGrid({ table, mirrorId }: DataGridProps) {
  const store = useDynamicStore()
  const { fields, records, loading, references, recordsTotal, recordsPage, recordsPageSize, recordsSortField, recordsSortOrder } = store

  const [detailOpen, setDetailOpen] = useState(false)
  const [detailRecord, setDetailRecord] = useState<any | null>(null)
  const [detailRef, setDetailRef] = useState<FieldReference | null>(null)
  const [detailFieldName, setDetailFieldName] = useState('')

  // Load data on mount / table / mirror change
  useEffect(() => {
    if (!table.tableId) return
    if (mirrorId) {
      store.fetchMirrorFields(mirrorId)
      store.fetchReferences(table.tableId)
      store.fetchMirrorRecords(mirrorId, 1, 20)
    } else {
      store.fetchFields(table.tableId)
      store.fetchReferences(table.tableId)
      store.fetchRecords(table.tableId, table.tenantId, 1, 20)
    }
  }, [table.tableId, mirrorId])

  // Resolve reference labels
  const { labelMap, loadingRefs } = useReferenceLabels(records, fields, references)

  // Build reference lookup map: fieldName → { ref, sourceTable }
  const refMap = useMemo(() => {
    const m = new Map<string, FieldReference>()
    for (const ref of references) {
      const field = fields.find(f => f.fieldId === ref.fieldId)
      if (field) m.set(field.name, ref)
    }
    return m
  }, [fields, references])

  // Columns: all non-hidden fields
  const columns = useMemo(() => fields, [fields])

  const totalPages = Math.max(1, Math.ceil(recordsTotal / recordsPageSize))

  const goToPage = useCallback((page: number) => {
    if (mirrorId) {
      store.fetchMirrorRecords(mirrorId, page, recordsPageSize)
    } else {
      store.fetchRecords(table.tableId, table.tenantId, page, recordsPageSize, recordsSortField, recordsSortOrder)
    }
  }, [table.tableId, table.tenantId, recordsPageSize, recordsSortField, recordsSortOrder, mirrorId, store])

  // Detail lookup for a reference cell
  const openRefDetail = useCallback(async (fieldName: string, recordId: string) => {
    const ref = refMap.get(fieldName)
    if (!ref) return
    try {
      const res: any = await postAction(
        `/dynamic/tables/${ref.sourceTableId}/references/${ref.refId}/lookup`,
        { recordId, page: 1, pageSize: 1 },
      )
      const items = res?.data?.items || res?.data || []
      const match = items.find((r: any) => r.recordId === recordId)
      if (match) {
        setDetailRecord({ ...match, _sourceTableId: ref.sourceTableId })
        setDetailRef(ref)
        setDetailFieldName(fieldName)
        setDetailOpen(true)
      }
    } catch { /* ignore */ }
  }, [refMap])

  const isLoading = loading || loadingRefs
  const noTableSelected = !table.tableId

  return (
    <Card className="shadow-sm">
      <CardContent className="p-0">
        {/* Toolbar */}
        <div className="flex items-center justify-between px-4 py-3 border-b flex-wrap gap-2">
          <div className="flex items-center gap-3">
            <h2 className="text-sm font-semibold">{table.name}</h2>
            {mirrorId && (
              <Badge variant="secondary" className="text-xs gap-1">
                <Share2 className="size-3" /> 镜像
              </Badge>
            )}
            <Badge variant="secondary" className="text-xs">
              {recordsTotal} 条记录
            </Badge>
            <Badge variant="outline" className="text-xs">
              {fields.length} 个字段
            </Badge>
          </div>
          <div className="flex items-center gap-2">
            {/* Sort Controls */}
            <select
              value={recordsSortField || ''}
              onChange={(e) => {
                const newField = e.target.value || null
                if (mirrorId) {
                  store.fetchMirrorRecords(mirrorId, 1, recordsPageSize)
                } else {
                  store.fetchRecords(table.tableId, table.tenantId, 1, recordsPageSize, newField, recordsSortOrder)
                }
              }}
              className="h-8 rounded-md border border-input bg-background px-2.5 text-xs outline-none focus:ring-1 focus:ring-ring"
              disabled={!!mirrorId}
            >
              <option value="">默认排序 (创建时间)</option>
              {fields.map((f) => (
                <option key={f.fieldId} value={f.name}>
                  {f.name}{f.type === 'reference' ? ' (引用)' : ''}
                </option>
              ))}
            </select>
            <Button
              variant="outline"
              size="icon"
              className="size-7"
              title={recordsSortOrder === 'asc' ? '升序 → 降序' : '降序 → 升序'}
              disabled={!recordsSortField || !!mirrorId}
              onClick={() => {
                const newOrder = recordsSortOrder === 'asc' ? 'desc' : 'asc'
                store.fetchRecords(table.tableId, table.tenantId, 1, recordsPageSize, recordsSortField, newOrder)
              }}
            >
              <ArrowUpDown className={`size-3.5 ${recordsSortOrder === 'asc' ? 'rotate-180' : ''} transition-transform`} />
            </Button>
            <Button variant="outline" size="sm" onClick={() => goToPage(recordsPage)} disabled={isLoading}>
              刷新
            </Button>
          </div>
        </div>

        {/* Table */}
        {noTableSelected ? (
          <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
            <LayersIcon className="size-12 mb-4 opacity-30" />
            <p className="text-sm">请选择一个动态表</p>
          </div>
        ) : (
          <>
            <div className="overflow-auto max-h-[calc(100vh-280px)]">
              <Table>
                <TableHeader className="sticky top-0 bg-muted/50 z-10">
                  <TableRow>
                    <TableHead className="w-12 text-center text-xs">#</TableHead>
                    {columns.map((col) => (
                      <TableHead key={col.fieldId} className="text-xs font-semibold">
                        <div className="flex items-center gap-1.5">
                          {col.name}
                          {col.type === 'reference' && (
                            <Badge variant="outline" className="text-[9px] h-3.5 px-1 leading-none">引</Badge>
                          )}
                        </div>
                      </TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isLoading && records.length === 0 ? (
                    <RowSkeleton cols={columns.length + 1} />
                  ) : records.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={columns.length + 1} className="text-center py-16 text-muted-foreground">
                        <div className="flex flex-col items-center gap-2">
                          <span className="text-3xl">📋</span>
                          <span className="text-sm">暂无数据</span>
                        </div>
                      </TableCell>
                    </TableRow>
                  ) : (
                    records.map((record, idx) => (
                      <TableRow key={record.recordId} className="hover:bg-primary/5 transition-colors">
                        <TableCell className="text-center text-xs text-muted-foreground font-mono w-12">
                          {(recordsPage - 1) * recordsPageSize + idx + 1}
                        </TableCell>
                        {columns.map((col) => {
                          const rawValue = record.data?.[col.name]
                          const ref = refMap.get(col.name)

                          if (col.type === 'reference' && ref) {
                            const val = coerceValue(rawValue)
                            const labelKey = `${col.name}:${val}`
                            const displayValue = labelMap[labelKey] || val

                            return (
                              <TableCell key={col.fieldId} className="max-w-48">
                                {val ? (
                                  <button
                                    onClick={() => openRefDetail(col.name, val)}
                                    className="inline-flex items-center gap-1 text-primary hover:underline text-xs font-medium cursor-pointer max-w-full"
                                  >
                                    <span className="truncate">{displayValue || val}</span>
                                    <ExternalLink className="size-3 shrink-0 opacity-50" />
                                  </button>
                                ) : (
                                  <span className="text-muted-foreground text-xs">—</span>
                                )}
                              </TableCell>
                            )
                          }

                          return (
                            <TableCell key={col.fieldId} className="max-w-64 text-xs">
                              <span className="line-clamp-2" title={coerceValue(rawValue)}>
                                {formatCellValue(rawValue, col)}
                              </span>
                            </TableCell>
                          )
                        })}
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>

            {/* Pagination */}
            <div className="flex items-center justify-between px-4 py-3 border-t bg-muted/20 text-sm">
              <span className="text-muted-foreground text-xs">
                {recordsTotal === 0
                  ? '暂无记录'
                  : `共 ${recordsTotal} 条，第 ${recordsPage} / ${totalPages} 页`}
              </span>
              <div className="flex items-center gap-0.5">
                <Button
                  variant="outline"
                  size="icon"
                  className="size-7"
                  disabled={recordsPage <= 1}
                  onClick={() => goToPage(1)}
                >
                  <ChevronsLeft className="size-3.5" />
                </Button>
                <Button
                  variant="outline"
                  size="icon"
                  className="size-7"
                  disabled={recordsPage <= 1}
                  onClick={() => goToPage(recordsPage - 1)}
                >
                  <ChevronLeft className="size-3.5" />
                </Button>
                <span className="px-2 text-xs font-medium tabular-nums min-w-16 text-center">
                  {recordsPage} / {totalPages}
                </span>
                <Button
                  variant="outline"
                  size="icon"
                  className="size-7"
                  disabled={recordsPage >= totalPages}
                  onClick={() => goToPage(recordsPage + 1)}
                >
                  <ChevronRight className="size-3.5" />
                </Button>
                <Button
                  variant="outline"
                  size="icon"
                  className="size-7"
                  disabled={recordsPage >= totalPages}
                  onClick={() => goToPage(totalPages)}
                >
                  <ChevronsRight className="size-3.5" />
                </Button>
              </div>
            </div>
          </>
        )}
      </CardContent>

      {/* Reference Detail Dialog */}
      <ReferenceDetailDialog
        open={detailOpen}
        onOpenChange={setDetailOpen}
        record={detailRecord}
        ref={detailRef}
        fieldName={detailFieldName}
      />
    </Card>
  )
}

// Simple inline icon to avoid import issues
function LayersIcon({ className }: { className?: string }) {
  return (
    <svg className={className} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 2 2 7l10 5 10-5-10-5Z" />
      <path d="m2 17 10 5 10-5" />
      <path d="m2 12 10 5 10-5" />
    </svg>
  )
}
