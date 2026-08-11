'use client'

import { useState, useEffect, useMemo, useRef, useCallback } from 'react'
import { useFileStore, type FileItem, type FileVersionItem } from '@/stores/file-store'
import { useAuthStore } from '@/stores/auth-store'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { formatSize, FileTypeIcon, displayFileName } from '@/lib/file-utils'
import { Search, Paperclip, X, ChevronDown, Loader2, Check, Eye, Plus, List } from 'lucide-react'
import type { FileItem as FileInfo } from '@/stores/file-store'
import { AttachmentListDialog } from '@/components/file/attachment-list-dialog'

export interface MultiFilePickerProps {
  /**
   * fileRef list. 每项与旧 FilePicker 相同:
   *   "fileId" | "fileId@V2" | "fileId@VN"
   * 同时兼容旧的单值 string（传进来自动 wrap 成列表）。
   */
  value: string[] | string
  onChange: (fileRefs: string[]) => void
  readOnly?: boolean
}

/** Parse "fileId@V2" or "fileId@VN" into { fileId, versionKey } */
function parseFileRef(ref: string): { fileId: string; versionKey: string } {
  const idx = ref.lastIndexOf('@V')
  if (idx === -1) return { fileId: ref || '', versionKey: '' }
  return { fileId: ref.slice(0, idx), versionKey: ref.slice(idx + 1) }
}

function buildFileRef(fileId: string, versionKey: string): string {
  if (!versionKey || versionKey === 'V1') return fileId
  return `${fileId}@${versionKey}`
}

function normalizeList(v: string[] | string | undefined | null): string[] {
  if (v === null || v === undefined || v === '') return []
  if (typeof v === 'string') return [v]
  if (Array.isArray(v)) return v.filter(x => typeof x === 'string' && x.length > 0)
  return []
}

const versionLabel = (key: string) => {
  if (!key || key === 'V1') return 'V1（默认）'
  if (key === 'VN') return 'VN（始终最新）'
  return key
}

/**
 * 多选附件的 Picker 组件。
 *
 * 编辑模式下：
 *  - 已选区域：横向卡片列表（超过 3 个时收起成「第一个 + 另外 N 个」，点展开看列表）
 *  - 每个卡片：图标 + 文件名 + 大小 + 版本选择 + 删除按钮
 *  - 添加按钮：打开文件选择弹窗（多选）
 *
 * 只读模式下：
 *  - 和编辑模式显示一致，只是不可编辑 / 不可添加 / 不可删除
 */
