import { Router } from 'express'
import { tenantController } from '@modules/auth-core/controller/tenant.controller'
import { authMiddleware } from '@middleware/auth'
import { hasPermission } from '@middleware/permission'
import { validate } from '@middleware/validate.middleware'
import { createTenantSchema, updateTenantSchema } from '@validators/tenant.validator'
import { asyncHandler } from '@utils/async-handler'

const router = Router()
const c = tenantController

router.get('/', authMiddleware, hasPermission('sys:tenant:view'), asyncHandler(c.list))
router.post('/create', authMiddleware, hasPermission('sys:tenant:add'), validate(createTenantSchema), c.create) // @Audited 已内置 error catch
router.get('/:id', authMiddleware, hasPermission('sys:tenant:view'), asyncHandler(c.detail))
router.put('/:id', authMiddleware, hasPermission('sys:tenant:edit'), validate(updateTenantSchema), c.update)
router.delete('/:id', authMiddleware, hasPermission('sys:tenant:delete'), c.delete)
router.put('/:id/restore', authMiddleware, hasPermission('sys:tenant:edit'), c.restore)

export default router
