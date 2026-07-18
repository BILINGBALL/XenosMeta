import { Router } from 'express'
import { asyncHandler } from '@utils/async-handler'
import { permissionController } from '@modules/auth-core/controller/permission.controller'
import { authMiddleware } from '@middleware/auth'
import { hasPermission } from '@middleware/permission'

const router = Router()
router.use(authMiddleware)
const c = permissionController

router.get('/', hasPermission('sys:permission:view'), asyncHandler(c.list))
router.get('/:id', hasPermission('sys:permission:view'), asyncHandler(c.detail))
router.post('/', hasPermission('sys:permission:add'), c.create)
router.put('/:id', hasPermission('sys:permission:edit'), c.update)
router.delete('/:id', hasPermission('sys:permission:delete'), c.delete)

export default router
