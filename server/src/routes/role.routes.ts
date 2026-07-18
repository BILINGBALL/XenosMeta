import { Router } from 'express'
import { asyncHandler } from '@utils/async-handler'
import { roleController } from '@modules/auth-core/controller/role.controller'
import { authMiddleware } from '@middleware/auth'
import { hasPermission } from '@middleware/permission'
import { validate } from '@middleware/validate.middleware'
import { createRoleSchema, updateRoleSchema, assignPermissionsSchema } from '@validators/role.validator'

const router = Router()
router.use(authMiddleware)
const c = roleController

router.get('/', hasPermission('sys:role:view'), asyncHandler(c.list))
router.get('/:id', hasPermission('sys:role:view'), asyncHandler(c.detail))
router.post('/', hasPermission('sys:role:add'), validate(createRoleSchema), c.create)
router.put('/:id', hasPermission('sys:role:edit'), validate(updateRoleSchema), c.update)
router.put('/:id/restore', hasPermission('sys:role:edit'), c.restore)
router.delete('/:id', hasPermission('sys:role:delete'), c.delete)
router.post('/:roleId/permissions', hasPermission('sys:role:assign'), validate(assignPermissionsSchema), c.assignPermissions)

export default router
