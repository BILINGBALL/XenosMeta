'use client'

import { useState, useEffect } from 'react'
import { useUserStore } from '@/stores/user-store'
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
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Separator } from '@/components/ui/separator'
import { apiClient } from '@/lib/api-client'
import { RefreshCw, Eye, Edit, Trash2, RotateCcw, UserPlus, Users, UserCog, Shield } from 'lucide-react'
import { useRoleStore } from '@/stores/role-store'
import type { User, Role } from '@/types'

export function UserPanel() {
  const isLoggedIn = useAuthStore((s) => s.isLoggedIn)
  const store = useUserStore()
  const { users, loading, fetchUsers, updateUser, deleteUser, restoreUser, assignGroup } = store

  // Detail
  const [showDetail, setShowDetail] = useState<User | null>(null)

  // Edit
  const [showEdit, setShowEdit] = useState<User | null>(null)
  const [editNickname, setEditNickname] = useState('')
  const [editEmail, setEditEmail] = useState('')
  const [editPhone, setEditPhone] = useState('')
  const [editAvatar, setEditAvatar] = useState('')
  const [editTenantId, setEditTenantId] = useState('')
  const [editProfile, setEditProfile] = useState('{}')
  const [editStatus, setEditStatus] = useState('true')

  // Create user (register)
  const [showCreate, setShowCreate] = useState(false)
  const [cUsername, setCUsername] = useState('')
  const [cPassword, setCPassword] = useState('')
  const [cNickname, setCNickname] = useState('')
  const [cEmail, setCEmail] = useState('')
  const [cPhone, setCPhone] = useState('')
  const [cAvatar, setCAvatar] = useState('')
  const [cTenantId, setCTenantId] = useState('')
  const [cProfile, setCProfile] = useState('{}')
  const [createLoading, setCreateLoading] = useState(false)

  // Assign group
  const [showAssign, setShowAssign] = useState<User | null>(null)
  const [assignGroupId, setAssignGroupId] = useState('')

  // Assign role
  const roleStore = useRoleStore()
  const [showAssignRole, setShowAssignRole] = useState<User | null>(null)
  const [assignRoleId, setAssignRoleId] = useState('')

  // Get user permissions
  const [permLoading, setPermLoading] = useState(false)
  const [permResult, setPermResult] = useState<string | null>(null)

  useEffect(() => { if (isLoggedIn) fetchUsers() }, [isLoggedIn, fetchUsers])

  const handleCreate = async () => {
    setCreateLoading(true)
    try {
      let profile: Record<string, unknown> | undefined
      try { profile = JSON.parse(cProfile) } catch { profile = undefined }
      await apiClient.post('/user/register', {
        username: cUsername,
        password: cPassword,
        nickname: cNickname || undefined,
        email: cEmail || undefined,
        phone: cPhone || undefined,
        avatar: cAvatar || undefined,
        tenantId: cTenantId || undefined,
        profile: profile || undefined,
      })
      setShowCreate(false)
      fetchUsers()
    } catch (e) {
      alert((e as Error).message)
    } finally {
      setCreateLoading(false)
    }
  }

  const handleUpdate = async () => {
    if (!showEdit) return
    let profile: Record<string, unknown> | undefined
    try { profile = JSON.parse(editProfile) } catch { profile = undefined }
    const ok = await updateUser(showEdit.id, {
      nickname: editNickname || undefined,
      email: editEmail || undefined,
      phone: editPhone || undefined,
      avatar: editAvatar || undefined,
      tenantId: editTenantId || undefined,
      profile: profile || undefined,
      status: editStatus === 'true',
    })
    if (ok) { setShowEdit(null); fetchUsers() }
  }

  const openEdit = (u: User) => {
    setShowEdit(u)
    setEditNickname(u.nickname || '')
    setEditEmail(u.email || '')
    setEditPhone(u.phone || '')
    setEditAvatar(u.avatar || '')
    setEditTenantId(u.tenantId || '')
    setEditProfile(u.profile ? JSON.stringify(u.profile, null, 2) : '{}')
    setEditStatus(u.status ? 'true' : 'false')
  }

  const handleAssign = async () => {
    if (!showAssign || !assignGroupId) return
    const ok = await assignGroup({ groupId: assignGroupId })
    if (ok) { setShowAssign(null); fetchUsers() }
  }

  const handleAssignRole = async () => {
    if (!showAssignRole || !assignRoleId) return
    try {
      await apiClient.post('/user/assign-role', { roleId: assignRoleId, userId: showAssignRole.id })
      setShowAssignRole(null)
      fetchUsers()
    } catch (e) { alert((e as Error).message) }
  }

  const handleRemoveRole = async (userId: string, roleId: string) => {
    try {
      await apiClient.post('/user/remove-role', { roleId, userId })
      fetchUsers()
    } catch (e) { alert((e as Error).message) }
  }

  const handleGetPermissions = async () => {
    setPermLoading(true)
    try {
      const res = await apiClient.get('/user/permissions')
      setPermResult(JSON.stringify(res, null, 2))
    } catch (e) {
      setPermResult(`Error: ${(e as Error).message}`)
    } finally {
      setPermLoading(false)
    }
  }

  const handleDelete = async (id: string) => {
    await deleteUser(id)
    fetchUsers()
  }

  const handleRestore = async (id: string) => {
    await restoreUser(id)
    fetchUsers()
  }

  if (!isLoggedIn) return null

  return (
    <SectionWrapper title="用户管理" description={`${users.length} 个用户`} badge="sys:user">
      <ToastListener store={useUserStore} />
      <Tabs defaultValue="list">
        <TabsList className="mb-4 w-full">
          <TabsTrigger value="list" className="flex-1"><Users className="h-3 w-3 mr-1" />用户列表</TabsTrigger>
          <TabsTrigger value="create" className="flex-1"><UserPlus className="h-3 w-3 mr-1" />创建用户</TabsTrigger>
          <TabsTrigger value="tools" className="flex-1"><UserCog className="h-3 w-3 mr-1" />工具</TabsTrigger>
        </TabsList>

        {/* LIST */}
        <TabsContent value="list">
          <div className="space-y-3">
            <div className="flex gap-2">
              <ActionButton onClick={fetchUsers} loading={loading} variant="outline"><RefreshCw className="h-3 w-3 mr-1" />刷新</ActionButton>
            </div>
            <div className="max-h-72 overflow-auto rounded border">
              <Table>
                <TableHeader><TableRow><TableHead>用户名</TableHead><TableHead>昵称</TableHead><TableHead>角色</TableHead><TableHead>租户</TableHead><TableHead>状态</TableHead><TableHead>操作</TableHead></TableRow></TableHeader>
                <TableBody>
                  {users.map((u) => (
                    <TableRow key={u.id}>
                      <TableCell className="font-medium">{u.username}</TableCell>
                      <TableCell>{u.nickname || '-'}</TableCell>
                      <TableCell className="text-xs">
                        <div className="flex flex-wrap gap-0.5">
                          {(u.roles || []).map((r: Role) => (
                            <span key={r.id} className="inline-flex items-center gap-0.5 bg-muted rounded px-1 py-0.5 text-[10px] font-mono group/role">
                              {r.roleName}
                              <button className="text-red-400 hover:text-red-600" onClick={() => handleRemoveRole(u.id, r.id)} title="移除角色">×</button>
                            </span>
                          ))}
                        </div>
                      </TableCell>
                      <TableCell className="text-xs">{u.tenant?.tenantName || '-'}</TableCell>
                      <TableCell><Badge variant={u.status ? 'default' : 'destructive'}>{u.status ? '启用' : '禁用'}</Badge></TableCell>
                      <TableCell>
                        <div className="flex gap-0.5">
                          <ActionButton variant="ghost" size="icon-sm" onClick={() => setShowDetail(u)} title="详情"><Eye className="h-3 w-3" /></ActionButton>
                          <ActionButton variant="ghost" size="icon-sm" onClick={() => openEdit(u)} title="编辑"><Edit className="h-3 w-3" /></ActionButton>
                          <ActionButton variant="ghost" size="icon-sm" onClick={() => handleDelete(u.id)} title="删除"><Trash2 className="h-3 w-3" /></ActionButton>
                          {!u.status && <ActionButton variant="ghost" size="icon-sm" onClick={() => handleRestore(u.id)} title="恢复"><RotateCcw className="h-3 w-3" /></ActionButton>}
                          <ActionButton variant="ghost" size="icon-sm" onClick={() => { setShowAssign(u); setAssignGroupId('') }} title="分配群组">👥</ActionButton>
                          <ActionButton variant="ghost" size="icon-sm" onClick={() => { setShowAssignRole(u); setAssignRoleId(''); roleStore.fetchRoles() }} title="分配角色"><Shield className="h-3 w-3" /></ActionButton>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </div>
        </TabsContent>

        {/* CREATE */}
        <TabsContent value="create">
          <div className="space-y-3 max-h-96 overflow-auto">
            <div className="grid grid-cols-2 gap-2">
              <FormField label="用户名 *" id="cu-user" value={cUsername} onChange={setCUsername} required />
              <FormField label="密码 *" id="cu-pass" value={cPassword} onChange={setCPassword} type="password" required />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <FormField label="昵称" id="cu-nick" value={cNickname} onChange={setCNickname} />
              <FormField label="邮箱" id="cu-email" value={cEmail} onChange={setCEmail} />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <FormField label="手机号" id="cu-phone" value={cPhone} onChange={setCPhone} />
              <FormField label="头像 URL" id="cu-avatar" value={cAvatar} onChange={setCAvatar} />
            </div>
            <FormField label="租户 ID" id="cu-tid" value={cTenantId} onChange={setCTenantId} />
            <div className="grid gap-1.5">
              <Label>Profile (JSON)</Label>
              <Textarea id="cu-profile" value={cProfile} onChange={(e) => setCProfile(e.target.value)} rows={3} className="font-mono text-xs" />
            </div>
            <ActionButton onClick={handleCreate} loading={createLoading} className="w-full">创建用户</ActionButton>
          </div>
        </TabsContent>

        {/* TOOLS */}
        <TabsContent value="tools">
          <div className="space-y-3">
            <div>
              <Label className="text-sm font-medium mb-2 block">查询当前用户权限</Label>
              <ActionButton onClick={handleGetPermissions} loading={permLoading} variant="outline">获取我的权限</ActionButton>
              {permResult && <pre className="mt-2 bg-muted rounded p-2 text-xs overflow-auto max-h-64 font-mono">{permResult}</pre>}
            </div>
            <Separator />
            <div>
              <Label className="text-sm font-medium mb-2 block">给列表第一个用户分配群组</Label>
              <div className="flex gap-2 items-end">
                <FormField label="群组 ID" id="assign-gid" value={assignGroupId} onChange={setAssignGroupId} placeholder="输入群组 UUID" />
                <ActionButton onClick={async () => {
                  const uid = users[0]?.id
                  if (!uid || !assignGroupId) { alert('请确保有用户列表且有群组ID'); return }
                  await assignGroup({ groupId: assignGroupId })
                  fetchUsers()
                }}>分配</ActionButton>
              </div>
            </div>
          </div>
        </TabsContent>
      </Tabs>

      {/* Detail Dialog */}
      <Dialog open={!!showDetail} onOpenChange={(v) => { if (!v) setShowDetail(null) }}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>用户详情 — {showDetail?.username}</DialogTitle></DialogHeader>
          <pre className="bg-muted rounded p-3 text-xs overflow-auto max-h-96 font-mono">{JSON.stringify(showDetail, null, 2)}</pre>
        </DialogContent>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog open={!!showEdit} onOpenChange={(v) => { if (!v) setShowEdit(null) }}>
        <DialogContent>
          <DialogHeader><DialogTitle>编辑用户 — {showEdit?.username}</DialogTitle></DialogHeader>
          <div className="space-y-3 max-h-96 overflow-auto">
            <FormField label="昵称" id="eu-nick" value={editNickname} onChange={setEditNickname} />
            <FormField label="邮箱" id="eu-email" value={editEmail} onChange={setEditEmail} />
            <FormField label="手机号" id="eu-phone" value={editPhone} onChange={setEditPhone} />
            <FormField label="头像 URL" id="eu-avatar" value={editAvatar} onChange={setEditAvatar} />
            <FormField label="租户 ID" id="eu-tid" value={editTenantId} onChange={setEditTenantId} placeholder="修改用户所属租户" />
            <div className="grid gap-1.5">
              <Label>Profile (JSON)</Label>
              <Textarea id="eu-profile" value={editProfile} onChange={(e) => setEditProfile(e.target.value)} rows={4} className="font-mono text-xs" />
            </div>
            <FormField label="状态 (true/false)" id="eu-status" value={editStatus} onChange={setEditStatus} />
          </div>
          <DialogFooter><ActionButton onClick={handleUpdate} loading={loading}>保存</ActionButton></DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Assign Group Dialog */}
      <Dialog open={!!showAssign} onOpenChange={(v) => { if (!v) setShowAssign(null) }}>
        <DialogContent>
          <DialogHeader><DialogTitle>分配群组 — {showAssign?.username}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <FormField label="群组 ID" id="ag-id" value={assignGroupId} onChange={setAssignGroupId} required />
          </div>
          <DialogFooter><ActionButton onClick={handleAssign} loading={loading}>分配</ActionButton></DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Assign Role Dialog */}
      <Dialog open={!!showAssignRole} onOpenChange={(v) => { if (!v) setShowAssignRole(null) }}>
        <DialogContent>
          <DialogHeader><DialogTitle>分配角色 — {showAssignRole?.username}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <Label>已分配角色</Label>
            <div className="flex flex-wrap gap-1">
              {(showAssignRole?.roles || []).map((r: Role) => (
                <span key={r.id} className="inline-flex items-center gap-0.5 bg-muted rounded px-1.5 py-0.5 text-xs">
                  {r.roleName} ({r.roleCode})
                  <button className="text-red-500 hover:text-red-700 ml-0.5" onClick={() => { handleRemoveRole(showAssignRole!.id, r.id) }}>×</button>
                </span>
              ))}
              {(!showAssignRole?.roles || showAssignRole.roles.length === 0) && (
                <span className="text-xs text-muted-foreground">暂无角色</span>
              )}
            </div>
            <Label>添加角色</Label>
            <div className="flex gap-2 items-end">
              <Select value={assignRoleId} onValueChange={(v) => setAssignRoleId(v || '')}>
                <SelectTrigger className="flex-1">
                  <SelectValue placeholder="选择角色…" />
                </SelectTrigger>
                <SelectContent>
                  {roleStore.roles.map((r) => (
                    <SelectItem key={r.id} value={r.id}>{r.roleName} ({r.roleCode})</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter><ActionButton onClick={handleAssignRole} loading={loading} disabled={!assignRoleId}>分配</ActionButton></DialogFooter>
        </DialogContent>
      </Dialog>
    </SectionWrapper>
  )
}
