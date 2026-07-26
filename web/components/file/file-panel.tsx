'use client'

import { useState, useEffect } from 'react'
import { useFileStore, type FileItem } from '@/stores/file-store'
import { useAuthStore } from '@/stores/auth-store'
import { SectionWrapper } from '@/components/shared/section-wrapper'
import { ActionButton } from '@/components/shared/action-button'
import { FormField } from '@/components/shared/form-field'
import { Separator } from '@/components/ui/separator'
import { Badge } from '@/components/ui/badge'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Upload, Search, Download, Trash2, Tag, RefreshCw,
  RotateCcw, AlertTriangle, FileText, Plus, Eye,
  History, FolderOpen,
} from 'lucide-react'

export function FilePanel() {
  const isLoggedIn = useAuthStore((s) => s.isLoggedIn)
  const store = useFileStore()

  // ===== Active files =====
  const [listResult, setListResult] = useState('')
  const [listPage, setListPage] = useState('1')

  // Upload
  const [uploadResult, setUploadResult] = useState('')

  // Download
  const [dlFileId, setDlFileId] = useState('')
  const [dlResult, setDlResult] = useState('')

  // Delete
  const [delFileId, setDelFileId] = useState('')
  const [delResult, setDelResult] = useState('')

  // ===== Trash =====
  const [trashPage, setTrashPage] = useState('1')
  const [trashSearch, setTrashSearch] = useState('')
  const [trashResult, setTrashResult] = useState('')

  // Restore
  const [restoreIds, setRestoreIds] = useState('')
  const [restoreResult, setRestoreResult] = useState('')

  // Permanent delete
  const [permDelIds, setPermDelIds] = useState('')
  const [permDelResult, setPermDelResult] = useState('')

  // Empty trash
  const [emptyTrashResult, setEmptyTrashResult] = useState('')

  useEffect(() => {
    if (isLoggedIn) {
      store.fetchFiles(1)
      store.fetchTags()
      store.fetchTrash(1)
    }
  }, [isLoggedIn])

  const handleList = async () => {
    try {
      await store.fetchFiles(parseInt(listPage) || 1)
      const state = useFileStore.getState()
      setListResult(JSON.stringify({ items: state.files, total: state.total, page: state.page }, null, 2))
    } catch (e) {
      setListResult(`Error: ${(e as Error).message}`)
    }
  }

  const handleUpload = async () => {
    try {
      const input = document.createElement('input')
      input.type = 'file'
      input.onchange = async (e: any) => {
        const file = e.target?.files?.[0]
        if (!file) return
        const ok = await store.uploadFile(file)
        setUploadResult(ok ? 'Upload OK — check list' : 'Upload failed')
        if (ok) handleList()
      }
      input.click()
    } catch (e) {
      setUploadResult(`Error: ${(e as Error).message}`)
    }
  }

  const handleDownload = async () => {
    if (!dlFileId) { setDlResult('请输入 fileId'); return }
    try {
      const url = await store.getDownloadUrl(dlFileId)
      setDlResult(url ? `URL: ${url.slice(0, 200)}...` : 'Failed to get URL')
    } catch (e) {
      setDlResult(`Error: ${(e as Error).message}`)
    }
  }

  const handleDelete = async () => {
    if (!delFileId) { setDelResult('请输入 fileId'); return }
    try {
      const ok = await store.deleteFile(delFileId)
      setDelResult(ok ? 'Delete OK (soft-deleted → trash)' : 'Delete failed')
      if (ok) handleList()
    } catch (e) {
      setDelResult(`Error: ${(e as Error).message}`)
    }
  }

  // ===== Trash operations =====
  const [trashLoading, setTrashLoading] = useState(false)

  const handleTrashList = async () => {
    setTrashLoading(true)
    try {
      await store.fetchTrash(parseInt(trashPage) || 1, trashSearch || undefined)
      const state = useFileStore.getState()
      setTrashResult(JSON.stringify({ items: state.trashFiles, total: state.trashTotal, page: state.trashPage }, null, 2))
    } catch (e) {
      setTrashResult(`Error: ${(e as Error).message}`)
    } finally {
      setTrashLoading(false)
    }
  }

  const handleRestore = async () => {
    if (!restoreIds) { setRestoreResult('请输入 fileId（多个用逗号分隔）'); return }
    try {
      const ids = restoreIds.split(',').map((s) => s.trim()).filter(Boolean)
      const ok = await store.restoreFiles(ids)
      setRestoreResult(ok ? 'Restore OK' : 'Restore failed')
      if (ok) handleTrashList()
    } catch (e) {
      setRestoreResult(`Error: ${(e as Error).message}`)
    }
  }

  const handlePermDelete = async () => {
    if (!permDelIds) { setPermDelResult('请输入 fileId（多个用逗号分隔）'); return }
    try {
      const ids = permDelIds.split(',').map((s) => s.trim()).filter(Boolean)
      const ok = await store.permanentDeleteFiles(ids)
      setPermDelResult(ok ? 'Permanent delete OK' : 'Delete failed')
      if (ok) handleTrashList()
    } catch (e) {
      setPermDelResult(`Error: ${(e as Error).message}`)
    }
  }

  const handleEmptyTrash = async () => {
    if (!confirm('确定要清空回收站？此操作不可撤销。')) return
    try {
      const ok = await store.emptyTrash()
      setEmptyTrashResult(ok ? 'Trash emptied OK' : 'Empty failed')
      if (ok) handleTrashList()
    } catch (e) {
      setEmptyTrashResult(`Error: ${(e as Error).message}`)
    }
  }

  if (!isLoggedIn) return null

  const storeState = useFileStore.getState()

  return (
    <SectionWrapper title="文件管理 & 回收站" description="文件上传、下载、软删除与回收站操作" badge="file">
      <Tabs defaultValue="files">
        <TabsList className="mb-4 flex flex-wrap h-auto gap-1 bg-transparent p-0">
          <TabsTrigger value="files"
            className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground rounded-md px-3 py-1.5 text-sm">
            📁 文件
          </TabsTrigger>
          <TabsTrigger value="trash"
            className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground rounded-md px-3 py-1.5 text-sm">
            🗑️ 回收站
          </TabsTrigger>
        </TabsList>

        {/* ========== Active Files Tab ========== */}
        <TabsContent value="files">
          <div className="space-y-6">

            {/* List files */}
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-sm font-medium">
                <FolderOpen className="h-4 w-4" /> 文件列表
              </div>
              <p className="text-xs text-muted-foreground">获取当前租户的文件列表（分页）</p>
              <div className="flex items-center gap-2">
                <FormField label="页码" id="list-page" value={listPage} onChange={setListPage} />
                <div className="pt-5">
                  <ActionButton onClick={handleList} loading={store.loading}>查询</ActionButton>
                </div>
                <div className="pt-5">
                  <ActionButton onClick={() => { store.fetchFiles(1); store.fetchTags() }} variant="outline">
                    <RefreshCw className="h-3 w-3 mr-1" />刷新
                  </ActionButton>
                </div>
              </div>
              {store.files.length > 0 && (
                <div className="text-xs text-muted-foreground">
                  当前: {store.files.length} 个文件，共 {store.total} 个 (第 {store.page} 页)
                </div>
              )}
              {listResult && <pre className="bg-muted rounded p-2 text-xs overflow-auto max-h-64 font-mono">{listResult}</pre>}

              {/* Active files table */}
              {store.files.length > 0 && (
                <Table className="text-xs">
                  <TableHeader>
                    <TableRow>
                      <TableHead>文件名</TableHead>
                      <TableHead>fileId</TableHead>
                      <TableHead className="w-16">大小</TableHead>
                      <TableHead className="w-12">版本</TableHead>
                      <TableHead className="w-24">上传时间</TableHead>
                      <TableHead className="w-20">操作</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {store.files.map((f: FileItem) => (
                      <TableRow key={f.fileId}>
                        <TableCell className="font-mono text-[11px] max-w-40 truncate" title={f.filename}>{f.filename}</TableCell>
                        <TableCell className="font-mono text-[10px] text-muted-foreground">{f.fileId.slice(0, 12)}…</TableCell>
                        <TableCell className="text-muted-foreground">{formatSize(f.size)}</TableCell>
                        <TableCell><Badge variant="secondary" className="text-[9px] h-4 px-1">V{f.currentVersion || 1}</Badge></TableCell>
                        <TableCell className="text-muted-foreground">{new Date(f.createdAt).toLocaleDateString('zh-CN')}</TableCell>
                        <TableCell>
                          <div className="flex gap-0.5">
                            <ActionButton size="icon-sm" variant="ghost" title="下载" onClick={async () => {
                              const url = await store.getDownloadUrl(f.fileId)
                              if (url) { const a = document.createElement('a'); a.href = url; a.download = f.filename; a.target = '_blank'; document.body.appendChild(a); a.click(); document.body.removeChild(a) }
                            }}><Download className="h-3 w-3" /></ActionButton>
                            <ActionButton size="icon-sm" variant="ghost" title="删除" onClick={async () => {
                              if (!confirm(`确定删除 ${f.filename}？`)) return
                              await store.deleteFile(f.fileId)
                              handleList()
                            }}><Trash2 className="h-3 w-3" /></ActionButton>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </div>

            <Separator />

            {/* Upload */}
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-sm font-medium">
                <Upload className="h-4 w-4" /> 上传文件
              </div>
              <p className="text-xs text-muted-foreground">选择文件上传到当前租户（最大 5GB）</p>
              <ActionButton onClick={handleUpload} loading={store.loading}>
                <Upload className="h-3 w-3 mr-1" />选择并上传
              </ActionButton>
              {uploadResult && <pre className="bg-muted rounded p-2 text-xs overflow-auto max-h-32 font-mono">{uploadResult}</pre>}
            </div>

            <Separator />

            {/* Download by ID */}
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-sm font-medium">
                <Download className="h-4 w-4" /> 获取下载链接
              </div>
              <p className="text-xs text-muted-foreground">通过 fileId 获取文件的预签名下载链接（1小时有效）</p>
              <div className="flex items-end gap-2">
                <FormField label="fileId" id="dl-fid" value={dlFileId} onChange={setDlFileId} />
                <ActionButton onClick={handleDownload}>获取</ActionButton>
              </div>
              {dlResult && <pre className="bg-muted rounded p-2 text-xs overflow-auto max-h-32 font-mono">{dlResult}</pre>}
            </div>

            <Separator />

            {/* Soft delete */}
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-sm font-medium">
                <Trash2 className="h-4 w-4" /> 软删除文件
              </div>
              <p className="text-xs text-muted-foreground">将文件移入回收站（MinIO 对象保留，可恢复）</p>
              <div className="flex items-end gap-2">
                <FormField label="fileId" id="del-fid" value={delFileId} onChange={setDelFileId} />
                <ActionButton onClick={handleDelete} variant="destructive">删除</ActionButton>
              </div>
              {delResult && <pre className="bg-muted rounded p-2 text-xs overflow-auto max-h-32 font-mono">{delResult}</pre>}
            </div>

          </div>
        </TabsContent>

        {/* ========== Trash Tab ========== */}
        <TabsContent value="trash">
          <div className="space-y-6">

            {/* Trash stats */}
            <div className="flex items-center gap-3">
              <Badge variant="secondary" className="text-xs">
                {store.trashTotal} 个文件在回收站
              </Badge>
              <ActionButton variant="outline" size="sm" onClick={handleTrashList} loading={trashLoading}>
                <RefreshCw className="h-3 w-3 mr-1" />刷新回收站
              </ActionButton>
            </div>

            {/* List trash */}
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-sm font-medium">
                <Trash2 className="h-4 w-4" /> 回收站列表
              </div>
              <p className="text-xs text-muted-foreground">查看所有软删除（deletedAt 不为 null）的文件</p>
              <div className="flex items-end gap-2">
                <FormField label="页码" id="trash-page" value={trashPage} onChange={setTrashPage} />
                <FormField label="搜索" id="trash-search" value={trashSearch} onChange={setTrashSearch} />
                <ActionButton onClick={handleTrashList} loading={trashLoading}>查询</ActionButton>
              </div>

              {/* Trash items table */}
              {store.trashFiles.length > 0 && (
                <Table className="text-xs">
                  <TableHeader>
                    <TableRow>
                      <TableHead>文件名</TableHead>
                      <TableHead>fileId</TableHead>
                      <TableHead className="w-16">大小</TableHead>
                      <TableHead className="w-12">版本</TableHead>
                      <TableHead className="w-28">删除时间</TableHead>
                      <TableHead className="w-24">操作</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {store.trashFiles.map((f: FileItem) => (
                      <TableRow key={f.fileId}>
                        <TableCell className="font-mono text-[11px] max-w-40 truncate" title={f.filename}>{f.filename}</TableCell>
                        <TableCell className="font-mono text-[10px] text-muted-foreground">{f.fileId.slice(0, 12)}…</TableCell>
                        <TableCell className="text-muted-foreground">{formatSize(f.size)}</TableCell>
                        <TableCell><Badge variant="secondary" className="text-[9px] h-4 px-1">V{f.currentVersion || 1}</Badge></TableCell>
                        <TableCell className="text-muted-foreground">
                          {f.deletedAt ? new Date(f.deletedAt).toLocaleString('zh-CN') : '—'}
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-0.5">
                            <ActionButton size="icon-sm" variant="ghost" title="恢复" onClick={async () => {
                              await store.restoreFiles([f.fileId])
                              handleTrashList()
                            }}><RotateCcw className="h-3 w-3" /></ActionButton>
                            <ActionButton size="icon-sm" variant="ghost" title="永久删除" onClick={async () => {
                              if (!confirm(`永久删除 ${f.filename}？不可撤销！`)) return
                              await store.permanentDeleteFiles([f.fileId])
                              handleTrashList()
                            }}><Trash2 className="h-3 w-3 text-destructive" /></ActionButton>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
              {trashResult && <pre className="bg-muted rounded p-2 text-xs overflow-auto max-h-64 font-mono">{trashResult}</pre>}
            </div>

            <Separator />

            {/* Restore */}
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-sm font-medium">
                <RotateCcw className="h-4 w-4" /> 恢复文件
              </div>
              <p className="text-xs text-muted-foreground">将回收站中的文件恢复（设置 deletedAt=null）</p>
              <div className="flex items-end gap-2">
                <FormField label="fileId（逗号分隔）" id="restore-ids" value={restoreIds} onChange={setRestoreIds} />
                <ActionButton onClick={handleRestore}>恢复</ActionButton>
              </div>
              {restoreResult && <pre className="bg-muted rounded p-2 text-xs overflow-auto max-h-32 font-mono">{restoreResult}</pre>}
            </div>

            <Separator />

            {/* Permanent delete */}
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-sm font-medium">
                <Trash2 className="h-4 w-4" /> 永久删除
              </div>
              <p className="text-xs text-muted-foreground">从回收站永久删除文件 — 彻底移除 MinIO 对象和数据库记录</p>
              <div className="flex items-end gap-2">
                <FormField label="fileId（逗号分隔）" id="perm-del-ids" value={permDelIds} onChange={setPermDelIds} />
                <ActionButton onClick={handlePermDelete} variant="destructive">永久删除</ActionButton>
              </div>
              {permDelResult && <pre className="bg-muted rounded p-2 text-xs overflow-auto max-h-32 font-mono">{permDelResult}</pre>}
            </div>

            <Separator />

            {/* Empty trash */}
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-sm font-medium">
                <AlertTriangle className="h-4 w-4" /> 清空回收站
              </div>
              <p className="text-xs text-muted-foreground">永久删除当前租户回收站中的所有文件。⚠️ 不可撤销！</p>
              <ActionButton onClick={handleEmptyTrash} variant="destructive">
                清空回收站
              </ActionButton>
              {emptyTrashResult && <pre className="bg-muted rounded p-2 text-xs overflow-auto max-h-32 font-mono">{emptyTrashResult}</pre>}
            </div>

          </div>
        </TabsContent>
      </Tabs>
    </SectionWrapper>
  )
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}
