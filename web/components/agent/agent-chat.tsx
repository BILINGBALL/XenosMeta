'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { useAgentStore } from '@/stores/agent-store'
import { useAuthStore } from '@/stores/auth-store'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Bot, User, Send, Plus, Trash2, Loader2, Wrench, ChevronDown, ChevronRight, MessageSquare, Mic, Square, X, Menu } from 'lucide-react'
import { useSpeechRecognition } from '@/hooks/use-speech-recognition'
import type { ChatDisplayMessage, ToolEvent } from '@/types'

// ==================== 消息气泡 ====================

function MessageBubble({ msg, streaming }: { msg: ChatDisplayMessage; streaming: boolean }) {
  const isUser = msg.role === 'user'

  return (
    <div className={`flex gap-3 ${isUser ? 'flex-row-reverse' : ''}`}>
      {/* 头像 */}
      <div className={`shrink-0 size-8 rounded-full flex items-center justify-center ${
        isUser ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'
      }`}>
        {isUser ? <User className="size-4" /> : <Bot className="size-4" />}
      </div>

      {/* 消息内容 */}
      <div className={`flex-1 min-w-0 ${isUser ? 'items-end' : 'items-start'} flex flex-col gap-2`}>
        {/* 工具调用概览 — 收起时只显示一行精简信息 */}
        {msg.toolEvents && msg.toolEvents.length > 0 && (
          <ToolEventBanner events={msg.toolEvents} />
        )}

        {/* 文本内容 */}
        {msg.content ? (
          <div className={`rounded-lg px-3.5 py-2.5 text-sm leading-relaxed max-w-[85%] ${
            isUser
              ? 'bg-primary text-primary-foreground'
              : 'bg-muted text-foreground'
          }`}>
            <div className="whitespace-pre-wrap break-words">{msg.content}</div>
          </div>
        ) : !isUser && streaming ? (
          <div className="flex items-center gap-1.5 text-sm text-muted-foreground px-2 py-2">
            <Loader2 className="size-3.5 animate-spin" />
            <span>思考中...</span>
          </div>
        ) : null}
      </div>
    </div>
  )
}

// ==================== 工具调用精简概览 ====================

