'use client'

import { useState, useEffect, useMemo } from 'react'
import { useAuthStore } from '@/stores/auth-store'
import { useDynamicStore } from '@/stores/dynamic-store'
import { useGroupStore } from '@/stores/group-store'
import { DataGrid } from '@/components/dynamic/data-grid'
import { Select, SelectContent, SelectItem, SelectSeparator, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Layers, Database, RefreshCw, Share2, ArrowDownToLine, ArrowUpFromLine } from 'lucide-react'

const DEFAULT_TABLE_ID = 'tblYM9eBk8UqpKS'

export default function AppPage() {
  const isLoggedIn = useAuthStore((s) => s.isLoggedIn)
  const hasHydrated = useAuthStore((s) => s.hasHydrated)
  const store = useDynamicStore()
  const { tables, loading, outgoingMirrors, incomingMirrors, mirrors } = store
  const { groups } = useGroupStore()

  type Selection = { type: 'table'; tableId: string } | { type: 'mirror'; mirrorId: string; name: string; sourceTableId: string }

  const [selection, setSelection] = useState<Selection>({ type: 'table', tableId: DEFAULT_TABLE_ID })
  const [selectorKey, setSelectorKey] = useState(DEFAULT_TABLE_ID)

  useEffect(() => {
    if (hasHydrated && isLoggedIn) {
      store.fetchTables()
      store.fetchAllMirrors()
      store.fetchCategorizedMirrors()
    }
  }, [hasHydrated, isLoggedIn])

  // Group name map
  const groupNameMap = useMemo(() => {
    const m = new Map<string, string>()
    for (const g of groups) m.set(g.id, g.groupName)
    return m
  }, [groups])

  const selectedTable = useMemo(() => {
    if (selection.type === 'table') {
      return tables.find((t) => t.tableId === selection.tableId) || null
    }
    return null
  }, [tables, selection])

  const handleSelect = (value: string) => {
    // value format: "table:tableId" or "mirror:mirrorId"
    const [type, id] = value.split(':')
    if (type === 'mirror') {
      const allMirrors = [...(outgoingMirrors || []), ...(incomingMirrors || []), ...(mirrors || [])]
      const mirror = allMirrors.find((m: any) => m.mirrorId === id)
      if (mirror) {
        setSelection({ type: 'mirror', mirrorId: id, name: mirror.name, sourceTableId: mirror.sourceTableId })
        store.fetchMirrorFields(id)
        store.fetchMirrorRecords(id, 1, 20)
      }
      setSelectorKey(value)
    } else {
      setSelection({ type: 'table', tableId: id })
      setSelectorKey(value)
    }
  }

  const handleRefresh = () => {
    store.fetchTables()
    store.fetchAllMirrors()
    store.fetchCategorizedMirrors()
    if (selection.type === 'mirror') {
      store.fetchMirrorRecords(selection.mirrorId)
    }
  }

  const getMirrorInfo = (mirror: any) => {
    const isIncoming = incomingMirrors?.some((m: any) => m.mirrorId === mirror.mirrorId)
    const srcGroupName = groupNameMap.get(mirror.sourceGroupId) || mirror.sourceGroupId || ''
    const tgtGroupName = groupNameMap.get(mirror.groupId) || mirror.groupId || ''
    return { isIncoming, srcGroupName, tgtGroupName }
  }

  const currentTitle = selection.type === 'mirror' ? selection.name : (selectedTable?.name || '')

  if (!hasHydrated) {
    return (
      <div className="flex flex-col items-center justify-center py-32 text-muted-foreground">
        <Database className="size-16 mb-4 opacity-20 animate-pulse" />
        <p className="text-lg font-medium mb-2">加载中...</p>
        <p className="text-sm">正在验证登录状态</p>
      </div>
    )
  }

  if (!isLoggedIn) {
    return (
      <div className="flex flex-col items-center justify-center py-32 text-muted-foreground">
        <Database className="size-16 mb-4 opacity-20" />
        <p className="text-lg font-medium mb-2">请先登录</p>
        <p className="text-sm mb-4">访问数据需要先登录系统</p>
        <Button onClick={() => window.open('/index.html', '_self')}>前往登录</Button>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold tracking-tight">数据表格</h1>
          <p className="text-sm text-muted-foreground mt-0.5">以多维表格形式浏览和管理动态表数据</p>
        </div>
        <Button variant="outline" size="sm" onClick={handleRefresh} disabled={loading}>
          <RefreshCw className="size-3.5 mr-1" />刷新
        </Button>
      </div>

      {/* Selector Card */}
      <Card className="shadow-sm">
        <CardContent className="py-3">
          <div className="flex items-center gap-4 flex-wrap">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Layers className="size-4" />
              <span>选择数据源</span>
            </div>
            <Select key={selectorKey} value={selectorKey} onValueChange={(v) => { if (v) handleSelect(v) }}>
              <SelectTrigger className="w-72">
                <SelectValue placeholder="选择表或镜像…">
                  {currentTitle || '选择…'}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                {/* My Tables */}
                <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground">📋 我的表</div>
                {tables.map((t) => (
                  <SelectItem key={`table:${t.tableId}`} value={`table:${t.tableId}`}>
                    <span className="flex items-center gap-2">
                      {t.name}
                      <Badge variant="outline" className="text-[10px] h-4 px-1 font-mono">{t.tableId.slice(0, 8)}…</Badge>
                    </span>
                  </SelectItem>
                ))}

                {/* Incoming Mirrors */}
                {(incomingMirrors || []).length > 0 && (
                  <>
                    <SelectSeparator />
                    <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground flex items-center gap-1">
                      <ArrowDownToLine className="size-3" /> 分享给我的镜像
                    </div>
                    {incomingMirrors!.map((m: any) => {
                      const info = getMirrorInfo(m)
                      const srcTable = tables.find(t => t.tableId === m.sourceTableId)
                      return (
                        <SelectItem key={`mirror:${m.mirrorId}`} value={`mirror:${m.mirrorId}`}>
                          <span className="flex items-center gap-2">
                            <Share2 className="size-3 text-blue-500" />
                            {m.name}
                            <Badge variant="secondary" className="text-[10px] h-4 px-1">
                              {srcTable?.name || m.sourceTableId?.slice(0, 8)}
                            </Badge>
                            {info.srcGroupName && (
                              <span className="text-[10px] text-muted-foreground">来自 {info.srcGroupName}</span>
                            )}
                          </span>
                        </SelectItem>
                      )
                    })}
                  </>
                )}

                {/* Outgoing Mirrors */}
                {(outgoingMirrors || []).length > 0 && (
                  <>
                    <SelectSeparator />
                    <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground flex items-center gap-1">
                      <ArrowUpFromLine className="size-3" /> 我分享的镜像
                    </div>
                    {outgoingMirrors!.map((m: any) => {
                      const info = getMirrorInfo(m)
                      const srcTable = tables.find(t => t.tableId === m.sourceTableId)
                      return (
                        <SelectItem key={`mirror:${m.mirrorId}`} value={`mirror:${m.mirrorId}`}>
                          <span className="flex items-center gap-2">
                            <Share2 className="size-3 text-green-500" />
                            {m.name}
                            <Badge variant="secondary" className="text-[10px] h-4 px-1">
                              {srcTable?.name || m.sourceTableId?.slice(0, 8)}
                            </Badge>
                            {info.tgtGroupName && (
                              <span className="text-[10px] text-muted-foreground">→ {info.tgtGroupName}</span>
                            )}
                          </span>
                        </SelectItem>
                      )
                    })}
                  </>
                )}

                {(!outgoingMirrors || outgoingMirrors.length === 0) && (!incomingMirrors || incomingMirrors.length === 0) && (
                  <>
                    <SelectSeparator />
                    <div className="px-2 py-1.5 text-xs text-muted-foreground">暂无镜像 — 可在 Dashboard 创建</div>
                  </>
                )}
              </SelectContent>
            </Select>

            {selection.type === 'mirror' && (
              <Badge variant="secondary" className="text-xs gap-1">
                <Share2 className="size-3" /> 镜像视图
              </Badge>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Data Grid */}
      {selection.type === 'table' && selectedTable ? (
        <DataGrid key={selectedTable.tableId} table={selectedTable} />
      ) : selection.type === 'mirror' ? (
        <DataGrid
          key={selection.mirrorId}
          table={{ tableId: selection.sourceTableId, name: selection.name, tenantId: '' } as any}
          mirrorId={selection.mirrorId}
        />
      ) : (
        <Card className="shadow-sm">
          <CardContent className="flex flex-col items-center justify-center py-20 text-muted-foreground">
            <Layers className="size-12 mb-4 opacity-30" />
            <p className="text-sm">请选择一个数据源开始浏览</p>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
