'use client'

import { useState, useEffect, useCallback } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import rehypeHighlight from 'rehype-highlight'
import { Button } from '@/components/ui/button'
import { Eye, Code, Copy, Check, Loader2, FileText } from 'lucide-react'

interface MarkdownPreviewProps {
  url: string
}

export function MarkdownPreview({ url }: MarkdownPreviewProps) {
  const [md, setMd] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [mode, setMode] = useState<'render' | 'source'>('render')
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError('')
    fetch(url)
      .then(async (r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`)
        const t = await r.text()
        if (!cancelled) setMd(t.length > 512000 ? t.slice(0, 512000) + '\n\n*...内容已截断...*' : t)
      })
      .catch((e) => { if (!cancelled) setError(e.message || '加载失败') })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [url])

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(md)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      const ta = document.createElement('textarea')
      ta.value = md
      ta.style.position = 'fixed'
      ta.style.opacity = '0'
      document.body.appendChild(ta)
      ta.select()
      document.execCommand('copy')
      document.body.removeChild(ta)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }, [md])

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-3">
        <Loader2 className="size-7 animate-spin text-muted-foreground" />
        <p className="text-sm text-muted-foreground">加载 Markdown...</p>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-3">
        <FileText className="size-10 text-muted-foreground/50" />
        <p className="text-sm text-destructive">{error}</p>
      </div>
    )
  }

  return (
    <div className="h-full flex flex-col">
      {/* 工具栏 */}
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
            <Eye className="size-3" />
            <span className="hidden sm:inline">渲染</span>
          </button>
          <button
            onClick={() => setMode('source')}
            className={`flex items-center gap-1 px-2.5 py-1 text-[11px] rounded transition-colors cursor-pointer ${
              mode === 'source'
                ? 'bg-background text-foreground shadow-sm font-medium'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            <Code className="size-3" />
            <span className="hidden sm:inline">源码</span>
          </button>
        </div>

        <div className="ml-auto flex items-center gap-1">
          <span className="text-[10px] text-muted-foreground tabular-nums hidden sm:inline">
            {md.length.toLocaleString()} 字符
          </span>
          <Button variant="ghost" size="sm" onClick={handleCopy} className="h-7 text-[11px] gap-1">
            {copied ? <Check className="size-3 text-green-500" /> : <Copy className="size-3" />}
            <span className="hidden sm:inline">{copied ? '已复制' : '复制'}</span>
          </Button>
        </div>
      </div>

      {/* 内容区 */}
      <div className="flex-1 min-h-0 overflow-auto">
        {mode === 'render' ? (
          <div className="md-body mx-auto max-w-4xl px-4 sm:px-8 py-6 sm:py-10">
            <ReactMarkdown
              remarkPlugins={[remarkGfm]}
              rehypePlugins={[[rehypeHighlight, { detect: true, ignoreMissing: true }]]}
              components={{
                a: ({ node: _node, ...props }) => (
                  <a {...props} target="_blank" rel="noopener noreferrer" />
                ),
              }}
            >
              {md}
            </ReactMarkdown>
          </div>
        ) : (
          <pre className="text-xs font-mono leading-relaxed p-4 sm:p-6 whitespace-pre-wrap break-words text-muted-foreground">
            {md}
          </pre>
        )}
      </div>
    </div>
  )
}
