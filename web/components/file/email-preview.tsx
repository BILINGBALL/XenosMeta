'use client'

import { useState, useEffect, useCallback } from 'react'
import { type FileItem } from '@/stores/file-store'
import { displayFileName } from '@/lib/file-utils'
import { Loader2, Mail, User, Calendar, Paperclip, ChevronDown, ChevronUp, ExternalLink } from 'lucide-react'

interface EmailPreviewProps {
  url: string
  file: FileItem
}

interface EmailData {
  subject: string
  from: string
  to: string
  cc: string
  date: string
  attachments: { filename: string; size: number; contentId?: string }[]
  bodyHtml: string
  bodyText: string
  hasHtml: boolean
}

export function EmailPreview({ url, file }: EmailPreviewProps) {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [emailData, setEmailData] = useState<EmailData | null>(null)
  const [showFullHeaders, setShowFullHeaders] = useState(false)
  const [showHtml, setShowHtml] = useState(true)

  const parseEml = useCallback((raw: string): EmailData => {
    const headers: Record<string, string> = {}
    let headerSection = ''
    let bodyStart = 0

    const separatorIdx = raw.search(/\r?\n\r?\n/)
    if (separatorIdx >= 0) {
      headerSection = raw.substring(0, separatorIdx)
      bodyStart = separatorIdx + (raw.match(/\r?\n\r?\n/)?.[0].length || 4)
    } else {
      headerSection = raw
    }

    const headerLines = headerSection.split(/\r?\n/)
    let currentKey = ''
    let currentValue = ''

    for (const line of headerLines) {
      if (!line.trim()) continue
      if (line.startsWith(' ') || line.startsWith('\t')) {
        currentValue += ' ' + line.trim()
      } else {
        if (currentKey) {
          headers[currentKey] = decodeMimeWords(currentValue.trim())
        }
        const colonIdx = line.indexOf(':')
        if (colonIdx > 0) {
          currentKey = line.substring(0, colonIdx).trim().toLowerCase()
          currentValue = line.substring(colonIdx + 1).trim()
        }
      }
    }
    if (currentKey) {
      headers[currentKey] = decodeMimeWords(currentValue.trim())
    }

    const rawBody = raw.substring(bodyStart)

    const attachments: EmailData['attachments'] = []
    const htmlParts: string[] = []
    const textParts: string[] = []

    const boundaryMatch = rawBody.match(/--([^\r\n]+)/)
    const boundary = boundaryMatch ? boundaryMatch[1].trim() : null

    if (boundary) {
      const parts = rawBody.split(new RegExp(`--${escapeRegExp(boundary)}`))
      for (const part of parts) {
        if (!part || part.startsWith('--')) continue
        const partHeaders = parsePartHeaders(part)
        const contentType = (partHeaders['content-type'] || '').toLowerCase()
        const disposition = (partHeaders['content-disposition'] || '').toLowerCase()
        const isAttachment = disposition.includes('attachment') || disposition.includes('form-data')

        if (isAttachment) {
          const filename = extractFilename(disposition) || extractFilename(partHeaders['content-type'] || '') || 'attachment'
          const body = extractPartBody(part)
          const size = estimateSize(body, contentType)
          attachments.push({
            filename: decodeMimeWords(filename),
            size,
            contentId: partHeaders['content-id']?.replace(/[<>]/g, ''),
          })
        } else if (contentType.includes('text/html')) {
          const body = extractPartBody(part)
          htmlParts.push(decodeBody(body, partHeaders))
        } else if (contentType.includes('text/plain')) {
          const body = extractPartBody(part)
          textParts.push(decodeBody(body, partHeaders))
        }
      }
    } else {
      const contentType = (headers['content-type'] || '').toLowerCase()
      if (contentType.includes('text/html')) {
        htmlParts.push(decodeBody(rawBody, headers))
      } else {
        textParts.push(decodeBody(rawBody, headers))
      }
    }

    const subject = headers['subject'] || '(无主题)'
    const from = headers['from'] || '(未知发件人)'
    const to = headers['to'] || ''
    const cc = headers['cc'] || ''
    const dateStr = headers['date'] || ''

    let parsedDate = dateStr
    try {
      const d = new Date(dateStr)
      if (!isNaN(d.getTime())) {
        parsedDate = d.toLocaleString('zh-CN', {
          year: 'numeric', month: '2-digit', day: '2-digit',
          hour: '2-digit', minute: '2-digit',
        })
      }
    } catch { /* keep original */ }

    return {
      subject,
      from,
      to,
      cc,
      date: parsedDate,
      attachments,
      bodyHtml: htmlParts.join('\n') || '',
      bodyText: textParts.join('\n') || '',
      hasHtml: htmlParts.length > 0,
    }
  }, [])

  const loadEmail = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const response = await fetch(url)
      if (!response.ok) throw new Error(`HTTP ${response.status}`)
      const text = await response.text()
      const data = parseEml(text)
      setEmailData(data)
    } catch (e: any) {
      setError(e.message || '邮件解析失败')
    } finally {
      setLoading(false)
    }
  }, [url, parseEml])

  useEffect(() => {
    loadEmail()
  }, [loadEmail])

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-3">
        <Loader2 className="size-8 animate-spin text-muted-foreground" />
        <p className="text-sm text-muted-foreground">解析邮件中...</p>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-3">
        <Mail className="size-12 text-muted-foreground opacity-30" />
        <p className="text-sm text-destructive">{error}</p>
      </div>
    )
  }

  if (!emailData) return null

  const formatSize = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  }

  const sanitizeHtml = (html: string): string => {
    let cleaned = html
    cleaned = cleaned.replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
    cleaned = cleaned.replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
    cleaned = cleaned.replace(/<iframe[^>]*>[\s\S]*?<\/iframe>/gi, '')
    cleaned = cleaned.replace(/on\w+="[^"]*"/gi, '')
    cleaned = cleaned.replace(/on\w+='[^']*'/gi, '')
    cleaned = cleaned.replace(/\s+on\w+=\{[^}]*\}/gi, '')
    return cleaned
  }

  return (
    <div className="h-full flex flex-col bg-white dark:bg-gray-900 rounded-lg overflow-hidden">
      <div className="border-b bg-muted/30 px-3 sm:px-4 py-3 shrink-0">
        <div className="flex items-start gap-2 mb-2">
          <Mail className="size-4 mt-0.5 text-indigo-500 shrink-0" />
          <h3 className="text-sm font-semibold flex-1 break-words">
            {emailData.subject}
          </h3>
        </div>

        <div className="space-y-1 text-xs">
          <div className="flex items-start gap-2">
            <User className="size-3 text-muted-foreground mt-0.5 shrink-0" />
            <span className="text-muted-foreground shrink-0">发件人:</span>
            <span className="break-all">{emailData.from}</span>
          </div>
          {emailData.to && (
            <div className="flex items-start gap-2">
              <span className="size-3 shrink-0" />
              <span className="text-muted-foreground shrink-0">收件人:</span>
              <span className="break-all">{emailData.to}</span>
            </div>
          )}
          {emailData.cc && (
            <div className="flex items-start gap-2">
              <span className="size-3 shrink-0" />
              <span className="text-muted-foreground shrink-0">抄送:</span>
              <span className="break-all">{emailData.cc}</span>
            </div>
          )}
          <div className="flex items-center gap-2">
            <Calendar className="size-3 text-muted-foreground" />
            <span>{emailData.date}</span>
          </div>
        </div>

        {emailData.attachments.length > 0 && (
          <div className="mt-2 pt-2 border-t border-muted">
            <div className="flex items-center gap-1 text-xs text-muted-foreground mb-1.5">
              <Paperclip className="size-3" />
              <span>{emailData.attachments.length} 个附件</span>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {emailData.attachments.map((att, idx) => (
                <span
                  key={idx}
                  className="inline-flex items-center gap-1 rounded-md bg-muted px-2 py-0.5 text-[11px]"
                >
                  <Paperclip className="size-2.5" />
                  {att.filename}
                  <span className="text-muted-foreground">({formatSize(att.size)})</span>
                </span>
              ))}
            </div>
          </div>
        )}
      </div>

      {emailData.hasHtml && (
        <div className="flex items-center gap-1 border-b px-3 py-1.5 bg-muted/20 shrink-0">
          <button
            onClick={() => setShowHtml(true)}
            className={`px-2 py-1 text-[11px] rounded transition-colors cursor-pointer ${showHtml ? 'bg-primary text-primary-foreground' : 'hover:bg-muted text-muted-foreground'}`}
          >
            HTML
          </button>
          <button
            onClick={() => setShowHtml(false)}
            className={`px-2 py-1 text-[11px] rounded transition-colors cursor-pointer ${!showHtml ? 'bg-primary text-primary-foreground' : 'hover:bg-muted text-muted-foreground'}`}
          >
            纯文本
          </button>
          <button
            onClick={() => setShowFullHeaders(!showFullHeaders)}
            className="ml-auto flex items-center gap-0.5 px-2 py-1 text-[11px] rounded hover:bg-muted text-muted-foreground cursor-pointer"
          >
            {showFullHeaders ? <ChevronUp className="size-3" /> : <ChevronDown className="size-3" />}
            详情
          </button>
        </div>
      )}

      <div className="flex-1 overflow-auto">
        {showFullHeaders && (
          <div className="border-b bg-muted/10 p-3 text-[11px] font-mono text-muted-foreground space-y-0.5">
            <div><strong className="text-foreground">From:</strong> {emailData.from}</div>
            <div><strong className="text-foreground">To:</strong> {emailData.to || '-'}</div>
            <div><strong className="text-foreground">Cc:</strong> {emailData.cc || '-'}</div>
            <div><strong className="text-foreground">Date:</strong> {emailData.date}</div>
            <div><strong className="text-foreground">Subject:</strong> {emailData.subject}</div>
          </div>
        )}

        {showHtml && emailData.hasHtml ? (
          <iframe
            srcDoc={sanitizeHtml(emailData.bodyHtml)}
            sandbox="allow-same-origin"
            className="w-full min-h-full border-0"
            title="Email HTML Body"
            style={{ minHeight: '300px' }}
          />
        ) : (
          <pre className="p-4 text-xs font-mono whitespace-pre-wrap break-words text-foreground leading-relaxed">
            {emailData.bodyText || emailData.bodyHtml.replace(/<[^>]*>/g, '')}
          </pre>
        )}
      </div>
    </div>
  )
}

