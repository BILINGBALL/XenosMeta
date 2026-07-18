'use client'

import { useState, useEffect } from 'react'
import { useRoleStore } from '@/stores/role-store'
import { usePermissionStore } from '@/stores/permission-store'
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Label } from '@/components/ui/label'
import { RefreshCw, Plus, Eye, Edit, Trash2, RotateCcw, Shield, Search } from 'lucide-react'
import type { Role } from '@/types'

export function RolePanel() {
  const isLoggedIn = useAuthStore((s) => s.isLoggedIn)
  const roleStore = useRoleStore()
  const permStore = usePermissionStore()
  const { roles, loading } = roleStore

  // Create
  const [showCreate, setShowCreate] = useState(false)
  const [cName, setCName] = useState('')
  const [cCode, setCCode] = useState('')
  const [cScope, setCScope] = useState('tenant')
  const [cDesc, setCDesc] = useState('')

  // Edit
  const [showEdit, setShowEdit] = useState<Role | null>(null)
  const [eName, setEName] = useState('')
  const [eDesc, setEDesc] = useState('')
  const [eScope, setEScope] = useState('tenant')
  const [eStatus, setEStatus] = useState('true')

  // Detail
  const [showDetail, setShowDetail] = useState<Role | null>(null)

  // Assign permissions
  const [showAssign, setShowAssign] = useState<Role | null>(null)
  const [selectedPermIds, setSelectedPermIds] = useState<Set<string>>(new Set())

  // Lookup
  const [lookupId, setLookupId] = useState('')
  const [lookupResult, setLookupResult] = useState<string | null>(null)

  useEffect(() => {
    if (isLoggedIn) { roleStore.fetchRoles(); permStore.fetchPermissions() }
  }, [isLoggedIn])

  const handleCreate = async () => {
    const ok = await roleStore.createRole({ roleName: cName, roleCode: cCode, scope: cScope, description: cDesc || undefined })
    if (ok) { setShowCreate(false); setCName(''); setCCode(''); setCScope('tenant'); setCDesc(''); roleStore.fetchRoles() }
  }

  const handleUpdate = async () => {
    if (!showEdit) return
    const ok = await roleStore.updateRole(showEdit.id, {
      roleName: eName || undefined,
      description: eDesc || undefined,
      scope: eScope !== showEdit.scope ? eScope : undefined,
      status: eStatus === 'true' ? true : false,
    })
    if (ok) { setShowEdit(null); roleStore.fetchRoles() }
  }

  const handleAssign = async () => {
    if (!showAssign) return
    const ok = await roleStore.assignPermissions(showAssign.id, { permissionIds: Array.from(selectedPermIds) })
    if (ok) { setShowAssign(null); roleStore.fetchRoles() }
  }

  const openAssign = (r: Role) => {
    setShowAssign(r)
    // permissions 是 RolePermission[] 结构: { id, permission: { id, permCode, ... } }
    setSelectedPermIds(new Set(r.permissions?.map((p: any) => p.permission?.id || p.permissionId).filter(Boolean) || []))
  }

  const togglePerm = (id: string) => {
    setSelectedPermIds((prev) => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  const handleLookup = async () => {
    if (!lookupId) return
    await roleStore.fetchRole(lookupId)
    const r = useRoleStore.getState().currentRole
    setLookupResult(r ? JSON.stringify(r, null, 2) : 'Not found')
  }

  if (!isLoggedIn) return null

  return (
    <SectionWrapper title="角色管理" description={`${roles.length} 个角色 · ${permStore.permissions.length} 个可用权限`} badge="sys:role">
      <ToastListener store={useRoleStore} />
      <Tabs defaultValue="list">
        <TabsList className="mb-4 w-full">
          <TabsTrigger value="list" className="flex-1">📋 列表</TabsTrigger>
          <TabsTrigger value="create" className="flex-1"><Plus className="h-3 w-3 mr-1" />创建</TabsTrigger>
          <TabsTrigger value="lookup" className="flex-1"><Search className="h-3 w-3 mr-1" />查找</TabsTrigger>
        </TabsList>

        <TabsContent value="list">
          <div className="space-y-3">
            <ActionButton onClick={() => { roleStore.fetchRoles(); permStore.fetchPermissions() }} loading={loading} variant="outline"><RefreshCw className="h-3 w-3 mr-1" />刷新</ActionButton>
            <div className="max-h-72 overflow-auto rounded border">
              <Table>
                <TableHeader><TableRow><TableHead>名称</TableHead><TableHead>编码</TableHead><TableHead>级别</TableHead><TableHead>描述</TableHead><TableHead>权限</TableHead><TableHead>状态</TableHead><TableHead>操作</TableHead></TableRow></TableHeader>
                <TableBody>
                  {roles.map((r) => (
                    <TableRow key={r.id}>
                      <TableCell className="font-medium">{r.roleName}</TableCell>
                      <TableCell className="font-mono text-xs">{r.roleCode}</TableCell>
                      <TableCell><Badge variant="outline">{r.scope || 'tenant'}</Badge></TableCell>
                      <TableCell className="text-xs max-w-40 truncate">{r.description || '-'}</TableCell>
                      <TableCell><Badge variant="secondary">{r.permissions?.length || 0}</Badge></TableCell>
                      <TableCell><Badge variant={r.status ? 'default' : 'destructive'}>{r.status ? '启用' : '禁用'}</Badge></TableCell>
                      <TableCell>
                        <div className="flex gap-0.5">
                          <ActionButton variant="ghost" size="icon-sm" onClick={() => setShowDetail(r)} title="详情"><Eye className="h-3 w-3" /></ActionButton>
                          <ActionButton variant="ghost" size="icon-sm" onClick={() => { setShowEdit(r); setEName(r.roleName); setEDesc(r.description || ''); setEScope(r.scope || 'tenant'); setEStatus(r.status ? 'true' : 'false') }} title="编辑"><Edit className="h-3 w-3" /></ActionButton>
                          <ActionButton variant="ghost" size="icon-sm" onClick={() => openAssign(r)} title="分配权限"><Shield className="h-3 w-3" /></ActionButton>
                          <ActionButton variant="ghost" size="icon-sm" onClick={async () => { await roleStore.deleteRole(r.id); roleStore.fetchRoles() }} title="删除"><Trash2 className="h-3 w-3" /></ActionButton>
                          {!r.status && <ActionButton variant="ghost" size="icon-sm" onClick={async () => { await roleStore.restoreRole(r.id); roleStore.fetchRoles() }} title="恢复"><RotateCcw className="h-3 w-3" /></ActionButton>}
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
            <FormField label="角色名称 *" id="rc-name" value={cName} onChange={setCName} required />
            <FormField label="角色编码 *" id="rc-code" value={cCode} onChange={setCCode} required placeholder="e.g. custom_role" />
            <FormField label="描述" id="rc-desc" value={cDesc} onChange={setCDesc} placeholder="角色用途说明" />
            <div className="grid gap-1.5">
              <Label htmlFor="rc-scope">角色级别</Label>
              <Select value={cScope} onValueChange={(v) => setCScope(v || 'tenant')}>
                <SelectTrigger id="rc-scope" className="w-full"><SelectValue /></SelectTrigger>
                <SelectContent className="w-[--radix-select-trigger-width] min-w-64">
                  <SelectItem value="tenant">tenant — 租户内自定义角色</SelectItem>
                  <SelectItem value="shared">shared — 跨租户共享预设角色</SelectItem>
                  <SelectItem value="system">system — 系统级（需管理员权限）</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <ActionButton onClick={handleCreate} loading={loading} className="w-full">创建角色</ActionButton>
          </div>
        </TabsContent>

        <TabsContent value="lookup">
          <div className="space-y-3">
            <div className="flex gap-2 items-end">
              <FormField label="角色 ID" id="rl-id" value={lookupId} onChange={setLookupId} placeholder="UUID" />
              <ActionButton onClick={handleLookup} loading={loading}>查询</ActionButton>
            </div>
            {lookupResult && <pre className="bg-muted rounded p-2 text-xs overflow-auto max-h-64 font-mono">{lookupResult}</pre>}
          </div>
        </TabsContent>
      </Tabs>

      {/* Detail */}
      <Dialog open={!!showDetail} onOpenChange={(v) => { if (!v) setShowDetail(null) }}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>角色详情 — {showDetail?.roleName}</DialogTitle></DialogHeader>
          <pre className="bg-muted rounded p-3 text-xs overflow-auto max-h-96 font-mono">{JSON.stringify(showDetail, null, 2)}</pre>
        </DialogContent>
      </Dialog>

      {/* Edit */}
      <Dialog open={!!showEdit} onOpenChange={(v) => { if (!v) setShowEdit(null) }}>
        <DialogContent>
          <DialogHeader><DialogTitle>编辑角色 — {showEdit?.roleName}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <FormField label="角色名称" id="er-name" value={eName} onChange={setEName} />
            <FormField label="描述" id="er-desc" value={eDesc} onChange={setEDesc} />
            <div className="grid gap-1.5">
              <Label htmlFor="er-scope">角色级别</Label>
              <Select value={eScope} onValueChange={(v) => setEScope(v || 'tenant')}>
                <SelectTrigger id="er-scope" className="w-full"><SelectValue /></SelectTrigger>
                <SelectContent className="w-[--radix-select-trigger-width] min-w-64">
                  <SelectItem value="tenant">tenant — 租户内自定义角色</SelectItem>
                  <SelectItem value="shared">shared — 跨租户共享预设角色</SelectItem>
                  <SelectItem value="system">system — 系统级（需管理员权限）</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <FormField label="状态 (true/false)" id="er-status" value={eStatus} onChange={setEStatus} />
          </div>
          <DialogFooter><ActionButton onClick={handleUpdate} loading={loading}>保存</ActionButton></DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Assign Permissions */}
      <Dialog open={!!showAssign} onOpenChange={(v) => { if (!v) setShowAssign(null) }}>
        <DialogContent className="max-w-xl">
          <DialogHeader><DialogTitle>分配权限 — {showAssign?.roleName}</DialogTitle><DialogDescription>勾选后点保存 ({selectedPermIds.size} 已选)</DialogDescription></DialogHeader>
          <div className="max-h-80 overflow-auto space-y-0.5 border rounded p-2">
            {permStore.permissions.map((p) => (
              <label key={p.id} className="flex items-center gap-2 text-sm cursor-pointer hover:bg-muted rounded px-1 py-0.5">
                <input type="checkbox" checked={selectedPermIds.has(p.id)} onChange={() => togglePerm(p.id)} className="h-4 w-4 shrink-0" />
                <span className="font-mono text-xs shrink-0 w-44 truncate">{p.permCode}</span>
                <span className="text-muted-foreground text-xs">{p.permName}</span>
              </label>
            ))}
          </div>
          <DialogFooter>
            <ActionButton variant="outline" size="sm" onClick={() => setSelectedPermIds(new Set(permStore.permissions.map(p => p.id)))}>全选</ActionButton>
            <ActionButton variant="outline" size="sm" onClick={() => setSelectedPermIds(new Set())}>清空</ActionButton>
            <ActionButton onClick={handleAssign} loading={loading}>保存分配</ActionButton>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </SectionWrapper>
  )
}
