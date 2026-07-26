'use client'

import { useState, useEffect, useMemo, useRef, useCallback } from 'react'
import { useFileStore, type FileItem, type FileVersionItem } from '@/stores/file-store'
import { useAuthStore } from '@/stores/auth-store'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { formatSize, FileTypeIcon, displayFileName } from '@/lib/file-utils'
import { Search, Paperclip, X, ChevronDown, Loader2 } from 'lucide-react'

interface FilePickerProps {
  /**
   * file reference string:
   * - "fileId"          → V1 (backward compatible)
   * - "fileId@V2"       → pinned to version 2
   * - "fileId@VN"       → follows the latest version
   */
  value: string
  onChange: (fileRef: string) => void
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

export function FilePicker({ value, onChange, readOnly }: FilePickerProps) {
  const isLoggedIn = useAuthStore((s) => s.isLoggedIn)
  const store = useFileStore()
  const { files, loading, allTags, total, pageSize } = store
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState('')
  const [selectedTag, setSelectedTag] = useState('')
  const [pickerPage, setPickerPage] = useState(1)
  const [loadingMore, setLoadingMore] = useState(false)
  const [allLoaded, setAllLoaded] = useState<FileItem[]>([])
  const [resolvedFile, setResolvedFile] = useState<FileItem | null>(null)
  const listRef = useRef<HTMLDivElement>(null)

  // Version state
  const [versions, setVersions] = useState<FileVersionItem[]>([])
  const [versionsLoading, setVersionsLoading] = useState(false)

  const { fileId, versionKey } = parseFileRef(value)

  // Load file store on mount
  useEffect(() => {
    if (isLoggedIn) {
      store.fetchFiles(1, 'createdAt', 'desc')
      store.fetchTags()
    }
  }, [isLoggedIn])

  // Load versions on selection
  useEffect(() => {
    if (fileId && isLoggedIn) {
      setVersionsLoading(true)
      store.getVersions(fileId).then((list) => {
        setVersions(list)
        setVersionsLoading(false)
      })
    } else {
      setVersions([])
    }
  }, [fileId, isLoggedIn])

  // When picker opens, fetch all files (paginated)
  useEffect(() => {
    if (open && isLoggedIn) {
      setPickerPage(1)
      async function load() {
        const all: FileItem[] = []
        let p = 1
        let hasMore = true
        while (hasMore) {
          try {
            // Use the store's fetchFiles with the current page
            const state = useFileStore.getState()
            if (p === 1) {
              all.push(...state.files)
            } else {
              // Fetch more via direct API call
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
  }, [open, isLoggedIn])

  // Resolve file for readOnly mode from remote if not in store
  useEffect(() => {
    if (readOnly && fileId && !resolvedFile) {
      const inStore = files.find(f => f.fileId === fileId)
      if (inStore) {
        setResolvedFile(inStore)
      } else {
        ;(async () => {
          try {
            const { apiClient } = await import('@/lib/api-client')
            const res: any = await apiClient.get(`/file/${fileId}`)
            const data = res.data || res
            if (data && data.fileId) {
              setResolvedFile({
                id: data.id || '',
                fileId: data.fileId,
                tenantId: data.tenantId || '',
                bucket: data.bucket || '',
                objectKey: data.objectKey || '',
                filename: data.filename || '',
                displayName: data.displayName || null,
                mimeType: data.mimeType || '',
                size: data.size || 0,
                currentVersion: data.currentVersion || 1,
                tags: data.tags || [],
                description: data.description || null,
                uploadedBy: data.uploadedBy || null,
                createdAt: data.createdAt || '',
                updatedAt: data.updatedAt || '',
              })
            }
          } catch { /* ignore */ }
        })()
      }
    }
  }, [readOnly, fileId, files])

  // Combined files list
  const displayFiles = open ? (allLoaded.length > 0 ? allLoaded : files) : files

  // Client-side filter for the picker (server search is an option too)
  const filteredFiles = useMemo(() => {
    let result = displayFiles
    if (search) result = result.filter((f) => f.filename.toLowerCase().includes(search.toLowerCase()))
    if (selectedTag) result = result.filter((f) => (f.tags as string[])?.includes(selectedTag))
    return result
  }, [displayFiles, search, selectedTag])

  // Also fetch from server when search changes
  useEffect(() => {
    if (open && search) {
      store.fetchFiles(1, 'createdAt', 'desc')
    }
  }, [search, open])

  const versionLabel = (key: string) => {
    if (!key || key === 'V1') return 'V1（默认）'
    if (key === 'VN') return 'VN（始终最新）'
    return key
  }

  const effectiveFile = resolvedFile || files.find(f => f.fileId === fileId) || null

  if (readOnly) {
    return (
      <div className="h-8 flex items-center rounded-md border border-transparent bg-muted/60 px-2.5 text-sm gap-2">
        <Paperclip className="size-3 text-muted-foreground" />
        {effectiveFile ? (
          <span className="text-xs truncate">
            {displayFileName(effectiveFile)}
            {versionKey && <span className="text-muted-foreground ml-1">· {versionLabel(versionKey)}</span>}
          </span>
        ) : (
          <span className="text-muted-foreground text-xs">—</span>
        )}
      </div>
    )
  }

  return (
    <div>
      <div className="flex items-center gap-2">
        {effectiveFile ? (
          <div className="flex items-center gap-2 flex-1 min-w-0 h-8 px-2.5 rounded-md border bg-muted/30 text-xs">
            <Paperclip className="size-3 text-muted-foreground shrink-0" />
            <span className="truncate flex-1">{displayFileName(effectiveFile)}</span>
            <span className="text-muted-foreground shrink-0">{formatSize(effectiveFile.size)}</span>

            {/* Version selector */}
            <div className="relative">
              <select
                className="appearance-none h-6 pl-1.5 pr-5 rounded border bg-background text-[10px] cursor-pointer focus:outline-none focus:ring-1 focus:ring-primary"
                value={versionKey || 'V1'}
                onChange={(e) => {
                  const vk = e.target.value
                  onChange(buildFileRef(fileId, vk))
                }}
              >
                <option value="V1">V1（默认）</option>
                {versions.map((v) => {
                  if (v.version === 1) return null
                  return <option key={v.versionId} value={`V${v.version}`}>V{v.version}</option>
                })}
                <option value="VN">VN（始终最新）</option>
              </select>
              <ChevronDown className="absolute right-1 top-1/2 -translate-y-1/2 size-3 text-muted-foreground pointer-events-none" />
            </div>

            <button onClick={() => onChange('')} className="shrink-0 hover:text-red-500"><X className="size-3" /></button>
          </div>
        ) : (
          <Button variant="outline" size="sm" onClick={() => setOpen(true)} className="h-8 text-xs">
            <Paperclip className="size-3 mr-1" />选择文件
          </Button>
        )}
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg max-h-[80vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>选择文件</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 flex-1 overflow-hidden flex flex-col">
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
                <Input placeholder="搜索文件…" value={search} onChange={(e) => setSearch(e.target.value)} className="pl-8 h-8 text-xs" />
              </div>
            </div>
            {allTags.length > 0 && (
              <div className="flex gap-1 flex-wrap">
                <Badge variant={!selectedTag ? 'default' : 'outline'} className="text-[10px] cursor-pointer" onClick={() => setSelectedTag('')}>全部</Badge>
                {allTags.map((t) => (
                  <Badge key={t} variant={selectedTag === t ? 'default' : 'outline'} className="text-[10px] cursor-pointer" onClick={() => setSelectedTag(selectedTag === t ? '' : t)}>{t}</Badge>
                ))}
              </div>
            )}
            <div className="flex-1 overflow-auto space-y-1" ref={listRef}>
              {filteredFiles.length === 0 ? (
                <p className="text-xs text-muted-foreground text-center py-8">无匹配文件</p>
              ) : (
                filteredFiles.map((f) => (
                  <button
                    key={f.fileId}
                    onClick={() => {
                      onChange(buildFileRef(f.fileId, ''))
                      setOpen(false)
                    }}
                    className={`w-full flex items-center gap-2 px-3 py-2 rounded-md text-left text-xs transition-colors ${fileId === f.fileId ? 'bg-primary/10 text-primary font-medium' : 'hover:bg-muted'}`}
                  >
                    <FileTypeIcon mimeType={f.mimeType} className="size-4" />
                    <span className="flex-1 truncate">{displayFileName(f)}</span>
                    <Badge variant="secondary" className="text-[9px] h-4 px-1 shrink-0">V{f.currentVersion || 1}</Badge>
                    <span className="text-muted-foreground shrink-0">{formatSize(f.size)}</span>
                    {(f.tags as string[])?.slice(0, 2).map((t) => (
                      <Badge key={t} variant="secondary" className="text-[9px] h-4 px-1">{t}</Badge>
                    ))}
                  </button>
                ))
              )}
            </div>
            <Button variant="outline" size="sm" onClick={() => { setOpen(false); onChange('') }} className="w-full">清除选择</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
