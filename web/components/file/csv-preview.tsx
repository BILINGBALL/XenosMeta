'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import Papa from 'papaparse'
import { type FileItem } from '@/stores/file-store'
import { displayFileName } from '@/lib/file-utils'
import { Loader2, Search, ChevronLeft, ChevronRight, Columns2 } from 'lucide-react'

interface CsvPreviewProps {
  url: string
  file: FileItem
}

const PREVIEW_ROWS = 200
const PAGE_SIZE = 100

export function CsvPreview({ url, file }: CsvPreviewProps) {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [data, setData] = useState<string[][]>([])
  const [headers, setHeaders] = useState<string[]>([])
  const [totalRows, setTotalRows] = useState(0)
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(0)
  const [frozenColumns, setFrozenColumns] = useState(0)
  const [hasHeader, setHasHeader] = useState(true)
  const [delimiter, setDelimiter] = useState<string | null>(null)
  const [autoDetected, setAutoDetected] = useState(true)

  const loadCsv = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const response = await fetch(url)
      if (!response.ok) throw new Error(`HTTP ${response.status}`)
      const text = await response.text()

      const parseResult = Papa.parse<string[]>(text, {
        delimiter: delimiter || ',',
        skipEmptyLines: true,
        worker: false,
      })

      const rows = parseResult.data
      if (rows.length === 0) {
        setLoading(false)
        return
      }

      setTotalRows(rows.length)

      if (hasHeader && rows.length > 0) {
        const headerRow = rows[0]
        const header = headerRow.map((h, i) => h?.trim() || `列${i + 1}`)
        setHeaders(header)
        setData(rows.slice(1, PREVIEW_ROWS + 1))
      } else {
        const maxCols = Math.max(...rows.slice(0, 10).map(r => r.length))
        const header = Array.from({ length: maxCols }, (_, i) => `列${i + 1}`)
        setHeaders(header)
        setData(rows.slice(0, PREVIEW_ROWS))
      }
    } catch (e: any) {
      setError(e.message || 'CSV 解析失败')
    } finally {
      setLoading(false)
    }
  }, [url, delimiter, hasHeader])

  useEffect(() => {
    loadCsv()
  }, [loadCsv])

  const filteredData = useMemo(() => {
    if (!search) return data
    const lower = search.toLowerCase()
    return data.filter(row =>
      row.some(cell => String(cell ?? '').toLowerCase().includes(lower))
    )
  }, [data, search])

  const totalPages = Math.ceil(filteredData.length / PAGE_SIZE)
  const currentPage = Math.min(page, Math.max(0, totalPages - 1))
  const pageData = filteredData.slice(currentPage * PAGE_SIZE, (currentPage + 1) * PAGE_SIZE)

  const colWidth = useMemo(() => {
    const headerCount = headers.length
    return Math.max(80, Math.min(200, Math.floor(1200 / Math.max(headerCount, 1))))
  }, [headers.length])

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-3">
        <Loader2 className="size-8 animate-spin text-muted-foreground" />
        <p className="text-sm text-muted-foreground">解析表格文件中...</p>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-3">
        <p className="text-sm text-destructive">{error}</p>
        <button
          onClick={() => loadCsv()}
          className="text-xs text-primary hover:underline cursor-pointer"
        >
          重试
        </button>
      </div>
    )
  }

  if (data.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-2">
        <p className="text-sm text-muted-foreground">空表格</p>
      </div>
    )
  }

  return (
    <div className="h-full flex flex-col bg-white dark:bg-gray-900 rounded-lg overflow-hidden">
      <div className="flex items-center gap-2 border-b px-3 py-2 bg-muted/30 shrink-0 flex-wrap">
        <div className="relative">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 size-3 text-muted-foreground" />
          <input
            type="text"
            placeholder="搜索..."
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(0) }}
            className="pl-7 pr-2 py-1 text-xs border rounded-md bg-background w-40"
          />
        </div>

        <div className="flex items-center gap-1 text-[11px] text-muted-foreground">
          <span>{filteredData.length} 行</span>
          {totalRows > PREVIEW_ROWS && (
            <span className="text-amber-600">
              (共 {totalRows} 行, 仅预览前 {PREVIEW_ROWS} 行)
            </span>
          )}
        </div>

        <div className="flex items-center gap-1 ml-auto">
          <button
            onClick={() => setFrozenColumns(frozenColumns === 0 ? 1 : 0)}
            className={`p-1 rounded hover:bg-muted text-xs flex items-center gap-1 cursor-pointer ${frozenColumns > 0 ? 'text-primary' : 'text-muted-foreground'}`}
            title={frozenColumns > 0 ? '取消冻结首列' : '冻结首列'}
          >
            <Columns2 className="size-3" />
            {frozenColumns > 0 ? '解冻' : '冻结'}
          </button>

          <button
            onClick={() => { setHasHeader(!hasHeader); setPage(0) }}
            className={`p-1 rounded hover:bg-muted text-xs cursor-pointer ${hasHeader ? 'text-primary' : 'text-muted-foreground'}`}
            title="切换首行为表头"
          >
            表头
          </button>

          {autoDetected && (
            <div className="flex items-center gap-0.5 text-[11px]">
              <button
                onClick={() => { setDelimiter(','); setAutoDetected(false) }}
                className={`px-1.5 py-0.5 rounded cursor-pointer ${delimiter === ',' ? 'bg-primary text-primary-foreground' : 'hover:bg-muted'}`}
              >,</button>
              <button
                onClick={() => { setDelimiter('\t'); setAutoDetected(false) }}
                className={`px-1.5 py-0.5 rounded cursor-pointer ${delimiter === '\t' ? 'bg-primary text-primary-foreground' : 'hover:bg-muted'}`}
              >Tab</button>
              <button
                onClick={() => { setDelimiter(';'); setAutoDetected(false) }}
                className={`px-1.5 py-0.5 rounded cursor-pointer ${delimiter === ';' ? 'bg-primary text-primary-foreground' : 'hover:bg-muted'}`}
              >;</button>
              <button
                onClick={() => { setDelimiter(null); setAutoDetected(true) }}
                className={`px-1.5 py-0.5 rounded cursor-pointer ${autoDetected ? 'bg-primary text-primary-foreground' : 'hover:bg-muted'}`}
              >自动</button>
            </div>
          )}
        </div>
      </div>

      <div className="flex-1 overflow-auto">
        <table className="w-full border-collapse text-xs" style={{ tableLayout: 'fixed' }}>
          <thead className="sticky top-0 bg-muted z-10">
            <tr>
              <th className="border-b border-r bg-muted px-2 py-1.5 text-[10px] font-medium text-muted-foreground w-8 sticky left-0 bg-muted z-20">
                #
              </th>
              {headers.map((header, idx) => (
                <th
                  key={idx}
                  className={`border-b border-r bg-muted px-2 py-1.5 text-left font-medium text-foreground truncate ${
                    idx < frozenColumns ? 'sticky z-20 bg-muted shadow-sm' : ''
                  }`}
                  style={{
                    minWidth: colWidth,
                    ...(idx < frozenColumns ? { left: `${32 + idx * colWidth}px` } : {}),
                  }}
                  title={header}
                >
                  <div className="truncate">{header}</div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {pageData.length === 0 ? (
              <tr>
                <td colSpan={headers.length + 1} className="text-center py-8 text-muted-foreground">
                  {search ? '无匹配结果' : '无数据'}
                </td>
              </tr>
            ) : (
              pageData.map((row, rowIdx) => (
                <tr
                  key={rowIdx}
                  className={`hover:bg-muted/50 transition-colors ${rowIdx % 2 === 0 ? 'bg-background' : 'bg-muted/20'}`}
                >
                  <td className="border-b border-r px-2 py-1 text-[10px] text-muted-foreground text-center bg-muted/30 sticky left-0 z-10">
                    {currentPage * PAGE_SIZE + rowIdx + 1}
                  </td>
                  {headers.map((_, colIdx) => (
                    <td
                      key={colIdx}
                      className={`border-b border-r px-2 py-1 align-top truncate max-w-xs ${
                        colIdx < frozenColumns ? 'sticky z-10 bg-inherit' : ''
                      }`}
                      style={{
                        minWidth: colWidth,
                        ...(colIdx < frozenColumns ? { left: `${32 + colIdx * colWidth}px`, backgroundColor: rowIdx % 2 === 0 ? 'white' : 'rgb(245 245 245)' } : {}),
                      }}
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

      {totalPages > 1 && (
        <div className="flex items-center justify-between border-t px-3 py-1.5 bg-muted/20 shrink-0">
          <span className="text-[11px] text-muted-foreground">
            第 {currentPage + 1} / {totalPages} 页
          </span>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setPage(Math.max(0, currentPage - 1))}
              disabled={currentPage === 0}
              className="p-1 rounded hover:bg-muted disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
            >
              <ChevronLeft className="size-3" />
            </button>
            <button
              onClick={() => setPage(Math.min(totalPages - 1, currentPage + 1))}
              disabled={currentPage >= totalPages - 1}
              className="p-1 rounded hover:bg-muted disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
            >
              <ChevronRight className="size-3" />
            </button>
          </div>
        </div>
      )}
    </div>
  )
}