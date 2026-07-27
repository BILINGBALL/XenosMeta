'use client'

import { useAuthStore } from '@/stores/auth-store'
import Link from 'next/link'
import { Layers, Bot } from 'lucide-react'

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const isLoggedIn = useAuthStore((s) => s.isLoggedIn)

  return (
    <div className="min-h-screen flex flex-col bg-muted/30">
      <header className="sticky top-0 z-50 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="flex h-14 items-center justify-between px-6">
          <div className="flex items-center gap-6">
            <Link href="/app" className="flex items-center gap-2 hover:opacity-80 transition-opacity">
              <div className="flex size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
                <Layers className="size-4" />
              </div>
              <span className="text-lg font-bold tracking-tight">生产管理系统</span>
            </Link>
            <nav className="flex items-center gap-1 text-sm">
              <Link href="/app" className="px-3 py-1.5 rounded-md hover:bg-muted transition-colors text-muted-foreground hover:text-foreground">
                数据表格
              </Link>
              <Link href="/app/files" className="px-3 py-1.5 rounded-md hover:bg-muted transition-colors text-muted-foreground hover:text-foreground">
                文件管理
              </Link>
              <Link href="/agent" className="flex items-center gap-1 px-3 py-1.5 rounded-md hover:bg-muted transition-colors text-muted-foreground hover:text-foreground">
                <Bot className="size-3.5" />AI Agent
              </Link>
            </nav>
          </div>
          <div className="flex items-center gap-3 text-sm text-muted-foreground">
            {!isLoggedIn && <span>未登录</span>}
          </div>
        </div>
      </header>
      <main className="flex-1 px-6 py-6">{children}</main>
    </div>
  )
}
