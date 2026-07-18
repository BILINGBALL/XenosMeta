import { Request, Response } from 'express'
import { groupService } from "../service/group.service"
import { success, created } from '@utils/response'
import { paginationSchema } from '@validators/common.validator'
import { Audited } from '@common/audit'

class GroupController {
    @Audited('Group')
    async createRoot(req: Request, res: Response) {
        const { tenantId, tenantCode } = req.body
        const data = await groupService.createRootGroup(tenantId, tenantCode)
        res.json(created(data, '根群组创建成功'))
    }

    async getRoot(req: Request, res: Response) {
        const { tenantId } = req.params
        const data = await groupService.getTenantRootGroup(tenantId)
        res.json(success(data, '根群组获取成功'))
    }

    @Audited('Group')
    async create(req: Request, res: Response) {
        const data = await groupService.createGroup(req.body)
        res.json(created(data, '群组创建成功'))
    }

    async list(req: Request, res: Response) {
        const { tenantId } = req.params
        const { page, pageSize } = paginationSchema.parse(req.query)
        const data = await groupService.getGroupList(tenantId, page, pageSize)
        res.json(success(data, '群组列表获取成功'))
    }

    async tree(req: Request, res: Response) {
        const { tenantId } = req.params
        const data = await groupService.getRootGroupTree(tenantId)
        res.json(success(data, '群组树获取成功'))
    }

    async subTree(req: Request, res: Response) {
        const { tenantId, groupId } = req.params
        const data = await groupService.getGroupTree(tenantId, groupId)
        res.json(success(data, '群组树获取成功'))
    }

    async detail(req: Request, res: Response) {
        const { id } = req.params
        const data = await groupService.getGroupById(id)
        res.json(success(data, '群组详情获取成功'))
    }

    @Audited('Group')
    async update(req: Request, res: Response) {
        const { id } = req.params
        const data = await groupService.updateGroup(id, req.body)
        res.json(success(data, '群组更新成功'))
    }

    @Audited('Group')
    async delete(req: Request, res: Response) {
        const { id } = req.params
        await groupService.deleteGroup(id)
        res.json(success(null, '群组删除成功'))
    }

    @Audited('Group')
    async restore(req: Request, res: Response) {
        const { id } = req.params
        const group = await groupService.restoreGroup(id)
        res.json(success(group, '群组恢复成功'))
    }

    // ==================== My Groups ====================

    async getMyGroups(req: Request, res: Response) {
        const tenantId = (req.query.tenantId || req.tenantId) as string
        const userId = req.userId as string
        const data = await groupService.getUserGroups(tenantId, userId)
        res.json(success(data, '我的群组获取成功'))
    }

    async getConnectedGroups(req: Request, res: Response) {
        const tenantId = (req.query.tenantId || req.tenantId) as string
        const userId = req.userId as string
        const data = await groupService.getConnectedGroups(tenantId, userId)
        res.json(success(data, '已建联群组获取成功'))
    }

    // ==================== GroupRelation ====================

    async createRelation(req: Request, res: Response) {
        const data = await groupService.createRelation(req.body)
        res.json(success(data, '联系请求已发送'))
    }

    async acceptRelation(req: Request, res: Response) {
        const { id } = req.params
        const rel = await groupService.acceptRelation(id)
        res.json(success(rel, '已接受联系'))
    }

    async rejectRelation(req: Request, res: Response) {
        const { id } = req.params
        const rel = await groupService.rejectRelation(id)
        res.json(success(rel, '已拒绝联系'))
    }

    async deleteRelation(req: Request, res: Response) {
        const { id } = req.params
        await groupService.deleteRelation(id)
        res.json(success(null, '已删除联系'))
    }

    async deleteRelationByGroups(req: Request, res: Response) {
        const { fromGroupId, toGroupId } = req.body
        const tenantId = (req.query.tenantId || req.tenantId) as string
        const userId = req.userId as string
        await groupService.deleteRelationByGroups(userId, tenantId, fromGroupId, toGroupId)
        res.json(success(null, '已取消关联'))
    }

    async reapplyRelation(req: Request, res: Response) {
        const { id } = req.params
        const rel = await groupService.reapplyRelation(id)
        res.json(success(rel, '已重新申请'))
    }

    async getPendingRelations(req: Request, res: Response) {
        const tenantId = (req.query.tenantId || req.tenantId) as string
        const userId = req.userId as string
        const data = await groupService.getPendingRelations(tenantId, userId)
        res.json(success(data, '待处理联系获取成功'))
    }

    async getSentRelations(req: Request, res: Response) {
        const tenantId = (req.query.tenantId || req.tenantId) as string
        const userId = req.userId as string
        const data = await groupService.getSentRelations(tenantId, userId)
        res.json(success(data, '已发联系获取成功'))
    }

    // ==================== Public / Share ====================

    async togglePublic(req: Request, res: Response) {
        const { id } = req.params
        const group = await groupService.togglePublic(id)
        res.json(success(group, group.public ? '已设为公开' : '已取消公开'))
    }

    async searchPublicGroups(req: Request, res: Response) {
        const { tenantId, search } = req.query
        const { page, pageSize } = paginationSchema.parse(req.query)
        const data = await groupService.searchPublicGroups(tenantId as string, search as string, page, pageSize)
        res.json(success(data, '公开群组列表获取成功'))
    }

    async shareMirror(req: Request, res: Response) {
        const data = await groupService.shareMirrorToGroup(req.body)
        res.json(success(data, '镜像推送成功，等待对方接受'))
    }

    async acceptMirror(req: Request, res: Response) {
        const { mirrorId } = req.params
        const mirror = await groupService.acceptMirror(mirrorId)
        res.json(success(mirror, '已接受镜像共享'))
    }

    async rejectMirror(req: Request, res: Response) {
        const { mirrorId } = req.params
        const mirror = await groupService.rejectMirror(mirrorId)
        res.json(success(mirror, '已拒绝并删除镜像'))
    }

    async getMirrorsForGroup(req: Request, res: Response) {
        const { id } = req.params
        const { status } = req.query
        const { page, pageSize } = paginationSchema.parse(req.query)
        const data = await groupService.getMirrorsForGroup(id, status as string, page, pageSize)
        res.json(success(data, '镜像列表获取成功'))
    }

    async getMirrorsFromGroup(req: Request, res: Response) {
        const { id } = req.params
        const { page, pageSize } = paginationSchema.parse(req.query)
        const data = await groupService.getMirrorsFromGroup(id, page, pageSize)
        res.json(success(data, '已发镜像列表获取成功'))
    }
}

export const groupController = new GroupController()
