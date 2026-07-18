import { Request, Response } from 'express'
import { permissionService } from '../service/permission.service'
import { success, created } from '@utils/response'
import { paginationSchema } from '@validators/common.validator'
import { Audited } from '@common/audit'

class PermissionController {
    async list(_req: Request, res: Response) {
        const permissions = await permissionService.getPermissions()
        res.json(success(permissions, '权限列表获取成功'))
    }

    async detail(req: Request, res: Response) {
        const { id } = req.params
        const permission = await permissionService.getPermission(id)
        res.json(success(permission, '权限详情获取成功'))
    }

    @Audited('Permission')
    async create(req: Request, res: Response) {
        const { permName, permCode, type, parentId, sort } = req.body
        const permission = await permissionService.createPermission({ permName, permCode, type, parentId, sort })
        res.json(created(permission, '权限创建成功'))
    }

    @Audited('Permission')
    async update(req: Request, res: Response) {
        const { id } = req.params
        const { permName, type, parentId, sort } = req.body
        const permission = await permissionService.updatePermission(id, { permName, type, parentId, sort })
        res.json(success(permission, '权限更新成功'))
    }

    @Audited('Permission')
    async delete(req: Request, res: Response) {
        const { id } = req.params
        await permissionService.deletePermission(id)
        res.json(success(null, '权限删除成功'))
    }
}

export const permissionController = new PermissionController()
