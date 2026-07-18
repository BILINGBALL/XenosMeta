'use client'

import { useState, useEffect } from 'react'
import { usePermissionStore } from '@/stores/permission-store'
import { useAuthStore } from '@/stores/auth-store'
import { SectionWrapper } from '@/components/shared/section-wrapper'
import { ActionButton } from '@/components/shared/action-button'
import { FormField } from '@/components/shared/form-field'
import { ToastListener } from '@/components/shared/toast-listener'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { DialogFooter } from '@/components/ui/dialog'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { RefreshCw, Plus, Eye, Edit, Trash2, Search } from 'lucide-react'
import type { Permission } from '@/types'

export function PermissionPanel() {
  const isLoggedIn = useAuthStore((s) => s.isLoggedIn)
  const store = usePermissionStore()
  const { permissions, loading } = store

  // Create
  const [showCreate, setShowCreate] = useState(false)
  const [cName, setCName] = useState('')
  const [cCode, setCCode] = useState('')
  const [cType, setCType] = useState('2')
  const [cParentId, setCParentId] = useState('')
  const [cSort, setCSort] = useState('0')

  // Edit
  const [showEdit, setShowEdit] = useState<Permission | null>(null)
  const [eName, setEName] = useState('')
  const [eCode, setECode] = useState('')
  const [eType, setEType] = useState('2')
  const [eSort, setESort] = useState('0')

  // Detail
  const [showDetail, setShowDetail] = useState<Permission | null>(null)

  // Lookup
  const [lookupId, setLookupId] = useState('')
  const [lookupResult, setLookupResult] = useState<string | null>(null)

  useEffect(() => { if (isLoggedIn) store.fetchPermissions() }, [isLoggedIn])

  const handleCreate = async () => {
    const ok = await store.createPermission({
      permName: cName, permCode: cCode,
      type: Number(cType) || 2,
      parentId: cParentId || null,
      sort: Number(cSort) || 0,
    })
    if (ok) { setShowCreate(false); setCName(''); setCCode(''); setCType('2'); setCParentId(''); setCSort('0'); store.fetchPermissions() }
  }

  const handleUpdate = async () => {
    if (!showEdit) return
    const ok = await store.updatePermission(showEdit.id, {
      permName: eName || undefined, permCode: eCode || undefined,
      type: Number(eType) || undefined,
      sort: Number(eSort) || undefined,
    })
    if (ok) { setShowEdit(null); store.fetchPermissions() }
  }

  const openEdit = (p: Permission) => {
    setShowEdit(p)
    setEName(p.permName)
    setECode(p.permCode)
    setEType(String(p.type))
    setESort(String(p.sort))
  }

  const handleLookup = async () => {
    if (!lookupId) return
    await store.fetchPermission(lookupId)
    const p = usePermissionStore.getState().currentPermission
    setLookupResult(p ? JSON.stringify(p, null, 2) : 'Not found')
  }

  if (!isLoggedIn) return null

  const typeLabel = (t: number) => t === 1 ? '菜单' : t === 2 ? '按钮' : String(t)

  return (
    <SectionWrapper title="权限管理" description={`${permissions.length} 个权限`} badge="sys:permission">
      <ToastListener store={usePermissionStore} />
      <Tabs defaultValue="list">
        <TabsList className="mb-4 w-full">
          <TabsTrigger value="list" className="flex-1">📋 列表</TabsTrigger>
          <TabsTrigger value="create" className="flex-1"><Plus className="h-3 w-3 mr-1" />创建</TabsTrigger>
          <TabsTrigger value="lookup" className="flex-1"><Search className="h-3 w-3 mr-1" />查找</TabsTrigger>
        </TabsList>

        <TabsContent value="list">
          <div className="space-y-3">
            <ActionButton onClick={() => store.fetchPermissions()} loading={loading} variant="outline"><RefreshCw className="h-3 w-3 mr-1" />刷新</ActionButton>
            <div className="max-h-72 overflow-auto rounded border">
              <Table>
                <TableHeader><TableRow><TableHead>名称</TableHead><TableHead>编码</TableHead><TableHead>类型</TableHead><TableHead>排序</TableHead><TableHead>父级</TableHead><TableHead>操作</TableHead></TableRow></TableHeader>
                <TableBody>
                  {permissions.map((p) => (
                    <TableRow key={p.id}>
                      <TableCell className="font-medium">{p.permName}</TableCell>
                      <TableCell className="font-mono text-xs">{p.permCode}</TableCell>
                      <TableCell><Badge variant="outline">{typeLabel(p.type)}</Badge></TableCell>
                      <TableCell>{p.sort}</TableCell>
                      <TableCell className="font-mono text-xs max-w-20 truncate">{p.parentId || '-'}</TableCell>
                      <TableCell>
                        <div className="flex gap-0.5">
                          <ActionButton variant="ghost" size="icon-sm" onClick={() => setShowDetail(p)} title="详情"><Eye className="h-3 w-3" /></ActionButton>
                          <ActionButton variant="ghost" size="icon-sm" onClick={() => openEdit(p)} title="编辑"><Edit className="h-3 w-3" /></ActionButton>
                          <ActionButton variant="ghost" size="icon-sm" onClick={async () => { await store.deletePermission(p.id); store.fetchPermissions() }} title="删除"><Trash2 className="h-3 w-3" /></ActionButton>
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
            <FormField label="权限名称 *" id="pc-name" value={cName} onChange={setCName} required />
            <FormField label="权限编码 *" id="pc-code" value={cCode} onChange={setCCode} required placeholder="module:resource:action" />
            <div className="grid grid-cols-2 gap-2">
              <div className="grid gap-1.5">
                <Label>类型</Label>
                <Select value={cType} onValueChange={(v) => setCType(v || '2')}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="1">1 - 菜单</SelectItem>
                    <SelectItem value="2">2 - 按钮</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <FormField label="排序" id="pc-sort" value={cSort} onChange={setCSort} type="number" />
            </div>
            <FormField label="父权限 ID (可选)" id="pc-pid" value={cParentId} onChange={setCParentId} />
            <ActionButton onClick={handleCreate} loading={loading} className="w-full">创建权限</ActionButton>
          </div>
        </TabsContent>

        <TabsContent value="lookup">
          <div className="space-y-3">
            <div className="flex gap-2 items-end">
              <FormField label="权限 ID" id="pl-id" value={lookupId} onChange={setLookupId} placeholder="UUID" />
              <ActionButton onClick={handleLookup} loading={loading}>查询</ActionButton>
            </div>
            {lookupResult && <pre className="bg-muted rounded p-2 text-xs overflow-auto max-h-64 font-mono">{lookupResult}</pre>}
          </div>
        </TabsContent>
      </Tabs>

      {/* Detail */}
      <Dialog open={!!showDetail} onOpenChange={(v) => { if (!v) setShowDetail(null) }}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>权限详情 — {showDetail?.permName}</DialogTitle></DialogHeader>
          <pre className="bg-muted rounded p-3 text-xs overflow-auto max-h-96 font-mono">{JSON.stringify(showDetail, null, 2)}</pre>
        </DialogContent>
      </Dialog>

      {/* Edit */}
      <Dialog open={!!showEdit} onOpenChange={(v) => { if (!v) setShowEdit(null) }}>
        <DialogContent>
          <DialogHeader><DialogTitle>编辑权限 — {showEdit?.permName}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <FormField label="权限名称" id="ep-name" value={eName} onChange={setEName} />
            <FormField label="权限编码" id="ep-code" value={eCode} onChange={setECode} />
            <div className="grid grid-cols-2 gap-2">
              <div className="grid gap-1.5">
                <Label>类型</Label>
                <Select value={eType} onValueChange={(v) => setEType(v || '2')}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="1">1 - 菜单</SelectItem>
                    <SelectItem value="2">2 - 按钮</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <FormField label="排序" id="ep-sort" value={eSort} onChange={setESort} type="number" />
            </div>
          </div>
          <DialogFooter><ActionButton onClick={handleUpdate} loading={loading}>保存</ActionButton></DialogFooter>
        </DialogContent>
      </Dialog>
    </SectionWrapper>
  )
}
