'use client'

import { useState, useEffect } from 'react'
import { useFileStore, type FileItem } from '@/stores/file-store'
import { useAuthStore } from '@/stores/auth-store'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog'
import {
  Search, X, Trash2, RefreshCw, RotateCcw, AlertTriangle,
} from 'lucide-react'
import { formatSize, FileTypeIcon, displayFileName } from '@/lib/file-utils'
import { Pagination } from '@/components/shared/pagination'

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return '刚刚'
  if (mins < 60) return `${mins} 分钟前`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours} 小时前`
  const days = Math.floor(hours / 24)
  if (days < 30) return `${days} 天前`
  return new Date(dateStr).toLocaleDateString('zh-CN')
}

export function FileTrash() {
  const isLoggedIn = useAuthStore((s) => s.isLoggedIn)
  const store = useFileStore()
  const { trashFiles, trashTotal, trashPage, trashLoading, pageSize } = store

  const [searchInput, setSearchInput] = useState('')
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [confirmAction, setConfirmAction] = useState<'restore' | 'delete' | 'empty' | null>(null)

  useEffect(() => {
    if (isLoggedIn) {
      store.fetchTrash(1)
    }
  }, [isLoggedIn])

  const handleSearch = () => {
    store.fetchTrash(1, searchInput || undefined)
  }

  const totalPages = Math.max(1, Math.ceil(trashTotal / pageSize))

  const toggleSelect = (fileId: string) => {
    const next = new Set(selected)
    if (next.has(fileId)) next.delete(fileId)
    else next.add(fileId)
    setSelected(next)
  }

  const toggleAll = () => {
    if (selected.size === trashFiles.length) {
      setSelected(new Set())
    } else {
      setSelected(new Set(trashFiles.map((f) => f.fileId)))
    }
  }

  const handleRestore = async () => {
    const ids = Array.from(selected)
    if (ids.length === 0) return
    await store.restoreFiles(ids)
    setSelected(new Set())
    setConfirmAction(null)
  }

  const handlePermanentDelete = async () => {
    const ids = Array.from(selected)
    if (ids.length === 0) return
    await store.permanentDeleteFiles(ids)
    setSelected(new Set())
    setConfirmAction(null)
  }

  const handleEmptyTrash = async () => {
    await store.emptyTrash()
    setConfirmAction(null)
  }

  if (!isLoggedIn) return null

  return (
    <Card className="shadow-sm">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CardTitle className="text-base">回收站</CardTitle>
            <Badge variant="secondary" className="text-[10px]">
              {trashTotal} 个文件
            </Badge>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => store.fetchTrash(trashPage, searchInput || undefined)}
              disabled={trashLoading}
            >
              <RefreshCw className="size-3.5 mr-1" />刷新
            </Button>
            {selected.size > 0 ? (
              <>
                <Button variant="outline" size="sm" onClick={() => setConfirmAction('restore')}>
                  <RotateCcw className="size-3.5 mr-1" />恢复 ({selected.size})
                </Button>
                <Button variant="destructive" size="sm" onClick={() => setConfirmAction('delete')}>
                  <Trash2 className="size-3.5 mr-1" />永久删除 ({selected.size})
                </Button>
              </>
            ) : (
              <Button
                variant="destructive"
                size="sm"
                onClick={() => setConfirmAction('empty')}
                disabled={trashTotal === 0}
              >
                <AlertTriangle className="size-3.5 mr-1" />清空回收站
              </Button>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* Search */}
        <div className="flex items-center gap-2">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
            <Input
              placeholder="搜索回收站文件…"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
              className="pl-8 h-8 text-xs"
            />
            {searchInput && (
              <button
                onClick={() => { setSearchInput(''); store.fetchTrash(1) }}
                className="absolute right-2 top-1/2 -translate-y-1/2"
              >
                <X className="size-3 text-muted-foreground" />
              </button>
            )}
          </div>
          <Button variant="ghost" size="sm" onClick={handleSearch} className="text-xs h-8">
            搜索
          </Button>
        </div>

        {/* Trash Table */}
        {trashLoading && trashFiles.length === 0 ? (
          <div className="space-y-2">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-12 w-full rounded-lg" />
            ))}
          </div>
        ) : trashFiles.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
            <Trash2 className="size-12 mb-3 opacity-20" />
            <p className="text-sm font-medium">回收站为空</p>
            <p className="text-xs mt-1">删除的文件将在这里显示</p>
          </div>
        ) : (
          <>
            <div className="border rounded-lg overflow-hidden">
              {/* Header */}
              <div className="flex items-center gap-3 px-3 py-2 bg-muted/50 text-xs font-medium text-muted-foreground">
                <input
                  type="checkbox"
                  checked={selected.size === trashFiles.length && trashFiles.length > 0}
                  onChange={toggleAll}
                  className="size-3.5 rounded border-muted-foreground/30 cursor-pointer"
                />
                <span className="flex-1">文件名</span>
                <span className="w-16 text-right">大小</span>
                <span className="w-24 text-right hidden sm:inline">版本</span>
                <span className="w-28 text-right hidden md:inline">删除时间</span>
              </div>

              {trashFiles.map((f) => (
                <div
                  key={f.fileId}
                  className={`flex items-center gap-3 px-3 py-2.5 border-t text-xs hover:bg-muted/30 transition-colors ${selected.has(f.fileId) ? 'bg-primary/5' : ''}`}
                >
                  <input
                    type="checkbox"
                    checked={selected.has(f.fileId)}
                    onChange={() => toggleSelect(f.fileId)}
                    className="size-3.5 rounded border-muted-foreground/30 cursor-pointer"
                  />
                  <div className="flex-1 flex items-center gap-2 min-w-0">
                    <FileTypeIcon mimeType={f.mimeType} className="size-4" />
                    <span className="truncate font-medium">{displayFileName(f)}</span>
                  </div>
                  <span className="w-16 text-right text-muted-foreground shrink-0">
                    {formatSize(f.size)}
                  </span>
                  <Badge variant="secondary" className="text-[9px] h-4 px-1 shrink-0 hidden sm:inline-flex">
                    V{f.currentVersion || 1}
                  </Badge>
                  <span className="w-28 text-right text-muted-foreground shrink-0 hidden md:inline">
                    {f.deletedAt ? timeAgo(f.deletedAt) : '—'}
                  </span>
                  <div className="flex gap-0.5 shrink-0">
                    <Button
                      variant="ghost"
                      size="icon-xs"
                      className="size-6"
                      onClick={() => { setSelected(new Set([f.fileId])); setConfirmAction('restore') }}
                      title="恢复"
                    >
                      <RotateCcw className="size-3" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon-xs"
                      className="size-6 text-destructive hover:text-destructive"
                      onClick={() => { setSelected(new Set([f.fileId])); setConfirmAction('delete') }}
                      title="永久删除"
                    >
                      <Trash2 className="size-3" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>

            {/* Pagination */}
            {trashTotal > pageSize && (
              <Pagination page={trashPage} totalPages={totalPages} total={trashTotal} onPageChange={(p) => store.fetchTrash(p, searchInput || undefined)} disabled={trashLoading} />
            )}
          </>
        )}

        {/* Confirmation Dialogs */}
        <Dialog open={confirmAction === 'restore'} onOpenChange={() => setConfirmAction(null)}>
          <DialogContent className="max-w-sm">
            <DialogHeader>
              <DialogTitle>确认恢复</DialogTitle>
              <DialogDescription>
                {selected.size > 1
                  ? `确定要恢复选中的 ${selected.size} 个文件吗？文件将回到文件列表中。`
                  : '确定要恢复此文件吗？文件将回到文件列表中。'}
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button variant="outline" onClick={() => setConfirmAction(null)}>取消</Button>
              <Button onClick={handleRestore}><RotateCcw className="size-3.5 mr-1" />确认恢复</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog open={confirmAction === 'delete'} onOpenChange={() => setConfirmAction(null)}>
          <DialogContent className="max-w-sm">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-destructive">
                <AlertTriangle className="size-5" />永久删除
              </DialogTitle>
              <DialogDescription>
                {selected.size > 1
                  ? `确定要永久删除选中的 ${selected.size} 个文件吗？此操作不可撤销，文件及其所有版本将从 MinIO 存储中彻底删除。`
                  : '确定要永久删除此文件吗？此操作不可撤销，文件及其所有版本将从 MinIO 存储中彻底删除。'}
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button variant="outline" onClick={() => setConfirmAction(null)}>取消</Button>
              <Button variant="destructive" onClick={handlePermanentDelete}><Trash2 className="size-3.5 mr-1" />确认永久删除</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog open={confirmAction === 'empty'} onOpenChange={() => setConfirmAction(null)}>
          <DialogContent className="max-w-sm">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-destructive">
                <AlertTriangle className="size-5" />清空回收站
              </DialogTitle>
              <DialogDescription>
                确定要清空回收站吗？将永久删除全部 {trashTotal} 个文件及其所有版本，此操作不可撤销。
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button variant="outline" onClick={() => setConfirmAction(null)}>取消</Button>
              <Button variant="destructive" onClick={handleEmptyTrash}><Trash2 className="size-3.5 mr-1" />确认清空</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  )
}
