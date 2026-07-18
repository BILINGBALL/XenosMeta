import { Request, Response } from 'express'
import { roleService } from '../service/role.service'
import { success, created } from '@utils/response'
import { tenantService } from "../service/tenant.service"
import { paginationSchema } from '@validators/common.validator'
import { Audited } from '@common/audit'
import { AppError } from '@middleware/error.middleware'

/** 获取租户过滤条件：super admin 返回 undefined（不过滤），普通用户必须有 tenantId */
function getTenantFilter(req: Request): string | undefined {
    if (req.user?.isSuperAdmin) return undefined
    const tenantId = req.tenantId
    if (!tenantId) throw new AppError(400, '无租户上下文，请先创建或选择租户')
    return tenantId
}

/** 获取操作所需的 tenantId：super admin 需显式传入，否则用 token 中的 */
function getTenantForWrite(req: Request): string {
    if (req.user?.isSuperAdmin) {
        const tid = req.body.tenantId || req.query.tenantId || req.tenantId
        if (!tid) throw new AppError(400, '超级管理员操作需指定目标租户')
        return tid
    }
    const tenantId = req.tenantId
    if (!tenantId) throw new AppError(400, '无租户上下文，请先创建或选择租户')
    return tenantId
}

class RoleController {
    async list(req: Request, res: Response) {
        const tenantId = getTenantFilter(req)
        const { page, pageSize } = paginationSchema.parse(req.query)
        const roles = await roleService.getRoles(tenantId, page, pageSize)
        res.json(success(roles, '角色列表获取成功'))
    }

    async detail(req: Request, res: Response) {
        const tenantId = getTenantFilter(req)
        const { id } = req.params
        const role = await roleService.getRole(id, tenantId)
        res.json(success(role, '角色详情获取成功'))
    }

    @Audited('Role')
    async create(req: Request, res: Response) {
        const { roleName, roleCode, status, description, scope: reqScope } = req.body

        // 确定 scope
        let scope: string
        let actualTenantId: string | null = null

        if (reqScope === 'shared') {
            // 只有 super_admin 或 system tenant 可以创建 shared 预设角色
            const tenantId = getTenantForWrite(req)
            const tenant = await tenantService.getTenant(tenantId)
            if (tenant.scope !== 'system' && !req.user?.isSuperAdmin) {
                throw new AppError(403, '只有系统租户才能创建 shared 预设角色')
            }
            scope = 'shared'
            actualTenantId = tenantId // shared 角色归属于系统租户
        } else if (reqScope === 'system') {
            if (!req.user?.isSuperAdmin) {
                throw new AppError(403, '只有超级管理员才能创建 system 角色')
            }
            const tenantId = getTenantForWrite(req)
            const tenant = await tenantService.getTenant(tenantId)
            if (tenant.scope !== 'system') {
                throw new AppError(400, 'system 角色只能在 system 租户下创建')
            }
            scope = 'system'
            actualTenantId = tenantId
        } else {
            // 默认 tenant
            const tenantId = getTenantForWrite(req)
            const tenant = await tenantService.getTenant(tenantId)
            scope = tenant.scope === 'system' ? 'system' : 'tenant'
            actualTenantId = tenantId
        }

        const role = await roleService.createRole({
            roleName, roleCode, tenantId: actualTenantId, status, scope, description,
        })
        res.json(created(role, '角色创建成功'))
    }

    @Audited('Role')
    async update(req: Request, res: Response) {
        const tenantId = getTenantForWrite(req)
        const { id } = req.params
        const { roleName, status, description, scope } = req.body
        const role = await roleService.updateRole(id, tenantId, { roleName, status, description, scope })
        res.json(success(role, '角色更新成功'))
    }

    @Audited('Role')
    async delete(req: Request, res: Response) {
        const tenantId = getTenantForWrite(req)
        const { id } = req.params
        await roleService.deleteRole(id, tenantId)
        res.json(success(null, '角色删除成功'))
    }

    @Audited('Role')
    async restore(req: Request, res: Response) {
        const tenantId = getTenantForWrite(req)
        const { id } = req.params
        const role = await roleService.restoreRole(id, tenantId)
        res.json(success(role, '角色恢复成功'))
    }

    @Audited('Role')
    async assignPermissions(req: Request, res: Response) {
        const tenantId = getTenantForWrite(req)
        const { roleId } = req.params
        const { permissionIds } = req.body
        const role = await roleService.assignPermissionsToRole(roleId, tenantId, permissionIds)
        res.json(success(role, '权限分配成功'))
    }
}

export const roleController = new RoleController()
