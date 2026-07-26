'use client'

import { useEffect, useRef, useState } from 'react'
import { EditorState } from '@codemirror/state'
import { EditorView, keymap, lineNumbers, highlightActiveLine, drawSelection, rectangularSelection } from '@codemirror/view'
import { defaultHighlightStyle, syntaxHighlighting, bracketMatching, indentOnInput, foldGutter, foldKeymap } from '@codemirror/language'
import { oneDark } from '@codemirror/theme-one-dark'
import { Loader2 } from 'lucide-react'

// Dynamic language import map — only the language the user actually needs is loaded
const langImporters: Record<string, () => Promise<any>> = {
  javascript:   () => import('@codemirror/lang-javascript').then(m => m.javascript()),
  typescript:   () => import('@codemirror/lang-javascript').then(m => m.javascript({ typescript: true })),
  jsx:          () => import('@codemirror/lang-javascript').then(m => m.javascript({ jsx: true })),
  tsx:          () => import('@codemirror/lang-javascript').then(m => m.javascript({ jsx: true, typescript: true })),
  json:         () => import('@codemirror/lang-json').then(m => m.json()),
  css:          () => import('@codemirror/lang-css').then(m => m.css()),
  scss:         () => import('@codemirror/lang-css').then(m => m.css()),
  less:         () => import('@codemirror/lang-css').then(m => m.css()),
  html:         () => import('@codemirror/lang-html').then(m => m.html()),
  xml:          () => import('@codemirror/lang-xml').then(m => m.xml()),
  sql:          () => import('@codemirror/lang-sql').then(m => m.sql()),
  markdown:     () => import('@codemirror/lang-markdown').then(m => m.markdown()),
  yaml:         () => import('@codemirror/lang-markdown').then(m => m.markdown()),
}

interface CodeMirrorPreviewProps {
  content: string
  language: string
}

/**
 * Core CodeMirror 6 editor — read-only with syntax highlighting and virtual scrolling.
 * Renders millions of lines efficiently by only painting what's in the viewport.
 */
function CodeMirrorPreview({ content, language }: CodeMirrorPreviewProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const viewRef = useRef<EditorView | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [ready, setReady] = useState(false)

  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    let cancelled = false

    async function createEditor() {
      try {
        // Base read-only extensions
        const extensions: any[] = [
          lineNumbers(),
          drawSelection(),
          rectangularSelection(),
          highlightActiveLine(),
          syntaxHighlighting(defaultHighlightStyle, { fallback: true }),
          bracketMatching(),
          foldGutter(),
          indentOnInput(),
          oneDark,
          EditorView.editable.of(false),
          EditorState.readOnly.of(true),
          // Minimal keymap — allow copy, page up/down, home/end
          keymap.of([]),
        ]

        // Load language extension on demand
        const loader = langImporters[language]
        if (loader) {
          const lang = await loader()
          extensions.push(lang)
        }

        if (cancelled) return

        // Destroy previous view
        if (viewRef.current) {
          viewRef.current.destroy()
          viewRef.current = null
        }

        const state = EditorState.create({ doc: content, extensions })
        const view = new EditorView({ state, parent: container! })
        viewRef.current = view
        setReady(true)
      } catch (e: any) {
        if (!cancelled) {
          setError(e.message || '编辑器初始化失败')
        }
      }
    }

    createEditor()

    return () => {
      cancelled = true
      if (viewRef.current) {
        viewRef.current.destroy()
        viewRef.current = null
      }
    }
  }, [content, language])

  if (error) {
    return (
      <div className="flex items-center justify-center py-16 text-sm text-destructive">
        {error}
      </div>
    )
  }

  return (
    <div className="relative">
      {!ready && (
        <div className="absolute inset-0 flex items-center justify-center bg-muted/20 rounded-lg z-10">
          <Loader2 className="size-6 animate-spin text-muted-foreground" />
        </div>
      )}
      <div
        ref={containerRef}
        className="overflow-hidden rounded-lg"
        style={{ maxHeight: '70vh' }}
      />
    </div>
  )
}

// ===== Wrapper that fetches content =====
export function CodeMirrorPreviewWrapper({ url, language }: { url: string; language: string }) {
  const [content, setContent] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError('')

    fetch(url)
      .then(async (res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        const text = await res.text()
        if (!cancelled) {
          // CodeMirror handles large content natively via virtual scrolling.
          // Still cap at 10 MB to prevent browser OOM from the fetch string itself.
          if (text.length > 10 * 1024 * 1024) {
            setContent(text.slice(0, 10 * 1024 * 1024) + '\n\n/* 文件过大，已截断至 10 MB */')
          } else {
            setContent(text)
          }
        }
      })
      .catch((e) => { if (!cancelled) setError(e.message || '加载失败') })
      .finally(() => { if (!cancelled) setLoading(false) })

    return () => { cancelled = true }
  }, [url])

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="size-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex items-center justify-center py-16 text-sm text-destructive">
        {error}
      </div>
    )
  }

  return <CodeMirrorPreview content={content} language={language} />
}
