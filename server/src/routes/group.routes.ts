import { Router } from 'express'
import { asyncHandler } from '@utils/async-handler'
import { groupController } from '@modules/auth-core/controller/group.controller'
import { authMiddleware } from '@middleware/auth'
import { hasPermission } from '@middleware/permission'

const router = Router()
const c = groupController

router.post('/root', authMiddleware, hasPermission('sys:group:add'), c.createRoot)
router.get('/root/:tenantId', authMiddleware, hasPermission('sys:group:view'), asyncHandler(c.getRoot))
router.post('/', authMiddleware, hasPermission('sys:group:add'), c.create)
router.get('/list/:tenantId', authMiddleware, hasPermission('sys:group:view'), asyncHandler(c.list))
router.get('/tree/:tenantId', authMiddleware, hasPermission('sys:group:view'), asyncHandler(c.tree))
router.get('/tree/:tenantId/:groupId', authMiddleware, hasPermission('sys:group:view'), asyncHandler(c.subTree))

// 我的群组
router.get('/my', authMiddleware, asyncHandler(c.getMyGroups))
router.get('/connected', authMiddleware, asyncHandler(c.getConnectedGroups))
router.get('/pending-relations', authMiddleware, asyncHandler(c.getPendingRelations))
router.get('/sent-relations', authMiddleware, asyncHandler(c.getSentRelations))

// 群组联系（GroupRelation）
router.post('/relation', authMiddleware, asyncHandler(c.createRelation))
router.put('/relation/:id/accept', authMiddleware, asyncHandler(c.acceptRelation))
router.put('/relation/:id/reject', authMiddleware, asyncHandler(c.rejectRelation))
router.delete('/relation/:id', authMiddleware, asyncHandler(c.deleteRelation))
router.put('/relation/:id/reapply', authMiddleware, asyncHandler(c.reapplyRelation))
router.post('/relation/delete-by-groups', authMiddleware, asyncHandler(c.deleteRelationByGroups))

// 公开群组搜索（必须放在 /:id 之前）
router.get('/public/list', authMiddleware, hasPermission('sys:group:view'), asyncHandler(c.searchPublicGroups))

// 群组共享
router.post('/share-mirror', authMiddleware, hasPermission('sys:group:add'), asyncHandler(c.shareMirror))
router.put('/share-mirror/:mirrorId/accept', authMiddleware, hasPermission('sys:group:edit'), asyncHandler(c.acceptMirror))
router.put('/share-mirror/:mirrorId/reject', authMiddleware, hasPermission('sys:group:edit'), asyncHandler(c.rejectMirror))

router.get('/:id', authMiddleware, hasPermission('sys:group:view'), asyncHandler(c.detail))
router.put('/:id', authMiddleware, hasPermission('sys:group:edit'), c.update)
router.delete('/:id', authMiddleware, hasPermission('sys:group:delete'), c.delete)
router.put('/:id/restore', authMiddleware, hasPermission('sys:group:edit'), c.restore)
router.put('/:id/public', authMiddleware, hasPermission('sys:group:edit'), asyncHandler(c.togglePublic))
router.get('/:id/mirrors-in', authMiddleware, hasPermission('sys:group:view'), asyncHandler(c.getMirrorsForGroup))
router.get('/:id/mirrors-out', authMiddleware, hasPermission('sys:group:view'), asyncHandler(c.getMirrorsFromGroup))

export default router
