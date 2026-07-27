'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { useAgentStore } from '@/stores/agent-store'
import { useAuthStore } from '@/stores/auth-store'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Bot, User, Send, Plus, Trash2, Loader2, Wrench, ChevronDown, ChevronRight, MessageSquare, Mic, Square, X } from 'lucide-react'
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
        {/* 工具调用过程 */}
        {msg.toolEvents && msg.toolEvents.length > 0 && (
          <div className="w-full space-y-1.5">
            {msg.toolEvents.map(te => (
              <ToolEventCard key={te.toolCallId} event={te} />
            ))}
          </div>
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

// ==================== 工具调用卡片 ====================

function ToolEventCard({ event }: { event: ToolEvent }) {
  const [expanded, setExpanded] = useState(false)

  return (
    <div className="rounded-lg border bg-card text-card-foreground overflow-hidden text-xs">
      {/* 头部 */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center gap-2 px-3 py-2 hover:bg-muted/50 transition-colors"
      >
        {expanded ? <ChevronDown className="size-3 shrink-0" /> : <ChevronRight className="size-3 shrink-0" />}
        <Wrench className="size-3 shrink-0 text-muted-foreground" />
        <span className="font-medium">{event.name}</span>
        {event.status === 'running' && <Loader2 className="size-3 animate-spin text-blue-500" />}
        {event.status === 'done' && <Badge variant="default" className="text-[10px] h-4 px-1">成功</Badge>}
        {event.status === 'error' && <Badge variant="destructive" className="text-[10px] h-4 px-1">失败</Badge>}
      </button>

      {/* 展开内容 */}
      {expanded && (
        <div className="border-t px-3 py-2 space-y-2 bg-muted/30">
          {/* 参数 */}
          <div>
            <span className="text-muted-foreground">参数：</span>
            <pre className="mt-1 p-2 bg-muted rounded text-[11px] overflow-auto max-h-40 font-mono">
              {JSON.stringify(event.arguments, null, 2)}
            </pre>
          </div>
          {/* 结果 */}
          {event.result !== undefined && (
            <div>
              <span className="text-muted-foreground">结果：</span>
              <pre className="mt-1 p-2 bg-muted rounded text-[11px] overflow-auto max-h-40 font-mono">
                {typeof event.result === 'string' ? event.result : JSON.stringify(event.result, null, 2)}
              </pre>
            </div>
          )}
          {/* 错误 */}
          {event.error && (
            <div>
              <span className="text-destructive">错误：</span>
              <pre className="mt-1 p-2 bg-destructive/10 rounded text-[11px] text-destructive">
                {event.error}
              </pre>
            </div>
          )}
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

  if (!isLoggedIn) {
    return (
      <div className="flex flex-col items-center justify-center h-full py-32 text-muted-foreground">
        <Bot className="size-16 mb-4 opacity-20" />
        <p className="text-lg font-medium mb-2">请先登录</p>
        <p className="text-sm mb-4">使用 AI Agent 需要先登录系统</p>
        <Button onClick={() => window.open('/dashboard', '_self')}>前往登录</Button>
      </div>
    )
  }

  return (
    <div className="flex h-full gap-0">
      {/* 左侧会话列表 */}
      <div className="w-64 shrink-0 border-r flex flex-col bg-muted/30">
        <div className="p-3 border-b">
          <Button
            className="w-full"
            size="sm"
            onClick={() => store.createConversation()}
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
              onClick={() => store.selectConversation(conv.id)}
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
      </div>

      {/* 右侧对话区 */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* 消息列表 */}
        <div ref={scrollRef} className="flex-1 overflow-auto px-4 py-6 space-y-6">
          {store.messages.length === 0 && !store.loading ? (
            <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
              <Bot className="size-16 mb-4 opacity-20" />
              <p className="text-lg font-medium mb-2">AI Agent</p>
              <p className="text-sm">开始一个新的对话，我可以帮你查询数据、管理文件和执行操作</p>
              {store.tools.length > 0 && (
                <div className="mt-6 flex flex-wrap gap-2 justify-center max-w-md">
                  {store.tools.map(tool => (
                    <Badge
                      key={tool.name}
                      variant={tool.available ? 'default' : 'secondary'}
                      className="text-xs"
                    >
                      <Wrench className="size-2.5 mr-1" />
                      {tool.name}
                    </Badge>
                  ))}
                </div>
              )}
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
              ) : isRecording ? (
                <Mic className="size-5" />
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
