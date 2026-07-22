'use client'

import { useState, useEffect, useRef } from 'react'
import { useFileStore, type FileItem } from '@/stores/file-store'
import { useAuthStore } from '@/stores/auth-store'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { DialogFooter } from '@/components/ui/dialog'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Upload, Search, X, Download, Trash2, Tag, FileText, Image, File,
  ChevronLeft, ChevronRight, Grid3X3, List, Plus, RefreshCw,
} from 'lucide-react'

// ===== Helpers =====
function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function isImage(mimeType: string): boolean {
  return mimeType.startsWith('image/')
}

function fileIcon(mimeType: string) {
  if (mimeType.startsWith('image/')) return <Image className="size-6 text-blue-500" />
  if (mimeType.includes('pdf')) return <FileText className="size-6 text-red-500" />
  if (mimeType.startsWith('text/')) return <FileText className="size-6 text-green-500" />
  return <File className="size-6 text-muted-foreground" />
}

// ===== File Manager =====
export function FileManager() {
  const isLoggedIn = useAuthStore((s) => s.isLoggedIn)
  const store = useFileStore()
  const { files, total, page, pageSize, loading, search, selectedTags, allTags } = store

  const [showUpload, setShowUpload] = useState(false)
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid')
  const [previewFile, setPreviewFile] = useState<FileItem | null>(null)
  const [editFile, setEditFile] = useState<FileItem | null>(null)
  const [editTags, setEditTags] = useState('')
  const [editDesc, setEditDesc] = useState('')
  const [searchInput, setSearchInput] = useState('')
  const searchTimer = useRef<ReturnType<typeof setTimeout>>(undefined)

  useEffect(() => {
    if (isLoggedIn) {
      store.fetchFiles(1)
      store.fetchTags()
    }
  }, [isLoggedIn])

  const handleSearch = (value: string) => {
    setSearchInput(value)
    clearTimeout(searchTimer.current)
    searchTimer.current = setTimeout(() => {
      store.setSearch(value)
      store.fetchFiles(1)
    }, 400)
  }

  const toggleTag = (tag: string) => {
    const next = selectedTags.includes(tag)
      ? selectedTags.filter((t) => t !== tag)
      : [...selectedTags, tag]
    store.setSelectedTags(next)
    store.fetchFiles(1)
  }

  const totalPages = Math.max(1, Math.ceil(total / pageSize))

  const openEdit = (f: FileItem) => {
    setEditFile(f)
    setEditTags((f.tags || []).join(', '))
    setEditDesc(f.description || '')
  }

  const handleEdit = async () => {
    if (!editFile) return
    const tags = editTags.split(',').map((t) => t.trim()).filter(Boolean)
    await store.updateFile(editFile.fileId, { tags, description: editDesc.trim() || undefined })
    setEditFile(null)
  }

  const handleDelete = async (fileId: string) => {
    if (!confirm('确定要删除此文件吗？')) return
    await store.deleteFile(fileId)
  }

  const handleDownload = (f: FileItem) => {
    window.open(store.getDownloadUrl(f.fileId), '_blank')
  }

  if (!isLoggedIn) return null

  const FileCard = ({ f }: { f: FileItem }) => (
    <div
      className="group relative flex flex-col rounded-lg border bg-card p-3 hover:shadow-md transition-all cursor-pointer"
      onClick={() => isImage(f.mimeType) ? setPreviewFile(f) : handleDownload(f)}
    >
      <div className="flex items-center justify-center h-24 mb-2 rounded-md bg-muted/50 overflow-hidden">
        {isImage(f.mimeType) ? (
          <img
            src={store.getDownloadUrl(f.fileId)}
            alt={f.filename}
            className="max-h-full max-w-full object-contain"
            loading="lazy"
            onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }}
          />
        ) : (
          fileIcon(f.mimeType)
        )}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-xs font-medium truncate" title={f.filename}>{f.filename}</p>
        <p className="text-[10px] text-muted-foreground mt-0.5">{formatSize(f.size)}</p>
        {(f.tags as string[])?.length > 0 && (
          <div className="flex flex-wrap gap-0.5 mt-1">
            {(f.tags as string[]).slice(0, 3).map((t) => (
              <Badge key={t} variant="secondary" className="text-[9px] h-4 px-1">{t}</Badge>
            ))}
          </div>
        )}
      </div>
      <div className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 transition-opacity flex gap-0.5">
        <Button variant="ghost" size="icon-xs" className="size-6" onClick={(e) => { e.stopPropagation(); openEdit(f) }} title="编辑"><Tag className="size-3" /></Button>
        <Button variant="ghost" size="icon-xs" className="size-6" onClick={(e) => { e.stopPropagation(); handleDownload(f) }} title="下载"><Download className="size-3" /></Button>
        <Button variant="ghost" size="icon-xs" className="size-6" onClick={(e) => { e.stopPropagation(); handleDelete(f.fileId) }} title="删除"><Trash2 className="size-3" /></Button>
      </div>
    </div>
  )

  return (
    <Card className="shadow-sm">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base">文件管理</CardTitle>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="icon-sm" onClick={() => { viewMode === 'grid' ? setViewMode('list') : setViewMode('grid') }} title={viewMode === 'grid' ? '列表视图' : '网格视图'}>
              {viewMode === 'grid' ? <List className="size-3.5" /> : <Grid3X3 className="size-3.5" />}
            </Button>
            <Button variant="outline" size="sm" onClick={() => { store.fetchFiles(); store.fetchTags() }} disabled={loading}>
              <RefreshCw className="size-3.5 mr-1" />刷新
            </Button>
            <Button size="sm" onClick={() => setShowUpload(true)}>
              <Upload className="size-3.5 mr-1" />上传文件
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* Search & Tags */}
        <div className="flex items-center gap-2 flex-wrap">
          <div className="relative flex-1 min-w-48 max-w-sm">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
            <Input
              placeholder="搜索文件名…"
              value={searchInput}
              onChange={(e) => handleSearch(e.target.value)}
              className="pl-8 h-8 text-xs"
            />
            {searchInput && (
              <button onClick={() => { setSearchInput(''); store.setSearch(''); store.fetchFiles(1) }} className="absolute right-2 top-1/2 -translate-y-1/2">
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
                <button onClick={() => { store.setSelectedTags([]); store.fetchFiles(1) }} className="text-[10px] text-muted-foreground hover:text-foreground">
                  <X className="size-3 inline" /> 清除
                </button>
              )}
            </div>
          )}
        </div>

        {/* File Grid/List */}
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
            {files.map((f) => <FileCard key={f.fileId} f={f} />)}
          </div>
        ) : (
          <div className="border rounded-lg overflow-hidden">
            {files.map((f) => (
              <div key={f.fileId} className="flex items-center gap-3 px-3 py-2 border-b last:border-0 hover:bg-muted/50 text-sm">
                {fileIcon(f.mimeType)}
                <span className="flex-1 truncate font-medium text-xs">{f.filename}</span>
                <span className="text-[10px] text-muted-foreground">{formatSize(f.size)}</span>
                <span className="text-[10px] text-muted-foreground hidden sm:inline">{new Date(f.createdAt).toLocaleDateString()}</span>
                <div className="flex gap-0.5">
                  <Button variant="ghost" size="icon-xs" className="size-6" onClick={() => openEdit(f)}><Tag className="size-3" /></Button>
                  <Button variant="ghost" size="icon-xs" className="size-6" onClick={() => handleDownload(f)}><Download className="size-3" /></Button>
                  <Button variant="ghost" size="icon-xs" className="size-6" onClick={() => handleDelete(f.fileId)}><Trash2 className="size-3" /></Button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Pagination */}
        {total > pageSize && (
          <div className="flex items-center justify-between text-xs text-muted-foreground pt-2">
            <span>共 {total} 个文件，第 {page}/{totalPages} 页</span>
            <div className="flex items-center gap-0.5">
              <Button variant="outline" size="icon" className="size-7" disabled={page <= 1} onClick={() => store.fetchFiles(1)}>
                <ChevronLeft className="size-3.5 rotate-180" />
                <ChevronLeft className="size-3.5 rotate-180 -ml-1.5" />
              </Button>
              <Button variant="outline" size="icon" className="size-7" disabled={page <= 1} onClick={() => store.fetchFiles(page - 1)}>
                <ChevronLeft className="size-3.5" />
              </Button>
              <span className="px-2 tabular-nums min-w-12 text-center">{page} / {totalPages}</span>
              <Button variant="outline" size="icon" className="size-7" disabled={page >= totalPages} onClick={() => store.fetchFiles(page + 1)}>
                <ChevronRight className="size-3.5" />
              </Button>
              <Button variant="outline" size="icon" className="size-7" disabled={page >= totalPages} onClick={() => store.fetchFiles(totalPages)}>
                <ChevronRight className="size-3.5" />
                <ChevronRight className="size-3.5 -ml-1.5" />
              </Button>
            </div>
          </div>
        )}
      </CardContent>

      {/* Upload Dialog */}
      <UploadDialog open={showUpload} onOpenChange={setShowUpload} />

      {/* Preview Dialog */}
      <Dialog open={!!previewFile} onOpenChange={() => setPreviewFile(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader><DialogTitle>{previewFile?.filename}</DialogTitle></DialogHeader>
          {previewFile && isImage(previewFile.mimeType) ? (
            <img src={store.getDownloadUrl(previewFile.fileId)} alt={previewFile.filename} className="max-h-[70vh] object-contain rounded" />
          ) : (
            <div className="flex flex-col items-center gap-3 py-8">
              {previewFile && fileIcon(previewFile.mimeType)}
              <p className="text-sm text-muted-foreground">无法预览此文件类型</p>
              <Button variant="outline" size="sm" onClick={() => previewFile && handleDownload(previewFile)}>
                <Download className="size-3.5 mr-1" />下载文件
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog open={!!editFile} onOpenChange={() => setEditFile(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>编辑标签 — {editFile?.filename}</DialogTitle>
            <DialogDescription>用逗号分隔多个标签，如：合同, 技术图纸</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="grid gap-1.5">
              <label className="text-xs font-medium">标签</label>
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
    </Card>
  )
}

// ===== Upload Dialog =====
function UploadDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  const store = useFileStore()
  const [dragOver, setDragOver] = useState(false)
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [tags, setTags] = useState('')
  const [desc, setDesc] = useState('')
  const [uploading, setUploading] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setDragOver(false)
    const file = e.dataTransfer.files[0]
    if (file) setSelectedFile(file)
  }

  const handleUpload = async () => {
    if (!selectedFile) return
    setUploading(true)
    const tagList = tags.split(',').map((t) => t.trim()).filter(Boolean)
    const ok = await store.uploadFile(selectedFile, tagList, desc.trim() || undefined)
    setUploading(false)
    if (ok) {
      setSelectedFile(null); setTags(''); setDesc(''); onOpenChange(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>上传文件</DialogTitle>
          <DialogDescription>支持任意文件类型，最大 50MB</DialogDescription>
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
                <p className="text-xs text-muted-foreground mt-1">最大 50MB</p>
              </div>
            )}
            <input ref={fileInputRef} type="file" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) setSelectedFile(f) }} />
          </div>
          <div className="grid gap-1.5">
            <label className="text-xs font-medium">标签（逗号分隔）</label>
            <Input value={tags} onChange={(e) => setTags(e.target.value)} placeholder="合同, 技术图纸" />
          </div>
          <div className="grid gap-1.5">
            <label className="text-xs font-medium">描述</label>
            <Input value={desc} onChange={(e) => setDesc(e.target.value)} placeholder="文件描述（选填）" />
          </div>
        </div>
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

// Reuse size formatter (same as above)
