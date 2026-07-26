'use client'

import { useState, useEffect, useCallback } from 'react'
import * as mammoth from 'mammoth'
import * as XLSX from 'xlsx'
import { type FileItem } from '@/stores/file-store'
import { displayFileName, getOfficeSubType, formatSize } from '@/lib/file-utils'
import { Button } from '@/components/ui/button'
import { Loader2, Download, ExternalLink, FileText, Table2, Presentation, AlertTriangle } from 'lucide-react'

interface OfficePreviewProps {
  url: string
  file: FileItem
  onDownload: () => void
}

export function OfficePreview({ url, file, onDownload }: OfficePreviewProps) {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [wordHtml, setWordHtml] = useState('')
  const [excelSheets, setExcelSheets] = useState<{ name: string; data: any[][]; headers: any[] }[]>([])
  const [activeSheet, setActiveSheet] = useState(0)
  const [excelSearch, setExcelSearch] = useState('')
  const [filteredData, setFilteredData] = useState<any[][]>([])
  const [zoom, setZoom] = useState(1)

  const subType = getOfficeSubType(file.mimeType, file.filename)
  const isOldFormat = /\.(doc|xls|ppt)$/i.test(file.filename || '')

  const loadFile = useCallback(async () => {
    if (isOldFormat) {
      setLoading(false)
      return
    }

    setLoading(true)
    setError('')
    setWordHtml('')
    setExcelSheets([])

    try {
      const response = await fetch(url)
      if (!response.ok) throw new Error(`HTTP ${response.status}`)
      const arrayBuffer = await response.arrayBuffer()

      if (subType === 'word') {
        const result = await mammoth.convertToHtml({ arrayBuffer })
        setWordHtml(result.value)
      } else if (subType === 'excel') {
        const workbook = XLSX.read(arrayBuffer, { type: 'array' })
        const sheets = workbook.SheetNames.map(name => {
          const sheet = workbook.Sheets[name]
          const data = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '', raw: false })
          return { name, data }
        })
        const processedSheets = sheets.map(s => {
          const data = s.data as any[][]
          const headers = data.length > 0 ? data[0] : []
          const body = data.length > 1 ? data.slice(1) : []
          return { name: s.name, data: body, headers }
        })
        setExcelSheets(processedSheets)
        if (processedSheets.length > 0) setFilteredData(processedSheets[0].data)
      }
    } catch (e: any) {
      setError(e.message || '文件解析失败')
    } finally {
      setLoading(false)
    }
  }, [url, subType, isOldFormat])

  useEffect(() => {
    loadFile()
  }, [loadFile])

  useEffect(() => {
    if (excelSheets.length > 0 && excelSearch) {
      const sheet = excelSheets[activeSheet]
      const searchLower = excelSearch.toLowerCase()
      const filtered = sheet.data.filter(row =>
        row.some((cell: any) =>
          String(cell ?? '').toLowerCase().includes(searchLower)
        )
      )
      setFilteredData(filtered)
    } else if (excelSheets.length > 0) {
      setFilteredData(excelSheets[activeSheet].data)
    }
  }, [activeSheet, excelSearch, excelSheets])

  const handleOpenInNewTab = () => {
    if (url) {
      const w = window.open('', '_blank')
      if (w) {
        w.document.write(`<!DOCTYPE html><html><head><title>${displayFileName(file)}</title><style>body{margin:0}iframe{width:100vw;height:100vh;border:none}</style></head><body><iframe src="${url}"></iframe></body></html>`)
        w.document.close()
      }
    }
  }

  const renderWord = () => {
    if (loading) return <OfficeLoading />
    if (error) return <OfficeError error={error} onDownload={onDownload} />
    if (!wordHtml) return null

    return (
      <div className="h-full overflow-auto bg-white dark:bg-gray-900 rounded-lg p-4 sm:p-8 shadow-sm">
        <div
          className="prose prose-sm md:prose-base lg:prose-lg max-w-none dark:prose-invert
            prose-headings:font-semibold prose-p:leading-relaxed
            prose-img:max-w-full prose-table:text-xs"
          style={{
            transform: `scale(${zoom})`,
            transformOrigin: 'top left',
            width: `${100 / zoom}%`,
          }}
          dangerouslySetInnerHTML={{ __html: wordHtml }}
        />
      </div>
    )
  }

  const renderExcel = () => {
    if (loading) return <OfficeLoading />
    if (error) return <OfficeError error={error} onDownload={onDownload} />
    if (excelSheets.length === 0) return null

    const currentSheet = excelSheets[activeSheet]
    if (!currentSheet) return null

    const headerCount = currentSheet.headers.length
    const baseColWidth = Math.max(60, Math.min(160, Math.floor(1000 / Math.max(headerCount, 1))))

    return (
      <div className="h-full flex flex-col bg-white dark:bg-gray-900 rounded-lg overflow-hidden">
        {excelSheets.length > 1 && (
          <div className="flex items-center gap-1 border-b bg-muted/50 px-2 py-1 overflow-x-auto shrink-0">
            {excelSheets.map((sheet, idx) => (
              <button
                key={sheet.name}
                onClick={() => { setActiveSheet(idx); setExcelSearch('') }}
                className={`px-2.5 py-1 text-[11px] rounded-md whitespace-nowrap transition-colors cursor-pointer
                  ${idx === activeSheet ? 'bg-primary text-primary-foreground font-medium' : 'hover:bg-muted text-muted-foreground'}`}
              >
                {sheet.name}
              </button>
            ))}
          </div>
        )}

        <div className="flex items-center gap-2 border-b px-2.5 py-1.5 bg-muted/30 shrink-0">
          <input
            type="text"
            placeholder="搜索..."
            value={excelSearch}
            onChange={(e) => setExcelSearch(e.target.value)}
            className="flex-1 max-w-xs text-[11px] px-2 py-1 border rounded-md bg-background"
          />
          <span className="text-[10px] text-muted-foreground shrink-0">
            {filteredData.length} 行
          </span>
          <div className="ml-auto flex items-center gap-1 shrink-0">
            <span className="text-[10px] text-muted-foreground hidden sm:inline">缩放:</span>
            <button
              onClick={() => setZoom(z => Math.max(0.5, z - 0.1))}
              className="px-1.5 py-0.5 text-[11px] border rounded hover:bg-muted cursor-pointer h-6 w-6 flex items-center justify-center"
              title="缩小"
            >−</button>
            <span className="text-[10px] tabular-nums min-w-[36px] text-center">{Math.round(zoom * 100)}%</span>
            <button
              onClick={() => setZoom(z => Math.min(2, z + 0.1))}
              className="px-1.5 py-0.5 text-[11px] border rounded hover:bg-muted cursor-pointer h-6 w-6 flex items-center justify-center"
              title="放大"
            >+</button>
            <button
              onClick={() => setZoom(1)}
              className="px-1.5 py-0.5 text-[10px] border rounded hover:bg-muted cursor-pointer h-6 hidden sm:inline-flex items-center"
              title="重置"
            >重置</button>
          </div>
        </div>

        <div className="flex-1 overflow-auto">
          <div
            style={{
              transform: `scale(${zoom})`,
              transformOrigin: 'top left',
              width: `${100 / zoom}%`,
            }}
          >
            <table className="w-full border-collapse text-[11px] leading-tight" style={{ tableLayout: 'fixed' }}>
              <thead className="sticky top-0 bg-muted z-10">
                <tr>
                  <th className="border-b border-r bg-muted px-1.5 py-1 text-[9px] font-medium text-muted-foreground w-6 text-center shrink-0 sticky left-0 z-20">#</th>
                  {currentSheet.headers.map((header: any, idx: number) => (
                    <th
                      key={idx}
                      className="border-b border-r bg-muted px-1.5 py-1 text-left font-medium text-foreground truncate"
                      style={{ minWidth: baseColWidth }}
                      title={String(header ?? '')}
                    >
                      <div className="truncate">{String(header ?? '')}</div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filteredData.length === 0 && !loading ? (
                  <tr>
                    <td colSpan={headerCount + 1} className="text-center py-8 text-muted-foreground">
                      {excelSearch ? '无匹配结果' : '空工作表'}
                    </td>
                  </tr>
                ) : (
                  filteredData.map((row: any[], rowIdx: number) => (
                    <tr
                      key={rowIdx}
                      className={`hover:bg-muted/50 transition-colors ${rowIdx % 2 === 0 ? 'bg-background' : 'bg-muted/20'}`}
                    >
                      <td className="border-b border-r px-1.5 py-0.5 text-[9px] text-muted-foreground text-center bg-muted/30 sticky left-0 select-none w-6">{rowIdx + 1}</td>
                      {currentSheet.headers.map((_: any, colIdx: number) => (
                        <td
                          key={colIdx}
                          className="border-b border-r px-1.5 py-0.5 align-middle truncate"
                          style={{ minWidth: baseColWidth }}
                          title={String(row[colIdx] ?? '')}
                        >
                          {String(row[colIdx] ?? '')}
                        </td>
                      ))}
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    )
  }

  const renderFallback = () => {
    const icons = {
      word: <FileText className="size-12 text-blue-500" />,
      excel: <Table2 className="size-12 text-green-500" />,
      ppt: <Presentation className="size-12 text-orange-500" />,
      unknown: <FileText className="size-12 text-muted-foreground" />,
    }
    const labels = {
      word: 'Word 文档',
      excel: 'Excel 表格',
      ppt: 'PPT 演示文稿',
      unknown: 'Office 文档',
    }

    return (
      <div className="flex flex-col items-center justify-center h-full gap-4 px-6 text-center">
        {icons[subType as keyof typeof icons] || icons.unknown}
        <div>
          <p className="text-sm font-semibold">{displayFileName(file)}</p>
          <p className="text-xs text-muted-foreground mt-1">
            {formatSize(file.size)} · {labels[subType as keyof typeof labels] || labels.unknown}
          </p>
        </div>
        {subType === 'ppt' ? (
          <div className="space-y-3 max-w-sm">
            <div className="rounded-lg border bg-muted/30 p-3 text-left">
              <p className="text-xs font-medium flex items-center gap-1.5 mb-1">
                <AlertTriangle className="size-3 text-amber-500" /> 暂不支持在线预览
              </p>
              <p className="text-[11px] text-muted-foreground leading-relaxed">
                PPT 演示文稿预览需要 LibreOffice 后端转换，当前版本暂未集成。
                您可以下载后本地打开，或在新标签页中查看。
              </p>
            </div>
            <div className="flex items-center gap-2 justify-center">
              <Button variant="outline" size="sm" onClick={onDownload}>
                <Download className="size-3.5 mr-1" />下载文件
              </Button>
              <Button size="sm" onClick={handleOpenInNewTab}>
                <ExternalLink className="size-3.5 mr-1" />新标签页打开
              </Button>
            </div>
          </div>
        ) : isOldFormat ? (
          <div className="space-y-3 max-w-sm">
            <div className="rounded-lg border bg-amber-50 dark:bg-amber-950/20 p-3 text-left">
              <p className="text-xs font-medium flex items-center gap-1.5 mb-1 text-amber-600 dark:text-amber-400">
                <AlertTriangle className="size-3" /> 旧格式文档
              </p>
              <p className="text-[11px] text-muted-foreground leading-relaxed">
                {labels[subType as keyof typeof labels] || '文档'}为旧版二进制格式（.doc/.xls/.ppt），
                客户端解析兼容性有限。建议下载后使用 Office 或 WPS 打开。
              </p>
            </div>
            <Button size="sm" onClick={onDownload}>
              <Download className="size-3.5 mr-1" />下载文件
            </Button>
          </div>
        ) : (
          <div className="space-y-3">
            <p className="text-xs text-muted-foreground">文件解析失败，请尝试下载后本地打开</p>
            <Button size="sm" onClick={onDownload}>
              <Download className="size-3.5 mr-1" />下载文件
            </Button>
          </div>
        )}
      </div>
    )
  }

  if (subType === 'word') {
    return (
      <div className="h-full flex flex-col">
        {renderWord()}
        {wordHtml && !loading && !error && (
          <div className="flex items-center gap-2 px-3 py-1.5 border-t bg-muted/30 shrink-0">
            <span className="text-[10px] text-muted-foreground">缩放:</span>
            <button
              onClick={() => setZoom(z => Math.max(0.5, z - 0.1))}
              className="px-1.5 py-0.5 text-xs border rounded hover:bg-muted cursor-pointer"
            >−</button>
            <span className="text-xs tabular-nums min-w-[40px] text-center">{Math.round(zoom * 100)}%</span>
            <button
              onClick={() => setZoom(z => Math.min(2, z + 0.1))}
              className="px-1.5 py-0.5 text-xs border rounded hover:bg-muted cursor-pointer"
            >+</button>
            <button
              onClick={() => setZoom(1)}
              className="px-1.5 py-0.5 text-xs border rounded hover:bg-muted cursor-pointer"
            >重置</button>
          </div>
        )}
      </div>
    )
  }

  if (subType === 'excel') {
    return renderExcel()
  }

  return renderFallback()
}

function OfficeLoading() {
  return (
    <div className="flex flex-col items-center justify-center h-full gap-3">
      <Loader2 className="size-8 animate-spin text-muted-foreground" />
      <p className="text-sm text-muted-foreground">解析 Office 文件中...</p>
      <p className="text-[11px] text-muted-foreground">首次加载可能需要几秒</p>
    </div>
  )
}

function OfficeError({ error, onDownload }: { error: string; onDownload: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center h-full gap-3">
      <AlertTriangle className="size-8 text-amber-500" />
      <p className="text-sm text-destructive">{error}</p>
      <Button variant="outline" size="sm" onClick={onDownload}>
        <Download className="size-3.5 mr-1" />下载文件
      </Button>
    </div>
  )
}