import { Router } from 'express'
import { fileController } from '@modules/file/file.controller'
import { authMiddleware } from '@middleware/auth'

const router = Router()
router.use(authMiddleware)

router.post('/upload', fileController.uploadFile as any)
router.get('/tags', fileController.getTags)
router.post('/list', fileController.listFiles)

// Trash / Recycle Bin routes — must be before :fileId to avoid route conflicts
router.post('/trash/list', fileController.listTrash)
router.post('/trash/restore', fileController.restoreFiles)
router.post('/trash/permanent-delete', fileController.permanentDelete)
router.post('/trash/empty', fileController.emptyTrash)

// Content proxy + convert + thumbnail — before :fileId
router.get('/:fileId/content', fileController.streamFile)
router.get('/:fileId/convert-pdf', fileController.convertToPdf)
router.get('/:fileId/thumbnail', fileController.getThumbnail)

// Version routes — must be before :fileId catch-all
router.post('/:fileId/version', fileController.uploadNewVersion as any)
router.get('/:fileId/versions', fileController.listVersions)
router.get('/:fileId/versions/:version/download', fileController.downloadVersion)

// Rename — before :fileId
router.patch('/:fileId/rename', fileController.renameFile)

router.get('/:fileId/download', fileController.downloadFile)
router.get('/:fileId', fileController.getFile)
router.put('/:fileId', fileController.updateFile)
router.delete('/:fileId', fileController.deleteFile)

export default router
