'use client'

import { useCallback, useEffect, useState } from 'react'
import dynamic from 'next/dynamic'
import { useFileStore, type FileItem } from '@/stores/file-store'
import { useAuthStore } from '@/stores/auth-store'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { formatSize, FileTypeIcon, getPreviewType, getLanguage, getPreviewLabel, displayFileName } from '@/lib/file-utils'
import { Download, Loader2, Eye, Code, ExternalLink } from 'lucide-react'
import PdfPreview from './pdf-preview'
import { ImageViewer } from './image-viewer'
import { MarkdownPreview } from './markdown-preview'

const CodeMirrorPreviewWrapper = dynamic(() => import('./codemirror-preview').then(m => ({ default: m.CodeMirrorPreviewWrapper })), {
  ssr: false,
  loading: () => (
    <div className="flex items-center justify-center py-16">
      <Loader2 className="size-6 animate-spin text-muted-foreground" />
    </div>
  ),
})

const OfficePreviewWrapper = dynamic(() => import('./office-preview').then(m => ({ default: m.OfficePreview })), {
  ssr: false,
  loading: () => (
    <div className="flex items-center justify-center py-16">
      <Loader2 className="size-6 animate-spin text-muted-foreground" />
    </div>
  ),
})

const EmailPreviewWrapper = dynamic(() => import('./email-preview').then(m => ({ default: m.EmailPreview })), {
  ssr: false,
  loading: () => (
    <div className="flex items-center justify-center py-16">
      <Loader2 className="size-6 animate-spin text-muted-foreground" />
    </div>
  ),
})

const CsvPreviewWrapper = dynamic(() => import('./csv-preview').then(m => ({ default: m.CsvPreview })), {
  ssr: false,
  loading: () => (
    <div className="flex items-center justify-center py-16">
      <Loader2 className="size-6 animate-spin text-muted-foreground" />
    </div>
  ),
})

