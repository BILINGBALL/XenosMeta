import { Request, Response } from 'express'
import { tenantService } from "../service/tenant.service"
import { success, created } from '@utils/response'
import { asyncHandler } from '@utils/async-handler'
import { paginationSchema } from '@validators/common.validator'
import { Audited } from '@common/audit'

class TenantController {
    @Audited('Tenant')
    async create(req: Request, res: Response) {
        const { tenantName, tenantCode, scope, status } = req.body
        // 安全：只有 super_admin 才能创建 scope=system 的租户
        const isSuperAdmin = req.user?.isSuperAdmin
        const finalScope = (scope === 'system' && isSuperAdmin) ? 'system' : (scope || 'tenant')
        const tenant = await tenantService.createTenant({ tenantName, tenantCode, scope: finalScope, status, adminId: req.userId })
        res.json(created(tenant, '租户创建成功'))
    }

    async list(req: Request, res: Response) {
        const { page, pageSize } = paginationSchema.parse(req.query)
        const tenants = await tenantService.getTenants(page, pageSize)
        res.json(success(tenants, '租户列表获取成功'))
    }

    async detail(req: Request, res: Response) {
        const { id } = req.params
        const tenant = await tenantService.getTenant(id)
        res.json(success(tenant, '租户详情获取成功'))
    }

    @Audited('Tenant')
    async update(req: Request, res: Response) {
        const { id } = req.params
        const { tenantName, status, adminId } = req.body
        const tenant = await tenantService.updateTenant(id, { tenantName, status, adminId })
        res.json(success(tenant, '租户更新成功'))
    }

    @Audited('Tenant')
    async delete(req: Request, res: Response) {
        const { id } = req.params
        await tenantService.deleteTenant(id)
        res.json(success(null, '租户删除成功'))
    }

    @Audited('Tenant')
    async restore(req: Request, res: Response) {
        const { id } = req.params
        const tenant = await tenantService.restoreTenant(id)
        res.json(success(tenant, '租户恢复成功'))
    }
}

export const tenantController = new TenantController()
