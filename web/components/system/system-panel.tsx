'use client'

import { useState } from 'react'
import { useAuthStore } from '@/stores/auth-store'
import { SectionWrapper } from '@/components/shared/section-wrapper'
import { ActionButton } from '@/components/shared/action-button'
import { FormField } from '@/components/shared/form-field'
import { Separator } from '@/components/ui/separator'
import { Label } from '@/components/ui/label'
import { apiClient } from '@/lib/api-client'
import { RefreshCw, ShieldCheck, Wrench, Trash2 } from 'lucide-react'

export function SystemPanel() {
  const isLoggedIn = useAuthStore((s) => s.isLoggedIn)

  // Init super admin
  const [isaUserId, setIsaUserId] = useState('')
  const [isaLoading, setIsaLoading] = useState(false)
  const [isaResult, setIsaResult] = useState<string | null>(null)

  // Seed permissions
  const [seedLoading, setSeedLoading] = useState(false)
  const [seedResult, setSeedResult] = useState<string | null>(null)

  // Cleanup
  const [cleanupLoading, setCleanupLoading] = useState(false)
  const [cleanupResult, setCleanupResult] = useState<string | null>(null)

  const handleInitSuperAdmin = async () => {
    setIsaLoading(true)
    try {
      const res = await apiClient.post('/system/init-super-admin', { userId: isaUserId })
      setIsaResult(JSON.stringify(res, null, 2))
    } catch (e) {
      setIsaResult(`Error: ${(e as Error).message}`)
    } finally {
      setIsaLoading(false)
    }
  }

  const handleSeedPermissions = async () => {
    setSeedLoading(true)
    try {
      const res = await apiClient.post('/system/seed-permissions')
      setSeedResult(JSON.stringify(res, null, 2))
    } catch (e) {
      setSeedResult(`Error: ${(e as Error).message}`)
    } finally {
      setSeedLoading(false)
    }
  }

  const handleCleanup = async () => {
    setCleanupLoading(true)
    try {
      const res = await apiClient.post('/system/cleanup')
      setCleanupResult(JSON.stringify(res, null, 2))
    } catch (e) {
      setCleanupResult(`Error: ${(e as Error).message}`)
    } finally {
      setCleanupLoading(false)
    }
  }

  if (!isLoggedIn) return null

  return (
    <SectionWrapper title="系统管理" description="系统级操作" badge="sys:system">
      <div className="space-y-6">

        {/* Init Super Admin */}
        <div className="space-y-3">
          <div className="flex items-center gap-2 text-sm font-medium">
            <ShieldCheck className="h-4 w-4" /> 初始化超级管理员
          </div>
          <p className="text-xs text-muted-foreground">为指定用户创建超级管理员角色并分配全部 38 个权限。系统租户自动检测，无需手动填写。</p>
          <FormField label="用户 ID" id="isa-uid" value={isaUserId} onChange={setIsaUserId} required />
          <ActionButton onClick={handleInitSuperAdmin} loading={isaLoading} variant="default">
            初始化
          </ActionButton>
          {isaResult && <pre className="bg-muted rounded p-2 text-xs overflow-auto max-h-48 font-mono">{isaResult}</pre>}
        </div>

        <Separator />

        {/* Seed Permissions */}
        <div className="space-y-3">
          <div className="flex items-center gap-2 text-sm font-medium">
            <RefreshCw className="h-4 w-4" /> 同步权限码
          </div>
          <p className="text-xs text-muted-foreground">将所有预定义权限码写入数据库</p>
          <ActionButton onClick={handleSeedPermissions} loading={seedLoading} variant="outline">
            执行同步
          </ActionButton>
          {seedResult && <pre className="bg-muted rounded p-2 text-xs overflow-auto max-h-48 font-mono">{seedResult}</pre>}
        </div>

        <Separator />

        {/* Seed Preset Roles */}
        <div className="space-y-3">
          <div className="flex items-center gap-2 text-sm font-medium">
            ⭐ 初始化预设角色
          </div>
          <p className="text-xs text-muted-foreground">创建跨租户共享的预设角色：租户管理员、普通成员、人事管理</p>
          <ActionButton onClick={async () => {
            setSeedLoading(true)
            try { const res = await apiClient.post('/system/seed-preset-roles'); setSeedResult(JSON.stringify(res, null, 2)) }
            catch (e) { setSeedResult('Error: ' + (e as Error).message) }
            finally { setSeedLoading(false) }
          }} loading={seedLoading} variant="outline">
            执行初始化
          </ActionButton>
          {seedResult && <pre className="bg-muted rounded p-2 text-xs overflow-auto max-h-48 font-mono">{seedResult}</pre>}
        </div>

        <Separator />

        {/* Cleanup */}
        <div className="space-y-3">
          <div className="flex items-center gap-2 text-sm font-medium">
            <Trash2 className="h-4 w-4" /> 软删除清理
          </div>
          <p className="text-xs text-muted-foreground">手动触发系统软删除数据清理</p>
          <ActionButton onClick={handleCleanup} loading={cleanupLoading} variant="destructive">
            执行清理
          </ActionButton>
          {cleanupResult && <pre className="bg-muted rounded p-2 text-xs overflow-auto max-h-48 font-mono">{cleanupResult}</pre>}
        </div>

      </div>
    </SectionWrapper>
  )
}
