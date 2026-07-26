'use client'

import { useState, useRef, useEffect } from 'react'

export function useMultiSelect<T extends { fileId: string }>(items: T[]) {
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [lastClicked, setLastClicked] = useState<string | null>(null)

  const toggle = (fileId: string, metaKey: boolean, shiftKey: boolean) => {
    setSelected(prev => {
      const next = new Set(prev)

      if (shiftKey && lastClicked) {
        // Range select
        const lastIdx = items.findIndex(i => i.fileId === lastClicked)
        const currIdx = items.findIndex(i => i.fileId === fileId)
        if (lastIdx >= 0 && currIdx >= 0) {
          const [from, to] = lastIdx < currIdx ? [lastIdx, currIdx] : [currIdx, lastIdx]
          for (let i = from; i <= to; i++) next.add(items[i].fileId)
          return next
        }
      }

      if (metaKey) {
        // Toggle single
        if (next.has(fileId)) next.delete(fileId)
        else next.add(fileId)
      } else {
        // Replace selection
        next.clear()
        next.add(fileId)
      }

      return next
    })
    setLastClicked(fileId)
  }

  const selectAll = () => setSelected(new Set(items.map(i => i.fileId)))
  const clearSelection = () => { setSelected(new Set()); setLastClicked(null) }
  const isAllSelected = items.length > 0 && selected.size === items.length

  return { selected, toggle, selectAll, clearSelection, isAllSelected, setSelected }
}

/** Simple context menu hook */
export function useContextMenu() {
  const [menu, setMenu] = useState<{ x: number; y: number; fileId: string } | null>(null)
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handler = () => setMenu(null)
    document.addEventListener('click', handler)
    return () => document.removeEventListener('click', handler)
  }, [])

  const open = (e: React.MouseEvent, fileId: string) => {
    e.preventDefault()
    // Position within viewport
    const x = Math.min(e.clientX, window.innerWidth - 220)
    const y = Math.min(e.clientY, window.innerHeight - 280)
    setMenu({ x, y, fileId })
  }

  return { menu, open, close: () => setMenu(null), menuRef, setMenu }
}
