'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { useAgentStore } from '@/stores/agent-store'
import { useAuthStore } from '@/stores/auth-store'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Bot, User, Send, Plus, Trash2, Loader2, Wrench, ChevronDown, ChevronRight, MessageSquare, Mic, Square, X, Menu, ArrowLeft, Search, UserCog, LogOut } from 'lucide-react'
import Link from 'next/link'
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
  const [searchQuery, setSearchQuery] = useState('')
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
  const user = useAuthStore((s) => s.user)
  const logout = useAuthStore((s) => s.logout)

  const filteredConversations = store.conversations.filter(conv => {
    if (!searchQuery.trim()) return true
    const q = searchQuery.toLowerCase()
    return conv.title.toLowerCase().includes(q) ||
      (conv.lastMessagePreview || '').toLowerCase().includes(q)
  })

  const sidebarContent = (
    <>
      {/* 顶部：搜索 + 新对话 */}
      <div className="p-3 border-b space-y-3 shrink-0">
        <div className="relative">
          <Search className="size-4 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="搜索会话"
            className="pl-8 h-10"
          />
        </div>
        <Button
          className="w-full h-10"
          onClick={() => { store.createConversation(); setDrawerOpen(false); setSearchQuery('') }}
        >
          <Plus className="size-4 mr-1.5" />新对话
        </Button>
      </div>

      {/* 中间：会话列表（可滚动） */}
      <div className="flex-1 min-h-0 overflow-auto">
        {filteredConversations.map(conv => (
          <div
            key={conv.id}
            className={`group flex items-start gap-2.5 px-3 py-3 cursor-pointer hover:bg-muted transition-colors ${
              store.currentConversationId === conv.id ? 'bg-muted border-l-2 border-primary' : ''
            }`}
            onClick={() => handleSelectConversation(conv.id)}
          >
            <MessageSquare className="size-4 shrink-0 text-muted-foreground mt-0.5" />
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between gap-1">
                <span className="text-sm font-medium truncate">{conv.title}</span>
                <button
                  onClick={(e) => { e.stopPropagation(); store.deleteConversation(conv.id) }}
                  className="shrink-0 opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-destructive"
                >
                  <Trash2 className="size-4" />
                </button>
              </div>
              {conv.lastMessagePreview && (
                <p className="text-xs text-muted-foreground truncate mt-1">{conv.lastMessagePreview}</p>
              )}
            </div>
          </div>
        ))}
        {filteredConversations.length === 0 && (
          <div className="px-3 py-8 text-center text-xs text-muted-foreground">
            {searchQuery.trim() ? '未找到匹配的会话' : '暂无会话，点击上方按钮创建'}
          </div>
        )}
      </div>

      {/* 底部：个人中心（固定） */}
      <div className="shrink-0 border-t p-3 bg-muted/20">
        <div className="flex items-center gap-3 px-2 py-2 rounded-lg hover:bg-muted/50 transition-colors">
          <div className="shrink-0 size-9 rounded-full bg-primary text-primary-foreground flex items-center justify-center">
            <User className="size-4" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-sm font-medium truncate">
              {user?.nickname || user?.username || '用户'}
            </div>
            <div className="text-xs text-muted-foreground truncate">
              {user?.username || ''}
            </div>
          </div>
          <button
            onClick={() => logout()}
            className="shrink-0 size-8 rounded-md flex items-center justify-center text-muted-foreground hover:text-destructive hover:bg-muted transition-colors"
            title="退出登录"
          >
            <LogOut className="size-4" />
          </button>
        </div>
      </div>
    </>
  )

  return (
    <div className="flex h-full overflow-hidden">
      {/* ----- 侧栏：push 抽屉 -----
          手机端关闭时 -ml-64 将侧栏拉出视口（overflow-hidden 裁剪），
          开启时 ml-0 让侧栏归位、主区域自然被挤右；
          桌面端 sm:ml-0 始终可见。
          transition-[margin] 让侧栏滑入与主区域让位同步动画。 */}
      <aside className={`
        w-64 shrink-0 border-r bg-muted/30 h-full flex flex-col
        transition-[margin] duration-300 ease-in-out
        ${drawerOpen ? 'ml-0' : '-ml-64 sm:ml-0'}
      `}>
        {sidebarContent}
      </aside>

      {/* ----- 右侧对话区 ----- */}
      <div className="relative flex-1 min-h-0 flex flex-col min-w-0">
        {/* 手机端：抽屉打开时虚化主聊天区并屏蔽交互，点击任意空白处关闭抽屉。
            放在 chat 区内部、absolute inset-0，不会覆盖左侧 sidebar，
            因此点击 sidebar 内的会话仍可正常切换。 */}
        {drawerOpen && (
          <div
            className="sm:hidden absolute inset-0 z-20 bg-background/30 backdrop-blur-[2px] cursor-pointer"
            onClick={() => setDrawerOpen(false)}
            aria-hidden
          />
        )}
        {/* 顶部条 — 手机端：汉堡 + 返回 + 当前会话标题 */}
        <div className="sm:hidden h-14 flex items-center gap-1 px-3 border-b shrink-0">
          <Button
            variant="ghost"
            size="icon"
            className="shrink-0 size-11"
            onClick={() => setDrawerOpen(!drawerOpen)}
            aria-label="切换侧栏"
          >
            <Menu className="size-5" />
          </Button>
          <Link
            href="/app"
            className="shrink-0 flex items-center justify-center size-11 rounded-md hover:bg-muted transition-colors text-muted-foreground"
            aria-label="返回"
          >
            <ArrowLeft className="size-5" />
          </Link>
          <span className="text-lg font-semibold truncate flex-1 mr-2">
            {store.conversations.find(c => c.id === store.currentConversationId)?.title || 'AI Agent'}
          </span>
        </div>

        {/* 消息列表 */}
        <div ref={scrollRef} className="flex-1 min-h-0 overflow-auto px-4 py-6 space-y-6">
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
        <div className="shrink-0 border-t px-4 py-4">
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
              placeholder={isRecording ? '请开始说话...' : '输入消息，或按住麦克风说话'}
              className={`flex-1 min-h-[44px] max-h-32 resize-none transition-colors ${isRecording ? 'border-red-500 bg-red-50/30' : ''}`}
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
                  : 'size-11 rounded-full bg-muted text-muted-foreground hover:bg-muted-foreground/20 active:scale-95'
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
              className="shrink-0 size-11"
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
