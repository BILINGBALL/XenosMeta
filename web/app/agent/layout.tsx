'use client'

import Link from 'next/link'
import { useAuthStore } from '@/stores/auth-store'
import { Bot, ArrowLeft } from 'lucide-react'

export default function AgentLayout({ children }: { children: React.ReactNode }) {
  const isLoggedIn = useAuthStore((s) => s.isLoggedIn)

  return (
    <div className="fixed inset-0 flex flex-col bg-background overscroll-contain">
      {/* 桌面端顶部栏；手机端由 AgentChat 自带汉堡头处理 */}
      <header className="hidden sm:flex shrink-0 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="flex h-14 items-center justify-between px-6 w-full">
          <div className="flex items-center gap-4">
            <Link
              href="/app"
              className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              <ArrowLeft className="size-4" />
              <span>返回</span>
            </Link>
            <div className="w-px h-5 bg-border" />
            <Link href="/agent" className="flex items-center gap-2 hover:opacity-80 transition-opacity">
              <div className="flex size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
                <Bot className="size-4" />
              </div>
              <span className="text-lg font-bold tracking-tight">AI Agent</span>
            </Link>
          </div>
          <div className="flex items-center gap-3 text-sm">
            <span className="text-xs text-muted-foreground">
              {isLoggedIn ? '已连接' : <a href="/index.html" className="hover:text-foreground transition-colors">未登录</a>}
            </span>
          </div>
        </div>
      </header>
      <main className="flex-1 min-h-0 overflow-hidden overscroll-contain">{children}</main>
    </div>
  )
}
