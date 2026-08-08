'use client'

import { useEffect, useLayoutEffect, useRef, useState, useCallback } from 'react'
import * as pdfjsLib from 'pdfjs-dist/legacy/build/pdf.mjs'
import { type FileItem } from '@/stores/file-store'
import { displayFileName } from '@/lib/file-utils'
import { Button } from '@/components/ui/button'
import { Loader2, ChevronLeft, ChevronRight, ZoomIn, ZoomOut, Maximize2 } from 'lucide-react'

const ZOOM_STEPS = [0.5, 0.75, 1, 1.25, 1.5, 2, 2.5, 3]
const PAGE_GAP = 12
const BUFFER = 1 // pre-render this many pages above/below viewport
const CLEAR_DIST = 5 // clear canvases this far from viewport

interface PdfPreviewProps { url: string; file: FileItem; authToken?: string }

export default function PdfPreview({ url, file, authToken }: PdfPreviewProps) {
  const name = displayFileName(file)
  const viewerRef = useRef<HTMLDivElement>(null)
  const contentRef = useRef<HTMLDivElement>(null)
  const pdfDocRef = useRef<any>(null)
  const pageSizesRef = useRef<{ w: number; h: number }[]>([])
  const pageTopsRef = useRef<number[]>([])
  const canvasByPageRef = useRef<Map<number, { canvas: HTMLCanvasElement; zoom: number }>>(new Map())
  const genRef = useRef(0)
  const scrollAnchorRef = useRef<{ page: number; ratio: number } | null>(null)
  // pinch 松手 commit 标记：true 时 changeZoom 不清 canvas，由 pageHeights useLayoutEffect 统一清
  const pinchCommitRef = useRef(false)

  const [totalPages, setTotalPages] = useState(0)
  const [currentPage, setCurrentPage] = useState(1)
  const [zoom, setZoom] = useState(1)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [pageHeights, setPageHeights] = useState<number[]>([])
  const [pageWidths, setPageWidths] = useState<number[]>([])

  /** 从错误消息中剥离 URL / JWT 等敏感信息，避免泄漏到 UI */
  const sanitizeError = (msg: string | undefined): string => {
    if (!msg) return '加载失败，请重试'
    // 先替换整个 URL
    let cleaned = msg.replace(/https?:\/\/[^\s]+/g, '[URL]')
    // 干掉明显的 JWT (eyJ... 长串) 或 query 里的 _token=xxx
    cleaned = cleaned.replace(/(?:_token|token|auth|authorization)=[A-Za-z0-9\-._~+/]+=*/gi, '[TOKEN]')
    cleaned = cleaned.replace(/eyJ[A-Za-z0-9_\-]{10,}\.[A-Za-z0-9_\-]{10,}\.[A-Za-z0-9_\-]{10,}/g, '[JWT]')
    return cleaned
  }

  // ===== 初始化 PDF worker + 加载文档 =====
  useEffect(() => {
    let cancelled = false
    setLoading(true); setError(''); setTotalPages(0); setCurrentPage(1)
    setPageHeights([])
    pageSizesRef.current = []; pageTopsRef.current = []
    canvasByPageRef.current.clear()
    pdfDocRef.current = null

    // workerSrc 懒加载，避免模块初始化时加载竞争导致偶发失败
    pdfjsLib.GlobalWorkerOptions.workerSrc = '/pdf.worker.mjs'

    const load = async () => {
      try {
        const headers: Record<string, string> = authToken
          ? { Authorization: `Bearer ${authToken}` }
          : {}
        const doc = await pdfjsLib.getDocument({
          url,
          // 禁用范围内请求 + 使用请求头传 token，彻底避免 URL 带 token
          httpHeaders: headers,
          useSystemFonts: true,
          withCredentials: false,
        }).promise
        if (cancelled) return
        pdfDocRef.current = doc
        setTotalPages(doc.numPages)

        // Fetch all page sizes (needed for accurate placeholders)
        const sizes: { w: number; h: number }[] = []
        for (let i = 1; i <= doc.numPages; i++) {
          if (cancelled) return
          const page = await doc.getPage(i)
          const vp = page.getViewport({ scale: 1 })
          sizes.push({ w: vp.width, h: vp.height })
          // Yield periodically to avoid blocking
          if (i % 10 === 0) {
            await new Promise<void>(r => setTimeout(r, 0))
            if (cancelled) return
          }
        }
        if (cancelled) return
        pageSizesRef.current = sizes
        setLoading(false)
      } catch (err: any) {
        if (cancelled) return
        setError(sanitizeError(err?.message))
        setLoading(false)
      }
    }
    load()
    return () => {
      cancelled = true
      if (pdfDocRef.current) {
        try { pdfDocRef.current.destroy() } catch { /* ignore */ }
        pdfDocRef.current = null
      }
    }
  }, [url, authToken])

  // ===== Compute page widths and heights at a given zoom =====
  const computeDimensions = useCallback((z: number) => {
    const viewer = viewerRef.current
    if (!viewer || pageSizesRef.current.length === 0) return { heights: [], widths: [] }
    const cw = viewer.clientWidth - PAGE_GAP
    const heights = pageSizesRef.current.map(s => s.h * (cw / s.w) * z + PAGE_GAP)
    const widths = pageSizesRef.current.map(s => s.w * (cw / s.w) * z)
    return { heights, widths }
  }, [])

  // ===== Update heights + widths + page tops when zoom changes or PDF loads =====
  // 使用 useLayoutEffect 确保尺寸变更在 paint 前完成，避免闪烁
  useLayoutEffect(() => {
    if (pageSizesRef.current.length === 0) return
    const { heights, widths } = computeDimensions(zoom)
    setPageHeights(heights)
    setPageWidths(widths)
    const tops: number[] = []
    let y = 0
    for (const h of heights) { tops.push(y); y += h }
    pageTopsRef.current = tops
  }, [zoom, computeDimensions, loading])

  // ===== After heights update: restore scroll + render visible =====
  // 使用 useLayoutEffect 确保滚动恢复 + transform 清除在 paint 前完成
  useLayoutEffect(() => {
    if (pageHeights.length === 0) return

    // Restore scroll position after zoom change
    if (scrollAnchorRef.current) {
      const { page, ratio } = scrollAnchorRef.current
      const top = pageTopsRef.current[page - 1] ?? 0
      const h = pageHeights[page - 1] ?? 0
      const viewer = viewerRef.current
      if (viewer) viewer.scrollTop = top + ratio * h
      scrollAnchorRef.current = null
    }

    // pinch commit：此时 pageHeights 已更新到新 zoom，在同一同步帧内清 transform + 旧 canvas
    // 浏览器不会 paint 中间状态 → 用户看到的是平滑过渡
    if (pinchCommitRef.current) {
      const c = contentRef.current
      if (c) { c.style.transform = ''; c.style.transformOrigin = '' }
      const viewer = viewerRef.current
      canvasByPageRef.current.clear()
      if (viewer) viewer.querySelectorAll('[data-pdf-ph]').forEach(el => { (el as HTMLElement).innerHTML = '' })
      pinchCommitRef.current = false
    }

    // Render visible pages
    renderVisiblePages()
  }, [pageHeights]) // eslint-disable-line react-hooks/exhaustive-deps

  // ===== Render a single page into its placeholder =====
  const renderPage = useCallback(async (pageNum: number, currentZoom: number, gen: number) => {
    const pdfDoc = pdfDocRef.current
    const viewer = viewerRef.current
    if (!pdfDoc || !viewer || gen !== genRef.current) return

    const size = pageSizesRef.current[pageNum - 1]
    if (!size) return

    // Already rendered at this zoom?
    const existing = canvasByPageRef.current.get(pageNum)
    if (existing && existing.zoom === currentZoom) return

    try {
      const page = await pdfDoc.getPage(pageNum)
      if (gen !== genRef.current) return

      const cw = viewer.clientWidth - PAGE_GAP
      const scale = (cw / size.w) * currentZoom
      const viewport = page.getViewport({ scale })
      // Cap DPR at 2 for mobile performance
      const dpr = Math.min(window.devicePixelRatio || 1, 2)

      const canvas = document.createElement('canvas')
      canvas.width = Math.floor(viewport.width * dpr)
      canvas.height = Math.floor(viewport.height * dpr)
      canvas.style.width = `${viewport.width}px`
      canvas.style.height = `${viewport.height}px`
      canvas.style.display = 'block'
      canvas.style.margin = `${PAGE_GAP}px 0 0 0`

      const ctx = canvas.getContext('2d')!
      ctx.scale(dpr, dpr)
      await page.render({ canvasContext: ctx, viewport }).promise

      if (gen !== genRef.current) return

      // Insert into placeholder
      const ph = viewer.querySelector(`[data-pdf-ph="${pageNum}"]`)
      if (ph) {
        ph.innerHTML = ''
        ph.appendChild(canvas)
        canvasByPageRef.current.set(pageNum, { canvas, zoom: currentZoom })
      }
    } catch { /* stale render */ }
  }, [])

  // ===== Render only visible pages (virtual rendering) =====
  const renderVisiblePages = useCallback(async () => {
    const viewer = viewerRef.current
    if (!viewer || pageHeights.length === 0) return

    const gen = ++genRef.current
    const scrollTop = viewer.scrollTop
    const viewH = viewer.clientHeight

    // Find visible page range
    let firstPage = 1
    let lastPage = totalPages

    for (let i = 0; i < pageHeights.length; i++) {
      const top = pageTopsRef.current[i] ?? 0
      const bot = top + pageHeights[i]
      if (bot >= scrollTop - viewH * BUFFER) {
        firstPage = Math.max(1, i + 1 - BUFFER)
        break
      }
    }
    for (let i = firstPage - 1; i < pageHeights.length; i++) {
      const top = pageTopsRef.current[i] ?? 0
      if (top > scrollTop + viewH + viewH * BUFFER) {
        lastPage = Math.min(totalPages, i + BUFFER)
        break
      }
    }

    // Render visible pages (don't await — fire and forget for responsiveness)
    for (let p = firstPage; p <= lastPage; p++) {
      renderPage(p, zoom, gen)
    }

    // Clear distant canvases to free memory
    for (const [page] of canvasByPageRef.current) {
      if (page < firstPage - CLEAR_DIST || page > lastPage + CLEAR_DIST) {
        const ph = viewer.querySelector(`[data-pdf-ph="${page}"]`)
        if (ph) ph.innerHTML = ''
        canvasByPageRef.current.delete(page)
      }
    }
  }, [pageHeights, totalPages, zoom, renderPage])

  // ===== Scroll handler: update current page + render visible =====
  useEffect(() => {
    const viewer = viewerRef.current
    if (!viewer || pageHeights.length === 0) return
    let ticking = false
    const onScroll = () => {
      if (ticking) return
      ticking = true
      requestAnimationFrame(() => {
        ticking = false
        const v = viewerRef.current
        if (!v) return
        const st = v.scrollTop
        // Find current page
        for (let i = 0; i < pageHeights.length; i++) {
          if ((pageTopsRef.current[i] ?? 0) + pageHeights[i] > st + 2) {
            setCurrentPage(i + 1)
            break
          }
        }
        renderVisiblePages()
      })
    }
    viewer.addEventListener('scroll', onScroll, { passive: true })
    return () => viewer.removeEventListener('scroll', onScroll)
  }, [pageHeights, renderVisiblePages])

  // ===== Change zoom with scroll position preservation =====
  const changeZoom = useCallback((newZoom: number) => {
    const viewer = viewerRef.current
    if (viewer && pageHeights.length > 0) {
      const st = viewer.scrollTop
      // Find current page and ratio within it
      for (let i = 0; i < pageHeights.length; i++) {
        const top = pageTopsRef.current[i] ?? 0
        if (top + pageHeights[i] > st) {
          scrollAnchorRef.current = {
            page: i + 1,
            ratio: pageHeights[i] > 0 ? (st - top) / pageHeights[i] : 0,
          }
          break
        }
      }
    }
    // pinch commit 时不清 canvas（transform 还在，旧 canvas 仍可见）
    // 由 pageHeights useLayoutEffect 统一清
    if (!pinchCommitRef.current) {
      canvasByPageRef.current.clear()
      if (viewer) viewer.querySelectorAll('[data-pdf-ph]').forEach(el => { (el as HTMLElement).innerHTML = '' })
    }
    setZoom(newZoom)
  }, [pageHeights])

  // ===== Window resize → recompute heights =====
  useEffect(() => {
    let raf = 0
    const onResize = () => {
      cancelAnimationFrame(raf)
      raf = requestAnimationFrame(() => {
        if (pageSizesRef.current.length === 0) return
        // Capture anchor before resize
        const viewer = viewerRef.current
        if (viewer && pageHeights.length > 0) {
          const st = viewer.scrollTop
          for (let i = 0; i < pageHeights.length; i++) {
            if ((pageTopsRef.current[i] ?? 0) + pageHeights[i] > st) {
              scrollAnchorRef.current = {
                page: i + 1,
                ratio: pageHeights[i] > 0 ? (st - (pageTopsRef.current[i] ?? 0)) / pageHeights[i] : 0,
              }
              break
            }
          }
        }
        canvasByPageRef.current.clear()
        if (viewer) viewer.querySelectorAll('[data-pdf-ph]').forEach(el => { (el as HTMLElement).innerHTML = '' })
        const { heights, widths } = computeDimensions(zoom)
        setPageHeights(heights)
        setPageWidths(widths)
        const tops: number[] = []
        let y = 0
        for (const h of heights) { tops.push(y); y += h }
        pageTopsRef.current = tops
      })
    }
    window.addEventListener('resize', onResize)
    return () => { window.removeEventListener('resize', onResize); cancelAnimationFrame(raf) }
  }, [zoom, pageHeights, computeDimensions])

  // ===== Scroll to page =====
  const scrollToPage = useCallback((n: number) => {
    const viewer = viewerRef.current
    if (!viewer) return
    const top = pageTopsRef.current[n - 1] ?? 0
    viewer.scrollTo({ top, behavior: 'smooth' })
    setCurrentPage(n)
  }, [])

  // ===== Keyboard =====
  useEffect(() => {
    const kd = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return
      if (e.key === 'ArrowUp' || e.key === 'ArrowLeft') { e.preventDefault(); if (currentPage > 1) scrollToPage(currentPage - 1) }
      if (e.key === 'ArrowDown' || e.key === 'ArrowRight') { e.preventDefault(); if (currentPage < totalPages) scrollToPage(currentPage + 1) }
    }
    document.addEventListener('keydown', kd)
    return () => document.removeEventListener('keydown', kd)
  }, [currentPage, totalPages, scrollToPage])

  // ===== Ctrl+Wheel zoom =====
  useEffect(() => {
    const v = viewerRef.current
    if (!v) return
    const wh = (e: WheelEvent) => {
      if (e.ctrlKey || e.metaKey) {
        e.preventDefault()
        const idx = ZOOM_STEPS.findIndex(s => s > zoom + 0.001)
        const next = e.deltaY > 0
          ? (ZOOM_STEPS.findLastIndex(s => s < zoom - 0.001) >= 0 ? ZOOM_STEPS[ZOOM_STEPS.findLastIndex(s => s < zoom - 0.001)] : 0.5)
          : (idx >= 0 ? ZOOM_STEPS[idx] : 3)
        changeZoom(next)
      }
    }
    v.addEventListener('wheel', wh, { passive: false })
    return () => v.removeEventListener('wheel', wh)
  }, [zoom, changeZoom])

  // ===== Touch pinch zoom =====
  // pinch 过程中用 CSS transform 做实时预览（GPU 加速），松手后才 commit 到真实 zoom
  useEffect(() => {
    const v = viewerRef.current
    const c = contentRef.current
    if (!v || !c) return
    const td = (t: TouchList) => t.length < 2 ? 0 : Math.hypot(t[0].clientX - t[1].clientX, t[0].clientY - t[1].clientY)
    let pDist = 0, pZoom = 1, pinchActive = false, curScale = 1

    const clearTransform = () => {
      c.style.transform = ''
      c.style.transformOrigin = ''
    }

    const ts = (e: TouchEvent) => {
      if (e.touches.length === 2) {
        pDist = td(e.touches)
        pZoom = zoom
        curScale = 1
        pinchActive = true
        // 以双指中点为缩放原点（相对于 content 的坐标）
        const rect = c.getBoundingClientRect()
        const midX = (e.touches[0].clientX + e.touches[1].clientX) / 2 - rect.left
        const midY = (e.touches[0].clientY + e.touches[1].clientY) / 2 - rect.top
        c.style.transformOrigin = `${midX}px ${midY}px`
      }
    }
    const tm = (e: TouchEvent) => {
      if (!pinchActive || e.touches.length !== 2) return
      e.preventDefault()
      if (pDist <= 0) return
      // 实时更新 CSS scale — 纯 GPU 合成，不触发 React 重渲染
      const raw = td(e.touches) / pDist
      // 确保 final zoom (pZoom * raw) 在 0.5~3 范围
      curScale = Math.max(0.5 / pZoom, Math.min(3 / pZoom, raw))
      c.style.transform = `scale(${curScale})`
    }
    const te = () => {
      if (!pinchActive) return
      pinchActive = false
      const finalZoom = Math.max(0.5, Math.min(3, Math.round(pZoom * curScale * 100) / 100))
      if (Math.abs(finalZoom - zoom) >= 0.01) {
        // 不清 transform！设置 commit 标记，让 pageHeights useLayoutEffect 在 paint 前统一清
        // 这样 transform → 新 zoom 的切换在同一帧完成，无闪烁
        pinchCommitRef.current = true
        changeZoom(finalZoom)
      } else {
        clearTransform()
      }
    }
    v.addEventListener('touchstart', ts, { passive: true })
    v.addEventListener('touchmove', tm, { passive: false })
    v.addEventListener('touchend', te, { passive: true })
    v.addEventListener('touchcancel', () => { pinchActive = false; clearTransform() }, { passive: true })
    return () => {
      v.removeEventListener('touchstart', ts)
      v.removeEventListener('touchmove', tm)
      v.removeEventListener('touchend', te)
      v.removeEventListener('touchcancel', clearTransform)
    }
  }, [zoom, changeZoom])

  // ===== Zoom buttons =====
  const zoomIn = () => { const i = ZOOM_STEPS.findIndex(s => s > zoom + 0.001); changeZoom(i >= 0 ? ZOOM_STEPS[i] : 3) }
  const zoomOut = () => { const i = ZOOM_STEPS.findLastIndex(s => s < zoom - 0.001); changeZoom(i >= 0 ? ZOOM_STEPS[i] : 0.5) }
  const zoomReset = () => changeZoom(1)

  const isReady = !loading && !error
  const hasPages = totalPages > 1

  return (
    <div className="flex flex-col h-full min-h-0 relative">
      {/* Top toolbar */}
      <div className="flex items-center justify-between gap-2 px-3 py-1.5 bg-card border-b shrink-0">
        <span className="text-[11px] font-medium truncate min-w-0" title={name}>📄 {name}</span>
        <div className="flex items-center gap-0.5 shrink-0">
          {hasPages && (
            <>
              <Button variant="ghost" size="icon-xs" disabled={!isReady || currentPage <= 1} onClick={() => scrollToPage(currentPage - 1)}><ChevronLeft className="size-3.5" /></Button>
              <span className="text-[10px] tabular-nums min-w-[50px] text-center text-muted-foreground select-none">{currentPage}/{totalPages}</span>
              <Button variant="ghost" size="icon-xs" disabled={!isReady || currentPage >= totalPages} onClick={() => scrollToPage(currentPage + 1)}><ChevronRight className="size-3.5" /></Button>
              <span className="w-px h-3 bg-border mx-0.5" />
            </>
          )}
          <Button variant="ghost" size="icon-xs" disabled={!isReady || zoom <= 0.5} onClick={zoomOut}><ZoomOut className="size-3" /></Button>
          <button className="text-[10px] tabular-nums w-[34px] text-center text-muted-foreground select-none cursor-pointer hover:text-foreground" onClick={zoomReset}>{Math.round(zoom * 100)}%</button>
          <Button variant="ghost" size="icon-xs" disabled={!isReady || zoom >= 3} onClick={zoomIn}><ZoomIn className="size-3" /></Button>
          {zoom !== 1 && <Button variant="ghost" size="icon-xs" onClick={zoomReset} title="重置"><Maximize2 className="size-3" /></Button>}
        </div>
      </div>

      {/* Viewer — scroll container with virtual placeholders */}
      <div ref={viewerRef} className="flex-1 min-h-0 overflow-auto overscroll-contain px-1 py-2">
        <div ref={contentRef} className="origin-top-left will-change-transform">
          {loading && !error && (
            <div className="flex flex-col items-center justify-center gap-3 py-20">
              <Loader2 className="size-8 animate-spin text-muted-foreground" />
              <span className="text-sm text-muted-foreground">加载 PDF...</span>
            </div>
          )}
          {error && (
            <div className="flex items-center justify-center py-20">
              <p className="text-sm text-destructive">加载失败：{error}</p>
            </div>
          )}
          {!loading && !error && pageHeights.map((h, i) => (
            <div
              key={i}
              data-pdf-ph={i + 1}
              style={{ height: `${h}px`, width: pageWidths[i] ? `${pageWidths[i]}px` : undefined }}
              className="flex items-start"
            />
          ))}
        </div>
      </div>

      {/* Mobile bottom bar — page nav */}
      {hasPages && (
        <div
          className="md:hidden flex items-center justify-center gap-3 px-2 py-1 bg-card border-t shrink-0"
          style={{ paddingBottom: 'max(0.25rem, env(safe-area-inset-bottom))' }}
        >
          <Button variant="ghost" size="icon" className="size-9 shrink-0" disabled={!isReady || currentPage <= 1} onClick={() => scrollToPage(currentPage - 1)}>
            <ChevronLeft className="size-4" />
          </Button>
          <span className="text-xs tabular-nums font-medium select-none min-w-[48px] text-center">{currentPage}/{totalPages}</span>
          <Button variant="ghost" size="icon" className="size-9 shrink-0" disabled={!isReady || currentPage >= totalPages} onClick={() => scrollToPage(currentPage + 1)}>
            <ChevronRight className="size-4" />
          </Button>
        </div>
      )}
    </div>
  )
}
