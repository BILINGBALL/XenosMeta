'use client'

import { useState, useEffect } from 'react'
import { useTenantStore } from '@/stores/tenant-store'
import { useAuthStore } from '@/stores/auth-store'
import { SectionWrapper } from '@/components/shared/section-wrapper'
import { ActionButton } from '@/components/shared/action-button'
import { FormField } from '@/components/shared/form-field'
import { ToastListener } from '@/components/shared/toast-listener'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { DialogFooter } from '@/components/ui/dialog'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { RefreshCw, Plus, Eye, Edit, Trash2, RotateCcw, Building2, FolderPlus } from 'lucide-react'
import type { Tenant } from '@/types'

export function TenantPanel() {
  const isLoggedIn = useAuthStore((s) => s.isLoggedIn)
  const store = useTenantStore()
  const { tenants, loading, fetchTenants, fetchTenant, createTenant, updateTenant, deleteTenant, restoreTenant } = store

  // Create
  const [showCreate, setShowCreate] = useState(false)
  const [cName, setCName] = useState('')
  const [cCode, setCCode] = useState('')
  const [cScope, setCScope] = useState('tenant')

  // Edit
  const [showEdit, setShowEdit] = useState<Tenant | null>(null)
  const [eName, setEName] = useState('')
  const [eStatus, setEStatus] = useState('true')

  // Detail
  const [showDetail, setShowDetail] = useState<Tenant | null>(null)

  // Single fetch
  const [fetchId, setFetchId] = useState('')
  const [fetchResult, setFetchResult] = useState<string | null>(null)

  useEffect(() => { if (isLoggedIn) fetchTenants() }, [isLoggedIn, fetchTenants])

  const handleCreate = async () => {
    const ok = await createTenant({ tenantName: cName, tenantCode: cCode })
    if (ok) { setShowCreate(false); setCName(''); setCCode(''); setCScope('tenant'); fetchTenants() }
  }

  const handleUpdate = async () => {
    if (!showEdit) return
    const ok = await updateTenant(showEdit.id, { tenantName: eName || undefined, status: eStatus === 'true' })
    if (ok) { setShowEdit(null); fetchTenants() }
  }

  const openEdit = (t: Tenant) => {
    setShowEdit(t)
    setEName(t.tenantName)
    setEStatus(t.status ? 'true' : 'false')
  }

  const handleFetchOne = async () => {
    if (!fetchId) return
    await fetchTenant(fetchId)
    const t = useTenantStore.getState().currentTenant
    setFetchResult(t ? JSON.stringify(t, null, 2) : 'Not found')
  }

  if (!isLoggedIn) return null

  return (
    <SectionWrapper title="租户管理" description={`${tenants.length} 个租户`} badge="sys:tenant">
      <ToastListener store={useTenantStore} />
      <Tabs defaultValue="list">
        <TabsList className="mb-4 w-full">
          <TabsTrigger value="list" className="flex-1"><Building2 className="h-3 w-3 mr-1" />列表</TabsTrigger>
          <TabsTrigger value="create" className="flex-1"><Plus className="h-3 w-3 mr-1" />创建</TabsTrigger>
          <TabsTrigger value="lookup" className="flex-1"><Eye className="h-3 w-3 mr-1" />查询</TabsTrigger>
        </TabsList>

        <TabsContent value="list">
          <div className="space-y-3">
            <ActionButton onClick={fetchTenants} loading={loading} variant="outline"><RefreshCw className="h-3 w-3 mr-1" />刷新</ActionButton>
            <div className="max-h-72 overflow-auto rounded border">
              <Table>
                <TableHeader><TableRow><TableHead>名称</TableHead><TableHead>编码</TableHead><TableHead>类型</TableHead><TableHead>状态</TableHead><TableHead>操作</TableHead></TableRow></TableHeader>
                <TableBody>
                  {tenants.map((t) => (
                    <TableRow key={t.id}>
                      <TableCell className="font-medium">{t.tenantName}</TableCell>
                      <TableCell className="font-mono text-xs">{t.tenantCode}</TableCell>
                      <TableCell><Badge variant="outline">{t.scope || 'tenant'}</Badge></TableCell>
                      <TableCell><Badge variant={t.status ? 'default' : 'destructive'}>{t.status ? '启用' : '禁用'}</Badge></TableCell>
                      <TableCell>
                        <div className="flex gap-0.5">
                          <ActionButton variant="ghost" size="icon-sm" onClick={() => setShowDetail(t)} title="详情"><Eye className="h-3 w-3" /></ActionButton>
                          <ActionButton variant="ghost" size="icon-sm" onClick={() => openEdit(t)} title="编辑"><Edit className="h-3 w-3" /></ActionButton>
                          <ActionButton variant="ghost" size="icon-sm" onClick={async () => { await deleteTenant(t.id); fetchTenants() }} title="删除"><Trash2 className="h-3 w-3" /></ActionButton>
                          {!t.status && <ActionButton variant="ghost" size="icon-sm" onClick={async () => { await restoreTenant(t.id); fetchTenants() }} title="恢复"><RotateCcw className="h-3 w-3" /></ActionButton>}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="create">
          <div className="space-y-3">
            <FormField label="租户名称 *" id="tc-name" value={cName} onChange={setCName} required />
            <FormField label="租户编码 *" id="tc-code" value={cCode} onChange={setCCode} required />
            <div className="grid gap-1.5">
              <Label>租户类型</Label>
              <Select value={cScope} onValueChange={(v) => setCScope(v || 'tenant')}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="tenant">tenant</SelectItem>
                  <SelectItem value="system">system</SelectItem>
                  <SelectItem value="experience">experience</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <ActionButton onClick={handleCreate} loading={loading} className="w-full">创建租户</ActionButton>
          </div>
        </TabsContent>

        <TabsContent value="lookup">
          <div className="space-y-3">
            <div className="flex gap-2 items-end">
              <FormField label="租户 ID" id="tl-id" value={fetchId} onChange={setFetchId} placeholder="UUID" />
              <ActionButton onClick={handleFetchOne} loading={loading}>查询</ActionButton>
            </div>
            {fetchResult && <pre className="bg-muted rounded p-2 text-xs overflow-auto max-h-64 font-mono">{fetchResult}</pre>}
          </div>
        </TabsContent>
      </Tabs>

      {/* Create Dialog (deprecated by tab, kept for convenience) */}
      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent>
          <DialogHeader><DialogTitle>创建租户</DialogTitle><DialogDescription>创建一个新的租户</DialogDescription></DialogHeader>
          <div className="space-y-3">
            <FormField label="租户名称 *" id="c-tname" value={cName} onChange={setCName} required />
            <FormField label="租户编码 *" id="c-tcode" value={cCode} onChange={setCCode} required />
          </div>
          <DialogFooter><ActionButton onClick={handleCreate} loading={loading}>创建</ActionButton></DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog open={!!showEdit} onOpenChange={(v) => { if (!v) setShowEdit(null) }}>
        <DialogContent>
          <DialogHeader><DialogTitle>编辑租户 — {showEdit?.tenantName}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <FormField label="租户名称" id="e-tname" value={eName} onChange={setEName} />
            <FormField label="状态 (true/false)" id="e-tstatus" value={eStatus} onChange={setEStatus} />
          </div>
          <DialogFooter><ActionButton onClick={handleUpdate} loading={loading}>保存</ActionButton></DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Detail Dialog */}
      <Dialog open={!!showDetail} onOpenChange={(v) => { if (!v) setShowDetail(null) }}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>租户详情 — {showDetail?.tenantName}</DialogTitle></DialogHeader>
          <pre className="bg-muted rounded p-3 text-xs overflow-auto max-h-96 font-mono">{JSON.stringify(showDetail, null, 2)}</pre>
        </DialogContent>
      </Dialog>
    </SectionWrapper>
  )
}
