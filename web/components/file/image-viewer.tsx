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
  // ===== 惯性动画（和阻尼/回弹解耦，不修改它们的实现）=====
  const velocityRef = useRef({ vx: 0, vy: 0 }) // 每 16ms 归一化的像素速度
  const lastMoveRef = useRef({ x: 0, y: 0, t: 0 }) // 上一次 move 的采样点
  const hasVelocityRef = useRef(false) // 是否已有速度样本（首次不做 EMA，避免低估）
  const momentumRafRef = useRef<number | null>(null) // 惯性 rAF 句柄
  const latestOffsetRef = useRef({ x: 0, y: 0 }) // 实时同步 offset，供惯性 rAF 旁路读取
  const scaleRef = useRef(1) // 实时同步 scale，供 bounceBackAll 延迟调用读取最新值
  // 记录松手时的偏移，确保惯性起点和松手瞬间一致（避免 React setState 异步导致的偏差）
  const releaseOffsetRef = useRef({ x: 0, y: 0 })

  const [showControls, setShowControls] = useState(true)
  const hideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const minScale = 0.1 // 全局绝对最小值（极个别场景兜底用）
  const maxScale = 20
  // ★ 统一的最小缩放基准 = contain 模式 scale（图片加载后/旋转后同步更新）
  // 初始值 0 = "未初始化"哨兵；所有读取必须通过 getMinContain() 做有效性检查+兜底
  const minContainScaleRef = useRef(0)
  const minContainWidthScaleRef = useRef(0)

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

  /** ★ 唯一的最小基准读取入口：带有效性检查 + 实时兜底重算 + 写回，保证任何时机读到的都是合法值 */
  const getMinContain = useCallback((): number => {
    const cached = minContainScaleRef.current
    // 合法条件：已初始化（>0）且不是"明显过大"（大图场景 contain 不可能超过 0.99）
    if (cached > 0 && cached < 0.999) return cached
    // 缓存无效 → 立刻实时计算，写回缓存，再返回
    if (naturalSize.w > 0) {
      const fresh = computeFitScale('contain')
      if (fresh > 0) {
        minContainScaleRef.current = fresh
        minContainWidthScaleRef.current = computeFitScale('width')
        return fresh
      }
    }
    // 极端兜底：图片还没加载完成 → 退化为 1（不会被当作 contain 基准，随后加载完会立刻被 useEffect 覆盖）
    return 1
  }, [naturalSize, computeFitScale])

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
      const container = containerRef.current
      const cw = container?.clientWidth ?? 0
      const ch = container?.clientHeight ?? 0
      // 图片缩放后的显示宽高（考虑旋转）
      const rotRad = (rotation * Math.PI) / 180
      const cos = Math.abs(Math.cos(rotRad))
      const sin = Math.abs(Math.sin(rotRad))
      const dw = (naturalSize.w * cos + naturalSize.h * sin) * s
      const dh = (naturalSize.w * sin + naturalSize.h * cos) * s
      // 超限上限按图片显示尺寸的比例来，保证大图小图的回弹视觉比例一致
      // 图比容器大：最多能拖出显示宽度的 12%，但不低于 180px（小图保底）
      const overCapLarge = Math.max(180, Math.max(dw, dh) * 0.12)
      // 图比容器小：最多能拖出容器尺寸的 20%，但不低于 200px
      const overCapSmall = Math.max(200, Math.min(cw, ch) * 0.2)

      const damp = (v: number, max: number, overCap: number) => {
        if (max === 0) {
          const abs = Math.abs(v)
          const damped = abs * 0.4 + (abs > 50 ? Math.log(abs - 49) * 6 : 0)
          return v >= 0 ? Math.min(damped, overCap) : -Math.min(damped, overCap)
        }
        if (v > max) {
          const over = v - max
          const dampedOver = over * 0.35 + (over > 40 ? Math.log(over - 39) * 5 : 0)
          return max + Math.min(dampedOver, overCap)
        }
        if (v < -max) {
          const over = -max - v
          const dampedOver = over * 0.35 + (over > 40 ? Math.log(over - 39) * 5 : 0)
          return -(max + Math.min(dampedOver, overCap))
        }
        return v
      }
      return {
        x: damp(rawX, maxX, maxX === 0 ? overCapSmall : overCapLarge),
        y: damp(rawY, maxY, maxY === 0 ? overCapSmall : overCapLarge),
      }
    },
    [getOffsetBounds, naturalSize, rotation]
  )

  /** 松手时统一回弹：scale 低于最小值 → 回弹；offset 超出边界 → 钳制回弹 */
  // ★ 故意不依赖 scale/offset state（因为惯性结束时延迟调用的是旧闭包），
  // 改为从 latestOffsetRef/scaleRef 读最新值，保证任何时候调用读到的都是当前实际位置
  const bounceBackAll = useCallback(() => {
    const minFit = getMinContain()
    // ★ 从 ref 读最新的 offset/scale，而不是闭包中的 state（旧闭包的 state 是惯性开始前的值）
    const curOffset = latestOffsetRef.current
    const curScale = scaleRef.current
    const clamped = clampOffset(curOffset.x, curOffset.y, curScale)
    const needOffsetBounce =
      Math.abs(clamped.x - curOffset.x) > 0.5 || Math.abs(clamped.y - curOffset.y) > 0.5
    const needScaleBounce = curScale < minFit - 0.001

    if (!needOffsetBounce && !needScaleBounce) return

    setIsBouncing(true)
    if (needScaleBounce) {
      setScale(minFit)
      setOffset({ x: 0, y: 0 })
      setFitMode('contain')
    } else {
      setOffset(clamped)
    }
    setTimeout(() => setIsBouncing(false), 450)
  }, [clampOffset, getMinContain])

  // ===== 惯性（不修改阻尼/回弹逻辑，只在拖拽-松手之间多插一步滑行）=====
  useEffect(() => {
    latestOffsetRef.current = offset
  }, [offset])

  useEffect(() => {
    scaleRef.current = scale
  }, [scale])

  /** 停掉正在运行的惯性 rAF，并清空速度采样（用户按下/双指 pinch 时调用） */
  const stopMomentum = useCallback(() => {
    if (momentumRafRef.current != null) {
      cancelAnimationFrame(momentumRafRef.current)
      momentumRafRef.current = null
    }
    velocityRef.current = { vx: 0, vy: 0 }
    hasVelocityRef.current = false
  }, [])

  /** 松手后按当前速度滑行，摩擦自然减速；结束后交给 bounceBackAll 处理超限/回弹 */
  const startMomentum = useCallback(
    (scaleAtRelease: number) => {
      // 松手前停顿 >80ms → 视为用户有意停下，直接回弹
      const stallDt = performance.now() - lastMoveRef.current.t
      if (stallDt > 80) {
        velocityRef.current = { vx: 0, vy: 0 }
      }

      // 先读速度，再停 rAF（stopMomentum 会清零 velocityRef）
      let { vx, vy } = velocityRef.current
      if (momentumRafRef.current != null) {
        cancelAnimationFrame(momentumRafRef.current)
        momentumRafRef.current = null
      }
      velocityRef.current = { vx: 0, vy: 0 }
      hasVelocityRef.current = false

      const speed = Math.hypot(vx, vy)
      if (speed < 0.25) {
        // 速度太小 → 直接走回弹（下一帧再调用，保证 offset state 已更新）
        requestAnimationFrame(() => bounceBackAll())
        return
      }

      // 记录松手瞬间的位置，作为惯性起点（不主动拉回阻尼超限区域，避免跳变）
      let px = releaseOffsetRef.current.x
      let py = releaseOffsetRef.current.y

      const friction = 0.925 // 更高摩擦 = 滑行更短
      const minSpeed = 0.04
      let lastT = performance.now()

      const step = () => {
        const now = performance.now()
        const dt = Math.min(48, now - lastT) // 更保守的 dt 上限
        lastT = now
        const decay = Math.pow(friction, dt / 16)
        vx *= decay
        vy *= decay

        const dtFactor = dt / 16
        const rawX = px + vx * dtFactor
        const rawY = py + vy * dtFactor

        // 直接复用 applyDampedOffset（和拖拽时完全一致），避免重复实现和两边不一致
        const { maxX, maxY } = getOffsetBounds(scaleAtRelease)
        const damped = applyDampedOffset(rawX, rawY, scaleAtRelease)
        const nx = damped.x
        const ny = damped.y

        // 如果惯性位移（raw）尝试越界但被阻尼吃掉了大部分 → 对应方向速度快速衰减
        if (maxX > 0) {
          const rawOverX = rawX - maxX
          if (rawOverX > 0 && vx > 0) {
            vx *= 0.35
          } else if (rawX < -maxX && vx < 0) {
            vx *= 0.35
          }
        } else {
          vx *= 0.4
        }
        if (maxY > 0) {
          if (rawY > maxY && vy > 0) {
            vy *= 0.35
          } else if (rawY < -maxY && vy < 0) {
            vy *= 0.35
          }
        } else {
          vy *= 0.4
        }

        px = nx
        py = ny
        latestOffsetRef.current = { x: nx, y: ny }
        setOffset({ x: nx, y: ny })

        const s = Math.hypot(vx, vy)
        if (s < minSpeed) {
          momentumRafRef.current = null
          // 等 setOffset commit 后再走回弹判定（这样 bounceBackAll 读的 offset 是最新的）
          requestAnimationFrame(() => bounceBackAll())
          return
        }
        momentumRafRef.current = requestAnimationFrame(step)
      }
      momentumRafRef.current = requestAnimationFrame(step)
    },
    [getOffsetBounds, bounceBackAll, applyDampedOffset]
  )

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

  // ★ 同步最小 contain 基准（图片加载完成 / 旋转后，useLayoutEffect 保证在绘制前就写入 ref，避免首帧读到脏值）
  useEffect(() => {
    if (naturalSize.w > 0) {
      // 不再强制要求 containerRef.current，即便容器瞬时无尺寸，后续 getMinContain 会兜底重算
      const containS = computeFitScale('contain')
      const widthS = computeFitScale('width')
      // 只有合法值才写 ref（contain 不可能 ≤0，也不可能 ≥1 除非是小图，而大图场景 0.999 阈值可正确区分）
      if (containS > 0) {
        minContainScaleRef.current = containS
        minContainWidthScaleRef.current = widthS
        // scale 低于基准时才拉升，避免不必要的状态更新
        if (containS < 0.999) {
          setScale((prev) => (prev < containS ? containS : prev))
        }
      }
    }
    // getMinContain 作为依赖：即便 useEffect 没写入成功，getMinContain 也能兜底
  }, [naturalSize.w, naturalSize.h, rotation, computeFitScale, getMinContain])

  // 图片加载完成 / 旋转变化时，根据当前 fitMode 重新适配 scale
  // ★ 注意：依赖数组故意不含 fitMode —— fitMode 变化是用户主动缩放（zoomOut/滚轮/键盘）的副作用，
  // 此时 scale 已由用户操作设定，不应该被这里覆盖成 computeFitScale(fitMode)（否则 'original' 会把 scale 设成 1 → 闪一下原图大小）
  useEffect(() => {
    if (naturalSize.w > 0 && fitMode) {
      const s = computeFitScale(fitMode)
      setScale(s)
      setOffset({ x: 0, y: 0 })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
      // ★ 滚轮缩放下限也统一为 contain 基准（用 getMinContain 防首帧脏值）
      const wheelMin = getMinContain()
      const newScale = Math.max(wheelMin, Math.min(maxScale, oldScale + delta))
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
    [scale, clampOffset, getMinContain]
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
    stopMomentum()
    setIsDragging(true)
    dragStartRef.current = { x: e.clientX, y: e.clientY, ox: offset.x, oy: offset.y }
    lastMoveRef.current = { x: e.clientX, y: e.clientY, t: performance.now() }
    hasVelocityRef.current = false
  }

  useEffect(() => {
    if (!isDragging) return

    const handleMouseMove = (e: MouseEvent) => {
      const rawX = dragStartRef.current.ox + (e.clientX - dragStartRef.current.x)
      const rawY = dragStartRef.current.oy + (e.clientY - dragStartRef.current.y)
      // 拖拽中允许超量拖动 + 阻尼，不硬钳制（保留内容不动）
      const damped = applyDampedOffset(rawX, rawY, scale)
      latestOffsetRef.current = damped
      setOffset(damped)

      // 速度采样 — 不影响拖拽本身的偏移计算
      // 只采样最近的位移，不做过多历史平滑（alpha 更高 = 更看重最新速度）
      const now = performance.now()
      const dt = now - lastMoveRef.current.t
      if (dt > 0) {
        const dx = e.clientX - lastMoveRef.current.x
        const dy = e.clientY - lastMoveRef.current.y
        const vxRaw = dx / (dt / 16)
        const vyRaw = dy / (dt / 16)
        if (!hasVelocityRef.current) {
          velocityRef.current.vx = vxRaw
          velocityRef.current.vy = vyRaw
          hasVelocityRef.current = true
        } else {
          const alpha = 0.7 // 更激进：70% 新速度 + 30% 旧速度
          velocityRef.current.vx = velocityRef.current.vx * (1 - alpha) + vxRaw * alpha
          velocityRef.current.vy = velocityRef.current.vy * (1 - alpha) + vyRaw * alpha
        }
      }
      lastMoveRef.current = { x: e.clientX, y: e.clientY, t: now }
    }

    const captureScale = scale
    const handleMouseUp = () => {
      setIsDragging(false)
      // 记录松手瞬间的偏移：用 latestOffsetRef 避免 React 异步 setState 带来的偏差
      releaseOffsetRef.current = { ...latestOffsetRef.current }
      startMomentum(captureScale) // 有速度滑行，没速度直接 bounceBackAll
    }

    window.addEventListener('mousemove', handleMouseMove)
    window.addEventListener('mouseup', handleMouseUp)

    return () => {
      window.removeEventListener('mousemove', handleMouseMove)
      window.removeEventListener('mouseup', handleMouseUp)
    }
  }, [isDragging, scale, applyDampedOffset, startMomentum, stopMomentum])

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
      stopMomentum()
      setIsDragging(true)
      dragStartRef.current = {
        x: e.touches[0].clientX,
        y: e.touches[0].clientY,
        ox: offset.x,
        oy: offset.y,
      }
      lastMoveRef.current = {
        x: e.touches[0].clientX,
        y: e.touches[0].clientY,
        t: performance.now(),
      }
      hasVelocityRef.current = false
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
      // 拖拽中允许超量拖动 + 阻尼，不硬钳制（保留内容不动）
      const damped = applyDampedOffset(rawX, rawY, scale)
      latestOffsetRef.current = damped
      setOffset(damped)

      // 速度采样（不影响偏移本身）
      const now = performance.now()
      const dt = now - lastMoveRef.current.t
      if (dt > 0) {
        const dx = e.touches[0].clientX - lastMoveRef.current.x
        const dy = e.touches[0].clientY - lastMoveRef.current.y
        const vxRaw = dx / (dt / 16)
        const vyRaw = dy / (dt / 16)
        if (!hasVelocityRef.current) {
          velocityRef.current.vx = vxRaw
          velocityRef.current.vy = vyRaw
          hasVelocityRef.current = true
        } else {
          const alpha = 0.7 // 更激进：70% 新速度 + 30% 旧速度
          velocityRef.current.vx = velocityRef.current.vx * (1 - alpha) + vxRaw * alpha
          velocityRef.current.vy = velocityRef.current.vy * (1 - alpha) + vyRaw * alpha
        }
      }
      lastMoveRef.current = {
        x: e.touches[0].clientX,
        y: e.touches[0].clientY,
        t: now,
      }
    } else if (e.touches.length === 2) {
      e.preventDefault()
      stopMomentum() // 双指缩放：停掉惯性
      const dist = getTouchDistance(e.touches)
      if (pinchRef.current.startDist > 0) {
        const ratio = dist / pinchRef.current.startDist
        // ★ 双指缩放下限用 getMinContain 防首帧脏值
        const pinchMin = getMinContain()
        const newScale = Math.max(
          pinchMin,
          Math.min(maxScale, pinchRef.current.startScale * ratio)
        )
        if (newScale !== scale) {
          setScale(newScale)
          setFitMode('original')
        }
      }
    }
  }

  const captureTouchScale = scale
  const handleTouchEnd = (e: React.TouchEvent) => {
    if (e.touches.length === 0) {
      setIsDragging(false)
      pinchRef.current.startDist = 0
      // 记录松手瞬间的偏移：用 latestOffsetRef 避免 React 异步 setState 带来的偏差
      releaseOffsetRef.current = { ...latestOffsetRef.current }
      startMomentum(captureTouchScale) // 有速度滑行，没速度直接 bounceBackAll
    } else if (e.touches.length === 1) {
      setIsDragging(true)
      dragStartRef.current = {
        x: e.touches[0].clientX,
        y: e.touches[0].clientY,
        ox: offset.x,
        oy: offset.y,
      }
      pinchRef.current.startDist = 0
      lastMoveRef.current = {
        x: e.touches[0].clientX,
        y: e.touches[0].clientY,
        t: performance.now(),
      }
      hasVelocityRef.current = false
    }
  }

  const handleTouchStartPinch = (e: React.TouchEvent) => {
    if (e.touches.length === 2) {
      stopMomentum() // 双指缩放：停掉惯性
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
          setScale((s) => Math.max(getMinContain(), s / 1.2))
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
    // ★ 唯一入口 getMinContain：防首帧读到未初始化的脏值 1
    const minFit = getMinContain()
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