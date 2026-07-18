import {NextFunction, Request, Response} from 'express'
import {verifyToken} from '@config/jwt'
import {unauthorized} from '@utils/response'
import {getUserPermissions} from '@utils/permission.util'


// 扩展Request挂载用户信息
declare global {
    namespace Express {
        interface Request {
            user?: any
            userId?: string
            tenantId?: string
            username?: string
            /** 用户权限码列表 */
            userPermissions?: string[]
            /** 用户群组子树（按需加载，见 groupAuth.middleware） */
            userGroupTrees?: any;
        }
    }
}

export const authMiddleware = async (req: Request, res: Response, next: NextFunction) => {

    const token = req.headers.authorization?.replace('Bearer ', '')
    if (!token) {
        return res.status(401).json(unauthorized('未登录，请先授权'))
    }

    try {
        const decoded = verifyToken(token)

        req.user = decoded
        req.tenantId = (decoded as any).tenantId
        req.userId = (decoded as any).id
        req.username = (decoded as any).username

        // 加载用户权限（带 Redis 缓存，一次 JOIN 查询）
        const { permissions, isSuperAdmin } = await getUserPermissions((decoded as any).id)
        req.userPermissions = permissions
        req.user.isSuperAdmin = isSuperAdmin

        next()
    } catch (err) {
        return res.status(401).json(unauthorized('token失效，请重新登录'))
    }
}
