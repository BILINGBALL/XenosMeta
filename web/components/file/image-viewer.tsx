'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import {
  ZoomIn,
  ZoomOut,
  Maximize2,
  Minimize2,
  RotateCw,
  RotateCcw,
  FlipHorizontal,
  FlipVertical,
  Download,
  Printer,
  ChevronLeft,
  ChevronRight,
  Loader2,
  X,
  Move,
} from 'lucide-react'

interface ImageViewerProps {
  src: string
  alt?: string
  onDownload?: () => void
  onPrev?: () => void
  onNext?: () => void
  hasPrev?: boolean
  hasNext?: boolean
  showToolbar?: boolean
  showDownload?: boolean
}

type FitMode = 'contain' | 'cover' | 'original' | 'width'

export function ImageViewer({
  src,
  alt = '',
  onDownload,
  onPrev,
  onNext,
  hasPrev = false,
  hasNext = false,
  showToolbar = true,
  showDownload = true,
}: ImageViewerProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const imgRef = useRef<HTMLImageElement>(null)

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [naturalSize, setNaturalSize] = useState({ w: 0, h: 0 })

  const [scale, setScale] = useState(1)
  const [rotation, setRotation] = useState(0)
  const [flipH, setFlipH] = useState(false)
  const [flipV, setFlipV] = useState(false)
  const [fitMode, setFitMode] = useState<FitMode>('contain')

  const [offset, setOffset] = useState({ x: 0, y: 0 })
  const [isDragging, setIsDragging] = useState(false)
  const [isBouncing, setIsBouncing] = useState(false)
  const dragStartRef = useRef({ x: 0, y: 0, ox: 0, oy: 0 })

  const [showControls, setShowControls] = useState(true)
  const hideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const minScale = 0.1
  const maxScale = 20

  const computeFitScale = useCallback(
    (mode: FitMode): number => {
      const container = containerRef.current
      const img = imgRef.current
      if (!container || !img || naturalSize.w === 0) return 1

      const cw = container.clientWidth
      const ch = container.clientHeight

      const rotRad = (rotation * Math.PI) / 180
      const sin = Math.abs(Math.sin(rotRad))
      const cos = Math.abs(Math.cos(rotRad))

      const iw = naturalSize.w * cos + naturalSize.h * sin
      const ih = naturalSize.w * sin + naturalSize.h * cos

      if (iw === 0 || ih === 0) return 1

      switch (mode) {
        case 'contain':
          return Math.min(cw / iw, ch / ih, 1)
        case 'cover':
          return Math.max(cw / iw, ch / ih)
        case 'width':
          return cw / iw
        case 'original':
          return 1
        default:
          return 1
      }
    },
    [naturalSize, rotation]
  )

  /** 获取当前缩放和尺寸下 offset 的合法边界 [maxX, maxY]（正负对称） */
  const getOffsetBounds = useCallback(
    (s: number): { maxX: number; maxY: number } => {
      const container = containerRef.current
      if (!container || naturalSize.w === 0) return { maxX: 0, maxY: 0 }
      const cw = container.clientWidth
      const ch = container.clientHeight
      const rotRad = (rotation * Math.PI) / 180
      const cos = Math.abs(Math.cos(rotRad))
      const sin = Math.abs(Math.sin(rotRad))
      const dw = (naturalSize.w * cos + naturalSize.h * sin) * s
      const dh = (naturalSize.w * sin + naturalSize.h * cos) * s
      return {
        maxX: dw > cw ? (dw - cw) / 2 : 0,
        maxY: dh > ch ? (dh - ch) / 2 : 0,
      }
    },
    [naturalSize, rotation]
  )

  /** 钳制 offset 到合法边界内（硬边界，非拖拽场景用） */
  const clampOffset = useCallback(
    (ox: number, oy: number, s: number): { x: number; y: number } => {
      const { maxX, maxY } = getOffsetBounds(s)
      return {
        x: Math.min(Math.max(ox, -maxX), maxX),
        y: Math.min(Math.max(oy, -maxY), maxY),
      }
    },
    [getOffsetBounds]
  )

  /** 拖拽偏移带阻尼：超出边界后越拖越费力（给用户"到头了"的视觉反馈但不硬挡） */
  const applyDampedOffset = useCallback(
    (rawX: number, rawY: number, s: number): { x: number; y: number } => {
      const { maxX, maxY } = getOffsetBounds(s)
      const damp = (v: number, max: number) => {
        if (max === 0) {
          // 图片比容器小：任何偏移都带阻尼（拖出然后回弹）
          const abs = Math.abs(v)
          const damped = abs * 0.4 + (abs > 50 ? Math.log(abs - 49) * 6 : 0)
          return v >= 0 ? Math.min(damped, 200) : -Math.min(damped, 200)
        }
        if (v > max) {
          const over = v - max
          const dampedOver = over * 0.35 + (over > 40 ? Math.log(over - 39) * 5 : 0)
          return max + Math.min(dampedOver, 180)
        }
        if (v < -max) {
          const over = -max - v
          const dampedOver = over * 0.35 + (over > 40 ? Math.log(over - 39) * 5 : 0)
          return -(max + Math.min(dampedOver, 180))
        }
        return v
      }
      return { x: damp(rawX, maxX), y: damp(rawY, maxY) }
    },
    [getOffsetBounds]
  )

  /** 松手时统一回弹：scale 低于最小值 → 回弹；offset 超出边界 → 钳制回弹 */
  const bounceBackAll = useCallback(() => {
    const minFit = computeFitScale('width')
    const clamped = clampOffset(offset.x, offset.y, scale)
    const needOffsetBounce =
      Math.abs(clamped.x - offset.x) > 0.5 || Math.abs(clamped.y - offset.y) > 0.5
    const needScaleBounce = scale < minFit - 0.001

    if (!needOffsetBounce && !needScaleBounce) return

    setIsBouncing(true)
    if (needScaleBounce) {
      setScale(minFit)
      setOffset({ x: 0, y: 0 })
      setFitMode('width')
    } else {
      setOffset(clamped)
    }
    setTimeout(() => setIsBouncing(false), 450)
  }, [scale, offset, computeFitScale, clampOffset])

  const applyFitMode = useCallback(
    (mode: FitMode) => {
      setFitMode(mode)
      const s = computeFitScale(mode)
      setScale(s)
      setOffset({ x: 0, y: 0 })
    },
    [computeFitScale]
  )

  const handleImageLoad = (e: React.SyntheticEvent<HTMLImageElement>) => {
    const img = e.currentTarget
    setNaturalSize({ w: img.naturalWidth, h: img.naturalHeight })
    setLoading(false)
    setError('')
  }

  const handleImageError = () => {
    setLoading(false)
    setError('图片加载失败')
  }

  useEffect(() => {
    if (naturalSize.w > 0 && fitMode) {
      const s = computeFitScale(fitMode)
      setScale(s)
      setOffset({ x: 0, y: 0 })
    }
  }, [naturalSize.w, naturalSize.h, rotation])

  // 缩放变化时钳制 offset（按钮/键盘/双击场景）
  useEffect(() => {
    setOffset((o) => clampOffset(o.x, o.y, scale))
  }, [scale, clampOffset])

  const zoomAt = useCallback(
    (delta: number, cx?: number, cy?: number) => {
      const container = containerRef.current
      if (!container) return

      const oldScale = scale
      const newScale = Math.max(minScale, Math.min(maxScale, oldScale + delta))
      if (newScale === oldScale) return

      if (cx != null && cy != null) {
        const rect = container.getBoundingClientRect()
        const px = cx - rect.left - container.clientWidth / 2
        const py = cy - rect.top - container.clientHeight / 2
        const ratio = newScale / oldScale
        setOffset((o) => {
          const raw = {
            x: px - (px - o.x) * ratio,
            y: py - (py - o.y) * ratio,
          }
          return clampOffset(raw.x, raw.y, newScale)
        })
      } else {
        setOffset((o) => clampOffset(o.x, o.y, newScale))
      }

      setScale(newScale)
      setFitMode('original')
    },
    [scale, clampOffset]
  )

  const handleWheel = useCallback(
    (e: React.WheelEvent) => {
      e.preventDefault()
      const delta = e.deltaY > 0 ? -scale * 0.15 : scale * 0.15
      zoomAt(delta, e.clientX, e.clientY)
    },
    [zoomAt, scale]
  )

  const handleMouseDown = (e: React.MouseEvent) => {
    if (e.button !== 0) return
    setIsDragging(true)
    dragStartRef.current = { x: e.clientX, y: e.clientY, ox: offset.x, oy: offset.y }
  }

  useEffect(() => {
    if (!isDragging) return

    const handleMouseMove = (e: MouseEvent) => {
      const rawX = dragStartRef.current.ox + (e.clientX - dragStartRef.current.x)
      const rawY = dragStartRef.current.oy + (e.clientY - dragStartRef.current.y)
      // 拖拽中允许超量拖动 + 阻尼，不硬钳制
      setOffset(applyDampedOffset(rawX, rawY, scale))
    }

    const handleMouseUp = () => {
      setIsDragging(false)
      bounceBackAll()
    }

    window.addEventListener('mousemove', handleMouseMove)
    window.addEventListener('mouseup', handleMouseUp)

    return () => {
      window.removeEventListener('mousemove', handleMouseMove)
      window.removeEventListener('mouseup', handleMouseUp)
    }
  }, [isDragging, scale, applyDampedOffset, bounceBackAll])

  const handleDoubleClick = (e: React.MouseEvent) => {
    if (scale <= computeFitScale('contain') + 0.01) {
      zoomAt(scale, e.clientX, e.clientY)
      setFitMode('original')
    } else {
      applyFitMode('contain')
    }
  }

  const handleTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length === 1) {
      setIsDragging(true)
      dragStartRef.current = {
        x: e.touches[0].clientX,
        y: e.touches[0].clientY,
        ox: offset.x,
        oy: offset.y,
      }
    }
  }

  const pinchRef = useRef({ startDist: 0, startScale: 1, startCx: 0, startCy: 0 })

  const getTouchDistance = (touches: React.TouchList) => {
    if (touches.length < 2) return 0
    return Math.hypot(
      touches[0].clientX - touches[1].clientX,
      touches[0].clientY - touches[1].clientY
    )
  }

  const handleTouchMove = (e: React.TouchEvent) => {
    if (e.touches.length === 1 && isDragging) {
      e.preventDefault()
      const rawX = dragStartRef.current.ox + (e.touches[0].clientX - dragStartRef.current.x)
      const rawY = dragStartRef.current.oy + (e.touches[0].clientY - dragStartRef.current.y)
      // 拖拽中允许超量拖动 + 阻尼，不硬钳制
      setOffset(applyDampedOffset(rawX, rawY, scale))
    } else if (e.touches.length === 2) {
      e.preventDefault()
      const dist = getTouchDistance(e.touches)
      if (pinchRef.current.startDist > 0) {
        const ratio = dist / pinchRef.current.startDist
        const newScale = Math.max(
          minScale,
          Math.min(maxScale, pinchRef.current.startScale * ratio)
        )
        if (newScale !== scale) {
          setScale(newScale)
          setFitMode('original')
        }
      }
    }
  }

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (e.touches.length === 0) {
      setIsDragging(false)
      pinchRef.current.startDist = 0
      bounceBackAll()
    } else if (e.touches.length === 1) {
      setIsDragging(true)
      dragStartRef.current = {
        x: e.touches[0].clientX,
        y: e.touches[0].clientY,
        ox: offset.x,
        oy: offset.y,
      }
      pinchRef.current.startDist = 0
    }
  }

  const handleTouchStartPinch = (e: React.TouchEvent) => {
    if (e.touches.length === 2) {
      pinchRef.current = {
        startDist: getTouchDistance(e.touches),
        startScale: scale,
        startCx: (e.touches[0].clientX + e.touches[1].clientX) / 2,
        startCy: (e.touches[0].clientY + e.touches[1].clientY) / 2,
      }
    }
  }

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return

      switch (e.key) {
        case '+':
        case '=':
          e.preventDefault()
          setScale((s) => Math.min(maxScale, s * 1.2))
          setFitMode('original')
          break
        case '-':
        case '_':
          e.preventDefault()
          setScale((s) => Math.max(minScale, s / 1.2))
          setFitMode('original')
          break
        case '0':
          e.preventDefault()
          applyFitMode('contain')
          break
        case 'ArrowLeft':
          if (hasPrev && onPrev) {
            e.preventDefault()
            onPrev()
          }
          break
        case 'ArrowRight':
          if (hasNext && onNext) {
            e.preventDefault()
            onNext()
          }
          break
        case 'r':
        case 'R':
          e.preventDefault()
          setRotation((r) => r + 90)
          break
        case 'h':
        case 'H':
          e.preventDefault()
          setFlipH((f) => !f)
          break
        case 'v':
        case 'V':
          e.preventDefault()
          setFlipV((f) => !f)
          break
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [applyFitMode, hasPrev, hasNext, onPrev, onNext])

  const resetView = () => {
    setRotation(0)
    setFlipH(false)
    setFlipV(false)
    applyFitMode('contain')
  }

  const rotateCW = () => setRotation((r) => r + 90)
  const rotateCCW = () => setRotation((r) => r - 90)
  const toggleFlipH = () => setFlipH((f) => !f)
  const toggleFlipV = () => setFlipV((f) => !f)

  const zoomIn = () => {
    setScale((s) => Math.min(maxScale, s * 1.25))
    setFitMode('original')
  }
  const zoomOut = () => {
    // 按钮缩小不允许低于"适应宽度"
    const minFit = computeFitScale('width')
    setScale((s) => Math.max(minFit, s / 1.25))
    setFitMode('original')
  }

  const handlePrint = () => {
    const w = window.open('', '_blank')
    if (!w) return
    w.document.write(
      `<!DOCTYPE html><html><head><title>${alt || '图片'}</title><style>
        @page { margin: 0; }
        html, body { margin: 0; padding: 0; height: 100vh; overflow: hidden; }
        body { display: flex; justify-content: center; align-items: center; background: #fff; }
        img { max-width: 100vw; max-height: 100vh; object-fit: contain; page-break-inside: avoid; break-inside: avoid; }
      </style></head><body><img src="${src}" alt="${alt}" onload="window.print()" /></body></html>`
    )
    w.document.close()
  }

  const showControlsTemp = () => {
    setShowControls(true)
    if (hideTimerRef.current) clearTimeout(hideTimerRef.current)
    hideTimerRef.current = setTimeout(() => {
      if (!isDragging) setShowControls(false)
    }, 2500)
  }

  useEffect(() => {
    const t = setTimeout(() => setShowControls(false), 2500)
    return () => clearTimeout(t)
  }, [])

  const imgTransform = `translate(-50%, -50%) translate(${offset.x}px, ${offset.y}px) scale(${scale}) scaleX(${flipH ? -1 : 1}) scaleY(${flipV ? -1 : 1}) rotate(${rotation}deg)`

  // 比例显示相对于"适应屏幕"（contain）的倍率，fit 时 = 100%，放大 = >100%
  const fitScale = computeFitScale('contain')
  const scalePercent = fitScale > 0 ? Math.round((scale / fitScale) * 100) : Math.round(scale * 100)

  return (
    <div
      ref={containerRef}
      className="relative w-full h-full bg-muted/10 rounded-lg overflow-hidden select-none"
      style={{ touchAction: 'none', cursor: isDragging ? 'grabbing' : scale > computeFitScale('contain') + 0.01 ? 'grab' : 'default' }}
      onWheel={handleWheel}
      onMouseDown={handleMouseDown}
      onMouseMove={showControlsTemp}
      onDoubleClick={handleDoubleClick}
      onTouchStart={(e) => {
        handleTouchStart(e)
        handleTouchStartPinch(e)
        showControlsTemp()
      }}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      {loading && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 z-20 bg-muted/20">
          <Loader2 className="size-8 animate-spin text-muted-foreground" />
          <p className="text-sm text-muted-foreground">加载中...</p>
        </div>
      )}

      {error && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 z-20">
          <X className="size-8 text-destructive opacity-50" />
          <p className="text-sm text-destructive">{error}</p>
        </div>
      )}

      <img
        ref={imgRef}
        src={src}
        alt={alt}
        onLoad={handleImageLoad}
        onError={handleImageError}
        draggable={false}
        className="absolute top-1/2 left-1/2 max-w-none max-h-none pointer-events-none"
        style={{
          transform: imgTransform,
          transformOrigin: 'center center',
          willChange: 'transform',
          opacity: loading ? 0 : 1,
          transition: isBouncing
            ? 'transform 450ms cubic-bezier(0.22, 1, 0.36, 1), opacity 0.2s ease'
            : (loading ? 'opacity 0.2s ease' : 'none'),
        }}
      />

      {showToolbar && !error && (
        <>
          <div
            className={`absolute bottom-3 left-1/2 -translate-x-1/2 z-20 flex items-center gap-0.5 bg-background/90 backdrop-blur-sm rounded-xl border shadow-lg px-1 py-1 transition-all duration-300 ${
              showControls ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-2 pointer-events-none'
            }`}
            onMouseEnter={() => {
              setShowControls(true)
              if (hideTimerRef.current) clearTimeout(hideTimerRef.current)
            }}
            onMouseLeave={showControlsTemp}
          >
            <Button variant="ghost" size="icon-xs" onClick={zoomOut} title="缩小 (-)">
              <ZoomOut className="size-4" />
            </Button>
            <span className="text-[11px] tabular-nums min-w-[44px] text-center font-medium text-muted-foreground select-none">
              {scalePercent}%
            </span>
            <Button variant="ghost" size="icon-xs" onClick={zoomIn} title="放大 (+)">
              <ZoomIn className="size-4" />
            </Button>

            <span className="w-px h-4 bg-border mx-1" />

            <Button
              variant="ghost"
              size="icon-xs"
              onClick={() => applyFitMode('contain')}
              title="适应屏幕 (0)"
              className={fitMode === 'contain' ? 'bg-muted' : ''}
            >
              <Minimize2 className="size-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon-xs"
              onClick={() => applyFitMode('original')}
              title="原始尺寸"
              className={fitMode === 'original' ? 'bg-muted' : ''}
            >
              <Maximize2 className="size-4" />
            </Button>

            <span className="w-px h-4 bg-border mx-1" />

            <Button variant="ghost" size="icon-xs" onClick={rotateCCW} title="逆时针旋转 (R)">
              <RotateCcw className="size-4" />
            </Button>
            <Button variant="ghost" size="icon-xs" onClick={rotateCW} title="顺时针旋转 (R)">
              <RotateCw className="size-4" />
            </Button>

            <span className="w-px h-4 bg-border mx-1 hidden sm:inline" />

            <Button
              variant="ghost"
              size="icon-xs"
              onClick={toggleFlipH}
              title="水平翻转 (H)"
              className={`hidden sm:inline-flex ${flipH ? 'bg-muted' : ''}`}
            >
              <FlipHorizontal className="size-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon-xs"
              onClick={toggleFlipV}
              title="垂直翻转 (V)"
              className={`hidden sm:inline-flex ${flipV ? 'bg-muted' : ''}`}
            >
              <FlipVertical className="size-4" />
            </Button>

            {(rotation !== 0 || flipH || flipV) && (
              <>
                <span className="w-px h-4 bg-border mx-1" />
                <Button variant="ghost" size="icon-xs" onClick={resetView} title="重置视图">
                  <Move className="size-4" />
                </Button>
              </>
            )}

            {showDownload && onDownload && (
              <>
                <span className="w-px h-4 bg-border mx-1" />
                <Button variant="ghost" size="icon-xs" onClick={onDownload} title="下载">
                  <Download className="size-4" />
                </Button>
                <Button variant="ghost" size="icon-xs" onClick={handlePrint} title="打印">
                  <Printer className="size-4" />
                </Button>
              </>
            )}
          </div>

          {hasPrev && onPrev && (
            <button
              onClick={onPrev}
              className={`absolute left-3 top-1/2 -translate-y-1/2 z-20 size-10 sm:size-11 rounded-full bg-background/80 backdrop-blur-sm border shadow-lg flex items-center justify-center text-foreground hover:bg-background transition-all duration-300 ${
                showControls ? 'opacity-100' : 'opacity-0 pointer-events-none'
              }`}
              aria-label="上一张"
            >
              <ChevronLeft className="size-5" />
            </button>
          )}

          {hasNext && onNext && (
            <button
              onClick={onNext}
              className={`absolute right-3 top-1/2 -translate-y-1/2 z-20 size-10 sm:size-11 rounded-full bg-background/80 backdrop-blur-sm border shadow-lg flex items-center justify-center text-foreground hover:bg-background transition-all duration-300 ${
                showControls ? 'opacity-100' : 'opacity-0 pointer-events-none'
              }`}
              aria-label="下一张"
            >
              <ChevronRight className="size-5" />
            </button>
          )}
        </>
      )}

      {naturalSize.w > 0 && (
        <div
          className={`absolute top-2 right-2 z-20 text-[10px] text-muted-foreground bg-background/60 backdrop-blur-sm px-2 py-0.5 rounded-md tabular-nums transition-opacity duration-300 ${
            showControls ? 'opacity-100' : 'opacity-40'
          }`}
        >
          {naturalSize.w} × {naturalSize.h}
        </div>
      )}
    </div>
  )
}