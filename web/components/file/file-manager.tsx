'use client'

import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import { useFileStore, type FileItem, type FileVersionItem } from '@/stores/file-store'
import { useAuthStore } from '@/stores/auth-store'
import { FilePreview } from '@/components/file/file-preview'
import { Pagination } from '@/components/shared/pagination'
import { useMultiSelect, useContextMenu } from '@/lib/use-multi-select'
import { formatSize, FileTypeIcon, downloadFile, displayFileName } from '@/lib/file-utils'
import { useDebounce } from '@/lib/hooks'
import { apiClient as axiosRaw } from '@/lib/api-client'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Upload, Search, X, Download, Trash2, Edit3, RefreshCw, History,
  ChevronDown, Grid3X3, List, Plus, ArrowUpDown, CheckSquare, Square,
  RotateCcw, FileText, ClipboardCopy, Share2,
} from 'lucide-react'

// ===== File Manager =====
export function FileManager() {
  const isLoggedIn = useAuthStore((s) => s.isLoggedIn)
  const token = useAuthStore((s) => s.accessToken)
  const store = useFileStore()
  const { files, total, page, pageSize, loading, search, selectedTags, allTags, uploadProgress } = store

  const [showUpload, setShowUpload] = useState(false)
  const [droppedFile, setDroppedFile] = useState<File | null>(null)
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid')
  const [previewFile, setPreviewFile] = useState<FileItem | null>(null)
  const [dragOver, setDragOver] = useState(false)
  const [focusedIndex, setFocusedIndex] = useState(0)
  const [searchInput, setSearchInput] = useState('')

  // Sort
  const [sortBy, setSortBy] = useState<'filename' | 'size' | 'createdAt' | 'updatedAt'>('createdAt')
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc')

  // Edit dialog
  const [editFile, setEditFile] = useState<FileItem | null>(null)
  const [editName, setEditName] = useState('')
  const [editTags, setEditTags] = useState('')
  const [editDesc, setEditDesc] = useState('')

  // Delete confirmation dialog
  const [deleteTarget, setDeleteTarget] = useState<FileItem | null>(null)
  const [deleteIds, setDeleteIds] = useState<string[]>([])

  // Batch tag dialog
  const [batchTagTargets, setBatchTagTargets] = useState<string[]>([])
  const [batchTags, setBatchTags] = useState('')

  // Version dialog
  const [versionsFile, setVersionsFile] = useState<FileItem | null>(null)
  const [versions, setVersions] = useState<FileVersionItem[]>([])
  const [versionsLoading, setVersionsLoading] = useState(false)

  // Multi-select
  const { selected, toggle, selectAll, clearSelection, isAllSelected, setSelected } = useMultiSelect(files)
  const { menu, open: openContextMenu, close: closeContextMenu } = useContextMenu()

  // Multi-select mode toggle
  const [multiSelectMode, setMultiSelectMode] = useState(false)

  // Debounced search
  const debouncedSearch = useDebounce(searchInput, 400)

  useEffect(() => {
    if (isLoggedIn) {
      store.fetchFiles(1, sortBy, sortOrder)
      store.fetchTags()
    }
  }, [isLoggedIn])

  useEffect(() => {
    if (isLoggedIn) {
      store.setSearch(debouncedSearch)
      store.fetchFiles(1, sortBy, sortOrder)
    }
  }, [debouncedSearch])

  const totalPages = Math.max(1, Math.ceil(total / pageSize))

  // ===== Keyboard navigation =====
  const gridRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!gridRef.current) return
    const handler = (e: KeyboardEvent) => {
      // Only if dialogs aren't open
      if (previewFile || editFile || deleteTarget || showUpload) return

      const cols = viewMode === 'grid' ? 6 : 1
      const maxIdx = files.length - 1

      switch (e.key) {
        case 'ArrowRight': e.preventDefault(); setFocusedIndex(i => Math.min(i + 1, maxIdx)); break
        case 'ArrowLeft': e.preventDefault(); setFocusedIndex(i => Math.max(i - 1, 0)); break
        case 'ArrowDown': e.preventDefault(); setFocusedIndex(i => Math.min(i + cols, maxIdx)); break
        case 'ArrowUp': e.preventDefault(); setFocusedIndex(i => Math.max(i - cols, 0)); break
        case 'Enter':
          if (files[focusedIndex]) {
            e.preventDefault()
            setPreviewFile(files[focusedIndex])
          }
          break
        case 'Delete':
        case 'Backspace':
          e.preventDefault()
          if (multiSelectMode && selected.size > 0) {
            setDeleteIds(Array.from(selected))
            setDeleteTarget(null)
          } else if (files[focusedIndex]) {
            setDeleteTarget(files[focusedIndex])
            setDeleteIds([])
          }
          break
        case 'Escape':
          if (multiSelectMode) { clearSelection(); setMultiSelectMode(false) }
          else clearSelection()
          break
        case 'a':
          if ((e.ctrlKey || e.metaKey) && multiSelectMode) { e.preventDefault(); selectAll() }
          break
      }
    }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [files, focusedIndex, viewMode, selected, previewFile, editFile, deleteTarget, showUpload, multiSelectMode])

  // ===== Drag-and-drop on main area =====
  const handleMainDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'copy'
    setDragOver(true)
  }

  const handleMainDragLeave = (e: React.DragEvent) => {
    if (e.currentTarget === e.target) setDragOver(false)
  }

  const handleMainDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setDragOver(false)
    const file = e.dataTransfer.files[0]
    if (file) {
      setDroppedFile(file)
      setShowUpload(true)
    }
  }

  // ===== Actions =====
  const handleDownload = useCallback(async (f: FileItem) => {
    const url = await store.getDownloadUrl(f.fileId)
    if (url) downloadFile(url, displayFileName(f))
  }, [store])

  const handleVersionDownload = useCallback(async (f: FileItem, version: number) => {
    const url = await store.getVersionDownloadUrl(f.fileId, version)
    if (url) downloadFile(url, `V${version}_${displayFileName(f)}`)
  }, [store])

  const handleConfirmDelete = async () => {
    const ids = deleteTarget ? [deleteTarget.fileId] : deleteIds
    for (const id of ids) await store.deleteFile(id)
    setDeleteTarget(null)
    setDeleteIds([])
    clearSelection()
  }

  const openEdit = (f: FileItem) => {
    setEditFile(f)
    setEditName(displayFileName(f))
    setEditTags((f.tags || []).join(', '))
    setEditDesc(f.description || '')
  }

  const handleEdit = async () => {
    if (!editFile) return
    const name = editName.trim() || null
    const tags = editTags.split(',').map((t) => t.trim()).filter(Boolean)
    const desc = editDesc.trim() || undefined

    // If name changed, use rename endpoint
    if (name && name !== displayFileName(editFile)) {
      await store.renameFile(editFile.fileId, name)
    }
    await store.updateFile(editFile.fileId, { tags, description: desc })
    setEditFile(null)
    clearSelection()
  }

  const handleBatchTag = async () => {
    const tags = batchTags.split(',').map((t) => t.trim()).filter(Boolean)
    for (const id of batchTagTargets) {
      await store.updateFile(id, { tags })
    }
    await store.fetchFiles(page, sortBy, sortOrder)
    await store.fetchTags()
    setBatchTagTargets([])
    setBatchTags('')
    clearSelection()
  }

  const openVersions = async (f: FileItem) => {
    setVersionsFile(f)
    setVersionsLoading(true)
    const list = await store.getVersions(f.fileId)
    setVersions(list)
    setVersionsLoading(false)
  }

  const handleUploadNewVersion = async (file: File) => {
    if (!versionsFile) return false
    const ok = await store.uploadNewVersion(versionsFile.fileId, file)
    if (ok) {
      const list = await store.getVersions(versionsFile.fileId)
      setVersions(list)
      await store.fetchFiles(page, sortBy, sortOrder)
    }
    return ok
  }

  const handleSort = (field: 'filename' | 'size' | 'createdAt' | 'updatedAt') => {
    if (sortBy === field) {
      const next = sortOrder === 'asc' ? 'desc' : 'asc'
      setSortOrder(next)
      store.fetchFiles(1, field, next)
    } else {
      setSortBy(field)
      setSortOrder('asc')
      store.fetchFiles(1, field, 'asc')
    }
  }

  const toggleTag = (tag: string) => {
    const next = selectedTags.includes(tag)
      ? selectedTags.filter((t) => t !== tag)
      : [...selectedTags, tag]
    store.setSelectedTags(next)
    store.fetchFiles(1, sortBy, sortOrder)
  }

  if (!isLoggedIn) return null

  const sortOptions: { key: typeof sortBy; label: string }[] = [
    { key: 'createdAt', label: '时间' },
    { key: 'filename', label: '名称' },
    { key: 'size', label: '大小' },
    { key: 'updatedAt', label: '修改' },
  ]

  const contextFile = menu ? files.find(f => f.fileId === menu.fileId) : null

  return (
    <Card className="shadow-sm">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {/*<CardTitle className="text-base">文件管理</CardTitle>*/}
            {selected.size > 0 && (
              <Badge variant="default" className="text-[10px]">
                已选 {selected.size} 项
              </Badge>
            )}
          </div>
          <div className="flex items-center gap-2">
            {/* Sort dropdown */}
            <div className="flex items-center gap-1 text-xs bg-muted/50 rounded-lg p-0.5">
              {sortOptions.map((opt) => (
                <button
                  key={opt.key}
                  onClick={() => handleSort(opt.key)}
                  className={`px-2 py-1 rounded-md transition-colors flex items-center gap-0.5 ${
                    sortBy === opt.key
                      ? 'bg-background shadow-sm font-medium text-foreground'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  {opt.label}
                  {sortBy === opt.key && (
                    <span className="text-[9px]">{sortOrder === 'asc' ? '↑' : '↓'}</span>
                  )}
                </button>
              ))}
            </div>

            <Button variant="outline" size="icon-sm" onClick={() => { viewMode === 'grid' ? setViewMode('list') : setViewMode('grid') }} title={viewMode === 'grid' ? '列表视图' : '网格视图'}>
              {viewMode === 'grid' ? <List className="size-3.5" /> : <Grid3X3 className="size-3.5" />}
            </Button>
            <Button variant="ghost" size="icon-sm" onClick={() => { setMultiSelectMode(m => !m); if (multiSelectMode) clearSelection() }} title={multiSelectMode ? '退出多选' : '多选模式'}>
              <CheckSquare className={`size-3.5 ${multiSelectMode ? 'text-primary' : ''}`} />
            </Button>
            <Button variant="outline" size="sm" onClick={() => { store.fetchFiles(page, sortBy, sortOrder); store.fetchTags() }} disabled={loading}>
              <RefreshCw className="size-3.5 mr-1" />刷新
            </Button>

            {selected.size > 0 && multiSelectMode ? (
              <>
                <Button variant="outline" size="sm" onClick={() => { setBatchTagTargets(Array.from(selected)); setBatchTags('') }}>
                  <Edit3 className="size-3.5 mr-1" />批量标签
                </Button>
                <Button variant="destructive" size="sm" onClick={() => { setDeleteIds(Array.from(selected)); setDeleteTarget(null) }}>
                  <Trash2 className="size-3.5 mr-1" />批量删除
                </Button>
              </>
            ) : (
              <Button size="sm" onClick={() => { setDroppedFile(null); setShowUpload(true) }}>
                <Upload className="size-3.5 mr-1" />上传文件
              </Button>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-3" onDragOver={handleMainDragOver} onDragLeave={handleMainDragLeave} onDrop={handleMainDrop}>
        {/* Drag overlay */}
        {dragOver && (
          <div className="absolute inset-0 z-10 flex items-center justify-center bg-primary/5 border-2 border-dashed border-primary rounded-lg pointer-events-none">
            <div className="text-center bg-background/80 rounded-xl p-6 shadow-lg">
              <Upload className="size-10 mx-auto mb-2 text-primary" />
              <p className="text-sm font-medium">释放文件以上传</p>
            </div>
          </div>
        )}

        {/* Search & Tags */}
        <div className="flex items-center gap-2 flex-wrap">
          <div className="relative flex-1 min-w-48 max-w-sm">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
            <Input
              placeholder="搜索文件名…"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              className="pl-8 h-8 text-xs"
            />
            {searchInput && (
              <button onClick={() => setSearchInput('')} className="absolute right-2 top-1/2 -translate-y-1/2">
                <X className="size-3 text-muted-foreground" />
              </button>
            )}
          </div>
          {allTags.length > 0 && (
            <div className="flex items-center gap-1 flex-wrap">
              {allTags.map((tag) => (
                <Badge
                  key={tag}
                  variant={selectedTags.includes(tag) ? 'default' : 'outline'}
                  className="text-[10px] h-5 px-1.5 cursor-pointer hover:opacity-80"
                  onClick={() => toggleTag(tag)}
                >
                  {tag}
                </Badge>
              ))}
              {selectedTags.length > 0 && (
                <button onClick={() => { store.setSelectedTags([]); store.fetchFiles(1, sortBy, sortOrder) }} className="text-[10px] text-muted-foreground hover:text-foreground">
                  <X className="size-3 inline" /> 清除
                </button>
              )}
            </div>
          )}
        </div>

        {/* Select all checkbox — only visible in multiSelectMode */}
        {multiSelectMode && files.length > 0 && (
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <label className="flex items-center gap-1 cursor-pointer select-none">
              <input type="checkbox" checked={isAllSelected} onChange={() => isAllSelected ? clearSelection() : selectAll()} className="size-3.5" />
              全选
            </label>
            {selected.size > 0 && (
              <span className="text-primary cursor-pointer" onClick={clearSelection}>取消选择</span>
            )}
          </div>
        )}

        {/* File Grid/List */}
        <div ref={gridRef}>
          {loading && files.length === 0 ? (
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="rounded-lg border p-3 space-y-2">
                  <Skeleton className="h-24 w-full rounded-md" />
                  <Skeleton className="h-3 w-3/4" />
                  <Skeleton className="h-2 w-1/2" />
                </div>
              ))}
            </div>
          ) : files.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
              <Upload className="size-12 mb-3 opacity-20" />
              <p className="text-sm font-medium">暂无文件</p>
              <p className="text-xs mt-1">拖拽文件到此处或点击「上传文件」</p>
            </div>
          ) : viewMode === 'grid' ? (
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
              {files.map((f, idx) => (
                <div
                  key={f.fileId}
                  className={`group relative flex flex-col rounded-lg border bg-card p-3 transition-all cursor-pointer
                    ${selected.has(f.fileId) ? 'ring-2 ring-primary bg-primary/5' : 'hover:shadow-md'}
                    ${idx === focusedIndex ? 'ring-2 ring-ring' : ''}`}
                  onClick={(e) => multiSelectMode ? toggle(f.fileId, e.metaKey || e.ctrlKey, e.shiftKey) : setPreviewFile(f)}
                  onDoubleClick={() => setPreviewFile(f)}
                  onContextMenu={(e) => openContextMenu(e, f.fileId)}
                  tabIndex={-1}
                >
                  <div className="flex items-center justify-center h-24 mb-2 rounded-md bg-muted/50 overflow-hidden relative">
                    {f.mimeType.startsWith('image/') && token ? (
                      <>
                        <FileTypeIcon mimeType={f.mimeType} filename={f.filename} className="size-8 opacity-20" />
                        <img
                          src={`${process.env.NEXT_PUBLIC_API_URL || 'http://192.168.1.23:3001/api'}/file/${f.fileId}/thumbnail?w=200&_token=${token}`}
                          alt={displayFileName(f)}
                          className="absolute inset-0 max-h-full max-w-full object-contain m-auto p-1"
                          loading="lazy"
                          onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }}
                        />
                      </>
                    ) : (
                      <FileTypeIcon mimeType={f.mimeType} filename={f.filename} className="size-10" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1">
                      <p className="text-xs font-medium truncate flex-1" title={displayFileName(f)}>
                        {displayFileName(f)}
                      </p>
                      <Badge variant="secondary" className="text-[9px] h-4 px-1 shrink-0">V{f.currentVersion || 1}</Badge>
                    </div>
                    <p className="text-[10px] text-muted-foreground mt-0.5">{formatSize(f.size)}</p>
                    {(f.tags as string[])?.length > 0 && (
                      <div className="flex flex-wrap gap-0.5 mt-1">
                        {(f.tags as string[]).slice(0, 3).map((t) => (
                          <Badge key={t} variant="secondary" className="text-[9px] h-4 px-1">{t}</Badge>
                        ))}
                      </div>
                    )}
                  </div>
                  {/* Checkbox — only visible in multiSelectMode */}
                  {multiSelectMode && (
                    <div className="absolute top-1 left-1">
                      <input
                        type="checkbox"
                        checked={selected.has(f.fileId)}
                        onChange={(e) => { e.stopPropagation(); toggle(f.fileId, false, false) }}
                        onClick={(e) => e.stopPropagation()}
                        className="size-3.5 cursor-pointer"
                      />
                    </div>
                  )}
                  <div className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 transition-opacity flex gap-0.5">
                    <Button variant="ghost" size="icon-xs" className="size-6" onClick={(e) => { e.stopPropagation(); openVersions(f) }} title="版本"><History className="size-3" /></Button>
                    <Button variant="ghost" size="icon-xs" className="size-6" onClick={(e) => { e.stopPropagation(); openEdit(f) }} title="编辑"><Edit3 className="size-3" /></Button>
                    <Button variant="ghost" size="icon-xs" className="size-6" onClick={(e) => { e.stopPropagation(); handleDownload(f) }} title="下载"><Download className="size-3" /></Button>
                    <Button variant="ghost" size="icon-xs" className="size-6" onClick={(e) => { e.stopPropagation(); setDeleteTarget(f) }} title="删除"><Trash2 className="size-3" /></Button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="border rounded-lg overflow-hidden">
              {/* Header — desktop only */}
              <div className="hidden md:flex items-center gap-3 px-4 py-2 bg-muted/50 text-xs font-medium text-muted-foreground">
                {multiSelectMode && (
                  <input type="checkbox" checked={isAllSelected} onChange={() => isAllSelected ? clearSelection() : selectAll()} className="size-3.5 shrink-0" />
                )}
                <span className="flex-1 min-w-0">文件名</span>
                <span className="w-16 text-right shrink-0">大小</span>
                <span className="w-10 text-center shrink-0">版本</span>
                <span className="w-24 text-right shrink-0">日期</span>
                <span className="w-[112px] shrink-0" />
              </div>
              {files.map((f, idx) => (
                <div
                  key={f.fileId}
                  className={`flex flex-col md:flex-row md:items-center gap-1 px-4 py-2.5 border-t last:border-0 text-xs cursor-pointer transition-colors
                    ${selected.has(f.fileId) ? 'bg-primary/5' : 'hover:bg-muted/30'}
                    ${idx === focusedIndex ? 'ring-2 ring-ring ring-inset' : ''}`}
                  onClick={(e) => multiSelectMode ? toggle(f.fileId, e.metaKey || e.ctrlKey, e.shiftKey) : setPreviewFile(f)}
                  onDoubleClick={() => setPreviewFile(f)}
                  onContextMenu={(e) => openContextMenu(e, f.fileId)}
                >
                  {/* Main row */}
                  <div className="flex items-center gap-2 min-w-0">
                    {multiSelectMode && (
                      <input type="checkbox" checked={selected.has(f.fileId)}
                        onChange={(e) => { e.stopPropagation(); toggle(f.fileId, false, false) }}
                        onClick={(e) => e.stopPropagation()} className="size-3.5 shrink-0" />
                    )}
                    <FileTypeIcon mimeType={f.mimeType} className="size-5 shrink-0" />
                    <span className="flex-1 truncate font-medium min-w-0">{displayFileName(f)}</span>
                    {/* Desktop: meta columns pushed to the right */}
                    <span className="hidden md:inline w-16 text-right text-muted-foreground shrink-0 tabular-nums">{formatSize(f.size)}</span>
                    <Badge variant="secondary" className="hidden md:inline-flex text-[9px] h-4 px-1 shrink-0 w-10 justify-center">V{f.currentVersion || 1}</Badge>
                    <span className="hidden md:inline w-24 text-right text-muted-foreground shrink-0 tabular-nums">
                      {new Date(f.createdAt).toLocaleDateString('zh-CN')}
                    </span>
                    <div className="hidden md:flex gap-0.5 w-[112px] justify-end shrink-0">
                      <Button variant="ghost" size="icon-xs" className="size-6" onClick={(e) => { e.stopPropagation(); openVersions(f) }} title="版本"><History className="size-3" /></Button>
                      <Button variant="ghost" size="icon-xs" className="size-6" onClick={(e) => { e.stopPropagation(); openEdit(f) }} title="编辑"><Edit3 className="size-3" /></Button>
                      <Button variant="ghost" size="icon-xs" className="size-6" onClick={(e) => { e.stopPropagation(); handleDownload(f) }} title="下载"><Download className="size-3" /></Button>
                      <Button variant="ghost" size="icon-xs" className="size-6" onClick={(e) => { e.stopPropagation(); setDeleteTarget(f) }} title="删除"><Trash2 className="size-3" /></Button>
                    </div>
                  </div>
                  {/* Mobile: meta + actions below filename */}
                  <div className="flex md:hidden items-center gap-2 text-muted-foreground">
                    <span className="tabular-nums">{formatSize(f.size)}</span>
                    <span className="opacity-40">·</span>
                    <Badge variant="secondary" className="text-[9px] h-4 px-1">V{f.currentVersion || 1}</Badge>
                    <span className="opacity-40">·</span>
                    <span className="tabular-nums">{new Date(f.createdAt).toLocaleDateString('zh-CN')}</span>
                    <div className="flex-1" />
                    <div className="flex gap-0.5">
                      <Button variant="ghost" size="icon-xs" className="size-6" onClick={(e) => { e.stopPropagation(); openVersions(f) }}><History className="size-3" /></Button>
                      <Button variant="ghost" size="icon-xs" className="size-6" onClick={(e) => { e.stopPropagation(); openEdit(f) }}><Edit3 className="size-3" /></Button>
                      <Button variant="ghost" size="icon-xs" className="size-6" onClick={(e) => { e.stopPropagation(); handleDownload(f) }}><Download className="size-3" /></Button>
                      <Button variant="ghost" size="icon-xs" className="size-6" onClick={(e) => { e.stopPropagation(); setDeleteTarget(f) }}><Trash2 className="size-3" /></Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Pagination */}
        <Pagination page={page} totalPages={totalPages} total={total} onPageChange={(p) => store.fetchFiles(p, sortBy, sortOrder)} disabled={loading} />

        {/* Context Menu */}
        {menu && contextFile && (
          <div
            className="fixed z-50 w-48 rounded-lg border bg-popover shadow-lg py-1 text-xs"
            style={{ left: menu.x, top: menu.y }}
            onClick={(e) => e.stopPropagation()}
          >
            <button className="w-full flex items-center gap-2 px-3 py-1.5 hover:bg-muted text-left" onClick={() => { closeContextMenu(); setPreviewFile(contextFile) }}>
              <FileText className="size-3.5" />预览
            </button>
            <button className="w-full flex items-center gap-2 px-3 py-1.5 hover:bg-muted text-left" onClick={() => { closeContextMenu(); handleDownload(contextFile) }}>
              <Download className="size-3.5" />下载
            </button>
            <button className="w-full flex items-center gap-2 px-3 py-1.5 hover:bg-muted text-left" onClick={() => { closeContextMenu(); openEdit(contextFile) }}>
              <Edit3 className="size-3.5" />重命名 / 标签
            </button>
            <button className="w-full flex items-center gap-2 px-3 py-1.5 hover:bg-muted text-left" onClick={() => { closeContextMenu(); openVersions(contextFile) }}>
              <History className="size-3.5" />版本历史
            </button>
            <button className="w-full flex items-center gap-2 px-3 py-1.5 hover:bg-muted text-left" onClick={() => {
              closeContextMenu()
              navigator.clipboard.writeText(contextFile.fileId)
            }}>
              <ClipboardCopy className="size-3.5" />复制 fileId
            </button>
            <hr className="my-1 border-t" />
            <button className="w-full flex items-center gap-2 px-3 py-1.5 hover:bg-destructive/10 text-destructive text-left" onClick={() => { closeContextMenu(); setDeleteTarget(contextFile) }}>
              <Trash2 className="size-3.5" />删除
            </button>
          </div>
        )}
      </CardContent>

      {/* Upload Dialog */}
      <UploadDialog
        open={showUpload}
        onOpenChange={setShowUpload}
        droppedFile={droppedFile}
        uploadProgress={uploadProgress}
        onUploaded={() => store.fetchFiles(1, sortBy, sortOrder)}
      />

      {/* Preview Dialog */}
      <FilePreview file={previewFile} onClose={() => setPreviewFile(null)} />

      {/* Edit Dialog */}
      <Dialog open={!!editFile} onOpenChange={() => setEditFile(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>编辑文件 — {editFile && displayFileName(editFile)}</DialogTitle>
            <DialogDescription>修改文件名、标签和描述</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="grid gap-1.5">
              <label className="text-xs font-medium">文件名</label>
              <Input value={editName} onChange={(e) => setEditName(e.target.value)} placeholder="文件显示名称" />
            </div>
            <div className="grid gap-1.5">
              <label className="text-xs font-medium">标签（逗号分隔）</label>
              <Input value={editTags} onChange={(e) => setEditTags(e.target.value)} placeholder="合同, 技术图纸" />
            </div>
            <div className="grid gap-1.5">
              <label className="text-xs font-medium">描述</label>
              <Input value={editDesc} onChange={(e) => setEditDesc(e.target.value)} placeholder="文件描述（选填）" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditFile(null)}>取消</Button>
            <Button onClick={handleEdit}>保存</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={!!deleteTarget || deleteIds.length > 0} onOpenChange={() => { setDeleteTarget(null); setDeleteIds([]) }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>确认删除</DialogTitle>
            <DialogDescription>
              {deleteTarget
                ? `确定要删除「${displayFileName(deleteTarget)}」吗？文件将移入回收站，可随时恢复。`
                : `确定要删除选中的 ${deleteIds.length} 个文件吗？文件将移入回收站，可随时恢复。`}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setDeleteTarget(null); setDeleteIds([]) }}>取消</Button>
            <Button variant="destructive" onClick={handleConfirmDelete}><Trash2 className="size-3.5 mr-1" />确认删除</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Batch Tag Dialog */}
      <Dialog open={batchTagTargets.length > 0} onOpenChange={() => setBatchTagTargets([])}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>批量编辑标签</DialogTitle>
            <DialogDescription>为选中的 {batchTagTargets.length} 个文件设置标签</DialogDescription>
          </DialogHeader>
          <div className="grid gap-1.5">
            <label className="text-xs font-medium">标签（逗号分隔，将覆盖原有标签）</label>
            <Input value={batchTags} onChange={(e) => setBatchTags(e.target.value)} placeholder="合同, 技术图纸" />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setBatchTagTargets([])}>取消</Button>
            <Button onClick={handleBatchTag}>应用</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Version History Dialog */}
      <VersionDialog
        file={versionsFile}
        versions={versions}
        loading={versionsLoading}
        onClose={() => { setVersionsFile(null); setVersions([]) }}
        onDownload={(v) => versionsFile && handleVersionDownload(versionsFile, v)}
        onUploadNew={(file) => handleUploadNewVersion(file)}
      />
    </Card>
  )
}

// ===== Upload Dialog =====
function UploadDialog({ open, onOpenChange, droppedFile, uploadProgress, onUploaded }: {
  open: boolean
  onOpenChange: (v: boolean) => void
  droppedFile: File | null
  uploadProgress: number | null
  onUploaded: () => void
}) {
  const store = useFileStore()
  const [dragOver, setDragOver] = useState(false)
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [customName, setCustomName] = useState('')
  const [tags, setTags] = useState('')
  const [desc, setDesc] = useState('')
  const [uploading, setUploading] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (droppedFile) {
      setSelectedFile(droppedFile)
      setCustomName(droppedFile.name)
    }
  }, [droppedFile])

  useEffect(() => {
    if (open && selectedFile && !customName) {
      setCustomName(selectedFile.name)
    }
  }, [open])

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setDragOver(false)
    const file = e.dataTransfer.files[0]
    if (file) { setSelectedFile(file); setCustomName(file.name) }
  }

  const handleUpload = async () => {
    if (!selectedFile) return
    setUploading(true)
    const tagList = tags.split(',').map((t) => t.trim()).filter(Boolean)
    const displayName = customName.trim() || selectedFile.name
    const ok = await store.uploadFile(selectedFile, tagList, desc.trim() || undefined, displayName)
    setUploading(false)
    if (ok) {
      setSelectedFile(null); setCustomName(''); setTags(''); setDesc(''); onOpenChange(false)
      store.fetchTags()
      onUploaded()
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>上传文件</DialogTitle>
          <DialogDescription>支持任意文件类型，最大 5GB</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div
            className={`flex flex-col items-center justify-center border-2 border-dashed rounded-lg p-8 transition-colors cursor-pointer ${dragOver ? 'border-primary bg-primary/5' : 'border-muted-foreground/25 hover:border-primary/50'} ${selectedFile ? 'border-green-500 bg-green-50 dark:bg-green-950/20' : ''}`}
            onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
            onDragLeave={() => setDragOver(false)}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
          >
            {selectedFile ? (
              <div className="text-center">
                <FileText className="size-10 mx-auto mb-2 text-green-600" />
                <p className="text-sm font-medium">{selectedFile.name}</p>
                <p className="text-xs text-muted-foreground">{formatSize(selectedFile.size)}</p>
              </div>
            ) : (
              <div className="text-center">
                <Upload className="size-10 mx-auto mb-2 text-muted-foreground" />
                <p className="text-sm">拖拽文件到此处或点击选择</p>
                <p className="text-xs text-muted-foreground mt-1">最大 5GB</p>
              </div>
            )}
            <input ref={fileInputRef} type="file" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) { setSelectedFile(f); setCustomName(f.name) } }} />
          </div>
          <div className="grid gap-1.5">
            <label className="text-xs font-medium">文件名</label>
            <Input value={customName} onChange={(e) => setCustomName(e.target.value)} placeholder="自定义文件名（可选）" />
          </div>
          <div className="grid gap-1.5">
            <label className="text-xs font-medium">标签（逗号分隔）</label>
            <Input value={tags} onChange={(e) => setTags(e.target.value)} placeholder="合同, 技术图纸" />
          </div>
          <div className="grid gap-1.5">
            <label className="text-xs font-medium">描述</label>
            <Input value={desc} onChange={(e) => setDesc(e.target.value)} placeholder="文件描述（选填）" />
          </div>
          {uploadProgress !== null && (
            <div className="space-y-1">
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>上传中…</span>
                <span>{uploadProgress}%</span>
              </div>
              <Progress value={uploadProgress} className="h-1.5" />
            </div>
          )}
        </div>
        {store.error && (
          <div className="rounded-md bg-destructive/10 px-3 py-2 text-xs text-destructive">{store.error}</div>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>取消</Button>
          <Button onClick={handleUpload} disabled={!selectedFile || uploading}>
            {uploading ? '上传中…' : '上传'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ===== Version Dialog =====
function VersionDialog({
  file, versions, loading, onClose, onDownload, onUploadNew,
}: {
  file: FileItem | null
  versions: FileVersionItem[]
  loading: boolean
  onClose: () => void
  onDownload: (version: number) => void
  onUploadNew: (file: File) => Promise<boolean>
}) {
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [customName, setCustomName] = useState('')
  const [uploading, setUploading] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleUpload = async () => {
    if (!selectedFile) return
    setUploading(true)
    const ok = await onUploadNew(selectedFile)
    setUploading(false)
    if (ok) { setSelectedFile(null); setCustomName('') }
  }

  if (!file) return null

  return (
    <Dialog open={!!file} onOpenChange={onClose}>
      <DialogContent className="max-w-lg max-h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            版本历史 — {displayFileName(file)}
            <Badge variant="secondary" className="text-[10px]">V{file.currentVersion || 1}</Badge>
          </DialogTitle>
          <DialogDescription>查看历史版本或上传新版本</DialogDescription>
        </DialogHeader>
        <div className="flex-1 overflow-auto space-y-3">
          {/* Upload new version */}
          <div className="rounded-lg border p-3 bg-muted/30">
            <p className="text-xs font-medium mb-2">上传新版本</p>
            <div className="flex items-center gap-2">
              {selectedFile ? (
                <div className="flex-1 flex items-center gap-2 text-xs">
                  <FileText className="size-4 text-green-600" />
                  <span className="truncate flex-1">{selectedFile.name}</span>
                  <span className="text-muted-foreground shrink-0">{formatSize(selectedFile.size)}</span>
                  <button onClick={() => setSelectedFile(null)} className="shrink-0 hover:text-red-500"><X className="size-3" /></button>
                </div>
              ) : (
                <Button variant="outline" size="sm" onClick={() => fileInputRef.current?.click()} className="text-xs h-7">
                  <Plus className="size-3 mr-1" />选择文件
                </Button>
              )}
              <input ref={fileInputRef} type="file" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) setSelectedFile(f) }} />
              <Button size="sm" onClick={handleUpload} disabled={!selectedFile || uploading} className="text-xs h-7">
                {uploading ? '上传中…' : '上传'}
              </Button>
            </div>
          </div>

          {/* Version list */}
          <p className="text-xs font-medium text-muted-foreground">历史版本</p>
          {loading ? (
            <div className="space-y-2">
              {[1, 2, 3].map((i) => <Skeleton key={i} className="h-12 w-full rounded-lg" />)}
            </div>
          ) : versions.length === 0 ? (
            <p className="text-xs text-muted-foreground text-center py-4">暂无版本记录</p>
          ) : (
            <div className="space-y-1.5">
              {versions.map((v, idx) => (
                <div
                  key={v.versionId}
                  className={`flex items-center gap-3 px-3 py-2 rounded-lg border text-xs ${idx === 0 ? 'bg-primary/5 border-primary/30' : 'bg-card'}`}
                >
                  <div className="shrink-0 flex items-center justify-center size-8 rounded-full bg-muted font-semibold text-[10px]">
                    V{v.version}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium truncate">{v.filename}</p>
                    <p className="text-[10px] text-muted-foreground">
                      {formatSize(v.size)} · {new Date(v.createdAt).toLocaleString('zh-CN')}
                      {idx === 0 && <span className="ml-1 text-primary font-medium">（当前）</span>}
                    </p>
                  </div>
                  <Button variant="ghost" size="icon-xs" className="size-7" onClick={() => onDownload(v.version)} title="下载此版本">
                    <Download className="size-3.5" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>关闭</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
