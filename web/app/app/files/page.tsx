'use client'

import { useState } from 'react'
import { FileManager } from '@/components/file/file-manager'
import { FileTrash } from '@/components/file/file-trash'
import { Button } from '@/components/ui/button'
import { Trash2 } from 'lucide-react'

export default function FilesPage() {
  const [showTrash, setShowTrash] = useState(false)

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold tracking-tight">文件管理</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {showTrash ? '回收站 — 恢复或永久删除已删除的文件' : '上传、浏览和管理文件'}
          </p>
        </div>
        <Button
          variant={showTrash ? 'default' : 'outline'}
          size="sm"
          onClick={() => setShowTrash(!showTrash)}
        >
          <Trash2 className="size-3.5 mr-1" />
          {showTrash ? '返回文件' : '回收站'}
        </Button>
      </div>
      {showTrash ? <FileTrash /> : <FileManager />}
    </div>
  )
}
