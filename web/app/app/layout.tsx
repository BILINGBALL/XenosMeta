'use client'

import { useAuthStore } from '@/stores/auth-store'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Layers, Bot, Table, FileText } from 'lucide-react'

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const isLoggedIn = useAuthStore((s) => s.isLoggedIn)
  const hasHydrated = useAuthStore((s) => s.hasHydrated)
  const pathname = usePathname()

  const navItems = [
    { href: '/app', label: '数据表格', icon: Table },
    { href: '/app/files', label: '文件管理', icon: FileText },
    { href: '/agent', label: 'AI Agent', icon: Bot },
  ]

  return (
    <div className="min-h-screen flex flex-col bg-muted/30">
      <header className="sticky top-0 z-50 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        {/* 手机端：Logo + 图标导航 */}
        <div className="sm:hidden flex h-14 items-center justify-between px-3">
          <Link href="/app" className="flex items-center gap-2">
            <div className="flex size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground shrink-0">
              <Layers className="size-4" />
            </div>
            <span className="text-base font-bold tracking-tight">生产管理</span>
          </Link>
          <nav className="flex items-center gap-1">
            {navItems.map((item) => {
              const Icon = item.icon
              const active = pathname === item.href || (item.href !== '/app' && pathname.startsWith(item.href))
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  aria-label={item.label}
                  className={`flex size-9 items-center justify-center rounded-md transition-colors ${
                    active
                      ? 'bg-primary/10 text-primary'
                      : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                  }`}
                >
                  <Icon className="size-4.5" />
                </Link>
              )
            })}
          </nav>
        </div>

        {/* 桌面端：Logo + 标题 + 文字导航 */}
        <div className="hidden sm:flex h-14 items-center justify-between px-6">
          <div className="flex items-center gap-6">
            <Link href="/app" className="flex items-center gap-2 hover:opacity-80 transition-opacity">
              <div className="flex size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
                <Layers className="size-4" />
              </div>
              <span className="text-lg font-bold tracking-tight">生产管理系统</span>
            </Link>
            <nav className="flex items-center gap-1 text-sm">
              {navItems.map((item) => {
                const Icon = item.icon
                const active = pathname === item.href || (item.href !== '/app' && pathname.startsWith(item.href))
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`flex items-center gap-1 px-3 py-1.5 rounded-md transition-colors ${
                      active
                        ? 'bg-primary/10 text-primary'
                        : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                    }`}
                  >
                    <Icon className="size-3.5" />{item.label}
                  </Link>
                )
              })}
            </nav>
          </div>
          <div className="flex items-center gap-3 text-sm text-muted-foreground">
            {hasHydrated && !isLoggedIn && <a href="/index.html" className="hover:text-foreground transition-colors">未登录</a>}
          </div>
        </div>
      </header>
      <main className="flex-1 px-3 py-4 sm:px-6 sm:py-6">{children}</main>
    </div>
  )
}
