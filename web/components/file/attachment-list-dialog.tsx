'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { formatSize, FileTypeIcon, displayFileName } from '@/lib/file-utils'
import { useFileStore, type FileItem } from '@/stores/file-store'
import { apiClient } from '@/lib/api-client'
import { List, X, Paperclip, Eye } from 'lucide-react'
import type { FileItem as FileInfo } from '@/stores/file-store'
import dynamic from 'next/dynamic'

export interface AttachmentListDialogProps {
  /** fileRef 列表，支持 'fileId' / 'fileId@V2' / 'fileId@VN' */
  refs: string[]
  title?: string
  /** 显示在 Trigger 上的文字（当显示项超过阈值或提供「查看全部」入口时用） */
  triggerLabel?: string
  /** Trigger 形式：link = 像按钮一样的文字，badge = 小 badge（如另外 N 个），outline = 描边按钮 */
  variant?: 'link' | 'badge' | 'outline'
  readOnly?: boolean
  onPreview?: (file: FileInfo) => void
  /** 如果提供，表示允许列表内单项删除；idx 是 refs 中的 index */
  onRemove?: (idx: number) => void
}

function parseFileRef(ref: string): { fileId: string; versionKey: string } {
  const idx = ref.lastIndexOf('@V')
  if (idx === -1) return { fileId: ref || '', versionKey: '' }
  return { fileId: ref.slice(0, idx), versionKey: ref.slice(idx + 1) }
}

const versionLabel = (key: string) => {
  if (!key || key === 'V1') return 'V1'
  if (key === 'VN') return 'VN'
  return key
}

const FilePreview = dynamic(
  () => import('@/components/file/file-preview').then(m => m.FilePreview),
  { ssr: false, loading: () => null }
)

export function AttachmentListDialog({
  refs,
  title = '附件列表',
  triggerLabel,
  variant = 'link',
  readOnly,
  onPreview,
  onRemove,
}: AttachmentListDialogProps) {
  const [open, setOpen] = useState(false)
  const store = useFileStore()
  const storeFiles = store.files

  const [resolvedMap, setResolvedMap] = useState<Record<string, FileItem>>({})
  const [previewIdx, setPreviewIdx] = useState<number | null>(null)

  // Resolve all refs (async fetch remote file info when not in store)
  useEffect(() => {
    let cancelled = false
    for (const ref of refs) {
      const { fileId } = parseFileRef(ref)
      if (!fileId || resolvedMap[ref]) continue

      const inStore = storeFiles.find(f => f.fileId === fileId)
      if (inStore) {
        setResolvedMap(prev => ({ ...prev, [ref]: inStore }))
        continue
      }

      ;(async () => {
        try {
          const res: any = await apiClient.get(`/file/${fileId}`)
          const data = res.data || res
          if (data && data.fileId && !cancelled) {
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
            setResolvedMap(prev => ({ ...prev, [ref]: item }))
          }
        } catch { /* ignore */ }
      })()
    }
    return () => { cancelled = true }
  }, [refs, storeFiles, resolvedMap])

  const handlePreview = useCallback((idx: number) => {
    setPreviewIdx(idx)
    const ref = refs[idx]
    const { fileId } = parseFileRef(ref)
    const f = resolvedMap[ref] || storeFiles.find(x => x.fileId === fileId)
    if (f) onPreview?.(f as any)
  }, [refs, resolvedMap, storeFiles, onPreview])

  const previewFile = useMemo(() => {
    if (previewIdx == null) return null
    const ref = refs[previewIdx]
    const { fileId } = parseFileRef(ref)
    return (resolvedMap[ref] || storeFiles.find(x => x.fileId === fileId) || null) as any
  }, [previewIdx, refs, resolvedMap, storeFiles])

  // —————— Trigger UI ——————
  let triggerNode: React.ReactNode = null
  if (variant === 'badge') {
    triggerNode = (
      <Badge
        variant="secondary"
        className="h-8 px-2 text-[11px] cursor-pointer border-dashed hover:border-foreground/20 shrink-0"
      >
        <List className="size-3 mr-1 inline -translate-y-px" />
        {triggerLabel || `共 ${refs.length} 个`}
      </Badge>
    )
  } else if (variant === 'outline') {
    triggerNode = (
      <Button variant="outline" size="sm" type="button" className="h-10 text-xs shrink-0">
        <Eye className="size-3.5 mr-1" />
        {triggerLabel || `查看全部 (${refs.length})`}
      </Button>
    )
  } else {
    triggerNode = (
      <Button variant="link" size="sm" type="button" className="h-auto p-0 text-xs">
        {triggerLabel || `查看列表 (${refs.length})`}
      </Button>
    )
  }

  return (
    <>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger render={triggerNode as any}>
          {/* placeholder, actual trigger is render prop */}
        </DialogTrigger>
        <DialogContent className="max-w-2xl max-h-[80vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {title}
              <Badge variant="secondary" className="text-[10px] font-mono">{refs.length} 个</Badge>
            </DialogTitle>
          </DialogHeader>

          <div className="flex-1 overflow-auto pr-1">
            {refs.length === 0 ? (
              <div className="text-xs text-muted-foreground text-center py-10">暂无附件</div>
            ) : (
              <ul className="divide-y divide-muted rounded-md border">
                {refs.map((ref, idx) => {
                  const { fileId, versionKey } = parseFileRef(ref)
                  const file = resolvedMap[ref] || storeFiles.find(f => f.fileId === fileId) || null
                  const name = file ? displayFileName(file) : fileId
                  const size = file?.size ?? 0

                  return (
                    <li
                      key={`${ref}-${idx}`}
                      className="flex items-center gap-3 px-3 py-2.5 hover:bg-muted/40"
                    >
                      <span className="shrink-0 w-8 text-center text-muted-foreground text-xs font-mono">
                        #{idx + 1}
                      </span>
                      <span className="shrink-0">
                        {file ? (
                          <FileTypeIcon mimeType={file.mimeType} className="size-5" />
                        ) : (
                          <Paperclip className="size-4 text-muted-foreground" />
                        )}
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-sm">{name}</div>
                        <div className="mt-0.5 flex items-center gap-2 text-[11px] text-muted-foreground">
                          {size > 0 && <span>{formatSize(size)}</span>}
                          {versionKey && versionKey !== 'V1' && (
                            <Badge variant="outline" className="text-[9px] h-4 px-1 font-mono">
                              {versionLabel(versionKey)}
                            </Badge>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center gap-1 shrink-0">
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="h-7 px-2 text-xs"
                          disabled={!file}
                          onClick={() => handlePreview(idx)}
                        >
                          <Eye className="size-3.5 mr-1" />预览
                        </Button>
                        {onRemove && (
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="h-7 px-2 text-xs hover:text-red-600"
                            onClick={() => onRemove(idx)}
                          >
                            <X className="size-3.5 mr-1" />移除
                          </Button>
                        )}
                      </div>
                    </li>
                  )
                })}
              </ul>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* FilePreview 单文件预览 */}
      {previewFile && (
        <FilePreview file={previewFile} onClose={() => setPreviewIdx(null)} />
      )}
    </>
  )
}
