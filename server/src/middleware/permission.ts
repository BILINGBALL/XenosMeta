import { Request, Response, NextFunction } from 'express'
import { forbidden, unauthorized } from '@utils/response'

/**
 * 权限校验中间件 — 纯内存比较，无数据库查询
 * 前提：authMiddleware 已将用户权限列表注入 req.userPermissions
 */
export const hasPermission = (permCode: string) => {
    return (req: Request, res: Response, next: NextFunction) => {
        const userId = req.user?.id
        if (!userId) return res.status(401).json(unauthorized('用户未登录'))

        // 超级管理员直接放行
        if (req.user?.isSuperAdmin) return next()

        // 内存比较权限
        const permissions: string[] = req.userPermissions || []
        if (!permissions.includes(permCode)) {
            return res.status(403).json(forbidden('权限不足，无法访问'))
        }

        next()
    }
}
