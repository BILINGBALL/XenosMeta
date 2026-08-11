import { Request, Response } from 'express'
import prisma from '@config/db'
import { mirrorService } from '../service/mirror.service'
import { groupService } from '../../auth-core/service/group.service'
import { success, created } from '@utils/response'
import { asyncHandler } from '@utils/async-handler'
import { paginationSchema } from '@validators/common.validator'
import { generateMirrorId } from '@utils/id-generator'
import { convertIdToName, getFieldNameMap } from '@utils/dynamic.util'
import { Audited } from '@common/audit'
import { AppError } from '@middleware/error.middleware'

function requireTenantId(req: Request): string {
    const tenantId = req.tenantId
    if (!tenantId) throw new AppError(400, '无租户上下文，请先创建或选择租户')
    return tenantId
}

export class MirrorController {
    /** 创建镜像 */
    @Audited('TableMirror')
    async createMirror(req: Request, res: Response) {
        const tenantId = requireTenantId(req)
        const { tableId } = req.params
        const { name, description, groupId, visibleFields } = req.body
        // 自动从源表取 sourceGroupId
        const sourceTable = await prisma.dynamicTable.findUnique({ where: { tableId }, select: { groupId: true } })
        const mirror = await mirrorService.createMirror({
            sourceTableId: tableId,
            sourceGroupId: sourceTable?.groupId || null,
            name,
            description,
            groupId,
            visibleFields: visibleFields || [],
            tenantId,
            createdBy: req.userId,
            mirrorId: generateMirrorId(),
        })
        res.json(created(mirror, '镜像创建成功'))
    }

    /** 母表的镜像列表 */
    getMirrorsByTable = asyncHandler(async (req: Request, res: Response) => {
        const { tableId } = req.params
        const { page, pageSize } = paginationSchema.parse(req.query)
        const mirrors = await mirrorService.getMirrorsByTable(tableId, page, pageSize)
        res.json(success(mirrors, '镜像列表获取成功'))
    })

    /** 用户所在群组可见的镜像列表 */
    getMyMirrors = asyncHandler(async (req: Request, res: Response) => {
        const tenantId = requireTenantId(req)
        const userId = req.userId
        const { page, pageSize } = paginationSchema.parse(req.query)
        const groupIds = await groupService.getUserGroupIdList(tenantId, userId as any)
        const mirrors = await mirrorService.getMirrorsByGroups(groupIds, page, pageSize)
        res.json(success(mirrors, '镜像列表获取成功'))
    })

    /** 用户所在群组的镜像，按方向分类（outgoing / incoming） */
    getMyMirrorsCategorized = asyncHandler(async (req: Request, res: Response) => {
        const tenantId = requireTenantId(req)
        const userId = req.userId
        const groupIds = await groupService.getUserGroupIdList(tenantId, userId as any)
        const data = await mirrorService.getMirrorsCategorized(groupIds)
        res.json(success(data, '分类镜像获取成功'))
    })

    /** 镜像详情 */
    getMirror = asyncHandler(async (req: Request, res: Response) => {
        const { mirrorId } = req.params
        const mirror = await mirrorService.getMirror(mirrorId)
        res.json(success(mirror, '镜像详情获取成功'))
    })

    /** 更新镜像 */
    @Audited('TableMirror')
    async updateMirror(req: Request, res: Response) {
        const { mirrorId } = req.params
        const { name, description, visibleFields } = req.body
        const mirror = await mirrorService.updateMirror(mirrorId, { name, description, visibleFields })
        res.json(success(mirror, '镜像更新成功'))
    }

    /** 删除镜像 */
    @Audited('TableMirror')
    async deleteMirror(req: Request, res: Response) {
        const { mirrorId } = req.params
        await mirrorService.deleteMirror(mirrorId)
        res.json(success(null, '镜像删除成功'))
    }

    /** 通过镜像查询记录列表 */
    getRecords = asyncHandler(async (req: Request, res: Response) => {
        const tenantId = requireTenantId(req)
        const userId = req.userId
        const { mirrorId } = req.params
        const filter = req.body?.filter ?? {}
        const { page, pageSize } = paginationSchema.parse(req.query)
        const groupIds = await groupService.getUserGroupIdList(tenantId, userId as any)

        const result = await mirrorService.getRecords(mirrorId, tenantId, groupIds, filter, page, pageSize)

        // 通过镜像的母表做 name ↔ fieldId 转换，但只暴露 visibleFields
        const mirror = await mirrorService.getMirror(mirrorId)
        const fullFieldMapResult = await getFieldNameMap(mirror.sourceTableId, tenantId)
        const visibleFieldIds = new Set(mirror.visibleFields as string[])
        // 过滤 fieldMap：只保留 visibleFields 中的字段
        const fieldMap: Record<string, string> = {}
        for (const [name, fid] of Object.entries(fullFieldMapResult.nameToFid)) {
            if (visibleFieldIds.has(fid)) fieldMap[name] = fid
        }
        // 保留 attachmentFieldIds 信息给 convertIdToName
        const mapWithAttachments = { nameToFid: fieldMap, attachmentFieldIds: fullFieldMapResult.attachmentFieldIds }
        result.items = convertIdToName(mapWithAttachments, result.items) as any

        res.json(success(result, '记录列表获取成功'))
    })

    /** 通过镜像获取单条记录 */
    getRecord = asyncHandler(async (req: Request, res: Response) => {
        const tenantId = requireTenantId(req)
        const { mirrorId, recordId } = req.params
        const record = await mirrorService.getRecord(mirrorId, recordId)

        const mirror = await mirrorService.getMirror(mirrorId)
        const fullFieldMapResult = await getFieldNameMap(mirror.sourceTableId, tenantId)
        const visibleFieldIds = new Set(mirror.visibleFields as string[])
        const fieldMap: Record<string, string> = {}
        for (const [name, fid] of Object.entries(fullFieldMapResult.nameToFid)) {
            if (visibleFieldIds.has(fid)) fieldMap[name] = fid
        }
        const mapWithAttachments = { nameToFid: fieldMap, attachmentFieldIds: fullFieldMapResult.attachmentFieldIds }
        const data = convertIdToName(mapWithAttachments, [record])

        res.json(success(data[0], '记录详情获取成功'))
    })

    /** 获取镜像可见字段列表（仅返回 visibleFields 中的字段元数据） */
    getFields = asyncHandler(async (req: Request, res: Response) => {
        const tenantId = requireTenantId(req)
        const { mirrorId } = req.params
        const mirror = await mirrorService.getMirror(mirrorId)
        const visibleFieldIds = new Set(mirror.visibleFields as string[])

        // 查询母表全部字段，只返回 visibleFields 中的
        const allFields = await prisma.dynamicField.findMany({
            where: { tableId: mirror.sourceTableId, tenantId, deletedAt: null },
        })
        const visibleFields = allFields.filter((f: any) => visibleFieldIds.has(f.fieldId))

        res.json(success(visibleFields, '镜像字段列表获取成功'))
    })
}

export const mirrorController = new MirrorController()
