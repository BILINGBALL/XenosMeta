import { Router } from 'express'
import { systemController } from '@modules/auth-core/controller/system.controller'
import { authMiddleware } from '@middleware/auth'
import { asyncHandler } from '@utils/async-handler'

const router = Router()
router.post('/init-super-admin', systemController.initSuperAdmin)
router.post('/seed-permissions', authMiddleware, asyncHandler(systemController.seedPermissions))
router.post('/seed-preset-roles', authMiddleware, asyncHandler(systemController.seedPresetRoles))
router.post('/cleanup', authMiddleware, asyncHandler(systemController.cleanup))

export default router
