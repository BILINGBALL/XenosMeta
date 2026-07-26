import { Image, FileText, File, Film, Music, FileCode, Globe, Mail, Table2, Presentation } from 'lucide-react'

export function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

export type PreviewType = 'image' | 'video' | 'audio' | 'pdf' | 'office' | 'email' | 'csv' | 'md' | 'text' | 'html' | 'other'

const OFFICE_MIME_TYPES = new Set([
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-powerpoint',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
])

const EMAIL_MIME_TYPES = new Set([
  'message/rfc822',
  'application/vnd.ms-outlook',
])

const CSV_EXTENSIONS = new Set(['csv', 'tsv'])

export function isOfficeMimeType(m: string): boolean {
  return OFFICE_MIME_TYPES.has(m.toLowerCase())
}

export function isEmailMimeType(m: string): boolean {
  return EMAIL_MIME_TYPES.has(m.toLowerCase())
}

export function getOfficeSubType(mimeType: string, filename?: string): 'word' | 'excel' | 'ppt' | 'unknown' {
  const m = mimeType.toLowerCase()
  if (m.includes('word') || m === 'application/msword') return 'word'
  if (m.includes('excel') || m === 'application/vnd.ms-excel') return 'excel'
  if (m.includes('powerpoint') || m === 'application/vnd.ms-powerpoint') return 'ppt'
  if (filename) {
    const ext = filename.split('.').pop()?.toLowerCase()
    if (ext === 'docx' || ext === 'doc') return 'word'
    if (ext === 'xlsx' || ext === 'xls') return 'excel'
    if (ext === 'pptx' || ext === 'ppt') return 'ppt'
  }
  return 'unknown'
}

export function getPreviewType(mimeType: string, filename?: string): PreviewType {
  const m = mimeType.toLowerCase()
  const ext = filename?.split('.').pop()?.toLowerCase() || ''

  if (m.startsWith('image/')) return 'image'
  if (m.startsWith('video/')) return 'video'
  if (m.startsWith('audio/')) return 'audio'
  if (m === 'application/pdf') return 'pdf'
  if (m === 'text/html') return 'html'

  if (m === 'message/rfc822' || m === 'application/vnd.ms-outlook' || ext === 'eml' || ext === 'msg') return 'email'

  if (CSV_EXTENSIONS.has(ext) || m === 'text/csv' || m === 'text/tab-separated-values') return 'csv'

  if (m === 'text/markdown' || m === 'text/x-markdown') return 'md'
  if (ext === 'md' || ext === 'markdown') return 'md'

  if (OFFICE_MIME_TYPES.has(m)) return 'office'
  if (ext === 'docx' || ext === 'doc' || ext === 'xlsx' || ext === 'xls' || ext === 'pptx' || ext === 'ppt') return 'office'

  if (m.startsWith('text/') || m === 'application/json' || m === 'application/javascript' || m === 'application/xml' || m.includes('+json') || m.includes('+xml')) return 'text'

  return 'other'
}

export function getLanguage(mimeType: string, filename?: string): string {
  if (filename) {
    const ext = filename.split('.').pop()?.toLowerCase()
    const extMap: Record<string, string> = {
      js: 'javascript', jsx: 'javascript', ts: 'typescript', tsx: 'typescript',
      py: 'python', rb: 'ruby', go: 'go', rs: 'rust', java: 'java', kt: 'kotlin',
      c: 'c', cpp: 'cpp', h: 'c', cs: 'csharp', swift: 'swift',
      json: 'json', xml: 'xml', html: 'xml', css: 'css', scss: 'scss', less: 'less',
      sql: 'sql', yaml: 'yaml', yml: 'yaml', toml: 'ini', ini: 'ini',
      sh: 'bash', bash: 'bash', zsh: 'bash', ps1: 'powershell', bat: 'dos',
      md: 'markdown', dockerfile: 'dockerfile', vue: 'html', svelte: 'html',
      php: 'php', pl: 'perl', r: 'r', scala: 'scala', dart: 'dart',
      lua: 'lua', makefile: 'cmake', cmake: 'cmake',
      txt: 'plaintext', log: 'plaintext', conf: 'ini', env: 'plaintext',
      gitignore: 'plaintext', gitattributes: 'plaintext',
    }
    if (ext && extMap[ext]) return extMap[ext]
  }
  if (mimeType === 'application/json' || mimeType.includes('+json')) return 'json'
  if (mimeType === 'application/javascript') return 'javascript'
  if (mimeType === 'text/css') return 'css'
  if (mimeType === 'text/html') return 'xml'
  if (mimeType === 'application/xml' || mimeType.includes('+xml')) return 'xml'
  return 'plaintext'
}

export function getPreviewLabel(type: PreviewType): string {
  switch (type) {
    case 'image': return '图片预览'
    case 'video': return '视频预览'
    case 'audio': return '音频播放'
    case 'pdf':   return 'PDF 预览'
    case 'md':    return 'Markdown 预览'
    case 'html':  return 'HTML 预览'
    case 'text':  return '代码预览'
    case 'office': return 'Office 预览'
    case 'email': return '邮件预览'
    case 'csv':   return '表格预览'
    case 'other': return '文件详情'
  }
}

export function FileTypeIcon({ mimeType, filename, className = 'size-6' }: { mimeType: string; filename?: string; className?: string }) {
  const type = getPreviewType(mimeType, filename)
  const cls = `${className} shrink-0`
  switch (type) {
    case 'image': return <Image className={`${cls} text-blue-500`} />
    case 'video': return <Film className={`${cls} text-purple-500`} />
    case 'audio': return <Music className={`${cls} text-orange-500`} />
    case 'pdf':   return <FileText className={`${cls} text-red-500`} />
    case 'office': {
      const sub = getOfficeSubType(mimeType, filename)
      if (sub === 'word') return <FileText className={`${cls} text-blue-600`} />
      if (sub === 'excel') return <Table2 className={`${cls} text-green-600`} />
      if (sub === 'ppt') return <Presentation className={`${cls} text-orange-500`} />
      return <FileText className={`${cls} text-blue-600`} />
    }
    case 'md':    return <FileText className={`${cls} text-green-600`} />
    case 'html':  return <Globe className={`${cls} text-cyan-500`} />
    case 'email': return <Mail className={`${cls} text-indigo-500`} />
    case 'csv':   return <Table2 className={`${cls} text-emerald-600`} />
    case 'text':  return <FileCode className={`${cls} text-green-500`} />
    case 'other': return <File className={`${cls} text-muted-foreground`} />
  }
}

export function downloadFile(url: string, filename: string) {
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.target = '_blank'
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
}

export function displayFileName(file: { filename: string; displayName?: string | null }): string {
  return file.displayName || file.filename
}