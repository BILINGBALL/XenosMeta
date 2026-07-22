'use client'

import { useState, useMemo, useEffect } from 'react'
import { useDynamicStore } from '@/stores/dynamic-store'
import { useGroupStore } from '@/stores/group-store'
import { ActionButton } from '@/components/shared/action-button'
import { FormField } from '@/components/shared/form-field'
import { ToastListener } from '@/components/shared/toast-listener'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { DialogFooter } from '@/components/ui/dialog'
import { Badge } from '@/components/ui/badge'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Eye, Edit, Trash2, Plus, ChevronDown, ChevronRight, AlertTriangle } from 'lucide-react'
import { toast } from 'sonner'
import { apiClient } from '@/lib/api-client'
import type { DynamicField, DynamicTable, TableMirror, Group } from '@/types'

interface MirrorPanelProps {
  selectedTableId: string
  selectedTableName?: string
  tenantId: string
  tables: DynamicTable[]
  fields: DynamicField[]
  mirrors: TableMirror[]
  onRefresh: () => void
}

// Recursively collect all descendant IDs from a tree node
function collectDescIds(node: Group | null): string[] {
  if (!node) return []
  const ids: string[] = []
  for (const c of (node.children || [])) {
    ids.push(c.id)
    ids.push(...collectDescIds(c))
  }
  return ids
}

// Find node in tree
function findNode(root: Group | null, id: string): Group | null {
  if (!root) return null
  if (root.id === id) return root
  for (const c of (root.children || [])) {
    const f = findNode(c, id)
    if (f) return f
  }
  return null
}

