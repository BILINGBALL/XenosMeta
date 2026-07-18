'use client'

import { useState, useEffect, useCallback } from 'react'
import { useGroupStore } from '@/stores/group-store'
import { useAuthStore } from '@/stores/auth-store'
import { useTenantStore } from '@/stores/tenant-store'
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
import { Textarea } from '@/components/ui/textarea'
import { RefreshCw, Eye, Edit, Trash2, RotateCcw, FolderTree, Search, UserPlus, Users, ChevronRight, ChevronDown, Plus } from 'lucide-react'
import { toast } from 'sonner'
import { apiClient } from '@/lib/api-client'
import type { Group, GroupMember } from '@/types'

// Renders a single descendant row with its children recursively
function RenderedDescendant({ node, expandedIds, onToggle }: {
  node: Group
  expandedIds: Set<string>
  onToggle: (id: string) => void
}) {
  const isExp = expandedIds.has(node.id)
  const hasKids = (node.children || []).length > 0
  return (
    <div>
      <div className="flex items-center justify-between rounded border p-1.5 text-xs">
        <div className="flex items-center gap-1 flex-1 min-w-0">
          <button
            className={`size-4 flex items-center justify-center rounded shrink-0 ${hasKids ? 'text-muted-foreground hover:text-foreground' : 'text-muted-foreground/30 cursor-default'}`}
            onClick={() => hasKids && onToggle(node.id)}
            disabled={!hasKids}
          >
            {isExp ? <span className="text-xs leading-none">−</span> : <span className="text-xs leading-none font-bold">+</span>}
          </button>
          <span className="truncate">{node.groupName}</span>
          <span className="text-[10px] text-muted-foreground">{node.groupCode}</span>
          {node.public && <Badge variant="default" className="text-[10px] h-3.5 px-1">公开</Badge>}
        </div>
      </div>
      {isExp && hasKids && (
        <div className="ml-5 border-l border-muted/30 pl-3 space-y-0.5 mt-0.5">
          {node.children!.map((c) => (
            <RenderedDescendant key={c.id} node={c} expandedIds={expandedIds} onToggle={onToggle} />
          ))}
        </div>
      )}
    </div>
  )
}

// ============================================================
// TreeNode — simplified, no inline editing
// ============================================================

function TreeNode({
  node,
  depth,
  expandedIds,
  onToggle,
  onEdit,
  onCreateChild,
  onDetail,
  onDelete,
  onAssign,
}: {
  node: Group
  depth: number
  expandedIds: Set<string>
  onToggle: (id: string) => void
  onEdit: (g: Group) => void
  onCreateChild: (parentId: string) => void
  onDetail: (g: Group) => void
  onDelete: (id: string) => void
  onAssign: (g: Group) => void
}) {
  const children = node.children ?? []
  const isExpanded = expandedIds.has(node.id)
  const hasChildren = children.length > 0

  return (
    <div>
      <div
        className="flex items-center gap-1 py-1.5 px-1 rounded hover:bg-muted/50 group transition-colors"
        style={{ paddingLeft: `${depth * 1.5 + 0.25}rem` }}
      >
        <button
          type="button"
          className="size-5 flex items-center justify-center shrink-0 text-muted-foreground hover:text-foreground rounded"
          onClick={() => hasChildren && onToggle(node.id)}
          disabled={!hasChildren}
        >
          {hasChildren ? (
            isExpanded ? <ChevronDown className="size-3.5" /> : <ChevronRight className="size-3.5" />
          ) : (
            <span className="w-3.5" />
          )}
        </button>

        <span
          className="text-sm font-medium cursor-pointer select-none flex-1 min-w-0 truncate"
          onClick={() => onToggle(node.id)}
        >
          {node.groupName}
        </span>

        {node.public && (
          <span className="text-[10px] text-blue-600 dark:text-blue-400 shrink-0 font-medium">公开</span>
        )}
        {!node.status && (
          <Badge variant="destructive" className="text-[10px] h-4 px-1 shrink-0">禁用</Badge>
        )}

        <div className="flex gap-0.5 shrink-0 md:opacity-0 md:group-hover:opacity-100 transition-opacity">
          <ActionButton variant="ghost" size="icon-sm" onClick={() => onEdit(node)} title="编辑">
            <Edit className="size-3" />
          </ActionButton>
          <ActionButton variant="ghost" size="icon-sm" onClick={() => onDetail(node)} title="详情">
            <Eye className="size-3" />
          </ActionButton>
          <ActionButton variant="ghost" size="icon-sm" onClick={() => onAssign(node)} title="分配用户">
            <UserPlus className="size-3" />
          </ActionButton>
          {!node.status ? (
            <ActionButton variant="ghost" size="icon-sm" onClick={() => onDelete(node.id)} title="恢复">
              <RotateCcw className="size-3" />
            </ActionButton>
          ) : (
            <ActionButton variant="ghost" size="icon-sm" onClick={() => onDelete(node.id)} title="删除">
              <Trash2 className="size-3" />
            </ActionButton>
          )}
        </div>
      </div>

      {isExpanded && (
        <div>
          {children.map((child) => (
            <TreeNode
              key={child.id}
              node={child}
              depth={depth + 1}
              expandedIds={expandedIds}
              onToggle={onToggle}
              onEdit={onEdit}
              onCreateChild={onCreateChild}
              onDetail={onDetail}
              onDelete={onDelete}
              onAssign={onAssign}
            />
          ))}
          <button
            type="button"
            className="flex items-center gap-1 py-1.5 px-1 w-full text-left text-xs text-muted-foreground hover:text-foreground hover:bg-muted/30 rounded transition-colors border border-dashed border-transparent hover:border-border"
            style={{ paddingLeft: `${(depth + 1) * 1.5 + 0.25}rem` }}
            onClick={() => onCreateChild(node.id)}
          >
            <span className="w-3.5 shrink-0" />
            <Plus className="size-3 shrink-0" />
            <span>新建子群组</span>
          </button>
        </div>
      )}
    </div>
  )
}

