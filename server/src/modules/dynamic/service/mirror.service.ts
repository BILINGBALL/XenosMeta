import prisma from '@config/db'
import { notDeleted } from '@config/soft-delete'
import { AppError } from '@middleware/error.middleware'
import { paginate, PaginatedResult } from '@utils/pagination'
import { buildDynamicWhere } from '@utils/dynamic.util'

class MirrorService {
    /**
     * 创建镜像
     */
    async createMirror(data: {
        sourceTableId: string
        sourceGroupId?: string | null
        name: string
        description?: string
        groupId?: string | null
        visibleFields: string[]
        tenantId: string
        createdBy?: string
        mirrorId: string
    }) {
        // 校验母表存在
        const sourceTable = await prisma.dynamicTable.findUnique({ where: { tableId: data.sourceTableId } })
        if (!sourceTable) throw new AppError(404, '母表不存在')

        // 校验 visibleFields 都在母表中
        if (data.visibleFields.length > 0) {
            const fieldCount = await prisma.dynamicField.count({
                where: { tableId: data.sourceTableId, fieldId: { in: data.visibleFields } }
            })
            if (fieldCount !== data.visibleFields.length) {
                throw new AppError(400, '部分字段不属于母表')
            }
        }

        return prisma.tableMirror.create({ data })
    }

    /**
     * 获取母表的所有镜像
     */
    async getMirrorsByTable(sourceTableId: string, page = 1, pageSize = 20): Promise<PaginatedResult<any>> {
        return paginate(prisma.tableMirror, {
            where: { sourceTableId },
            orderBy: { createdAt: 'asc' },
        }, page, pageSize)
    }

    /**
     * 获取用户所在群组可见的所有镜像（跨母表聚合）
     * groupIds 为空时返回空列表
     */
    async getMirrorsByGroups(groupIds: string[], page = 1, pageSize = 20): Promise<PaginatedResult<any>> {
        if (!groupIds || groupIds.length === 0) {
            return { items: [], total: 0, page, pageSize, totalPages: 0 }
        }
        return paginate(prisma.tableMirror, {
            where: { OR: [{ groupId: { in: groupIds } }, { sourceGroupId: { in: groupIds } }] },
            include: { sourceTable: { select: { tableId: true, name: true, groupId: true } } },
            orderBy: { createdAt: 'desc' },
        }, page, pageSize)
    }

    /**
     * 获取用户所在群组的镜像，按方向分类
     * - outgoing: sourceGroupId 在 groupIds 中（我分享出去的）
     * - incoming: groupId 在 groupIds 中且 sourceGroupId 不在 groupIds 中（别人分享给我的）
     * 内部共享（双方都在 groupIds 中）优先归入 outgoing
     */
    async getMirrorsCategorized(groupIds: string[]) {
        if (!groupIds || groupIds.length === 0) {
            return { outgoing: [], incoming: [] }
        }
        const all = await prisma.tableMirror.findMany({
            where: { OR: [{ groupId: { in: groupIds } }, { sourceGroupId: { in: groupIds } }] },
            include: { sourceTable: { select: { tableId: true, name: true, groupId: true } } },
            orderBy: { createdAt: 'desc' },
        })
        const groupIdSet = new Set(groupIds)
        const outgoing = all.filter((m) => m.sourceGroupId && groupIdSet.has(m.sourceGroupId))
        const incoming = all.filter((m) => m.groupId && groupIdSet.has(m.groupId) && (!m.sourceGroupId || !groupIdSet.has(m.sourceGroupId)))
        return { outgoing, incoming }
    }

    /**
     * 获取镜像详情
     */
    async getMirror(mirrorId: string) {
        const mirror = await prisma.tableMirror.findUnique({
            where: { mirrorId },
            include: { sourceTable: true },
        })
        if (!mirror) throw new AppError(404, '镜像不存在')
        return mirror
    }

    /**
     * 更新镜像
     */
    async updateMirror(mirrorId: string, data: {
        name?: string
        description?: string
        visibleFields?: string[]
    }) {
        const mirror = await prisma.tableMirror.findUnique({ where: { mirrorId } })
        if (!mirror) throw new AppError(404, '镜像不存在')

        // 如果改了 visibleFields，校验字段属于母表
        if (data.visibleFields && data.visibleFields.length > 0) {
            const fieldCount = await prisma.dynamicField.count({
                where: { tableId: mirror.sourceTableId, fieldId: { in: data.visibleFields } }
            })
            if (fieldCount !== data.visibleFields.length) {
                throw new AppError(400, '部分字段不属于母表')
            }
        }

        return prisma.tableMirror.update({
            where: { mirrorId },
            data,
        })
    }

    /**
     * 删除镜像
     */
    async deleteMirror(mirrorId: string) {
        const mirror = await prisma.tableMirror.findUnique({ where: { mirrorId } })
        if (!mirror) throw new AppError(404, '镜像不存在')
        await prisma.tableMirror.delete({ where: { mirrorId } })
        return { success: true }
    }

    /**
     * 通过镜像查询记录 — 只读，返回 visibleFields 过滤后的数据
     */
    async getRecords(
        mirrorId: string,
        tenantId: string,
        groupIds: string[],
        jsonFilter?: any,
        page = 1,
        pageSize = 20,
    ): Promise<PaginatedResult<any>> {
        const mirror = await prisma.tableMirror.findUnique({ where: { mirrorId } })
        if (!mirror) throw new AppError(404, '镜像不存在')

        const visibleFields = mirror.visibleFields as string[]

        // 查询母表的实际数据
        const where = {
            ...(await buildDynamicWhere(mirror.sourceTableId, tenantId as any, jsonFilter)),
            ...notDeleted,
        }

        const result = await paginate(prisma.dynamicRecord, {
            where,
            orderBy: { createdAt: 'desc' },
        }, page, pageSize)

        // 过滤 data JSON：只保留 visibleFields 中的字段
        if (visibleFields.length > 0) {
            result.items = result.items.map((record: any) => ({
                ...record,
                data: filterDataFields(record.data, visibleFields),
            }))
        }

        return result
    }

    /**
     * 通过镜像获取单条记录
     */
    async getRecord(mirrorId: string, recordId: string) {
        const mirror = await prisma.tableMirror.findUnique({ where: { mirrorId } })
        if (!mirror) throw new AppError(404, '镜像不存在')

        const record = await prisma.dynamicRecord.findUnique({
            where: { recordId, tableId: mirror.sourceTableId },
        })
        if (!record) throw new AppError(404, '记录不存在')

        const visibleFields = mirror.visibleFields as string[]
        if (visibleFields.length > 0) {
            record.data = filterDataFields(record.data, visibleFields)
        }

        return record
    }
}

/** 只保留指定字段 */
function filterDataFields(data: any, allowedFields: string[]): Record<string, any> {
    const result: Record<string, any> = {}
    for (const fieldId of allowedFields) {
        if (fieldId in data) {
            result[fieldId] = data[fieldId]
        }
    }
    return result
}

export const mirrorService = new MirrorService()