function ToolEventBanner({ events }: { events: ToolEvent[] }) {
  const [open, setOpen] = useState(false)

  if (events.length === 0) return null

  return (
    <div className="text-xs">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-1.5 text-muted-foreground hover:text-foreground transition-colors"
      >
        {open ? <ChevronDown className="size-3" /> : <ChevronRight className="size-3" />}
        <Wrench className="size-3" />
        <span>
          调用了 {events.length} 个工具
          {events.filter(e => e.status === 'running').length > 0 && (
            <Loader2 className="size-2.5 inline ml-1 animate-spin align-baseline" />
          )}
        </span>
      </button>

      {open && (
        <div className="mt-2 space-y-1.5">
          {events.map(ev => (
            <div key={ev.toolCallId} className="rounded border bg-card px-2.5 py-1.5">
              <div className="flex items-center gap-1.5">
                <span className="font-medium">{ev.name}</span>
                {ev.status === 'running' && <Loader2 className="size-2.5 animate-spin text-blue-500" />}
                {ev.status === 'done' && <Badge variant="default" className="text-[9px] h-3.5 px-1 leading-none">✓</Badge>}
                {ev.status === 'error' && <Badge variant="destructive" className="text-[9px] h-3.5 px-1 leading-none">✗</Badge>}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ==================== 主组件 ====================

export function AgentChat() {
  const store = useAgentStore()
  const { isLoggedIn } = useAuthStore()
  const [input, setInput] = useState('')
  const [drawerOpen, setDrawerOpen] = useState(false)
  const scrollRef = useRef<HTMLDivElement>(null)

  // 语音识别
  const {
    isRecording,
    isConnecting,
    partialText,
    error: asrError,
    startRecording,
    stopRecording,
  } = useSpeechRecognition({
    onPartialText: (text) => {
      setInput(text)
    },
    onFinalText: (text) => {
      setInput(text)
    },
  })

  // 初始化
  useEffect(() => {
    if (isLoggedIn) {
      store.fetchConversations()
      store.fetchTools()
    }
  }, [isLoggedIn])

  // 自动滚动到底部
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [store.messages, partialText])

  const handleSend = useCallback(() => {
    if (!input.trim() || store.streaming) return
    if (isRecording) stopRecording()
    store.sendMessage(input)
    setInput('')
  }, [input, store.streaming, isRecording, stopRecording])

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }, [handleSend])

  // 按住说话
  const handleVoiceStart = (e: React.PointerEvent) => {
    e.preventDefault()
    if (isRecording || isConnecting || store.streaming) return
    startRecording()
  }

  const handleVoiceEnd = (e: React.PointerEvent) => {
    e.preventDefault()
    if (isRecording || isConnecting) {
      stopRecording()
    }
  }

  // 选会话后自动关 drawer
  const handleSelectConversation = useCallback((id: string) => {
    store.selectConversation(id)
    setDrawerOpen(false)
  }, [store])

  if (!isLoggedIn) {
    return (
      <div className="flex flex-col items-center justify-center h-full py-32 text-muted-foreground">
        <Bot className="size-16 mb-4 opacity-20" />
        <p className="text-lg font-medium mb-2">请先登录</p>
        <p className="text-sm mb-4">使用 AI Agent 需要先登录系统</p>
        <Button onClick={() => window.open('/index.html', '_self')}>前往登录</Button>
      </div>
    )
  }

  // 侧栏内容
  const sidebarContent = (
    <>
      <div className="p-3 border-b">
        <Button
          className="w-full"
          size="sm"
          onClick={() => { store.createConversation(); setDrawerOpen(false) }}
        >
          <Plus className="size-3.5 mr-1" />新对话
        </Button>
      </div>
      <div className="flex-1 overflow-auto">
        {store.conversations.map(conv => (
          <div
            key={conv.id}
            className={`group flex items-center gap-2 px-3 py-2.5 cursor-pointer hover:bg-muted transition-colors ${
              store.currentConversationId === conv.id ? 'bg-muted border-l-2 border-primary' : ''
            }`}
            onClick={() => handleSelectConversation(conv.id)}
          >
            <MessageSquare className="size-3.5 shrink-0 text-muted-foreground" />
            <span className="flex-1 text-sm truncate">{conv.title}</span>
            <button
              onClick={(e) => { e.stopPropagation(); store.deleteConversation(conv.id) }}
              className="opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-destructive"
            >
              <Trash2 className="size-3.5" />
            </button>
          </div>
        ))}
        {store.conversations.length === 0 && (
          <div className="px-3 py-8 text-center text-xs text-muted-foreground">
            暂无会话，点击上方按钮创建
          </div>
        )}
      </div>
    </>
  )

  return (
    <div className="flex h-full relative">
      {/* ----- 手机端遮罩 ----- */}
      {drawerOpen && (
        <div
          className="fixed inset-0 z-30 bg-black/30 sm:hidden"
          onClick={() => setDrawerOpen(false)}
        />
      )}

      {/* ----- 侧栏：桌面端固定 | 手机端抽屉 (relative 挤走主内容) ----- */}
      <aside className={`
        w-64 shrink-0 border-r bg-muted/30 h-full flex flex-col
        sm:relative sm:translate-x-0
        fixed sm:inset-auto inset-y-0 left-0 z-40
        transition-transform duration-300 ease-in-out
        ${drawerOpen ? 'translate-x-0' : '-translate-x-full sm:translate-x-0'}
      `}>
        {sidebarContent}
      </aside>

      {/* ----- 右侧对话区 ----- */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* 顶部条 — 手机端有汉堡 + 标题 */}
        <div className="sm:hidden flex items-center gap-2 px-3 py-2 border-b shrink-0">
          <Button
            variant="ghost"
            size="icon"
            className="shrink-0"
            onClick={() => setDrawerOpen(!drawerOpen)}
            aria-label="打开侧栏"
          >
            <Menu className="size-5" />
          </Button>
          <span className="text-sm font-medium truncate">
            {store.conversations.find(c => c.id === store.currentConversationId)?.title || 'AI Agent'}
          </span>
        </div>

        {/* 消息列表 */}
        <div ref={scrollRef} className="flex-1 overflow-auto px-4 py-6 space-y-6">
          {store.messages.length === 0 && !store.loading ? (
            <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
              <Bot className="size-16 mb-4 opacity-20" />
              <p className="text-lg font-medium mb-2">AI Agent</p>
              <p className="text-sm">开始一个新的对话，我可以帮你查询数据、管理文件和执行操作</p>
            </div>
          ) : (
            store.messages.map((msg, idx) => (
              <MessageBubble
                key={msg.id}
                msg={msg}
                streaming={store.streaming && idx === store.messages.length - 1}
              />
            ))
          )}
          {store.loading && (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="size-5 animate-spin text-muted-foreground" />
            </div>
          )}
        </div>

        {/* 输入区 */}
        <div className="shrink-0 border-t px-4 py-3">
          {store.error && (
            <div className="mb-2 px-3 py-2 rounded-lg bg-destructive/10 text-destructive text-xs">
              {store.error}
            </div>
          )}
          {asrError && (
            <div className="mb-2 px-3 py-2 rounded-lg bg-destructive/10 text-destructive text-xs">
              语音识别：{asrError}
            </div>
          )}
          {isRecording && (
            <div className="mb-2 flex items-center gap-2 text-xs text-destructive font-medium">
              <span className="relative flex h-3 w-3">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-3 w-3 bg-red-500"></span>
              </span>
              <span className="animate-pulse">正在聆听，请说话...</span>
              <span className="ml-2 text-muted-foreground font-normal">（松开手指结束）</span>
            </div>
          )}
          <div className="flex items-end gap-2">
            <Textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={isRecording ? '请开始说话...' : '输入消息，Enter 发送，Shift+Enter 换行，或按住麦克风说话'}
              className={`flex-1 min-h-[40px] max-h-32 resize-none transition-colors ${isRecording ? 'border-red-500 bg-red-50/30' : ''}`}
              rows={1}
              disabled={store.streaming}
            />
            {/* 按住说话按钮 */}
            <div
              onPointerDown={handleVoiceStart}
              onPointerUp={handleVoiceEnd}
              onPointerLeave={handleVoiceEnd}
              onPointerCancel={handleVoiceEnd}
              className={`shrink-0 flex items-center justify-center select-none cursor-pointer transition-all duration-150 ${
                isRecording
                  ? 'size-12 rounded-full bg-red-500 text-white shadow-lg shadow-red-500/40 scale-110'
                  : 'size-10 rounded-full bg-muted text-muted-foreground hover:bg-muted-foreground/20 active:scale-95'
              } ${store.streaming ? 'opacity-50 pointer-events-none' : ''}`}
              title={isRecording ? '松开结束' : '按住说话'}
            >
              {isConnecting ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Mic className="size-5" />
              )}
            </div>
            <Button
              onClick={handleSend}
              disabled={!input.trim() || store.streaming || !store.currentConversationId}
              size="icon"
              className="shrink-0"
            >
              {store.streaming ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
            </Button>
          </div>
          {store.totalTokens > 0 && (
            <div className="mt-1.5 text-[10px] text-muted-foreground text-right">
              Token 用量：{store.totalTokens.toLocaleString()}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