// ============================================================
// GroupEditDialog — full form for create child / edit existing
// ============================================================

function GroupEditDialog({
  open,
  onOpenChange,
  mode,
  group,
  parentName,
  onSave,
  loading,
}: {
  open: boolean
  onOpenChange: (v: boolean) => void
  mode: 'create-child' | 'edit'
  group?: Group | null   // for edit: pre-fill
  parentName?: string    // for create-child: show parent info
  onSave: (data: { groupName: string; groupCode: string; description: string; public: boolean }) => Promise<void>
  loading: boolean
}) {
  const [formName, setFormName] = useState('')
  const [formCode, setFormCode] = useState('')
  const [formDesc, setFormDesc] = useState('')
  const [formPublic, setFormPublic] = useState(false)

  useEffect(() => {
    if (open) {
      if (mode === 'edit' && group) {
        setFormName(group.groupName)
        setFormCode(group.groupCode || '')
        setFormDesc(group.description || '')
        setFormPublic(group.public || false)
      } else {
        setFormName('')
        setFormCode('')
        setFormDesc('')
        setFormPublic(false)
      }
    }
  }, [open, mode, group])

  const handleSave = async () => {
    if (!formName.trim()) { toast.error('名称不能为空'); return }
    await onSave({ groupName: formName.trim(), groupCode: formCode.trim(), description: formDesc.trim(), public: formPublic })
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{mode === 'create-child' ? '新建子群组' : `编辑 — ${group?.groupName}`}</DialogTitle>
          {mode === 'create-child' && parentName && (
            <DialogDescription>父群组: {parentName}</DialogDescription>
          )}
        </DialogHeader>
        <div className="space-y-3">
          <FormField label="名称 *" id="gf-name" value={formName} onChange={setFormName} placeholder="群组名称" required />
          <FormField label="编码" id="gf-code" value={formCode} onChange={setFormCode} placeholder="可选，同租户内唯一" />
          <div className="grid gap-1.5">
            <Label htmlFor="gf-desc">描述</Label>
            <Textarea id="gf-desc" value={formDesc} onChange={(e) => setFormDesc(e.target.value)} placeholder="可选，群组说明" className="h-20 resize-none" />
          </div>
          <div className="flex items-center justify-between">
            <div className="grid gap-0.5">
              <Label>对外公示</Label>
              <p className="text-xs text-muted-foreground">开启后租户内所有群组可见此群组</p>
            </div>
            <input type="checkbox" checked={formPublic} onChange={(e) => setFormPublic(e.target.checked)} className="h-4 w-4" />
          </div>
        </div>
        <DialogFooter>
          <ActionButton onClick={handleSave} loading={loading}>保存</ActionButton>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ============================================================
// GroupPanel
// ============================================================

export function GroupPanel() {
  const isLoggedIn = useAuthStore((s) => s.isLoggedIn)
  const { tenants, fetchTenants } = useTenantStore()
  const store = useGroupStore()
  const { groups, groupTree, loading, fetchGroups, fetchGroupTree, fetchGroup, createGroup, updateGroup, deleteGroup, restoreGroup } = store

  const [tenantId, setTenantId] = useState('')
  const selectedTenantName = tenants.find(t => t.id === tenantId)?.tenantName

  // Tree state
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set())
  const [myExpandedIds, setMyExpandedIds] = useState<Set<string>>(new Set())

  // Edit dialog
  const [editDialogOpen, setEditDialogOpen] = useState(false)
  const [editTarget, setEditTarget] = useState<Group | null>(null)

  // Create child dialog
  const [createChildOpen, setCreateChildOpen] = useState(false)
  const [createParentId, setCreateParentId] = useState<string | null>(null)
  const createParentName = createParentId ? groups.find(g => g.id === createParentId)?.groupName : ''

  // Detail
  const [showDetail, setShowDetail] = useState<Group | null>(null)

  // Members
  const [showMembers, setShowMembers] = useState<{ group: Group; members: GroupMember[] } | null>(null)
  const [membersLoading, setMembersLoading] = useState(false)

  // Lookup
  const [lookupId, setLookupId] = useState('')
  const [lookupResult, setLookupResult] = useState<string | null>(null)

  // Assign
  const [showAssign, setShowAssign] = useState<Group | null>(null)
  const [assignUserId, setAssignUserId] = useState('')
  const [assignLoading, setAssignLoading] = useState(false)

  // My Groups
  const [myGroups, setMyGroups] = useState<Group[]>([])
  const [connectedGroups, setConnectedGroups] = useState<Group[]>([])
  const [publicGroups, setPublicGroups] = useState<Group[]>([])
  const [pendingRelations, setPendingRelations] = useState<any[]>([])
  const [sentRelations, setSentRelations] = useState<any[]>([])
  const [mgLoading, setMgLoading] = useState(false)

  // ----------------------------------------------------------
  // Data loading
  // ----------------------------------------------------------
  useEffect(() => {
    if (isLoggedIn) fetchTenants()
  }, [isLoggedIn, fetchTenants])

  useEffect(() => {
    if (tenants.length > 0 && !tenantId) {
      setTenantId(tenants[0].id)
    }
  }, [tenants, tenantId])

  useEffect(() => {
    if (tenantId) {
      fetchGroups(tenantId)
      fetchGroupTree(tenantId)
      setExpandedIds(new Set())
    }
  }, [tenantId, fetchGroups, fetchGroupTree])

  // ----------------------------------------------------------
  // Tree helpers
  // ----------------------------------------------------------
  const toggleExpand = (id: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  // Recursively collect all descendant group IDs
  const collectDescendantIds = (node: Group | null): string[] => {
    if (!node) return []
    const ids: string[] = []
    for (const child of (node.children || [])) {
      ids.push(child.id)
      ids.push(...collectDescendantIds(child))
    }
    return ids
  }

  // Find node in tree
  const findNodeInTree = (root: Group | null, id: string): Group | null => {
    if (!root) return null
    if (root.id === id) return root
    for (const child of (root.children || [])) {
      const found = findNodeInTree(child, id)
      if (found) return found
    }
    return null
  }

  const toggleMyGroup = (id: string) => {
    setMyExpandedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) {
        // 收起：移除自身及所有子孙
        next.delete(id)
        const node = findNodeInTree(groupTree, id)
        for (const did of collectDescendantIds(node)) next.delete(did)
      } else {
        next.add(id)
      }
      return next
    })
  }

  useEffect(() => {
    if (groupTree) {
      setExpandedIds((prev) => {
        const next = new Set(prev)
        next.add(groupTree.id)
        return next
      })
    }
  }, [groupTree])

  const refreshAll = () => {
    if (tenantId) { fetchGroups(tenantId); fetchGroupTree(tenantId) }
  }

  // ----------------------------------------------------------
  // My Groups
  // ----------------------------------------------------------
  const fetchMyGroupsData = async () => {
    if (!tenantId) return
    setMgLoading(true)
    try {
      const [myRes, connRes, pubRes] = await Promise.all([
        apiClient.get(`/group/my?tenantId=${tenantId}`),
        apiClient.get(`/group/connected?tenantId=${tenantId}`),
        apiClient.get(`/group/public/list?tenantId=${tenantId}`),
      ])
      const myList = ((myRes as any).data?.items || (myRes as any).data || []) as Group[]
      setMyGroups(myList)
      setConnectedGroups(((connRes as any).data?.items || (connRes as any).data || []) as Group[])
      setPublicGroups(((pubRes as any).data?.items || (pubRes as any).data || []) as Group[])
      // 拉取待处理联系
      try {
        const pr = await apiClient.get(`/group/pending-relations?tenantId=${tenantId}`)
        setPendingRelations((pr as any).data || [])
      } catch { setPendingRelations([]) }
      // 拉取已发出的联系
      try {
        const sr = await apiClient.get(`/group/sent-relations?tenantId=${tenantId}`)
        setSentRelations((sr as any).data || [])
      } catch { setSentRelations([]) }
    } catch { /* ignore */ } finally { setMgLoading(false) }
  }

  const handleAcceptRelation = async (id: string) => {
    await apiClient.put(`/group/relation/${id}/accept`)
    toast.success('已接受联系')
    fetchMyGroupsData()
    refreshAll()
  }

  const handleRejectRelation = async (id: string) => {
    await apiClient.put(`/group/relation/${id}/reject`)
    toast.success('已拒绝联系')
    fetchMyGroupsData()
    refreshAll()
  }

  // Contact dialog
  const [contactTargetId, setContactTargetId] = useState<string | null>(null)
  const [contactNote, setContactNote] = useState('')

  // 取得联系 → 打开备注弹窗
  const openContact = (targetGroupId: string) => {
    setContactTargetId(targetGroupId)
    setContactNote('')
  }

  const handleContactSubmit = async () => {
    if (!tenantId || !myGroups.length || !contactTargetId) return
    try {
      await apiClient.post('/group/relation', {
        fromGroupId: myGroups[0].id,
        toGroupId: contactTargetId,
        tenantId,
        note: contactNote.trim() || undefined,
      })
      toast.success('已发送联系请求')
      setContactTargetId(null)
      fetchMyGroupsData()
    } catch (e) { toast.error((e as Error).message) }
  }

  const handleReapply = async (relationId: string) => {
    await apiClient.put(`/group/relation/${relationId}/reapply`)
    toast.success('已重新申请')
    fetchMyGroupsData()
  }

  const handleDeleteRelation = async (relationId: string) => {
    await apiClient.delete(`/group/relation/${relationId}`)
    toast.success('已放弃')
    fetchMyGroupsData()
  }

  useEffect(() => { if (tenantId) fetchMyGroupsData() }, [tenantId])

  const handleLeaveGroup = async (groupId: string) => {
    await apiClient.post('/user/remove-group', { groupId })
    toast.success('已退出群组')
    fetchMyGroupsData()
    refreshAll()
  }

  const handleJoinGroup = async (groupId: string) => {
    await apiClient.post('/user/assign-group', { groupId })
    toast.success('已加入群组')
    fetchMyGroupsData()
    refreshAll()
  }

  // Contact dialog state (share mirror AFTER relation is active)
  const [shareTarget, setShareTarget] = useState<Group | null>(null)
  const [shareSourceTableId, setShareSourceTableId] = useState('')
  const [shareVisibleFields, setShareVisibleFields] = useState<Set<string>>(new Set())
  const [shareSourceFields, setShareSourceFields] = useState<Array<{ fieldId: string; name: string }>>([])
  const [shareTables, setShareTables] = useState<Array<{ tableId: string; name: string }>>([])
  const [shareLoading, setShareLoading] = useState(false)

  const openShare = async (g: Group) => {
    setShareTarget(g)
    setShareSourceTableId('')
    setShareVisibleFields(new Set())
    try {
      const res = await apiClient.get(`/dynamic/tables?tenantId=${tenantId}`)
      const tables = ((res as any).data?.items || (res as any).data || []) as Array<{ tableId: string; name: string }>
      setShareTables(tables)
    } catch { setShareTables([]) }
  }

  const loadShareSourceFields = async (tableId: string) => {
    setShareSourceTableId(tableId)
    setShareVisibleFields(new Set())
    try {
      const res = await apiClient.get(`/dynamic/tables/${tableId}/fields`)
      setShareSourceFields(((res as any).data?.items || (res as any).data || []) as Array<{ fieldId: string; name: string }>)
    } catch { setShareSourceFields([]) }
  }

  const toggleShareField = (fieldId: string) => {
    setShareVisibleFields((prev) => {
      const next = new Set(prev)
      if (next.has(fieldId)) { next.delete(fieldId) } else { next.add(fieldId) }
      return next
    })
  }

  const handleShareSubmit = async () => {
    if (!shareTarget || !shareSourceTableId || !shareVisibleFields.size || !tenantId) {
      toast.error('请选择源表和至少一个字段')
      return
    }
    setShareLoading(true)
    try {
      await apiClient.post('/group/share-mirror', {
        sourceGroupId: myGroups[0]?.id,
        targetGroupId: shareTarget.id,
        sourceTableId: shareSourceTableId,
        visibleFields: Array.from(shareVisibleFields),
        name: `${shareTarget.groupName} 共享`,
        tenantId,
      })
      toast.success('镜像推送成功')
      setShareTarget(null)
    } catch (e) { toast.error((e as Error).message) } finally { setShareLoading(false) }
  }

  // ----------------------------------------------------------
  // Edit / Create child dialogs
  // ----------------------------------------------------------
  const openEdit = (g: Group) => {
    setEditTarget(g)
    setEditDialogOpen(true)
  }

  const openCreateChild = (parentId: string) => {
    setCreateParentId(parentId)
    setCreateChildOpen(true)
    setExpandedIds((prev) => new Set(prev).add(parentId))
  }

  const handleEditSave = async (data: { groupName: string; groupCode: string; description: string; public: boolean }) => {
    if (!editTarget) return
    await updateGroup(editTarget.id, data)
    setEditDialogOpen(false)
    setEditTarget(null)
    refreshAll()
  }

  const handleCreateChildSave = async (data: { groupName: string; groupCode: string; description: string; public: boolean }) => {
    if (!createParentId || !tenantId) return
    await createGroup({
      tenantId,
      groupName: data.groupName,
      groupCode: data.groupCode || undefined,
      parentId: createParentId,
      public: data.public,
    } as any)
    setCreateChildOpen(false)
    setCreateParentId(null)
    refreshAll()
  }

  // Actions
  // ----------------------------------------------------------
  const handleDelete = async (id: string) => {
    const g = groups.find((x) => x.id === id)
    if (g?.status) {
      await deleteGroup(id)
    } else {
      await restoreGroup(id)
    }
    refreshAll()
  }

  const handleLookup = async () => {
    if (!lookupId) { toast.error('请输入群组 ID'); return }
    await fetchGroup(lookupId)
    const g = useGroupStore.getState().currentGroup
    setLookupResult(g ? JSON.stringify(g, null, 2) : 'Not found')
  }

  const handleShowMembers = async (g: Group) => {
    setMembersLoading(true)
    try {
      await fetchGroup(g.id)
      const full = useGroupStore.getState().currentGroup
      setShowMembers({ group: full || g, members: full?.users?.map((u: any) => u.user) ?? [] })
    } catch {
      toast.error('获取成员失败')
    } finally {
      setMembersLoading(false)
    }
  }

  const handleAssignUser = async () => {
    if (!showAssign || !assignUserId) { toast.error('请输入用户 ID'); return }
    setAssignLoading(true)
    try {
      await apiClient.post('/user/assign-group', { groupId: showAssign.id, userId: assignUserId })
      toast.success(`已将用户 ${assignUserId} 分配到群组 ${showAssign.groupName}`)
      setShowAssign(null)
      setAssignUserId('')
    } catch (e) {
      toast.error((e as Error).message)
    } finally {
      setAssignLoading(false)
    }
  }

  if (!isLoggedIn) return null

  return (
    <SectionWrapper
      title="组织架构管理"
      description={tenantId ? `${groups.length} 个群组` : '加载租户列表中...'}
      badge="sys:group"
    >
      <ToastListener store={useGroupStore} />

      <div className="flex gap-2 flex-wrap items-center mb-4">
        <Select value={tenantId} onValueChange={(v) => setTenantId(v || '')}>
          <SelectTrigger className="w-48">
            <SelectValue placeholder={tenants.length === 0 ? '加载中...' : '选择租户'}>
              {selectedTenantName || ''}
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            {tenants.map((t) => (
              <SelectItem key={t.id} value={t.id}>{t.tenantName}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <ActionButton onClick={refreshAll} loading={loading} variant="outline">
          <RefreshCw className="h-3 w-3 mr-1" />刷新
        </ActionButton>
      </div>

      <Tabs defaultValue="tree">
        <TabsList className="w-full mb-4">
          <TabsTrigger value="tree" className="flex-1"><FolderTree className="h-3 w-3 mr-1" />树</TabsTrigger>
          <TabsTrigger value="list" className="flex-1">📋 列表</TabsTrigger>
          <TabsTrigger value="my-groups" className="flex-1">👤 我的群组</TabsTrigger>
          <TabsTrigger value="lookup" className="flex-1"><Search className="h-3 w-3 mr-1" />查找</TabsTrigger>
          <TabsTrigger value="assign" className="flex-1"><UserPlus className="h-3 w-3 mr-1" />分配用户</TabsTrigger>
        </TabsList>

        {/* ===== TREE ===== */}
        <TabsContent value="tree">
          {!tenantId ? (
            <p className="text-sm text-muted-foreground py-4 text-center">请先在上方选择一个租户</p>
          ) : groupTree ? (
            <div className="border rounded-lg max-h-[60vh] overflow-y-auto">
              <TreeNode
                node={groupTree}
                depth={0}
                expandedIds={expandedIds}
                onToggle={toggleExpand}
                onEdit={openEdit}
                onCreateChild={openCreateChild}
                onDetail={setShowDetail}
                onDelete={handleDelete}
                onAssign={(g) => { setShowAssign(g); setAssignUserId('') }}
              />
            </div>
          ) : (
            <p className="text-sm text-muted-foreground py-4 text-center">加载树中...</p>
          )}
        </TabsContent>

        {/* ===== LIST ===== */}
        <TabsContent value="list">
          <div className="max-h-72 overflow-auto rounded border">
            <Table>
              <TableHeader>
                <TableRow><TableHead>名称</TableHead><TableHead>编码</TableHead><TableHead>父级</TableHead><TableHead>公开</TableHead><TableHead>状态</TableHead><TableHead>操作</TableHead></TableRow>
              </TableHeader>
              <TableBody>
                {groups.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                      {tenantId ? '暂无群组数据' : '正在加载租户...'}
                    </TableCell>
                  </TableRow>
                )}
                {groups.map((g) => (
                  <TableRow key={g.id}>
                    <TableCell className="font-medium">{g.groupName}</TableCell>
                    <TableCell className="font-mono text-xs">{g.groupCode}</TableCell>
                    <TableCell className="font-mono text-xs max-w-24 truncate">{g.parentId || '-'}</TableCell>
                    <TableCell>{g.public ? <Badge variant="default">公开</Badge> : <span className="text-muted-foreground text-xs">—</span>}</TableCell>
                    <TableCell><Badge variant={g.status ? 'default' : 'destructive'}>{g.status ? '启用' : '禁用'}</Badge></TableCell>
                    <TableCell>
                      <div className="flex gap-0.5">
                        <ActionButton variant="ghost" size="icon-sm" onClick={() => openEdit(g)} title="编辑"><Edit className="h-3 w-3" /></ActionButton>
                        <ActionButton variant="ghost" size="icon-sm" onClick={() => setShowDetail(g)} title="详情"><Eye className="h-3 w-3" /></ActionButton>
                        <ActionButton variant="ghost" size="icon-sm" onClick={() => handleDelete(g.id)} title="删除"><Trash2 className="h-3 w-3" /></ActionButton>
                        {!g.status && <ActionButton variant="ghost" size="icon-sm" onClick={() => handleDelete(g.id)} title="恢复"><RotateCcw className="h-3 w-3" /></ActionButton>}
                        <ActionButton variant="ghost" size="icon-sm" onClick={() => handleShowMembers(g)} title="查看成员"><Users className="h-3 w-3" /></ActionButton>
                        <ActionButton variant="ghost" size="icon-sm" onClick={() => { setShowAssign(g); setAssignUserId('') }} title="分配用户"><UserPlus className="h-3 w-3" /></ActionButton>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </TabsContent>

        {/* ===== MY GROUPS ===== */}
        <TabsContent value="my-groups">
          <div className="space-y-4">
            {!tenantId ? (
              <p className="text-sm text-muted-foreground py-4 text-center">请先在上方选择一个租户</p>
            ) : (
              <>
                <div className="flex gap-2">
                  <ActionButton onClick={fetchMyGroupsData} loading={mgLoading} variant="outline">
                    <RefreshCw className="h-3 w-3 mr-1" />刷新
                  </ActionButton>
                </div>

                {/* ① 我的群组 */}
                <div>
                  <h3 className="text-sm font-semibold mb-2">我的群组 ({myGroups.length})</h3>
                  {myGroups.length === 0 ? (
                    <p className="text-xs text-muted-foreground py-2">你尚未加入任何群组</p>
                  ) : (
                    <div className="space-y-1 max-h-[60vh] overflow-y-auto">
                      {myGroups.map((g) => {
                        const treeNode = findNodeInTree(groupTree, g.id)
                        const isExp = myExpandedIds.has(g.id)
                        const hasKids = (treeNode?.children || []).length > 0
                        return (
                          <div key={g.id}>
                            {/* My group row */}
                            <div className="flex items-center justify-between rounded border p-2.5 text-sm">
                              <div className="flex items-center gap-1 flex-1 min-w-0">
                                <button
                                  className={`size-5 flex items-center justify-center rounded shrink-0 ${hasKids ? 'text-muted-foreground hover:text-foreground' : 'text-muted-foreground/30 cursor-default'}`}
                                  onClick={() => hasKids && toggleMyGroup(g.id)}
                                  disabled={!hasKids}
                                >
                                  {isExp ? <span className="text-base leading-none">−</span> : <span className="text-base leading-none font-bold">+</span>}
                                </button>
                                <span className="font-medium truncate">{g.groupName}</span>
                                <span className="text-xs text-muted-foreground">{g.groupCode}</span>
                                {g.public && <Badge variant="default" className="text-[10px] h-4 px-1">公开</Badge>}
                              </div>
                              <ActionButton variant="outline" size="sm" onClick={() => handleLeaveGroup(g.id)}>退出</ActionButton>
                            </div>
                            {/* Direct children (one level only) */}
                            {isExp && treeNode?.children && treeNode.children.length > 0 && (
                              <div className="ml-5 border-l-2 border-muted pl-3 space-y-0.5 mt-0.5">
                                {treeNode.children.map((child) => {
                                  const childExp = myExpandedIds.has(child.id)
                                  const childHasKids = (child.children || []).length > 0
                                  return (
                                    <div key={child.id}>
                                      <div className="flex items-center justify-between rounded border p-1.5 text-xs">
                                        <div className="flex items-center gap-1 flex-1 min-w-0">
                                          <button
                                            className={`size-4 flex items-center justify-center rounded shrink-0 ${childHasKids ? 'text-muted-foreground hover:text-foreground' : 'text-muted-foreground/30 cursor-default'}`}
                                            onClick={() => childHasKids && toggleMyGroup(child.id)}
                                            disabled={!childHasKids}
                                          >
                                            {childExp ? <span className="text-xs leading-none">−</span> : <span className="text-xs leading-none font-bold">+</span>}
                                          </button>
                                          <span className="truncate">{child.groupName}</span>
                                          <span className="text-[10px] text-muted-foreground">{child.groupCode}</span>
                                          {child.public && <Badge variant="default" className="text-[10px] h-3.5 px-1">公开</Badge>}
                                        </div>
                                      </div>
                                      {/* Grandchildren (only if child is expanded) */}
                                      {childExp && childHasKids && (
                                        <div className="ml-5 border-l border-muted/50 pl-3 space-y-0.5 mt-0.5">
                                          {child.children!.map((gc) => {
                                            const gcExp = myExpandedIds.has(gc.id)
                                            const gcHasKids = (gc.children || []).length > 0
                                            return (
                                              <div key={gc.id}>
                                                <div className="flex items-center justify-between rounded border p-1.5 text-xs">
                                                  <div className="flex items-center gap-1 flex-1 min-w-0">
                                                    <button
                                                      className={`size-4 flex items-center justify-center rounded shrink-0 ${gcHasKids ? 'text-muted-foreground hover:text-foreground' : 'text-muted-foreground/30 cursor-default'}`}
                                                      onClick={() => gcHasKids && toggleMyGroup(gc.id)}
                                                      disabled={!gcHasKids}
                                                    >
                                                      {gcExp ? <span className="text-xs leading-none">−</span> : <span className="text-xs leading-none font-bold">+</span>}
                                                    </button>
                                                    <span className="truncate">{gc.groupName}</span>
                                                    <span className="text-[10px] text-muted-foreground">{gc.groupCode}</span>
                                                    {gc.public && <Badge variant="default" className="text-[10px] h-3.5 px-1">公开</Badge>}
                                                  </div>
                                                </div>
                                                {/* Further descendants */}
                                                {gcExp && gcHasKids && (
                                                  <div className="ml-5 border-l border-muted/30 pl-3 space-y-0.5 mt-0.5">
                                                    {gc.children!.map((ggc) => (
                                                      <RenderedDescendant key={ggc.id} node={ggc} expandedIds={myExpandedIds} onToggle={toggleMyGroup} />
                                                    ))}
                                                  </div>
                                                )}
                                              </div>
                                            )
                                          })}
                                        </div>
                                      )}
                                    </div>
                                  )
                                })}
                              </div>
                            )}
                          </div>
                        )
                      })}
                    </div>
                  )}
                </div>

                {/* ② 已建联群组 */}
                <div>
                  <h3 className="text-sm font-semibold mb-2">已建联群组 ({connectedGroups.length})</h3>
                  {connectedGroups.length === 0 ? (
                    <p className="text-xs text-muted-foreground py-2">暂无已建联群组</p>
                  ) : (
                    <div className="space-y-1.5 max-h-48 overflow-y-auto">
                      {connectedGroups.map((g) => (
                        <div key={g.id} className="flex items-center justify-between rounded border p-2.5 text-sm">
                          <div className="flex-1 min-w-0">
                            <span className="font-medium">{g.groupName}</span>
                            <span className="text-xs text-muted-foreground ml-2">{g.groupCode}</span>
                          </div>
                          <div className="flex gap-1">
                            <ActionButton size="sm" variant="outline" onClick={() => openShare(g)}>推送镜像</ActionButton>
                            <ActionButton size="sm" variant="ghost" onClick={async () => {
                              if (!myGroups[0]) return
                              try {
                                await apiClient.post('/group/relation/delete-by-groups', { fromGroupId: myGroups[0].id, toGroupId: g.id })
                                toast.success('已取消关联')
                                fetchMyGroupsData()
                                refreshAll()
                              } catch (e) { toast.error((e as Error).message) }
                            }}>取消关联</ActionButton>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* ③ 待处理联系 */}
                {pendingRelations.length > 0 && (
                  <div>
                    <h3 className="text-sm font-semibold mb-2 text-amber-600">待处理联系 ({pendingRelations.length})</h3>
                    <div className="space-y-1.5 max-h-48 overflow-y-auto">
                      {pendingRelations.map((r: any) => (
                        <div key={r.id} className="flex items-center justify-between rounded border border-amber-200 bg-amber-50/50 p-2.5 text-sm">
                          <div className="flex-1 min-w-0">
                            <span className="font-medium">{r.fromGroup?.groupName || '?'}</span>
                            <span className="text-xs ml-1">请求与</span>
                            <span className="font-medium ml-1">{r.toGroup?.groupName || '?'}</span>
                            <span className="text-xs ml-1">取得联系</span>
                            {r.creator && <span className="text-xs text-muted-foreground ml-2">发起人: {r.creator.nickname || r.creator.username}</span>}
                            {r.note && <span className="text-xs text-muted-foreground ml-2 italic">"{r.note.slice(0, 40)}{r.note.length > 40 ? '…' : ''}"</span>}
                          </div>
                          <div className="flex gap-1 shrink-0 ml-2">
                            <ActionButton size="sm" onClick={() => handleAcceptRelation(r.id)}>接受</ActionButton>
                            <ActionButton size="sm" variant="outline" onClick={() => handleRejectRelation(r.id)}>拒绝</ActionButton>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* ④ 公开群组 */}
                <div>
                  <h3 className="text-sm font-semibold mb-2">公开群组 ({publicGroups.length})</h3>
                  {publicGroups.length === 0 ? (
                    <p className="text-xs text-muted-foreground py-2">暂无公开群组</p>
                  ) : (
                    <div className="space-y-1.5 max-h-48 overflow-y-auto">
                      {publicGroups.map((g) => {
                        const isMember = myGroups.some((mg) => mg.id === g.id)
                        return (
                          <div key={g.id} className="flex items-center justify-between rounded border p-2.5 text-sm">
                            <div className="flex-1 min-w-0">
                              <span className="font-medium">{g.groupName}</span>
                              <span className="text-xs text-muted-foreground ml-2">{g.groupCode}</span>
                              {g.description && <p className="text-xs text-muted-foreground truncate">{g.description}</p>}
                            </div>
                            <div className="flex gap-1 shrink-0">
                              {isMember ? (
                                <ActionButton variant="outline" size="sm" onClick={() => handleLeaveGroup(g.id)}>退出</ActionButton>
                              ) : (
                                <ActionButton variant="outline" size="sm" onClick={() => handleJoinGroup(g.id)}>加入</ActionButton>
                              )}
                              {/* State-aware contact button */}
                              {(() => {
                                const rel = sentRelations.find((r: any) => r.toGroup?.id === g.id)
                                if (!rel) {
                                  return <ActionButton size="sm" onClick={() => openContact(g.id)} disabled={myGroups.length === 0}>取得联系</ActionButton>
                                }
                                if (rel.status === 'pending') {
                                  return <ActionButton size="sm" disabled variant="secondary" onClick={() => {}}>申请中</ActionButton>
                                }
                                if (rel.status === 'rejected') {
                                  return (
                                    <div className="flex gap-1">
                                      <ActionButton size="sm" variant="destructive" title="被拒绝" onClick={() => {}}>被拒绝</ActionButton>
                                      <ActionButton size="sm" variant="outline" onClick={() => handleReapply(rel.id)}>再次申请</ActionButton>
                                      <ActionButton size="sm" variant="ghost" onClick={() => handleDeleteRelation(rel.id)}>放弃</ActionButton>
                                    </div>
                                  )
                                }
                                return null
                              })()}
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
        </TabsContent>

        {/* ===== LOOKUP ===== */}
        <TabsContent value="lookup">
          <div className="space-y-3">
            <div className="flex gap-2 items-end">
              <FormField label="群组 ID" id="gl-id" value={lookupId} onChange={setLookupId} placeholder="UUID" />
              <ActionButton onClick={handleLookup} loading={loading}>查询</ActionButton>
            </div>
            {lookupResult && <pre className="bg-muted rounded p-2 text-xs overflow-auto max-h-64 font-mono">{lookupResult}</pre>}
          </div>
        </TabsContent>

        {/* ===== ASSIGN ===== */}
        <TabsContent value="assign">
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">选择一个群组并输入要分配的用户 ID（可从树或列表中点击 👤 按钮预填）</p>
            <div className="grid grid-cols-2 gap-2">
              <FormField label="群组 ID" id="ga-gid" value={showAssign?.id || ''} onChange={() => {}} placeholder="从列表点击 👤 按钮" />
              <FormField label="用户 ID" id="ga-uid" value={assignUserId} onChange={setAssignUserId} placeholder="用户 UUID" />
            </div>
            <ActionButton onClick={handleAssignUser} loading={assignLoading} disabled={!showAssign || !assignUserId}>
              <UserPlus className="h-3 w-3 mr-1" />分配用户到群组
            </ActionButton>
          </div>
        </TabsContent>
      </Tabs>

      {/* Edit Dialog */}
      <GroupEditDialog
        open={editDialogOpen}
        onOpenChange={(v) => { if (!v) { setEditDialogOpen(false); setEditTarget(null) } }}
        mode="edit"
        group={editTarget}
        onSave={handleEditSave}
        loading={loading}
      />

      {/* Create Child Dialog */}
      <GroupEditDialog
        open={createChildOpen}
        onOpenChange={(v) => { if (!v) { setCreateChildOpen(false); setCreateParentId(null) } }}
        mode="create-child"
        parentName={createParentName}
        onSave={handleCreateChildSave}
        loading={loading}
      />

      {/* Detail Dialog */}
      <Dialog open={!!showDetail} onOpenChange={(v) => { if (!v) setShowDetail(null) }}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>{showDetail?.groupName}</DialogTitle></DialogHeader>
          <pre className="bg-muted rounded p-3 text-xs overflow-auto max-h-96 font-mono">{JSON.stringify(showDetail, null, 2)}</pre>
        </DialogContent>
      </Dialog>

      {/* Assign Dialog */}
      <Dialog open={!!showAssign} onOpenChange={(v) => { if (!v) { setShowAssign(null); setAssignUserId('') } }}>
        <DialogContent>
          <DialogHeader><DialogTitle>分配用户到群组</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="text-sm">
              群组: <span className="font-medium">{showAssign?.groupName}</span>
              <span className="text-muted-foreground ml-2 font-mono text-xs">({showAssign?.id})</span>
            </div>
            <FormField label="用户 ID *" id="ag-uid" value={assignUserId} onChange={setAssignUserId} placeholder="输入用户的 UUID" required />
            <p className="text-xs text-muted-foreground">可在「用户管理 → 工具」中查看用户列表获取 ID</p>
          </div>
          <DialogFooter>
            <ActionButton onClick={handleAssignUser} loading={assignLoading} disabled={!assignUserId}>确认分配</ActionButton>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Members Dialog */}
      <Dialog open={!!showMembers} onOpenChange={(v) => { if (!v) setShowMembers(null) }}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>群组成员 — {showMembers?.group.groupName}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            {membersLoading ? (
              <p className="text-sm text-muted-foreground">加载中...</p>
            ) : (
              <>
                <p className="text-sm text-muted-foreground">共 {showMembers?.members.length || 0} 名成员</p>
                {showMembers?.members.length ? (
                  <div className="max-h-64 overflow-auto rounded border">
                    <Table>
                      <TableHeader>
                        <TableRow><TableHead>用户名</TableHead><TableHead>昵称</TableHead><TableHead>邮箱</TableHead><TableHead>状态</TableHead></TableRow>
                      </TableHeader>
                      <TableBody>
                        {showMembers.members.map((m) => (
                          <TableRow key={m.id}>
                            <TableCell className="font-medium">{m.username}</TableCell>
                            <TableCell>{m.nickname || '-'}</TableCell>
                            <TableCell className="text-xs">{m.email || '-'}</TableCell>
                            <TableCell><Badge variant={m.status ? 'default' : 'destructive'}>{m.status ? '启用' : '禁用'}</Badge></TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground py-4 text-center">该群组暂无成员</p>
                )}
              </>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Contact (取得联系) Dialog */}
      <Dialog open={!!contactTargetId} onOpenChange={(v) => { if (!v) setContactTargetId(null) }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>取得联系</DialogTitle>
            <DialogDescription>
              {myGroups[0]?.groupName} → {publicGroups.find(g => g.id === contactTargetId)?.groupName}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="grid gap-1.5">
              <Label>备注（限 200 字）</Label>
              <Textarea
                value={contactNote}
                onChange={(e) => setContactNote(e.target.value.slice(0, 200))}
                placeholder="介绍你的群组和建联目的…"
                className="h-24 resize-none text-sm"
              />
              <p className="text-xs text-muted-foreground text-right">{contactNote.length}/200</p>
            </div>
          </div>
          <DialogFooter>
            <ActionButton onClick={handleContactSubmit} loading={loading}>发送请求</ActionButton>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Share Mirror (推送镜像) Dialog */}
      <Dialog open={!!shareTarget} onOpenChange={(v) => { if (!v) setShareTarget(null) }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>推送镜像 — {shareTarget?.groupName}</DialogTitle>
            <DialogDescription>已建联成功后，可向对方群组推送数据镜像</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="grid gap-1.5">
              <Label>源表</Label>
              <Select value={shareSourceTableId} onValueChange={(v) => { if (v) loadShareSourceFields(v) }}>
                <SelectTrigger><SelectValue placeholder="选择要共享的表…" /></SelectTrigger>
                <SelectContent>
                  {shareTables.map((t) => <SelectItem key={t.tableId} value={t.tableId}>{t.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            {shareSourceTableId && (
              <div className="grid gap-1.5">
                <Label>可见字段（至少勾选一个）</Label>
                <div className="border rounded-lg p-2 max-h-48 overflow-y-auto space-y-0.5">
                  {shareSourceFields.map((f) => {
                    const checked = shareVisibleFields.has(f.fieldId)
                    return (
                      <label key={f.fieldId} className={`flex items-center gap-2 text-sm rounded px-2 py-1 cursor-pointer ${checked ? 'bg-primary/10 text-primary font-medium' : 'hover:bg-muted'}`}>
                        <input type="checkbox" checked={checked} onChange={() => toggleShareField(f.fieldId)} className="h-3.5 w-3.5 shrink-0" />
                        <span>{f.name}</span>
                      </label>
                    )
                  })}
                </div>
                <p className="text-xs text-muted-foreground">已选 {shareVisibleFields.size} 个字段</p>
              </div>
            )}
          </div>
          <DialogFooter>
            <ActionButton onClick={handleShareSubmit} loading={shareLoading} disabled={!shareSourceTableId || !shareVisibleFields.size}>
              推送镜像
            </ActionButton>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </SectionWrapper>
  )
}
