import { Request, Response } from 'express'
import { fileService } from './file.service'
import { success, created, fail } from '@utils/response'
import { asyncHandler } from '@utils/async-handler'
import { AppError } from '@middleware/error.middleware'
import { groupService } from '@modules/auth-core/service/group.service'
import multer from 'multer'

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 50 * 1024 * 1024 }, // 50MB
})

function requireTenantId(req: Request): string {
  if (req.user?.isSuperAdmin) return req.tenantId || ''
  const tenantId = req.tenantId
  if (!tenantId) throw new AppError(400, '无租户上下文')
  return tenantId
}

class FileController {
  /** POST /api/file/upload */
  uploadFile = [
    upload.single('file'),
    asyncHandler(async (req: Request, res: Response) => {
      const tenantId = requireTenantId(req)
      const file = req.file
      if (!file) throw new AppError(400, '请选择文件')

      const tags = req.body.tags ? JSON.parse(req.body.tags) : undefined
      const result = await fileService.uploadFile({
        buffer: file.buffer,
        originalname: file.originalname,
        mimetype: file.mimetype,
        tenantId,
        groupId: req.body.groupId || null,
        tags,
        description: req.body.description,
        uploadedBy: req.userId,
      })
      res.json(created(result, '文件上传成功'))
    }),
  ]

  /** GET /api/file/:fileId */
  getFile = asyncHandler(async (req: Request, res: Response) => {
    const result = await fileService.getFile(req.params.fileId)
    res.json(success(result, '文件获取成功'))
  })

  /** GET /api/file/:fileId/download */
  downloadFile = asyncHandler(async (req: Request, res: Response) => {
    const url = await fileService.getDownloadUrl(req.params.fileId)
    res.redirect(url)
  })

  /** DELETE /api/file/:fileId */
  deleteFile = asyncHandler(async (req: Request, res: Response) => {
    await fileService.deleteFile(req.params.fileId)
    res.json(success(null, '文件删除成功'))
  })

  /** POST /api/file/list */
  listFiles = asyncHandler(async (req: Request, res: Response) => {
    const tenantId = requireTenantId(req)
    const { search, tags, mimeType, page, pageSize } = req.body || {}

    // Resolve user's group IDs
    const groupIds = req.user?.isSuperAdmin
      ? [] // super admin sees all
      : await groupService.getUserGroupIdList(tenantId, req.userId as string)

    const result = await fileService.listFiles({
      tenantId,
      groupIds,
      search,
      tags,
      mimeType,
      page: page || 1,
      pageSize: pageSize || 20,
    })
    res.json(success(result, '文件列表获取成功'))
  })

  /** PUT /api/file/:fileId */
  updateFile = asyncHandler(async (req: Request, res: Response) => {
    const { tags, description } = req.body || {}
    const result = await fileService.updateFile(req.params.fileId, { tags, description })
    res.json(success(result, '文件更新成功'))
  })

  /** GET /api/file/tags */
  getTags = asyncHandler(async (req: Request, res: Response) => {
    const tenantId = requireTenantId(req)
    const groupIds = req.user?.isSuperAdmin
      ? []
      : await groupService.getUserGroupIdList(tenantId, req.userId as string)
    const tags = await fileService.getTags(tenantId, groupIds)
    res.json(success(tags, '标签获取成功'))
  })
}

export const fileController = new FileController()