// ===== Code Preview =====
function CodePreview({ url, language, filename }: { url: string; language: string; filename: string }) {
  const [text, setText] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  useEffect(() => {
    let cancelled = false; setLoading(true); setError('')
    fetch(url).then(async (res) => {
      const t = await res.text()
      if (!cancelled) setText(t.length > 256000 ? t.slice(0, 256000) + '\n\n// ...' : t)
    }).catch((e) => { if (!cancelled) setError(e.message || '加载失败') }).finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [url])
  useEffect(() => {
    if (!text || loading) return
    const el = document.getElementById(`code-block-${filename}`)
    if (!el) return
    try { const hljs = (window as any).hljs; if (hljs) el.querySelectorAll('pre code').forEach((b: any) => { b.removeAttribute('data-highlighted'); hljs.highlightElement(b) }) } catch {}
  }, [text, loading, filename])
  if (loading) return <div className="flex items-center justify-center py-16"><Loader2 className="size-6 animate-spin text-muted-foreground" /></div>
  if (error) return <div className="flex items-center justify-center py-16 text-sm text-destructive">{error}</div>
  return <pre className="overflow-auto h-full text-xs leading-relaxed bg-muted/40 rounded-lg p-4"><code className={`language-${language}`}>{text}</code></pre>
}

// ===== HTML Preview =====
function HtmlPreview({ url }: { url: string }) {
  const [mode, setMode] = useState<'render' | 'source'>('render')
  const [source, setSource] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const isExternalUrl = /^https?:\/\//i.test(url)
  const proxyUrl = isExternalUrl ? `/api/html-view?url=${encodeURIComponent(url)}` : url

  useEffect(() => {
    if (mode !== 'source') return
    let c = false
    if (!source) {
      setLoading(true)
      fetch(url).then(async r => { if (!c) setSource(await r.text()) }).catch(e => { if (!c) setError(e.message || '加载失败') }).finally(() => { if (!c) setLoading(false) })
    }
    return () => { c = true }
  }, [mode, url, source])

  const Toolbar = (
    <div className="shrink-0 flex items-center gap-1 border-b bg-muted/30 px-2 py-1.5">
      <div className="flex items-center gap-0.5 bg-muted rounded-md p-0.5">
        <button
          onClick={() => setMode('render')}
          className={`flex items-center gap-1 px-2.5 py-1 text-[11px] rounded transition-colors cursor-pointer ${
            mode === 'render'
              ? 'bg-background text-foreground shadow-sm font-medium'
              : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          <Eye className="size-3" /><span className="hidden sm:inline">渲染</span>
        </button>
        <button
          onClick={() => setMode('source')}
          className={`flex items-center gap-1 px-2.5 py-1 text-[11px] rounded transition-colors cursor-pointer ${
            mode === 'source'
              ? 'bg-background text-foreground shadow-sm font-medium'
              : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          <Code className="size-3" /><span className="hidden sm:inline">源码</span>
        </button>
      </div>
      {isExternalUrl && (
        <span className="ml-2 text-[10px] text-muted-foreground truncate hidden sm:inline">{url}</span>
      )}
      <button
        onClick={() => { window.open(proxyUrl, '_blank') }}
        className="ml-auto flex items-center gap-1 px-2 py-1 text-[11px] rounded hover:bg-muted cursor-pointer text-muted-foreground hover:text-foreground"
      >
        <ExternalLink className="size-3" /><span className="hidden sm:inline">新标签页</span>
      </button>
    </div>
  )

  if (mode === 'source') {
    if (loading && !source) return <div className="flex items-center justify-center py-16"><Loader2 className="size-6 animate-spin text-muted-foreground" /></div>
    if (error) return <div className="flex items-center justify-center py-16 text-sm text-destructive">{error}</div>
    return (
      <div className="h-full flex flex-col">
        {Toolbar}
        <div className="flex-1 min-h-0 overflow-auto">
          <pre className="text-xs font-mono leading-relaxed p-4 whitespace-pre-wrap break-words text-muted-foreground">{source}</pre>
        </div>
      </div>
    )
  }

  return (
    <div className="h-full flex flex-col">
      {Toolbar}
      <div className="flex-1 min-h-0 relative">
        <iframe
          src={proxyUrl}
          sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-modals"
          className="w-full h-full border-0 bg-white"
          title="HTML Preview"
        />
      </div>
    </div>
  )
}

// ===== Text Preview =====
function TextPreview({ url }: { url: string }) {
  const [text, setText] = useState(''); const [loading, setLoading] = useState(true); const [error, setError] = useState('')
  useEffect(() => { let c = false; setLoading(true); setError(''); fetch(url).then(async r => { const t = await r.text(); if (!c) setText(t.length > 512000 ? t.slice(0, 512000) + '\n\n...' : t) }).catch(e => { if (!c) setError(e.message || '加载失败') }).finally(() => { if (!c) setLoading(false) }); return () => { c = true } }, [url])
  if (loading) return <div className="flex items-center justify-center py-16"><Loader2 className="size-6 animate-spin text-muted-foreground" /></div>
  if (error) return <div className="flex items-center justify-center py-16 text-sm text-destructive">{error}</div>
  if (!text) return <div className="flex items-center justify-center py-16 text-sm text-muted-foreground">空文件</div>
  return <pre className="overflow-auto h-full text-xs font-mono leading-relaxed bg-muted/40 rounded-lg p-4 whitespace-pre-wrap break-all">{text}</pre>
}

// ===== Main FilePreview Component =====
interface FilePreviewProps { file: FileItem | null; onClose: () => void }

export function FilePreview({ file, onClose }: FilePreviewProps) {
  const store = useFileStore()
  const token = useAuthStore((s) => s.accessToken)
  const [downloadUrl, setDownloadUrl] = useState('')
  const [loadedUrl, setLoadedUrl] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const apiBase = process.env.NEXT_PUBLIC_API_URL || ''

  useEffect(() => {
    if (!file) { setDownloadUrl(''); setLoadedUrl(null); return }
    let cancelled = false; setLoading(true); setError('')
    const contentUrl = `${apiBase}/file/${file.fileId}/content`
    const isPdf = file.mimeType === 'application/pdf' || (file.filename || '').toLowerCase().endsWith('.pdf')

    if (token) {
      // PDF 通过 Authorization header 传 token（由 PdfPreview 通过 pdfjs 的 httpHeaders 发送）
      // 非 PDF 文件则先用 fetch + Blob + objectURL 加载，避免 URL 泄漏 token
      if (isPdf) {
        setLoadedUrl(contentUrl)
        setLoading(false)
      } else {
        fetch(contentUrl, { headers: { Authorization: `Bearer ${token}` } })
          .then(async r => { if (!r.ok) throw new Error(`HTTP ${r.status}`); const b = await r.blob(); if (!cancelled) setLoadedUrl(URL.createObjectURL(b)) })
          .catch(e => { if (!cancelled) setError(e.message || '加载失败') })
          .finally(() => { if (!cancelled) setLoading(false) })
      }
    } else setLoadedUrl(contentUrl)

    store.getDownloadUrl(file.fileId).then(u => { if (!cancelled && u) setDownloadUrl(u) }).catch(() => {})
    return () => { cancelled = true; if (loadedUrl && loadedUrl.startsWith('blob:')) URL.revokeObjectURL(loadedUrl) }
  }, [file?.fileId, token])

  const handleDownload = useCallback(() => {
    if (!downloadUrl || !file) return
    const name = displayFileName(file)
    const ext = file.filename.split('.').pop()?.toLowerCase() || ''
    // HTML 文件：fetch 后以 UTF-8 解码再生成 Blob，避免浏览器直接打开原始 URL 导致乱码
    if (ext === 'html' || ext === 'htm') {
      fetch(downloadUrl).then(async r => r.arrayBuffer()).then(buf => {
        const text = new TextDecoder('utf-8').decode(buf)
        const blob = new Blob([text], { type: 'text/html;charset=utf-8' })
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url; a.download = name; document.body.appendChild(a); a.click(); document.body.removeChild(a)
        setTimeout(() => URL.revokeObjectURL(url), 1000)
      }).catch(() => {
        const a = document.createElement('a'); a.href = downloadUrl; a.download = name; a.target = '_blank'; document.body.appendChild(a); a.click(); document.body.removeChild(a)
      })
      return
    }
    const a = document.createElement('a'); a.href = downloadUrl; a.download = name; a.target = '_blank'; document.body.appendChild(a); a.click(); document.body.removeChild(a)
  }, [downloadUrl, file])

  if (!file) return null
  const previewType = getPreviewType(file.mimeType, file.filename)
  const ext = (file.filename.split('.').pop() || '').toLowerCase()
  const isPdf = previewType === 'pdf'

  const handleOpenNewTab = useCallback(async () => {
    // HTML：用代理视图避免乱码
    if (ext === 'html' || ext === 'htm') {
      const htmlSrc = downloadUrl || loadedUrl || ''
      if (!htmlSrc) return
      const url = (downloadUrl)
        ? `${window.location.origin}/api/html-view?url=${encodeURIComponent(downloadUrl)}`
        : htmlSrc
      window.open(url, '_blank', 'noopener,noreferrer')
      return
    }

    // MD/文本/代码：blob 的 Content-Type 没有 charset=utf-8，浏览器默认按其他编码显示中文乱码
    // → 读出来用 TextDecoder('utf-8') 强制解码再生成指定 charset 的 Blob
    if (previewType === 'md' || previewType === 'text') {
      try {
        const src = loadedUrl
        if (!src) throw new Error('no content')
        // blob: URL 直接 fetch；如果是 API URL（理论上这类文件不会有，只有 PDF 有）带 auth header
        const init: RequestInit = (!src.startsWith('blob:') && token)
          ? { headers: { Authorization: `Bearer ${token}` } }
          : {}
        const r = await fetch(src, init)
        if (!r.ok) throw new Error(`HTTP ${r.status}`)
        const buf = await r.arrayBuffer()
        const text = new TextDecoder('utf-8').decode(buf)
        const mimeType = previewType === 'md' ? 'text/markdown;charset=utf-8' : 'text/plain;charset=utf-8'
        const blob = new Blob([text], { type: mimeType })
        const url = URL.createObjectURL(blob)
        window.open(url, '_blank', 'noopener,noreferrer')
        setTimeout(() => URL.revokeObjectURL(url), 60000)
        return
      } catch {
        // fallback 到下方直接 open loadedUrl
      }
    }

    // PDF：loadedUrl 是需要 Authorization header 的 API URL，直接新标签页打开会 401
    // → 带 header fetch 后生成 blob URL 再 open
    if (isPdf && loadedUrl && !loadedUrl.startsWith('blob:')) {
      try {
        const headers = token ? { Authorization: `Bearer ${token}` } : undefined
        const r = await fetch(loadedUrl, headers ? { headers } : {})
        if (!r.ok) throw new Error(`HTTP ${r.status}`)
        const blob = await r.blob()
        const url = URL.createObjectURL(blob)
        window.open(url, '_blank', 'noopener,noreferrer')
        setTimeout(() => URL.revokeObjectURL(url), 60000)
        return
      } catch {
        // fetch 失败时 fallback 到 downloadUrl（会下载，但至少可用）
      }
    }

    // 其他文件（图片/视频/音频/office/csv/email）：优先用 blob 形式的 loadedUrl
    // 二进制文件不会有编码问题；浏览器能内联就内联，否则自动触发下载
    if (loadedUrl) {
      window.open(loadedUrl, '_blank', 'noopener,noreferrer')
      return
    }
    // 极端 fallback：下载链接
    if (downloadUrl) window.open(downloadUrl, '_blank', 'noopener,noreferrer')
  }, [file, previewType, ext, isPdf, token, downloadUrl, loadedUrl])

  const renderPreview = () => {
    if (loading) return <div className="flex flex-col items-center justify-center h-full gap-3"><Loader2 className="size-8 animate-spin text-muted-foreground" /><p className="text-sm text-muted-foreground">加载文件…</p></div>
    if (error) return <div className="flex flex-col items-center justify-center h-full gap-3"><FileTypeIcon mimeType={file.mimeType} filename={file.filename} className="size-12" /><p className="text-sm text-destructive">{error}</p><Button variant="outline" size="sm" onClick={handleDownload}><Download className="size-3.5 mr-1" />直接下载</Button></div>
    if (!loadedUrl) return <div className="flex items-center justify-center h-full"><Loader2 className="size-6 animate-spin text-muted-foreground" /></div>

    if (previewType === 'pdf') return <PdfPreview url={loadedUrl!} file={file} authToken={token || undefined} />

    if (previewType === 'office') {
      return <OfficePreviewWrapper url={loadedUrl!} file={file} onDownload={handleDownload} />
    }

    switch (previewType) {
      case 'image': return <ImageViewer src={loadedUrl!} alt={displayFileName(file)} onDownload={handleDownload} />
      case 'video': return <video src={loadedUrl!} controls className="max-h-full max-w-full rounded-lg bg-black" preload="metadata" />
      case 'audio': return <div className="flex flex-col items-center justify-center h-full px-4"><FileTypeIcon mimeType={file.mimeType} className="size-16 mb-4" /><p className="text-sm font-medium mb-1 truncate max-w-full">{displayFileName(file)}</p><audio src={loadedUrl!} controls className="w-full max-w-md mt-4" preload="metadata" /></div>
      case 'email': return <EmailPreviewWrapper url={loadedUrl!} file={file} />
      case 'csv': return <CsvPreviewWrapper url={loadedUrl!} file={file} />
      case 'md': return <MarkdownPreview url={loadedUrl!} />
      case 'html': return <HtmlPreview url={loadedUrl!} />
      case 'text': {
        const lang = getLanguage(file.mimeType, file.filename)
        if (lang && lang !== 'plaintext') {
          if (file.size > 100 * 1024) return <CodeMirrorPreviewWrapper url={loadedUrl!} language={lang} />
          return <CodePreview url={loadedUrl!} language={lang} filename={displayFileName(file)} />
        }
        return <TextPreview url={loadedUrl!} />
      }
      default: return <div className="flex flex-col items-center justify-center h-full gap-4"><FileTypeIcon mimeType={file.mimeType} filename={file.filename} className="size-12" /><div className="text-center"><p className="text-sm font-medium">{displayFileName(file)}</p><p className="text-xs text-muted-foreground mt-1">{formatSize(file.size)} · {file.mimeType}</p></div><Badge variant="outline" className="text-[10px]">不支持预览</Badge></div>
    }
  }

  return (
    <Dialog open={!!file} onOpenChange={onClose}>
      <DialogContent className="w-dvw h-dvh max-w-none sm:max-w-[90vw] sm:max-h-[90vh] sm:rounded-lg flex flex-col !gap-0 !p-0 overflow-hidden">
        {/* Header */}
        <div className="shrink-0 flex items-center gap-2 px-3 sm:px-4 py-1.5 sm:py-2.5 border-b">
          <FileTypeIcon mimeType={file.mimeType} filename={file.filename} className="size-4 sm:size-6 shrink-0" />
          <div className="flex-1 min-w-0">
            <DialogTitle className="truncate text-xs sm:text-sm">{displayFileName(file)}</DialogTitle>
            <DialogDescription className="flex items-center gap-1 sm:gap-1.5 flex-wrap text-[9px] sm:text-[11px]">
              <span>{formatSize(file.size)}</span><span className="hidden sm:inline">·</span>
              <Badge variant="secondary" className="text-[8px] h-3.5 px-1 rounded">V{file.currentVersion || 1}</Badge>
              <span className="hidden sm:inline">·</span><span>{getPreviewLabel(previewType)}</span>
            </DialogDescription>
          </div>
        </div>
        {/* Body — fills remaining height */}
        <div className="flex-1 min-h-0 overflow-hidden">{renderPreview()}</div>
        {/* Footer */}
        <div className="shrink-0 flex items-center gap-1.5 px-2 sm:px-4 py-1.5 sm:py-2 border-t bg-muted/30">
          <Button variant="outline" size="sm" onClick={handleDownload} disabled={!downloadUrl} className="touch-manipulation h-8 sm:min-h-[44px] px-2 sm:px-3 text-[11px] sm:text-sm">
            <Download className="size-3.5 mr-1" />下载
          </Button>
          <Button variant="outline" size="sm" onClick={handleOpenNewTab} disabled={!downloadUrl && !loadedUrl} className="touch-manipulation h-8 sm:min-h-[44px] px-2 sm:px-3 text-[11px] sm:text-sm">
            <ExternalLink className="size-3.5 mr-1" />新标签页查看
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
