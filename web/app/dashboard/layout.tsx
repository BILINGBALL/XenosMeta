'use client'

import Link from 'next/link'
import {useAuthStore} from '@/stores/auth-store'
import {Badge} from '@/components/ui/badge'
import {Button} from '@/components/ui/button'
import {Home} from 'lucide-react'

export default function DashboardLayout({children}: { children: React.ReactNode }) {
    const isLoggedIn = useAuthStore((s) => s.isLoggedIn)

    return (
        <div className="min-h-screen flex flex-col">
            {/*<header className="sticky top-0 z-50 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">*/}
            {/*  <div className="container mx-auto flex h-14 items-center justify-between px-4">*/}
            {/*    <div className="flex items-center gap-3">*/}
            {/*      <Link href="/" className="text-sm text-muted-foreground hover:text-foreground transition-colors">*/}
            {/*        <Home className="h-4 w-4" />*/}
            {/*      </Link>*/}
            {/*      <h1 className="text-lg font-bold tracking-tight">Auth Core</h1>*/}
            {/*      <Badge variant="outline" className="text-xs">控制台</Badge>*/}
            {/*    </div>*/}
            {/*    <div className="flex items-center gap-2 text-sm">*/}
            {/*      <span className="text-muted-foreground">Server:</span>*/}
            {/*      <code className="bg-muted px-2 py-0.5 rounded text-xs">192.168.1.23:3001</code>*/}
            {/*      {isLoggedIn && <Badge variant="default" className="ml-2">已连接</Badge>}*/}
            {/*      {!isLoggedIn && <Badge variant="secondary" className="ml-2">未登录</Badge>}*/}
            {/*    </div>*/}
            {/*  </div>*/}
            {/*</header>*/}
            <main className="flex-1 container mx-auto px-4 py-6">{children}</main>
            <footer className="border-t py-3 text-center text-xs text-muted-foreground">
                Auth Core 控制台
            </footer>
        </div>
    )
}