export function MultiFilePicker({ value, onChange, readOnly }: MultiFilePickerProps) {
  const isLoggedIn = useAuthStore((s) => s.isLoggedIn)
  const store = useFileStore()
  const { files, allTags } = store

  // Picker state
  const [pickerOpen, setPickerOpen] = useState(false)
  const [search, setSearch] = useState('')
  const [selectedTag, setSelectedTag] = useState('')
  const [allLoaded, setAllLoaded] = useState<FileItem[]>([])
  const listRef = useRef<HTMLDivElement>(null)

  // 当前选中的 ref 列表
  const refs = normalizeList(value)
  const [previewOpen, setPreviewOpen] = useState(false)
  const [previewFile, setPreviewFile] = useState<FileInfo | null>(null)

  // Version cache (fileId -> versions)
  const [versionMap, setVersionMap] = useState<Record<string, FileVersionItem[]>>({})
  const [versionLoading, setVersionLoading] = useState<Record<string, boolean>>({})

  // Resolve file info from store/remote
  const [resolvedMap, setResolvedMap] = useState<Record<string, FileItem>>({})

  // Load store on mount
  useEffect(() => {
    if (isLoggedIn) {
      store.fetchFiles(1, 'createdAt', 'desc').catch(() => {})
      store.fetchTags().catch(() => {})
    }
  }, [isLoggedIn, store])

  // Resolve each ref + load versions on mount
  useEffect(() => {
    let cancelled = false
    for (const ref of refs) {
      const { fileId } = parseFileRef(ref)
      if (!fileId) continue

      // Already resolved?
      if (resolvedMap[ref]) continue

      // Try store cache
      const inStore = files.find(f => f.fileId === fileId)
      if (inStore) {
        setResolvedMap(prev => ({ ...prev, [ref]: inStore }))
        continue
      }

      // Remote
      ;(async () => {
        try {
          const { apiClient } = await import('@/lib/api-client')
          const res: any = await apiClient.get(`/file/${fileId}`)
          const data = res.data || res
          if (data && data.fileId) {
            const item: FileItem = {
              id: data.id || '',
              fileId: data.fileId,
              tenantId: data.tenantId || '',
              bucket: data.bucket || '',
              objectKey: data.objectKey || '',
              filename: data.filename || '',
              displayName: data.displayName ?? null,
              mimeType: data.mimeType || '',
              size: data.size || 0,
              currentVersion: data.currentVersion || 1,
              tags: data.tags || [],
              description: data.description ?? null,
              uploadedBy: data.uploadedBy ?? null,
              createdAt: data.createdAt || '',
              updatedAt: data.updatedAt || '',
            }
            if (!cancelled) setResolvedMap(prev => ({ ...prev, [ref]: item }))
          }
        } catch { /* ignore */ }
      })()
    }
    return () => { cancelled = true }
  }, [refs, files])

  // Load versions on demand (when user clicks select)
  const loadVersions = useCallback(async (fileId: string) => {
    if (versionMap[fileId] || versionLoading[fileId]) return
    setVersionLoading(prev => ({ ...prev, [fileId]: true }))
    try {
      const list = await store.getVersions(fileId)
      setVersionMap(prev => ({ ...prev, [fileId]: list }))
    } finally {
      setVersionLoading(prev => ({ ...prev, [fileId]: false }))
    }
  }, [store, versionMap, versionLoading])

  // When picker opens, fetch all files (paginated)
  useEffect(() => {
    if (pickerOpen && isLoggedIn) {
      async function load() {
        const all: FileItem[] = []
        let p = 1
        let hasMore = true
        while (hasMore) {
          try {
            const state = useFileStore.getState()
            if (p === 1) {
              all.push(...state.files)
            } else {
              const res: any = await (await import('@/lib/api-client')).apiClient.post('/file/list', {
                page: p, pageSize: state.pageSize,
                search: search || undefined,
              })
              const data = res.data || res
              all.push(...(data.items || []))
              if ((data.page || p) >= Math.ceil((data.total || 0) / (data.pageSize || 20))) {
                break
              }
            }
            const s = useFileStore.getState()
            if (p * s.pageSize >= s.total) break
            p++
          } catch { break }
        }
        setAllLoaded(all)
      }
      load()
    }
  }, [pickerOpen, isLoggedIn, search])

  // Combined files list in picker
  const displayFiles = pickerOpen ? (allLoaded.length > 0 ? allLoaded : files) : files

  const filteredFiles = useMemo(() => {
    let result = displayFiles
    if (search) result = result.filter((f) => f.filename.toLowerCase().includes(search.toLowerCase()))
    if (selectedTag) result = result.filter((f) => (f.tags as string[])?.includes(selectedTag))
    return result
  }, [displayFiles, search, selectedTag])

  // Currently selected fileIds (for highlighting in picker)
  const selectedFileIdSet = useMemo(() => new Set(
    refs.map(r => parseFileRef(r).fileId).filter(Boolean)
  ), [refs])

  const handleToggleFile = useCallback((file: FileItem) => {
    const idx = refs.findIndex(r => parseFileRef(r).fileId === file.fileId)
    if (idx >= 0) {
      // 已存在 → 移除
      const next = refs.slice()
      next.splice(idx, 1)
      onChange(next)
    } else {
      // 新增 → 默认 V1（不写版本后缀）
      const next = refs.concat([file.fileId])
      onChange(next)
    }
  }, [refs, onChange])

  const handleRemoveAt = useCallback((i: number) => {
    const next = refs.slice()
    next.splice(i, 1)
    onChange(next)
  }, [refs, onChange])

  const handleVersionChange = useCallback((i: number, versionKey: string) => {
    const ref = refs[i]
    const { fileId } = parseFileRef(ref)
    const next = refs.slice()
    next[i] = buildFileRef(fileId, versionKey)
    onChange(next)
  }, [refs, onChange])

  const handlePreview = useCallback((file: FileInfo) => {
    setPreviewFile(file as any)
    setPreviewOpen(true)
  }, [])

  // —————— Display helpers ——————

  // readOnly / edit: 统一的预览 item
  const renderItem = (ref: string, i: number) => {
    const { fileId, versionKey } = parseFileRef(ref)
    const file = resolvedMap[ref] || files.find(f => f.fileId === fileId) || null
    const name = file ? displayFileName(file) : fileId
    const size = file?.size ?? 0

    return (
      <div
        key={`${ref}-${i}`}
        className="flex items-center gap-2 min-w-0 h-10 px-2.5 rounded-md border bg-muted/30 text-xs"
      >
        {file ? (
          <button
            type="button"
            onClick={() => handlePreview(file as any)}
            className="shrink-0 hover:text-primary"
            title="预览文件"
          >
            <FileTypeIcon mimeType={file.mimeType} className="size-4" />
          </button>
        ) : (
          <Paperclip className="size-3.5 shrink-0 text-muted-foreground" />
        )}

        <span className="truncate flex-1" title={name}>{name}</span>
        {size > 0 && <span className="text-muted-foreground shrink-0 hidden sm:inline">{formatSize(size)}</span>}

        {/* Version selector (edit mode, 有版本时显示) */}
        {!readOnly && (
          <div className="relative shrink-0" onMouseDown={() => loadVersions(fileId)}>
            {versionLoading[fileId] ? (
              <Loader2 className="size-3.5 animate-spin text-muted-foreground" />
            ) : (
              <>
                <select
                  className="appearance-none h-6 pl-1.5 pr-5 rounded border bg-background text-[10px] cursor-pointer focus:outline-none focus:ring-1 focus:ring-primary"
                  value={versionKey || 'V1'}
                  onChange={(e) => handleVersionChange(i, e.target.value)}
                >
                  <option value="V1">V1</option>
                  {(versionMap[fileId] || []).map((v) => {
                    if (v.version === 1) return null
                    return <option key={v.versionId} value={`V${v.version}`}>V{v.version}</option>
                  })}
                  <option value="VN">VN</option>
                </select>
                <ChevronDown className="absolute right-1 top-1/2 -translate-y-1/2 size-3 text-muted-foreground pointer-events-none" />
              </>
            )}
          </div>
        )}

        {!readOnly && (
          <button
            type="button"
            onClick={() => handleRemoveAt(i)}
            className="shrink-0 hover:text-red-500"
            title="移除"
          >
            <X className="size-3.5" />
          </button>
        )}
      </div>
    )
  }

  // —————— UI ——————

  if (refs.length === 0 && readOnly) {
    return (
      <div className="h-8 flex items-center rounded-md border border-transparent bg-muted/60 px-2.5 text-sm text-muted-foreground">
        —
      </div>
    )
  }

  const displayFirstN = 3

  return (
    <div className="space-y-2">
      {/* 已选展示区 */}
      <div className="flex flex-wrap gap-1.5">
        {refs.slice(0, displayFirstN).map((ref, i) => renderItem(ref, i))}

        {/* 更多：超过 displayFirstN 时显示一个"另外 N 个"按钮，点击打开列表弹窗 */}
        {refs.length > displayFirstN && (
          <AttachmentListDialog
            triggerLabel={`另外 ${refs.length - displayFirstN} 个`}
            refs={refs}
            title="附件列表"
            readOnly={readOnly}
            onRemove={!readOnly ? handleRemoveAt : undefined}
            onPreview={handlePreview}
          />
        )}

        {/* 预览入口：只读状态下 1~N 项时，都有「查看全部」按钮 */}
        {refs.length > 0 && (
          <AttachmentListDialog
            triggerLabel="查看全部"
            refs={refs}
            title="附件列表"
            readOnly={readOnly}
            onRemove={!readOnly ? handleRemoveAt : undefined}
            onPreview={handlePreview}
            variant="outline"
          />
        )}

        {/* 添加按钮 */}
        {!readOnly && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => setPickerOpen(true)}
            className="h-10 text-xs shrink-0"
            type="button"
          >
            <Plus className="size-3.5 mr-1" />
            {refs.length === 0 ? '选择附件' : '添加'}
          </Button>
        )}
      </div>

      {/* —————— 选择附件弹窗（多选） —————— */}
      <Dialog open={pickerOpen} onOpenChange={setPickerOpen}>
        <DialogContent className="max-w-lg max-h-[80vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>
              选择附件
              {refs.length > 0 && (
                <Badge variant="secondary" className="ml-2 text-[10px] font-mono">已选 {refs.length}</Badge>
              )}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-3 flex-1 overflow-hidden flex flex-col">
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
                <Input
                  placeholder="搜索文件…"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-8 h-8 text-xs"
                />
              </div>
            </div>

            {allTags.length > 0 && (
              <div className="flex gap-1 flex-wrap">
                <Badge
                  variant={!selectedTag ? 'default' : 'outline'}
                  className="text-[10px] cursor-pointer"
                  onClick={() => setSelectedTag('')}
                >
                  全部
                </Badge>
                {allTags.map((t) => (
                  <Badge
                    key={t}
                    variant={selectedTag === t ? 'default' : 'outline'}
                    className="text-[10px] cursor-pointer"
                    onClick={() => setSelectedTag(selectedTag === t ? '' : t)}
                  >
                    {t}
                  </Badge>
                ))}
              </div>
            )}

            <div className="flex-1 overflow-auto space-y-1 pr-1" ref={listRef}>
              {filteredFiles.length === 0 ? (
                <p className="text-xs text-muted-foreground text-center py-8">无匹配文件</p>
              ) : (
                filteredFiles.map((f) => {
                  const selected = selectedFileIdSet.has(f.fileId)
                  return (
                    <button
                      key={f.fileId}
                      type="button"
                      onClick={() => handleToggleFile(f)}
                      className={`w-full flex items-center gap-2 px-3 py-2 rounded-md text-left text-xs transition-colors ${
                        selected
                          ? 'bg-primary/10 text-primary font-medium ring-1 ring-primary/30'
                          : 'hover:bg-muted'
                      }`}
                    >
                      <span className={`flex items-center justify-center size-4 shrink-0 rounded-sm border ${
                        selected ? 'bg-primary border-primary text-primary-foreground' : 'border-muted-foreground/40'
                      }`}>
                        {selected && <Check className="size-3" />}
                      </span>
                      <FileTypeIcon mimeType={f.mimeType} className="size-4" />
                      <span className="flex-1 truncate">{displayFileName(f)}</span>
                      <Badge variant="secondary" className="text-[9px] h-4 px-1 shrink-0">V{f.currentVersion || 1}</Badge>
                      <span className="text-muted-foreground shrink-0 w-16 text-right">{formatSize(f.size)}</span>
                    </button>
                  )
                })
              )}
            </div>

            <Button
              variant="outline"
              size="sm"
              type="button"
              onClick={() => onChange([])}
              className="w-full"
            >
              清除全部
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* —————— 预览窗口 (FilePreview 单文件) —————— */}
      {previewOpen && previewFile && (
        <FilePreviewComponent file={previewFile as any} onClose={() => setPreviewOpen(false)} />
      )}
    </div>
  )
}

// —————— 懒加载 FilePreview + AttachmentListDialog 避免循环引用 ——————
import dynamic from 'next/dynamic'
const FilePreviewComponent = dynamic(
  () => import('@/components/file/file-preview').then(m => m.FilePreview),
  { ssr: false, loading: () => null }
)
