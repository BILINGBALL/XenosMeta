/**
 * Agent Store — 会话管理 + SSE 流式对话客户端
 */
import { create } from 'zustand'
import { apiClient, postAction } from '@/lib/api-client'
import { useAuthStore } from '@/stores/auth-store'
import type {
  AgentConversation,
  AgentMessage,
  AgentTool,
  ChatDisplayMessage,
  ToolEvent,
  AgentSSEEvent,
  AgentSSEEventData,
} from '@/types'

const API_BASE = process.env.NEXT_PUBLIC_API_URL || ''

interface AgentState {
  // 会话列表
  conversations: AgentConversation[]
  currentConversationId: string | null
  // 消息
  messages: ChatDisplayMessage[]
  // 工具
  tools: AgentTool[]
  // 状态
  loading: boolean
  streaming: boolean
  error: string | null
  // token 用量
  totalTokens: number

  // 操作
  fetchConversations: () => Promise<void>
  createConversation: (title?: string) => Promise<string | null>
  selectConversation: (id: string) => Promise<void>
  deleteConversation: (id: string) => Promise<void>
  renameConversation: (id: string, title: string) => Promise<void>
  togglePin: (id: string, pinned: boolean) => Promise<void>
  fetchTools: () => Promise<void>
  sendMessage: (content: string) => Promise<void>
  clearMessages: () => void
  clearError: () => void
}

/**
 * 清理空会话：若当前会话没有任何消息，则从本地和后端删除。
 * 用于用户点击「新对话」后未发消息就切走的场景，避免堆积无用记录。
 */
async function cleanupEmptyConversation(
  get: () => AgentState,
  set: (partial: Partial<AgentState>) => void,
) {
  const { currentConversationId, messages, conversations } = get()
  if (!currentConversationId || messages.length > 0) return

  const emptyId = currentConversationId
  // 本地先移除并清空 currentConversationId，避免后续操作指向已删除的会话
  set({
    conversations: conversations.filter(c => c.id !== emptyId),
    currentConversationId: null,
    messages: [],
  })

  // 后端静默删除
  try {
    await apiClient.delete(`/agent/conversations/${emptyId}`)
  } catch {
    // 忽略：网络错误等不阻断后续操作
  }
}

