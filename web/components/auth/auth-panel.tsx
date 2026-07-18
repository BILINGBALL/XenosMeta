'use client'

import { useState } from 'react'
import { useAuthStore } from '@/stores/auth-store'
import { SectionWrapper } from '@/components/shared/section-wrapper'
import { FormField } from '@/components/shared/form-field'
import { ActionButton } from '@/components/shared/action-button'
import { ToastListener } from '@/components/shared/toast-listener'
import { Separator } from '@/components/ui/separator'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Textarea } from '@/components/ui/textarea'
import { apiClient } from '@/lib/api-client'
import { Key, LogOut, User as UserIcon, UserPlus, LogIn } from 'lucide-react'

export function AuthPanel() {
  const { isLoggedIn, user, accessToken, loading, login, logout } = useAuthStore()

  // Login form
  const [loginUsername, setLoginUsername] = useState('admin')
  const [loginPassword, setLoginPassword] = useState('admin123')

  // Register form
  const [regUsername, setRegUsername] = useState('')
  const [regPassword, setRegPassword] = useState('')
  const [regNickname, setRegNickname] = useState('')
  const [regEmail, setRegEmail] = useState('')
  const [regPhone, setRegPhone] = useState('')
  const [regAvatar, setRegAvatar] = useState('')
  const [regTenantId, setRegTenantId] = useState('')
  const [regProfile, setRegProfile] = useState('{}')
  const [regLoading, setRegLoading] = useState(false)
  const [regResult, setRegResult] = useState<string | null>(null)

  // Refresh token
  const [refreshLoading, setRefreshLoading] = useState(false)
  const [refreshResult, setRefreshResult] = useState<string | null>(null)

  const handleLogin = async () => {
    await login({ username: loginUsername, password: loginPassword })
  }

  const handleLogout = async () => {
    await logout()
  }

  const handleRegister = async () => {
    setRegLoading(true)
    setRegResult(null)
    try {
      let profile: Record<string, unknown> | undefined
      try { profile = JSON.parse(regProfile) } catch { profile = undefined }
      const res = await apiClient.post('/user/register', {
        username: regUsername,
        password: regPassword,
        nickname: regNickname || undefined,
        email: regEmail || undefined,
        phone: regPhone || undefined,
        avatar: regAvatar || undefined,
        tenantId: regTenantId || undefined,
        profile: profile || undefined,
      })
      setRegResult(JSON.stringify(res, null, 2))
    } catch (e) {
      setRegResult(`Error: ${(e as Error).message}`)
    } finally {
      setRegLoading(false)
    }
  }

  const handleRefresh = async () => {
    setRefreshLoading(true)
    setRefreshResult(null)
    try {
      const refreshToken = useAuthStore.getState().refreshToken
      if (!refreshToken) {
        setRefreshResult('Error: No refresh token available')
        setRefreshLoading(false)
        return
      }
      const res = await apiClient.post('/user/refresh', { refreshToken })
      setRefreshResult(JSON.stringify(res, null, 2))
    } catch (e) {
      setRefreshResult(`Error: ${(e as Error).message}`)
    } finally {
      setRefreshLoading(false)
    }
  }

  if (isLoggedIn && user) {
    return (
      <SectionWrapper title="认证状态" description="已登录 — Token 有效" badge="已认证">
        <ToastListener store={useAuthStore} />
        <div className="space-y-3">
          <div className="flex items-center gap-2 text-sm">
            <UserIcon className="h-4 w-4 text-green-600" />
            <span className="font-medium">{user.nickname || user.username}</span>
            <span className="text-muted-foreground">({user.username})</span>
          </div>
          <div className="text-xs text-muted-foreground">
            User ID: <code className="bg-muted px-1 rounded">{user.id}</code>
          </div>
          <Separator />
          <div className="space-y-1">
            <Label className="text-xs flex items-center gap-1">
              <Key className="h-3 w-3" /> Access Token
            </Label>
            <Input value={accessToken || ''} readOnly className="text-xs font-mono h-8" />
          </div>
          <Separator />
          <div className="space-y-2">
            <Label className="text-xs">Refresh Token 操作</Label>
            <div className="flex gap-2">
              <ActionButton onClick={handleRefresh} loading={refreshLoading} variant="outline" size="sm">
                刷新 Token
              </ActionButton>
            </div>
            {refreshResult && (
              <pre className="bg-muted rounded p-2 text-xs overflow-auto max-h-48 font-mono">{refreshResult}</pre>
            )}
          </div>
          <ActionButton variant="destructive" onClick={handleLogout} loading={loading}>
            <LogOut className="h-3 w-3" /> 登出
          </ActionButton>
        </div>
      </SectionWrapper>
    )
  }

  return (
    <SectionWrapper title="认证操作" description="登录 / 注册 / 刷新 Token" badge="公开接口">
      <Tabs defaultValue="login">
        <TabsList className="mb-4 w-full">
          <TabsTrigger value="login" className="flex-1"><LogIn className="h-3 w-3 mr-1" />登录</TabsTrigger>
          <TabsTrigger value="register" className="flex-1"><UserPlus className="h-3 w-3 mr-1" />注册</TabsTrigger>
        </TabsList>

        <TabsContent value="login">
          <ToastListener store={useAuthStore} />
          <div className="space-y-3">
            <FormField label="用户名" id="login-username" value={loginUsername} onChange={setLoginUsername} placeholder="admin" />
            <FormField label="密码" id="login-password" value={loginPassword} onChange={setLoginPassword} type="password" placeholder="admin123" />
            <ActionButton onClick={handleLogin} loading={loading} className="w-full">登录</ActionButton>
          </div>
        </TabsContent>

        <TabsContent value="register">
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-2">
              <FormField label="用户名 *" id="reg-user" value={regUsername} onChange={setRegUsername} required />
              <FormField label="密码 *" id="reg-pass" value={regPassword} onChange={setRegPassword} type="password" required />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <FormField label="昵称" id="reg-nick" value={regNickname} onChange={setRegNickname} />
              <FormField label="邮箱" id="reg-email" value={regEmail} onChange={setRegEmail} />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <FormField label="手机号" id="reg-phone" value={regPhone} onChange={setRegPhone} />
              <FormField label="头像 URL" id="reg-avatar" value={regAvatar} onChange={setRegAvatar} />
            </div>
            <FormField label="租户 ID (可选)" id="reg-tid" value={regTenantId} onChange={setRegTenantId} />
            <div className="grid gap-1.5">
              <Label htmlFor="reg-profile">Profile (JSON)</Label>
              <Textarea id="reg-profile" value={regProfile} onChange={(e) => setRegProfile(e.target.value)} rows={3} className="font-mono text-xs" />
            </div>
            <ActionButton onClick={handleRegister} loading={regLoading} className="w-full">注册</ActionButton>
            {regResult && <pre className="bg-muted rounded p-2 text-xs overflow-auto max-h-64 font-mono">{regResult}</pre>}
          </div>
        </TabsContent>
      </Tabs>
    </SectionWrapper>
  )
}