function decodeMimeWords(str: string): string {
  if (!str) return ''
  return str.replace(/=\?([^?]+)\?([Bb])\?([^?]*)\?=/g, (_match, charset, enc, encoded) => {
    try {
      let bytes: Uint8Array
      if (enc === 'B') {
        bytes = new Uint8Array(atob(encoded).split('').map(c => c.charCodeAt(0)))
      } else {
        const hexBytes: number[] = []
        for (let i = 0; i < encoded.length; i += 2) {
          hexBytes.push(parseInt(encoded.substr(i, 2), 16))
        }
        bytes = new Uint8Array(hexBytes)
      }
      const decoder = new TextDecoder(charset.toLowerCase())
      return decoder.decode(bytes)
    } catch {
      return encoded
    }
  })
}

function escapeRegExp(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function parsePartHeaders(part: string): Record<string, string> {
  const headers: Record<string, string> = {}
  const lines = part.split(/\r?\n/)
  let inHeaders = true

  for (const line of lines) {
    if (inHeaders && line.trim() === '') {
      inHeaders = false
      break
    }
    if (inHeaders) {
      const colonIdx = line.indexOf(':')
      if (colonIdx > 0) {
        headers[line.substring(0, colonIdx).trim().toLowerCase()] = line.substring(colonIdx + 1).trim()
      }
    }
  }
  return headers
}

function extractPartBody(part: string): string {
  const separatorIdx = part.search(/\r?\n\r?\n/)
  if (separatorIdx >= 0) {
    return part.substring(separatorIdx + 4)
  }
  return ''
}

function extractFilename(headerValue: string): string {
  const match = headerValue.match(/filename\*?=(?:"([^"]+)"|([^;\s]+))/i)
  if (match) return match[1] || match[2] || ''
  return ''
}

function decodeBody(body: string, headers: Record<string, string>): string {
  const transferEncoding = (headers['content-transfer-encoding'] || '').toLowerCase()
  const charsetMatch = (headers['content-type'] || '').match(/charset="?([^";]+)"?/)
  const charset = charsetMatch ? charsetMatch[1] : 'utf-8'

  try {
    if (transferEncoding === 'base64') {
      const clean = body.replace(/\s/g, '')
      const binary = atob(clean)
      const bytes = new Uint8Array(binary.length)
      for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
      return new TextDecoder(charset).decode(bytes)
    }
    if (transferEncoding === 'quoted-printable') {
      return decodeQuotedPrintable(body, charset)
    }
  } catch { /* fall through */ }

  return body
}

function decodeQuotedPrintable(input: string, charset: string): string {
  const bytes: number[] = []
  const lines = input.replace(/=\r?\n/g, '').split(/\r?\n/)
  for (const line of lines) {
    for (let i = 0; i < line.length; i++) {
      if (line[i] === '=' && i + 2 < line.length) {
        const hex = line.substr(i + 1, 2)
        const byte = parseInt(hex, 16)
        if (!isNaN(byte)) {
          bytes.push(byte)
          i += 2
        }
      } else {
        bytes.push(line.charCodeAt(i))
      }
    }
  }
  try {
    return new TextDecoder(charset).decode(new Uint8Array(bytes))
  } catch {
    return String.fromCharCode(...bytes)
  }
}

function estimateSize(content: string, contentType: string): number {
  if (contentType.includes('base64')) {
    return Math.floor(content.replace(/\s/g, '').length * 0.75)
  }
  return content.length
}