export const useAgentStore = create<AgentState>((set, get) => ({
  conversations: [],
  currentConversationId: null,
  messages: [],
  tools: [],
  loading: false,
  streaming: false,
  error: null,
  totalTokens: 0,

  fetchConversations: async () => {
    set({ loading: true, error: null })
    try {
      const res = await apiClient.get<unknown, { data: { items: AgentConversation[]; total: number } }>(
        '/agent/conversations',
      )
      const items = res.data?.items || []
      set({ conversations: items, loading: false })

      // 首次进入：没有当前会话 → 自动创建（如果还有历史会话也选第一个）
      const { currentConversationId } = get()
      if (!currentConversationId) {
        if (items.length > 0) {
          await get().selectConversation(items[0].id)
        } else {
          await get().createConversation()
        }
      }
    } catch (e) {
      // 加载失败不阻断使用：静默失败，允许用户手动新建会话
      set({ loading: false, error: null, conversations: [] })
    }
  },

  createConversation: async (title?: string) => {
    // 若当前会话已是空会话（无消息），直接复用，避免堆积无意义的空会话
    const { currentConversationId: curId, messages: curMsgs } = get()
    if (curId && curMsgs.length === 0) {
      return curId
    }

    try {
      const res = await postAction<AgentConversation>('/agent/conversations', { title })
      const conv = res.data
      if (conv?.id) {
        set(state => ({
          conversations: [conv, ...state.conversations],
          currentConversationId: conv.id,
          messages: [],
          totalTokens: 0,
        }))
        return conv.id
      }
      return null
    } catch (e) {
      set({ error: (e as Error).message })
      return null
    }
  },

  selectConversation: async (id: string) => {
    // 切换前若当前会话为空会话（无消息），先删除避免堆积无用记录
    await cleanupEmptyConversation(get, set)

    set({ currentConversationId: id, loading: true, error: null, messages: [], totalTokens: 0 })
    try {
      const res = await apiClient.get<unknown, { data: { conversation: AgentConversation; messages: AgentMessage[] } }>(
        `/agent/conversations/${id}/messages`,
      )
      const data = res.data
      if (data) {
        // 转换数据库消息为展示消息
        const displayMessages: ChatDisplayMessage[] = (data.messages || []).map(m => ({
          id: m.id,
          role: m.role,
          content: m.content,
          timestamp: new Date(m.createdAt).getTime(),
        }))
        set({
          messages: displayMessages,
          totalTokens: data.conversation?.tokenUsage || 0,
          loading: false,
        })
      }
    } catch (e) {
      set({ loading: false, error: (e as Error).message })
    }
  },

  deleteConversation: async (id: string) => {
    try {
      await apiClient.delete(`/agent/conversations/${id}`)
      set(state => ({
        conversations: state.conversations.filter(c => c.id !== id),
        currentConversationId: state.currentConversationId === id ? null : state.currentConversationId,
        messages: state.currentConversationId === id ? [] : state.messages,
      }))
    } catch (e) {
      set({ error: (e as Error).message })
    }
  },

  renameConversation: async (id: string, title: string) => {
    try {
      const res = await apiClient.patch<unknown, { data: AgentConversation }>(
        `/agent/conversations/${id}`,
        { title },
      )
      const updated = res.data
      if (updated) {
        set(state => ({
          conversations: state.conversations.map(c =>
            c.id === id ? { ...c, title: updated.title } : c,
          ),
        }))
      }
    } catch (e) {
      set({ error: (e as Error).message })
    }
  },

  togglePin: async (id: string, pinned: boolean) => {
    // 乐观更新：立即调整本地顺序，提供即时反馈
    set(state => ({
      conversations: state.conversations
        .map(c => (c.id === id ? { ...c, pinned } : c))
        .sort((a, b) => {
          if (a.pinned !== b.pinned) return a.pinned ? -1 : 1
          return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
        }),
    }))
    try {
      await apiClient.patch(`/agent/conversations/${id}`, { pinned })
    } catch (e) {
      // 失败时回滚
      set({ error: (e as Error).message })
      get().fetchConversations()
    }
  },

  fetchTools: async () => {
    try {
      const res = await apiClient.get<unknown, { data: AgentTool[] }>('/agent/tools')
      if (res.data) set({ tools: res.data })
    } catch {
      // 静默失败，工具列表不影响核心功能
    }
  },

  sendMessage: async (content: string) => {
    const { currentConversationId } = get()
    if (!currentConversationId) {
      set({ error: '请先创建或选择一个会话' })
      return
    }
    if (!content.trim()) return

    const token = useAuthStore.getState().accessToken
    if (!token) {
      set({ error: '请先登录' })
      return
    }

    // 添加用户消息到展示列表
    const userMsg: ChatDisplayMessage = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: content.trim(),
      timestamp: Date.now(),
    }
    // 添加一个空的助手消息占位（等待流式填充）
    const assistantMsg: ChatDisplayMessage = {
      id: `assistant-${Date.now()}`,
      role: 'assistant',
      content: '',
      toolEvents: [],
      timestamp: Date.now(),
    }
    set(state => ({
      messages: [...state.messages, userMsg, assistantMsg],
      streaming: true,
      error: null,
    }))

    // 使用 fetch + ReadableStream 消费 SSE
    // 不能用 axios（不支持流式读取），必须用原生 fetch
    try {
      const res = await fetch(`${API_BASE}/agent/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          conversationId: currentConversationId,
          message: content.trim(),
        }),
      })

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}))
        throw new Error(errData.message || `请求失败 (${res.status})`)
      }

      const reader = res.body?.getReader()
      if (!reader) throw new Error('无法读取响应流')

      const decoder = new TextDecoder()
      let buffer = ''

      // 解析 SSE 数据
      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        buffer += decoder.decode(value, { stream: true })

        // SSE 以双换行分隔事件块
        const blocks = buffer.split('\n\n')
        buffer = blocks.pop() || ''

        for (const block of blocks) {
          const lines = block.split('\n')
          let eventType: string | null = null
          let dataStr = ''

          for (const line of lines) {
            if (line.startsWith('event: ')) {
              eventType = line.slice(7).trim()
            } else if (line.startsWith('data: ')) {
              dataStr += line.slice(6)
            }
          }

          if (!eventType || !dataStr) continue

          try {
            const data = JSON.parse(dataStr)
            handleSSEEvent(eventType as AgentSSEEvent, data, set, get)
          } catch {
            // 忽略解析错误（如心跳注释行）
          }
        }
      }
    } catch (e) {
      set(state => ({
        error: (e as Error).message,
        streaming: false,
      }))
    }
  },

  clearMessages: () => set({ messages: [], totalTokens: 0 }),

  clearError: () => set({ error: null }),
}))

/** 处理 SSE 事件，更新前端状态 */
function handleSSEEvent(
  event: AgentSSEEvent,
  data: AgentSSEEventData[typeof event],
  set: (fn: (state: AgentState) => Partial<AgentState>) => void,
  get: () => AgentState,
) {
  const { messages } = get()
  // 找到最后一条助手消息
  const lastIdx = messages.length - 1
  if (lastIdx < 0 || messages[lastIdx].role !== 'assistant') return

  switch (event) {
    case 'text': {
      const textData = data as AgentSSEEventData['text']
      const updated = [...messages]
      updated[lastIdx] = {
        ...updated[lastIdx],
        content: textData.content,
      }
      set(() => ({ messages: updated }))
      break
    }
    case 'tool_start': {
      const toolData = data as AgentSSEEventData['tool_start']
      const updated = [...messages]
      const toolEvent: ToolEvent = {
        toolCallId: toolData.toolCallId,
        name: toolData.name,
        arguments: toolData.arguments,
        status: 'running',
      }
      updated[lastIdx] = {
        ...updated[lastIdx],
        toolEvents: [...(updated[lastIdx].toolEvents || []), toolEvent],
      }
      set(() => ({ messages: updated }))
      break
    }
    case 'tool_result': {
      const toolData = data as AgentSSEEventData['tool_result']
      const updated = [...messages]
      const toolEvents = [...(updated[lastIdx].toolEvents || [])]
      const idx = toolEvents.findIndex(t => t.toolCallId === toolData.toolCallId)
      if (idx >= 0) {
        toolEvents[idx] = {
          ...toolEvents[idx],
          result: toolData.result,
          error: toolData.error,
          success: toolData.success,
          status: toolData.success ? 'done' : 'error',
        }
      }
      updated[lastIdx] = { ...updated[lastIdx], toolEvents }
      set(() => ({ messages: updated }))
      break
    }
    case 'usage': {
      const usageData = data as AgentSSEEventData['usage']
      set(state => ({ totalTokens: state.totalTokens + usageData.totalTokens }))
      break
    }
    case 'error': {
      const errData = data as AgentSSEEventData['error']
      set(() => ({ error: errData.message, streaming: false }))
      break
    }
    case 'done': {
      set(() => ({ streaming: false }))
      // 刷新会话列表（更新最后活跃时间）
      get().fetchConversations()
      break
    }
  }
}
