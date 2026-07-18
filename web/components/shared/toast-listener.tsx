'use client'

import { toast } from 'sonner'
import { useEffect, useRef } from 'react'
import type { StoreApi } from 'zustand'

interface StoreWithMessages {
  error: string | null
  message: string | null
  clearMessage: () => void
}

/**
 * Subscribes to store error/message and displays them as toasts.
 * Uses zustand's vanilla subscribe to avoid re-render loops.
 * Usage: <ToastListener store={useSomeStore} />
 */
export function ToastListener({ store }: { store: StoreApi<StoreWithMessages> }) {
  const prevError = useRef<string | null>(null)
  const prevMessage = useRef<string | null>(null)

  useEffect(() => {
    const unsub = store.subscribe((state) => {
      // Only act when error/message change to non-null
      if (state.error && state.error !== prevError.current) {
        toast.error(state.error)
        prevError.current = state.error
        // Defer clear to next tick to avoid update-in-render
        setTimeout(() => store.getState().clearMessage(), 0)
      }
      if (state.message && state.message !== prevMessage.current) {
        toast.success(state.message)
        prevMessage.current = state.message
        setTimeout(() => store.getState().clearMessage(), 0)
      }
    })
    return unsub
  }, [store])

  return null
}
