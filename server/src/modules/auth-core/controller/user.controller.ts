import { Request, Response } from 'express'
import { userService } from '../service/user.service'
import { success, fail, created } from '@utils/response'
import { asyncHandler } from '@utils/async-handler'
import { paginationSchema } from '@validators/common.validator'
import { Audited } from '@common/audit'

class UserController {
    @Audited('User')
    async register(req: Request, res: Response) {
        const data = await userService.registerUser(req.body)
        res.json(created(data, '注册成功'))
    }

    @Audited('User')
    async login(req: Request, res: Response) {
        const data = await userService.loginUser(req.body)
        res.json(success(data, '登录成功'))
    }

    async list(req: Request, res: Response) {
        // super admin 不过滤租户，看到全部用户
        const tenantId = req.user?.isSuperAdmin ? undefined : req.tenantId
        if (!tenantId && !req.user?.isSuperAdmin) {
            return res.status(400).json(fail("无租户上下文，请先创建或选择租户"))
        }
        const { page, pageSize } = paginationSchema.parse(req.query)
        const list = await userService.getUserListByTenant(tenantId, page, pageSize)
        res.json(success(list, '用户列表获取成功'))
    }

    async detail(req: Request, res: Response) {
        const { id } = req.params
        const user = await userService.getUserById(id)
        res.json(success(user, '用户详情获取成功'))
    }

    @Audited('User')
    async update(req: Request, res: Response) {
        const { id } = req.params
        const user = await userService.updateUser(id, req.body)
        res.json(success(user, '用户更新成功'))
    }

    @Audited('User')
    async delete(req: Request, res: Response) {
        const { id } = req.params
        await userService.deleteUser(id)
        res.json(success(null, '用户删除成功'))
    }

    @Audited('User')
    async restore(req: Request, res: Response) {
        const { id } = req.params
        const user = await userService.restoreUser(id)
        res.json(success(user, '用户恢复成功'))
    }

    async refresh(req: Request, res: Response) {
        const { refreshToken } = req.body
        const data = await userService.refreshAccessToken(refreshToken)
        res.json(success(data, 'Token 刷新成功'))
    }

    @Audited('User')
    async logout(req: Request, res: Response) {
        const userId = req.userId!
        await userService.logoutUser(userId)
        res.json(success(null, '登出成功'))
    }

    /** 获取当前登录用户的权限列表（客户端缓存用） */
    async myPermissions(req: Request, res: Response) {
        res.json(success({
            permissions: req.userPermissions || [],
            isSuperAdmin: req.user?.isSuperAdmin || false,
        }, '权限列表获取成功'))
    }

    @Audited('User')
    async assignGroup(req: Request, res: Response) {
        const { groupId, userId: targetUserId } = req.body
        const userId = targetUserId || req.userId   // 支持管理员给他人分配
        const tenantId = req.tenantId
        if (!userId || !tenantId) {
            return res.status(400).json(fail('关联群组失败'))
        }
        const result = await userService.assignGroupToUser(userId, groupId, tenantId)
        res.json(success(result, '关联群组成功'))
    }

    async removeGroup(req: Request, res: Response) {
        const { groupId } = req.body
        const userId = (req.body.userId || req.userId) as string
        const result = await userService.removeGroupFromUser(userId, groupId)
        res.json(success(result, '已退出群组'))
    }

    async assignRole(req: Request, res: Response) {
        const { roleId, userId: targetUserId } = req.body
        const userId = targetUserId || req.userId as string
        const result = await userService.assignRoleToUser(userId, roleId)
        res.json(success(result, '角色分配成功'))
    }

    async removeRole(req: Request, res: Response) {
        const { roleId, userId: targetUserId } = req.body
        const userId = targetUserId || req.userId as string
        const result = await userService.removeRoleFromUser(userId, roleId)
        res.json(success(result, '已移除角色'))
    }

    async myTenant(req: Request, res: Response) {
        const userId = req.userId as string
        const tenant = await userService.getMyTenant(userId)
        res.json(success(tenant, '我的租户'))
    }
}

export const userController = new UserController()
