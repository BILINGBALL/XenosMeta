'use client'

import { useState, useEffect, useMemo } from 'react'
import { useFileStore, type FileItem } from '@/stores/file-store'
import { useAuthStore } from '@/stores/auth-store'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Search, Paperclip, X, File as FileIcon } from 'lucide-react'

interface FilePickerProps {
  value: string       // fileId
  onChange: (fileId: string) => void
  readOnly?: boolean
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

export function FilePicker({ value, onChange, readOnly }: FilePickerProps) {
  const isLoggedIn = useAuthStore((s) => s.isLoggedIn)
  const store = useFileStore()
  const { files, loading, allTags } = store
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState('')
  const [selectedTag, setSelectedTag] = useState('')

  // Load file store data on mount
  useEffect(() => {
    if (isLoggedIn) {
      store.fetchFiles(1)
      store.fetchTags()
    }
  }, [isLoggedIn])

  // Find the selected file from the store
  const selectedFile = useMemo(() => {
    return files.find((f) => f.fileId === value) || null
  }, [files, value])

  const filteredFiles = useMemo(() => {
    let result = files
    if (search) result = result.filter((f) => f.filename.toLowerCase().includes(search.toLowerCase()))
    if (selectedTag) result = result.filter((f) => (f.tags as string[])?.includes(selectedTag))
    return result
  }, [files, search, selectedTag])

  if (readOnly) {
    return (
      <div className="h-8 flex items-center rounded-md border border-transparent bg-muted/60 px-2.5 text-sm gap-2">
        <Paperclip className="size-3 text-muted-foreground" />
        {selectedFile ? (
          <span className="text-xs truncate">{selectedFile.filename}</span>
        ) : (
          <span className="text-muted-foreground text-xs">—</span>
        )}
      </div>
    )
  }

  return (
    <div>
      <div className="flex items-center gap-2">
        {selectedFile ? (
          <div className="flex items-center gap-2 flex-1 min-w-0 h-8 px-2.5 rounded-md border bg-muted/30 text-xs">
            <Paperclip className="size-3 text-muted-foreground shrink-0" />
            <span className="truncate flex-1">{selectedFile.filename}</span>
            <span className="text-muted-foreground shrink-0">{formatSize(selectedFile.size)}</span>
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
            <div className="flex-1 overflow-auto space-y-1">
              {filteredFiles.length === 0 ? (
                <p className="text-xs text-muted-foreground text-center py-8">无匹配文件</p>
              ) : (
                filteredFiles.map((f) => (
                  <button
                    key={f.fileId}
                    onClick={() => { onChange(f.fileId); setOpen(false) }}
                    className={`w-full flex items-center gap-2 px-3 py-2 rounded-md text-left text-xs transition-colors ${value === f.fileId ? 'bg-primary/10 text-primary font-medium' : 'hover:bg-muted'}`}
                  >
                    <FileIcon className="size-4 shrink-0 text-muted-foreground" />
                    <span className="flex-1 truncate">{f.filename}</span>
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
