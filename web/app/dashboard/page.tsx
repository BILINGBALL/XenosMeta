'use client'

import {AuthPanel} from '@/components/auth/auth-panel'
import {TenantPanel} from '@/components/tenant/tenant-panel'
import {UserPanel} from '@/components/user/user-panel'
import {GroupPanel} from '@/components/group/group-panel'
import {RolePanel} from '@/components/role/role-panel'
import {PermissionPanel} from '@/components/permission/permission-panel'
import {TablePanel} from '@/components/dynamic/table-panel'
import {SystemPanel} from '@/components/system/system-panel'
import {useAuthStore} from '@/stores/auth-store'
import {Tabs, TabsContent, TabsList, TabsTrigger} from '@/components/ui/tabs'
import {Badge} from '@/components/ui/badge'

export default function Home() {
    const isLoggedIn = useAuthStore((s) => s.isLoggedIn)

    return (
        <div className="min-h-screen flex flex-col">
            {/* Header */}
            <header
                className="flex top-0 z-50 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
                <div className="container mx-auto flex h-14 items-center justify-between px-4">
                    <div className="flex items-center gap-3">
                        <h1 className="text-lg font-bold tracking-tight">Auth Core</h1>
                        <Badge variant="outline" className="text-xs">API Test Dashboard</Badge>
                    </div>
                    <div className="flex items-center gap-2 text-sm">
                        <span className="text-muted-foreground">Server:</span>
                        <code className="bg-muted px-2 py-0.5 rounded text-xs">http://localhost:3001/api</code>
                        {isLoggedIn && <Badge variant="default" className="ml-2">已连接</Badge>}
                        {!isLoggedIn && <Badge variant="secondary" className="ml-2">未登录</Badge>}
                    </div>
                </div>
            </header>

            {/* Main Content */}
            <main className="flex-1 container mx-auto px-4 py-6">
                <Tabs defaultValue="auth" className="w-full">
                    <TabsList className="mb-6 flex flex-wrap h-auto gap-1 bg-transparent p-0">
                        <TabsTrigger value="auth"
                                     className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground rounded-md px-3 py-1.5 text-sm">
                            🔑 认证
                        </TabsTrigger>
                        <TabsTrigger value="tenant"
                                     className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground rounded-md px-3 py-1.5 text-sm">
                            🏢 租户
                        </TabsTrigger>
                        <TabsTrigger value="user"
                                     className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground rounded-md px-3 py-1.5 text-sm">
                            👤 用户
                        </TabsTrigger>
                        <TabsTrigger value="group"
                                     className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground rounded-md px-3 py-1.5 text-sm">
                            🏛️ 组织架构
                        </TabsTrigger>
                        <TabsTrigger value="role"
                                     className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground rounded-md px-3 py-1.5 text-sm">
                            🛡️ 角色
                        </TabsTrigger>
                        <TabsTrigger value="permission"
                                     className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground rounded-md px-3 py-1.5 text-sm">
                            🔒 权限
                        </TabsTrigger>
                        <TabsTrigger value="dynamic"
                                     className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground rounded-md px-3 py-1.5 text-sm">
                            📊 动态表
                        </TabsTrigger>
                        <TabsTrigger value="system"
                                     className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground rounded-md px-3 py-1.5 text-sm">
                            ⚙️ 系统
                        </TabsTrigger>
                    </TabsList>

                    <TabsContent value="auth"><AuthPanel/></TabsContent>
                    <TabsContent value="tenant"><TenantPanel/></TabsContent>
                    <TabsContent value="user"><UserPanel/></TabsContent>
                    <TabsContent value="group"><GroupPanel/></TabsContent>
                    <TabsContent value="role"><RolePanel/></TabsContent>
                    <TabsContent value="permission"><PermissionPanel/></TabsContent>
                    <TabsContent value="dynamic"><TablePanel/></TabsContent>
                    <TabsContent value="system"><SystemPanel/></TabsContent>
                </Tabs>
            </main>

            {/* Footer */}
            <footer className="border-t py-3 text-center text-xs text-muted-foreground">
                Auth Core API Test Dashboard — Each tab is independent and can be tested separately
            </footer>
        </div>
    )
}
