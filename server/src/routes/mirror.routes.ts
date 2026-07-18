import { Router } from 'express'
import { mirrorController } from '@modules/dynamic/controller/mirror.controller'
import { authMiddleware } from '@middleware/auth'
import { hasPermission } from '@middleware/permission'

const router = Router()
router.use(authMiddleware)
const c = mirrorController

router.get('/mirrors', hasPermission('dynamic:table:view'), c.getMyMirrors)
router.get('/mirrors/categorized', hasPermission('dynamic:table:view'), c.getMyMirrorsCategorized)
router.post('/tables/:tableId/mirrors', hasPermission('dynamic:table:add'), c.createMirror)
router.get('/tables/:tableId/mirrors', hasPermission('dynamic:table:view'), c.getMirrorsByTable)
router.get('/mirrors/:mirrorId', hasPermission('dynamic:table:view'), c.getMirror)
router.put('/mirrors/:mirrorId', hasPermission('dynamic:table:edit'), c.updateMirror)
router.delete('/mirrors/:mirrorId', hasPermission('dynamic:table:delete'), c.deleteMirror)
router.post('/mirrors/:mirrorId/records/list', hasPermission('dynamic:record:view'), c.getRecords)
router.get('/mirrors/:mirrorId/records/:recordId', hasPermission('dynamic:record:view'), c.getRecord)

export default router