export function MirrorPanel({ selectedTableId, selectedTableName, tenantId, tables, fields, mirrors, onRefresh }: MirrorPanelProps) {
  const store = useDynamicStore()
  const { loading } = store
  const { groups, groupTree, fetchGroupTree, fetchGroups } = useGroupStore()

  // 确保群组数据已加载（用于显示群组名称）
  useEffect(() => {
    if (tenantId && groups.length === 0) fetchGroups(tenantId)
  }, [tenantId])

  const groupNameMap = useMemo(() => {
    const m = new Map<string, string>()
    for (const g of groups) m.set(g.id, g.groupName)
    return m
  }, [groups])

  const [showCreate, setShowCreate] = useState(false)
  const [showEdit, setShowEdit] = useState<TableMirror | null>(null)
  const [showDetail, setShowDetail] = useState<TableMirror | null>(null)
  const [showConfirm, setShowConfirm] = useState<{ changes: string[]; onConfirm: () => void } | null>(null)
  const [mName, setMName] = useState('')
  const [mDescription, setMDescription] = useState('')
  const [mGroupId, setMGroupId] = useState('')
  const [selectedFields, setSelectedFields] = useState<Set<string>>(new Set())
  // Fields loaded for the mirror being edited (fixes the bug where prop fields are stale)
  const [editSourceFields, setEditSourceFields] = useState<DynamicField[]>([])
  // Snapshot of original state when opening edit (for diff)
  const [editSnapshot, setEditSnapshot] = useState<{ name: string; desc: string; groupId: string; fields: Set<string> } | null>(null)

  // Available target groups: my groups + descendants + connected
  const [availableGroups, setAvailableGroups] = useState<Array<{ id: string; label: string }>>([])
  // User's own group IDs for direction classification
  const [userGroupIds, setUserGroupIds] = useState<Set<string>>(new Set())

  const fieldIdToName = useMemo(() => {
    const m = new Map<string, string>()
    for (const f of fields) m.set(f.fieldId, f.name)
    return m
  }, [fields])

  const fieldNameToId = useMemo(() => {
    const m = new Map<string, string>()
    for (const f of fields) m.set(f.name, f.fieldId)
    return m
  }, [fields])

  const fieldNames = useMemo(() => fields.map((f) => f.name), [fields])

  const sourceTableNames = useMemo(() => {
    const m = new Map<string, string>()
    for (const t of tables) m.set(t.tableId, t.name)
    return m
  }, [tables])

  const hasSelection = !!selectedTableId

  // Load available target groups
  const loadAvailableGroups = async () => {
    if (!tenantId) return
    try {
      // Ensure tree is loaded
      if (!groupTree) await fetchGroupTree(tenantId)

      const [myRes, connRes] = await Promise.all([
        apiClient.get(`/group/my?tenantId=${tenantId}`),
        apiClient.get(`/group/connected?tenantId=${tenantId}`),
      ])
      const myList = ((myRes as any).data || []) as Group[]
      const connList = ((connRes as any).data || []) as Group[]

      // Store raw user group IDs for mirror direction classification
      setUserGroupIds(new Set(myList.map((g: Group) => g.id)))

      const seen = new Set<string>()
      const result: Array<{ id: string; label: string }> = []

      // My groups
      for (const g of myList) {
        if (seen.has(g.id)) continue
        seen.add(g.id)
        result.push({ id: g.id, label: `${g.groupName} (我的)` })
        // Descendants
        const node = findNode(groupTree, g.id)
        for (const did of collectDescIds(node)) {
          if (seen.has(did)) continue
          seen.add(did)
          const dg = findNode(groupTree, did)
          result.push({ id: did, label: `  ${dg?.groupName || did} (子群组)` })
        }
      }
      // Connected groups
      for (const g of connList) {
        if (seen.has(g.id)) continue
        seen.add(g.id)
        result.push({ id: g.id, label: `${g.groupName} (建联)` })
      }

      setAvailableGroups(result)
    } catch { /* ignore */ }
  }

  const openCreate = () => {
    if (!hasSelection) { toast.error('请先选择一张表，再创建镜像'); return }
    setMName('')
    setMDescription('')
    setMGroupId('')
    setSelectedFields(new Set())
    loadAvailableGroups()
    setShowCreate(true)
  }

  const openEdit = async (m: TableMirror) => {
    setMName(m.name)
    setMDescription(m.description || '')
    setMGroupId(m.groupId ?? '')

    // Load fields from mirror's source table — use API directly to avoid prop staleness
    let loadedFields: DynamicField[] = []
    try {
      const res: any = await apiClient.get(`/dynamic/tables/${m.sourceTableId}/fields`)
      const items = Array.isArray(res?.data?.items) ? res.data.items : Array.isArray(res?.data) ? res.data : []
      loadedFields = items as DynamicField[]
      setEditSourceFields(loadedFields)
    } catch {
      setEditSourceFields([])
    }

    // Build fieldId→name map from the freshly loaded fields
    const fidToName = new Map<string, string>()
    for (const f of loadedFields) fidToName.set(f.fieldId, f.name)

    // Resolve visible field IDs to names using the fresh map
    const names = new Set<string>()
    for (const fid of (m.visibleFields || [])) {
      const fn = fidToName.get(fid)
      if (fn) names.add(fn)
    }
    setSelectedFields(names)

    // Snapshot original state for diff
    setEditSnapshot({
      name: m.name,
      desc: m.description || '',
      groupId: m.groupId ?? '',
      fields: new Set(names),
    })

    loadAvailableGroups()
    setShowEdit(m)
  }

  const openDetail = (m: TableMirror) => setShowDetail(m)

  const toggleField = (fieldName: string) => {
    setSelectedFields((prev) => {
      const next = new Set(prev)
      if (next.has(fieldName)) next.delete(fieldName)
      else next.add(fieldName)
      return next
    })
  }

  const handleCreate = async () => {
    if (!mName.trim()) { toast.error('镜像名称不能为空'); return }
    const visibleFields = Array.from(selectedFields).map((fn) => fieldNameToId.get(fn)).filter(Boolean) as string[]
    const ok = await store.createMirror(selectedTableId, {
      name: mName.trim(),
      description: mDescription.trim() || undefined,
      visibleFields,
      groupId: mGroupId || null,
    })
    if (ok) { setShowCreate(false); onRefresh() }
  }

  const handleUpdate = () => {
    if (!showEdit || !editSnapshot) return
    // Compute changes
    const changes: string[] = []
    const newName = mName.trim()
    const newDesc = mDescription.trim()
    const newGroupId = mGroupId || ''

    if (newName !== editSnapshot.name) changes.push(`名称：「${editSnapshot.name}」→「${newName}」`)
    if (newDesc !== editSnapshot.desc) {
      if (!editSnapshot.desc && newDesc) changes.push(`新增描述：「${newDesc}」`)
      else if (editSnapshot.desc && !newDesc) changes.push(`移除描述：「${editSnapshot.desc}」`)
      else changes.push(`描述：「${editSnapshot.desc}」→「${newDesc}」`)
    }
    if (newGroupId !== editSnapshot.groupId) {
      const oldG = editSnapshot.groupId ? groupNameMap.get(editSnapshot.groupId) || editSnapshot.groupId : '当前群组'
      const newG = newGroupId ? groupNameMap.get(newGroupId) || newGroupId : '当前群组'
      changes.push(`目标群组：「${oldG}」→「${newG}」`)
    }

    // Field changes
    const oldFields = editSnapshot.fields
    const added = Array.from(selectedFields).filter(f => !oldFields.has(f))
    const removed = Array.from(oldFields).filter(f => !selectedFields.has(f))
    if (added.length > 0) changes.push(`新增字段：${added.join('、')}`)
    if (removed.length > 0) changes.push(`移除字段：${removed.join('、')}`)

    if (changes.length === 0) {
      changes.push('未做任何修改')
    }

    setShowConfirm({
      changes,
      onConfirm: async () => {
        // Build name→fieldId map from locally loaded fields (not stale prop)
        const nameToId = new Map<string, string>()
        for (const f of editSourceFields) nameToId.set(f.name, f.fieldId)
        const visibleFields = Array.from(selectedFields).map((fn) => nameToId.get(fn)).filter(Boolean) as string[]
        const ok = await store.updateMirror(showEdit.mirrorId, {
          name: newName || undefined,
          description: newDesc || undefined,
          visibleFields,
          groupId: newGroupId || null,
        })
        if (ok) { setShowEdit(null); setEditSourceFields([]); setEditSnapshot(null); onRefresh() }
      },
    })
  }

  const handleDelete = async (mirrorId: string) => {
    const ok = await store.deleteMirror(mirrorId)
    if (ok) onRefresh()
  }

  // --- Mirror row ---
  const renderMirrorRow = (m: TableMirror, showSourceTable: boolean) => {
    const fieldLabels = (m.visibleFields || []).map((fid) => fieldIdToName.get(fid) || fid)
    const srcGroup = m.sourceGroupId ? groupNameMap.get(m.sourceGroupId) : null
    const tgtGroup = m.groupId ? groupNameMap.get(m.groupId) : null
    // Determine direction
    const isOutgoing = m.sourceGroupId ? userGroupIds.has(m.sourceGroupId) : false
    const isIncoming = m.groupId ? userGroupIds.has(m.groupId) && !isOutgoing : false
    const directionBadge = isOutgoing ? <Badge variant="default" className="text-[10px] h-4 px-1">📤 我分享的</Badge>
      : isIncoming ? <Badge variant="secondary" className="text-[10px] h-4 px-1">📥 分享给我的</Badge>
      : null
    return (
      <TableRow key={m.mirrorId}>
        <TableCell className="font-medium">{m.name}{directionBadge && <span className="ml-1.5">{directionBadge}</span>}</TableCell>
        {showSourceTable && <TableCell className="text-xs">{sourceTableNames.get(m.sourceTableId) || m.sourceTableId}</TableCell>}
        <TableCell className="text-xs">{srcGroup ? <Badge variant="outline">{srcGroup}</Badge> : <span className="text-muted-foreground">—</span>}</TableCell>
        <TableCell className="text-xs">{tgtGroup ? <Badge variant="outline">{tgtGroup}</Badge> : <span className="text-muted-foreground">—</span>}</TableCell>
        <TableCell className="text-xs max-w-48 truncate">
          {fieldLabels.length > 0 ? fieldLabels.join(', ') : <span className="text-muted-foreground">—</span>}
        </TableCell>
        <TableCell>
          <div className="flex gap-0.5">
            <ActionButton variant="ghost" size="icon-sm" onClick={() => openDetail(m)} title="详情"><Eye className="size-3" /></ActionButton>
            <ActionButton variant="ghost" size="icon-sm" onClick={() => openEdit(m)} title="编辑"><Edit className="size-3" /></ActionButton>
            <ActionButton variant="ghost" size="icon-sm" onClick={() => handleDelete(m.mirrorId)} title="删除"><Trash2 className="size-3" /></ActionButton>
          </div>
        </TableCell>
      </TableRow>
    )
  }

  const mirrorTable = (extraCol: boolean) => (
    <div className="max-h-80 overflow-auto rounded border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>镜像名称</TableHead>
            {extraCol && <TableHead>源表</TableHead>}
            <TableHead>来源群组</TableHead>
            <TableHead>目标群组</TableHead>
            <TableHead>可见字段</TableHead>
            <TableHead>操作</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {mirrors.length === 0 && (
            <TableRow>
              <TableCell colSpan={extraCol ? 6 : 5} className="text-center text-muted-foreground py-8">暂无镜像</TableCell>
            </TableRow>
          )}
          {mirrors.map((m) => renderMirrorRow(m, extraCol))}
        </TableBody>
      </Table>
    </div>
  )

  // Group selector component (reused in create/edit)
  const groupSelector = (
    <div className="grid gap-1.5">
      <Label>目标群组（留空则归属当前群组）</Label>
      <Select value={mGroupId} onValueChange={(v) => setMGroupId((v === '__none__' || !v) ? '' : v)}>
        <SelectTrigger>
          <SelectValue placeholder="选择目标群组…">
            {mGroupId ? groupNameMap.get(mGroupId) || mGroupId : '当前群组（默认）'}
          </SelectValue>
        </SelectTrigger>
        <SelectContent className="max-h-60">
          <SelectItem value="__none__">当前群组（默认）</SelectItem>
          {availableGroups.map((g) => (
            <SelectItem key={g.id} value={g.id}>{g.label}</SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  )

  // --- Dialogs ---
  const dialogs = (
    <>
      {/* Create Dialog */}
      <Dialog open={showCreate} onOpenChange={(v) => { if (!v) setShowCreate(false) }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>创建镜像 — {selectedTableName}</DialogTitle>
            <DialogDescription>选择可见字段和目标群组</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <FormField label="镜像名称 *" id="cm-name" value={mName} onChange={setMName} placeholder="例如: 客户简化视图" required />
            <FormField label="描述" id="cm-desc" value={mDescription} onChange={setMDescription} placeholder="镜像用途说明（选填）" />
            {groupSelector}
            <div className="grid gap-1.5">
              <Label>可见字段（至少勾选一个）</Label>
              <div className="border rounded-lg p-3 max-h-48 overflow-y-auto space-y-1">
                {fieldNames.length === 0 ? (
                  <p className="text-xs text-muted-foreground text-center py-2">该表暂无字段</p>
                ) : (
                  fieldNames.map((fn) => {
                    const f = fields.find((xf) => xf.name === fn)
                    const checked = selectedFields.has(fn)
                    return (
                      <label key={fn} className={`flex items-center gap-2 text-sm rounded px-2 py-1.5 cursor-pointer transition-colors ${checked ? 'bg-primary/10 text-primary font-medium' : 'hover:bg-muted'}`}>
                        <input type="checkbox" checked={checked} onChange={() => toggleField(fn)} className="h-4 w-4 shrink-0" />
                        <span className="flex-1">{fn}</span>
                        {f && <Badge variant="outline" className="text-[10px] h-4 px-1">{f.type}</Badge>}
                      </label>
                    )
                  })
                )}
              </div>
              <p className="text-xs text-muted-foreground">已选 {selectedFields.size} 个字段</p>
            </div>
          </div>
          <DialogFooter><ActionButton onClick={handleCreate} loading={loading}>创建</ActionButton></DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog open={!!showEdit} onOpenChange={(v) => { if (!v) setShowEdit(null) }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>编辑镜像 — {showEdit?.name}</DialogTitle>
            <DialogDescription>
              修改可见字段或目标群组可能影响已共享数据的引用完整性
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <FormField label="镜像名称" id="em-name" value={mName} onChange={setMName} />
            <FormField label="描述" id="em-desc" value={mDescription} onChange={setMDescription} />
            {groupSelector}

            {/* Warning */}
            <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm dark:border-amber-800 dark:bg-amber-950/30">
              <AlertTriangle className="size-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
              <div className="text-amber-800 dark:text-amber-200">
                <p className="font-medium">变更镜像配置可能影响引用方</p>
                <p className="text-xs mt-1 text-amber-700 dark:text-amber-300">
                  如果移除对方正在引用的字段，对方的引用配置可能会失效。请在变更前确认影响范围，必要时通知相关群组。
                </p>
              </div>
            </div>

            <div className="grid gap-1.5">
              <Label>可见字段（{selectedFields.size} 个已选）</Label>
              {(editSourceFields.length > 0 ? editSourceFields.map(f => f.name) : fieldNames).length === 0 ? (
                <p className="text-xs text-muted-foreground text-center py-4 border rounded-lg">
                  暂无字段 — 请先在源表中创建字段
                </p>
              ) : (
                <div className="border rounded-lg p-3 max-h-48 overflow-y-auto space-y-1">
                  {(editSourceFields.length > 0 ? editSourceFields : fields).map((f) => {
                    const fn = f.name
                    const checked = selectedFields.has(fn)
                    return (
                      <label key={fn} className={`flex items-center gap-2 text-sm rounded px-2 py-1.5 cursor-pointer transition-colors ${checked ? 'bg-primary/10 text-primary font-medium' : 'hover:bg-muted'}`}>
                        <input type="checkbox" checked={checked} onChange={() => toggleField(fn)} className="h-4 w-4 shrink-0" />
                        <span className="flex-1">{fn}</span>
                        <Badge variant="outline" className="text-[10px] h-4 px-1">{f.type}</Badge>
                      </label>
                    )
                  })}
                </div>
              )}
            </div>

            {/* Source table info */}
            <div className="text-xs text-muted-foreground flex items-center gap-1">
              <span>源表：</span>
              <Badge variant="outline" className="text-[10px] h-4 px-1 font-mono">
                {sourceTableNames.get(showEdit?.sourceTableId || '') || showEdit?.sourceTableId}
              </Badge>
              <span className="mx-1">|</span>
              <span>镜像 ID：</span>
              <code className="bg-muted px-1 rounded text-[10px] font-mono">{showEdit?.mirrorId}</code>
            </div>
          </div>
          <DialogFooter>
            <ActionButton variant="outline" onClick={() => setShowEdit(null)}>取消</ActionButton>
            <ActionButton onClick={handleUpdate} loading={loading}>保存更改</ActionButton>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Confirm Save Dialog */}
      <Dialog open={!!showConfirm} onOpenChange={(v) => { if (!v) setShowConfirm(null) }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>确认保存更改</DialogTitle>
            <DialogDescription>
              请确认以下变更内容。修改镜像配置可能影响已共享数据的引用完整性。
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2 max-h-64 overflow-auto">
            {showConfirm?.changes.map((c, i) => {
              const isNoChange = c === '未做任何修改'
              return (
                <div key={i} className={`flex items-start gap-2 text-sm py-1.5 px-3 rounded ${isNoChange ? 'bg-muted text-muted-foreground' : c.includes('移除') ? 'bg-red-50 text-red-800 dark:bg-red-950/30 dark:text-red-300' : c.includes('新增') ? 'bg-green-50 text-green-800 dark:bg-green-950/30 dark:text-green-300' : 'bg-muted/50'}`}>
                  <span className="text-xs mt-0.5">{isNoChange ? 'ℹ️' : c.includes('移除') ? '⚠️' : c.includes('新增') ? '✅' : '📝'}</span>
                  <span>{c}</span>
                </div>
              )
            })}
          </div>
          <DialogFooter>
            <ActionButton variant="outline" onClick={() => setShowConfirm(null)}>取消</ActionButton>
            <ActionButton onClick={() => { const fn = showConfirm?.onConfirm; setShowConfirm(null); fn?.() }} loading={loading}>
              确认保存
            </ActionButton>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <Dialog open={!!showDetail} onOpenChange={(v) => { if (!v) setShowDetail(null) }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>镜像详情 — {showDetail?.name}</DialogTitle>
            {showDetail?.description && <DialogDescription>{showDetail.description}</DialogDescription>}
          </DialogHeader>
          <div className="space-y-3 text-sm">
            <div className="grid grid-cols-2 gap-3">
              <div><span className="text-muted-foreground">源表：</span><span className="font-medium">{sourceTableNames.get(showDetail?.sourceTableId || '') || showDetail?.sourceTableId}</span></div>
              <div><span className="text-muted-foreground">镜像 ID：</span><code className="bg-muted px-1 rounded text-xs">{showDetail?.mirrorId}</code></div>
              <div><span className="text-muted-foreground">来源群组：</span><span>{showDetail?.sourceGroupId ? groupNameMap.get(showDetail.sourceGroupId) || showDetail.sourceGroupId : '—'}</span></div>
              <div><span className="text-muted-foreground">目标群组：</span><span>{showDetail?.groupId ? groupNameMap.get(showDetail.groupId) || showDetail.groupId : '—'}</span></div>
            </div>
            <div>
              <span className="text-muted-foreground text-xs">可见字段（{(showDetail?.visibleFields || []).length} 个）：</span>
              <div className="mt-1.5 flex flex-wrap gap-1">
                {(showDetail?.visibleFields || []).length === 0 ? (
                  <span className="text-xs text-muted-foreground">全部字段可见</span>
                ) : (
                  (showDetail?.visibleFields || []).map((fid: string) => {
                    const f = fields.find((xf) => xf.fieldId === fid)
                    return (
                      <Badge key={fid} variant="secondary" className="text-xs">
                        {f ? `${f.name} (${f.type})` : fid}
                      </Badge>
                    )
                  })
                )}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3 text-xs text-muted-foreground pt-2 border-t">
              <div>创建时间：{showDetail?.createdAt ? new Date(showDetail.createdAt).toLocaleString() : '—'}</div>
              <div>更新时间：{showDetail?.updatedAt ? new Date(showDetail.updatedAt).toLocaleString() : '—'}</div>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  )

  if (!selectedTableId) {
    return (
      <div className="space-y-3">
        <ToastListener store={useDynamicStore} />
        <div className="flex gap-2">
          <ActionButton onClick={onRefresh} loading={loading} variant="outline">刷新</ActionButton>
          <span className="text-xs text-muted-foreground self-center">提示：选择一张表后可创建镜像</span>
        </div>
        {mirrorTable(true)}
        {dialogs}
      </div>
    )
  }

  return (
    <div className="space-y-3">
      <ToastListener store={useDynamicStore} />
      <div className="flex gap-2">
        <ActionButton onClick={onRefresh} loading={loading} variant="outline">刷新</ActionButton>
        <ActionButton onClick={openCreate}><Plus className="size-3 mr-1" />新建镜像</ActionButton>
      </div>
      {mirrorTable(false)}
      {dialogs}
    </div>
  )
}
