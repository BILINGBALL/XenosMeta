import { Router } from 'express'
import { fileController } from '@modules/file/file.controller'
import { authMiddleware } from '@middleware/auth'

const router = Router()
router.use(authMiddleware)

router.post('/upload', fileController.uploadFile as any)
router.get('/tags', fileController.getTags)
router.post('/list', fileController.listFiles)
router.get('/:fileId/download', fileController.downloadFile)
router.get('/:fileId', fileController.getFile)
router.put('/:fileId', fileController.updateFile)
router.delete('/:fileId', fileController.deleteFile)

export default router
