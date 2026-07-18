import express from 'express'
import { asyncHandler } from '@utils/async-handler'
import { userController } from '@modules/auth-core/controller/user.controller'
import { authMiddleware } from '@middleware/auth'
import { hasPermission } from '@middleware/permission'
import { validate } from '@middleware/validate.middleware'
import { loginLimiter } from '@middleware/rate-limit.middleware'
import { registerSchema, loginSchema, updateUserSchema, assignGroupSchema, refreshTokenSchema } from '@validators/user.validator'

const router = express.Router()
const c = userController

// @Audited 方法自带 error catch；只读方法用 asyncHandler 包
router.post('/register', validate(registerSchema), c.register)
router.post('/login', loginLimiter, validate(loginSchema), c.login)
router.post('/refresh', validate(refreshTokenSchema), asyncHandler(c.refresh))
router.post('/logout', authMiddleware, c.logout)
router.get('/permissions', authMiddleware, asyncHandler(c.myPermissions))
router.get('/my-tenant', authMiddleware, asyncHandler(c.myTenant))
router.get('/list', authMiddleware, hasPermission('sys:user:view'), asyncHandler(c.list))
router.get('/:id', authMiddleware, hasPermission('sys:user:view'), asyncHandler(c.detail))
router.put('/:id', authMiddleware, hasPermission('sys:user:edit'), validate(updateUserSchema), c.update)
router.put('/:id/restore', authMiddleware, hasPermission('sys:user:edit'), c.restore)
router.delete('/:id', authMiddleware, hasPermission('sys:user:delete'), c.delete)
router.post('/assign-group', authMiddleware, hasPermission('sys:user:assign'), validate(assignGroupSchema), c.assignGroup)
router.post('/remove-group', authMiddleware, asyncHandler(c.removeGroup))
router.post('/assign-role', authMiddleware, asyncHandler(c.assignRole))
router.post('/remove-role', authMiddleware, asyncHandler(c.removeRole))

export default router
