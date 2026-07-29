/**
 * 用户偏好设置 Store — 持久化到 localStorage
 */
import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'

// SSR-safe storage
const storage = {
  getItem: (name: string) => {
    if (typeof window === 'undefined') return null
    return window.localStorage.getItem(name)
  },
  setItem: (name: string, value: string) => {
    if (typeof window !== 'undefined') window.localStorage.setItem(name, value)
  },
  removeItem: (name: string) => {
    if (typeof window !== 'undefined') window.localStorage.removeItem(name)
  },
}

export type FontSize = 'sm' | 'md' | 'lg'

// 字号 → 实际像素值映射
export const FONT_SIZE_PX: Record<FontSize, number> = {
  sm: 13,
  md: 15,
  lg: 17,
}

interface SettingsState {
  // 消息字体大小
  fontSize: FontSize
  // 回车发送消息（关闭时需 Shift+Enter 换行后 Enter 才发送）
  enterToSend: boolean
  // 工具调用详情默认展开
  autoExpandTools: boolean

  setFontSize: (size: FontSize) => void
  setEnterToSend: (v: boolean) => void
  setAutoExpandTools: (v: boolean) => void
  reset: () => void
}

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      fontSize: 'md',
      enterToSend: true,
      autoExpandTools: false,

      setFontSize: (fontSize) => set({ fontSize }),
      setEnterToSend: (enterToSend) => set({ enterToSend }),
      setAutoExpandTools: (autoExpandTools) => set({ autoExpandTools }),
      reset: () => set({ fontSize: 'md', enterToSend: true, autoExpandTools: false }),
    }),
    {
      name: 'xenos-settings',
      storage: createJSONStorage(() => storage),
    },
  ),
)
