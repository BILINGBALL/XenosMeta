import {Request, Response, NextFunction} from 'express'
import prisma from '@config/db'
import { notDeleted } from '@config/soft-delete'
import {unauthorized, fail} from '@utils/response'
import {groupService} from '@modules/auth-core/service/group.service'

/**
 * 按需加载用户群组数据的中间件
 * - 只在需要数据隔离的路由上使用，而非全局 authMiddleware
 * - 加载 userGroupTrees（权限子树）和 groupIds（群组ID列表）
 */
export const loadUserGroups = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const userId = req.user?.id
        const tenantId = req.tenantId
        if (!userId || !tenantId) return res.json(unauthorized('请先登录'))

        // 加载用户群组 ID 列表
        const userGroups = await prisma.userGroup.findMany({
            where: {userId},
            select: {groupId: true}
        })
        const groupIds = userGroups.map((g: any) => g.groupId)
        req.user.groupIds = groupIds

        // 按需加载用户群组权限树
        req.userGroupTrees = await groupService.getUserGroupTrees(tenantId, userId)

        next()
    } catch (err) {
        return res.json(fail('获取用户群组失败', 500))
    }
}
