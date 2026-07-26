'use client'

import { useState, useEffect, useRef } from 'react'

export function useDebounce<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = useState(value)
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay)
    return () => clearTimeout(timer)
  }, [value, delay])
  return debounced
}

export function useDebouncedCallback(callback: () => void, delay: number) {
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined)
  return () => {
    clearTimeout(timer.current)
    timer.current = setTimeout(callback, delay)
  }
}
