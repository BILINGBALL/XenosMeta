'use client'

import Link from 'next/link'
import { useAuthStore } from '@/stores/auth-store'
import { Bot, Database } from 'lucide-react'

export default function AgentLayout({ children }: { children: React.ReactNode }) {
  const isLoggedIn = useAuthStore((s) => s.isLoggedIn)

  return (
    <div className="h-dvh flex flex-col bg-background">
      <header className="shrink-0 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="flex h-14 items-center justify-between px-4 sm:px-6">
          <div className="flex items-center gap-4">
            <Link href="/agent" className="flex items-center gap-2 hover:opacity-80 transition-opacity">
              <div className="flex size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
                <Bot className="size-4" />
              </div>
              <span className="text-lg font-bold tracking-tight hidden sm:inline">AI Agent</span>
            </Link>
          </div>
          <div className="flex items-center gap-3 text-sm">
            <Link href="/app" className="flex items-center gap-1.5 text-muted-foreground hover:text-foreground transition-colors">
              <Database className="size-3.5" />
              <span className="hidden sm:inline">数据表格</span>
            </Link>
            <span className="text-xs text-muted-foreground">
              {isLoggedIn ? '已连接' : '未登录'}
            </span>
          </div>
        </div>
      </header>
      <main className="flex-1 min-h-0 overflow-hidden">{children}</main>
    </div>
  )
}
