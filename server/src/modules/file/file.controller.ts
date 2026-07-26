import {Request, Response} from 'express'
import {fileService} from './file.service'
import {success, created, fail} from '@utils/response'
import {asyncHandler} from '@utils/async-handler'
import {AppError} from '@middleware/error.middleware'
import {groupService} from '@modules/auth-core/service/group.service'
import multer from 'multer'
import iconv from 'iconv-lite'

const upload = multer({
    storage: multer.memoryStorage(),
    limits: {fileSize: 5 * 1024 * 1024 * 1024}, // 5GB
})

function requireTenantId(req: Request): string {
    if (req.user?.isSuperAdmin) return req.tenantId || ''
    const tenantId = req.tenantId
    if (!tenantId) throw new AppError(400, '无租户上下文')
    return tenantId
}

function tenantContext(req: Request) {
    return {
        tenantId: requireTenantId(req),
        isSuperAdmin: !!req.user?.isSuperAdmin,
    }
}

/** Fetch file with tenant isolation — use for all :fileId endpoints */
async function requireFileAccess(req: Request, fileId: string) {
    const { tenantId, isSuperAdmin } = tenantContext(req)
    return fileService.getFile(fileId, tenantId, isSuperAdmin)
}

function decodeFilename(originalname: string): string {
    const rawBytes = Buffer.from(originalname, 'latin1')
    const utf8Test = rawBytes.toString('utf8')
    if (utf8Test.includes('�')) {
        const gbkResult = iconv.decode(rawBytes, 'gbk')
        return gbkResult.includes('�') ? originalname : gbkResult
    }
    return utf8Test
}

class FileController {
    /** POST /api/file/upload */
    uploadFile = [
        upload.single('file'),
        asyncHandler(async (req: Request, res: Response) => {
            const tenantId = requireTenantId(req)
            const file = req.file
            if (!file) throw new AppError(400, '请选择文件')

            const filename = decodeFilename(file.originalname)
            const displayName = req.body.displayName || undefined
            const tags = req.body.tags ? JSON.parse(req.body.tags) : undefined
            const result = await fileService.uploadFile({
                buffer: file.buffer,
                originalname: filename,
                mimetype: file.mimetype,
                tenantId,
                groupId: req.body.groupId || null,
                displayName,
                tags,
                description: req.body.description,
                uploadedBy: req.userId,
            })
            res.json(created(result, '文件上传成功'))
        }),
    ]

    /** GET /api/file/:fileId */
    getFile = asyncHandler(async (req: Request, res: Response) => {
        const file = await requireFileAccess(req, req.params.fileId)
        res.json(success(file, '文件获取成功'))
    })

    /** GET /api/file/:fileId/download — returns presigned URL */
    downloadFile = asyncHandler(async (req: Request, res: Response) => {
        const { tenantId, isSuperAdmin } = tenantContext(req)
        const url = await fileService.getDownloadUrl(req.params.fileId, tenantId, isSuperAdmin)
        res.json(success(url, '下载链接获取成功'))
    })

    /** GET /api/file/:fileId/content — authenticated stream proxy with Range support */
    streamFile = asyncHandler(async (req: Request, res: Response) => {
        const { tenantId, isSuperAdmin } = tenantContext(req)
        const { stream, mimeType, filename, size, sha256, updatedAt, bucket, objectKey } =
          await fileService.getFileContent(req.params.fileId, tenantId, isSuperAdmin)

        // Cache headers
        res.setHeader('Accept-Ranges', 'bytes')
        res.setHeader('Cache-Control', 'private, max-age=3600')
        if (sha256) res.setHeader('ETag', `"${sha256}"`)
        if (updatedAt) res.setHeader('Last-Modified', new Date(updatedAt).toUTCString())

        const range = req.headers.range
        if (range) {
            const parts = range.replace(/bytes=/, '').split('-')
            const start = parseInt(parts[0], 10)
            const end = parts[1] ? parseInt(parts[1], 10) : size - 1

            if (start >= size || end >= size) {
                res.status(416).setHeader('Content-Range', `bytes */${size}`)
                return res.end()
            }

            const chunkSize = end - start + 1
            res.status(206)
            res.setHeader('Content-Range', `bytes ${start}-${end}/${size}`)
            res.setHeader('Content-Length', chunkSize)
            res.setHeader('Content-Type', mimeType)
            res.setHeader('Content-Disposition', `inline; filename*=UTF-8''${encodeURIComponent(filename)}`)

            // MinIO supports range via getPartialObject
            const { getMinioClient } = require('@config/minio')
            const partialStream = await getMinioClient().getPartialObject(bucket, objectKey, start, chunkSize)
            partialStream.pipe(res)
            return
        }

        // Full content (existing behavior)
        res.setHeader('Content-Type', mimeType)
        res.setHeader('Content-Disposition', `inline; filename*=UTF-8''${encodeURIComponent(filename)}`)
        res.setHeader('Content-Length', size)
        stream.pipe(res)
    })

    /** GET /api/file/:fileId/convert-pdf — convert office doc to PDF stream */
    convertToPdf = asyncHandler(async (req: Request, res: Response) => {
        const { tenantId, isSuperAdmin } = tenantContext(req)
        const { stream, mimeType, filename, size } = await fileService.convertToPdf(
            req.params.fileId, tenantId, isSuperAdmin,
        )
        res.setHeader('Content-Type', mimeType)
        res.setHeader('Content-Disposition', `inline; filename*=UTF-8''${encodeURIComponent(filename)}`)
        res.setHeader('Accept-Ranges', 'bytes')
        res.setHeader('Cache-Control', 'private, max-age=86400') // 24h — converted PDFs are stable
        if (size) res.setHeader('Content-Length', size)
        stream.pipe(res)
    })

    /** GET /api/file/:fileId/thumbnail — auto-resized image thumbnail */
    getThumbnail = asyncHandler(async (req: Request, res: Response) => {
        const { tenantId, isSuperAdmin } = tenantContext(req)
        const width = parseInt(req.query.w as string) || 200
        const { buffer, mimeType } = await fileService.getThumbnail(req.params.fileId, width, tenantId, isSuperAdmin)
        res.setHeader('Content-Type', mimeType)
        res.setHeader('Cache-Control', 'private, max-age=86400')
        res.send(buffer)
    })

    /** DELETE /api/file/:fileId — soft delete */
    deleteFile = asyncHandler(async (req: Request, res: Response) => {
        const { tenantId, isSuperAdmin } = tenantContext(req)
        // Check for dynamic record references
        const { referenced } = await fileService.checkFileReferences(req.params.fileId)
        if (referenced) {
            throw new AppError(409, '文件被动态记录引用，请先从对应记录中移除附件后再删除')
        }
        await fileService.deleteFile(req.params.fileId, tenantId, isSuperAdmin)
        res.json(success(null, '文件已移入回收站'))
    })

    /** PATCH /api/file/:fileId/rename */
    renameFile = asyncHandler(async (req: Request, res: Response) => {
        const { tenantId, isSuperAdmin } = tenantContext(req)
        const { name } = req.body || {}
        if (!name || typeof name !== 'string' || !name.trim()) {
            throw new AppError(400, '请提供有效的文件名')
        }
        const result = await fileService.renameFile(req.params.fileId, name.trim(), tenantId, isSuperAdmin)
        res.json(success(result, '文件重命名成功'))
    })

    /** POST /api/file/list */
    listFiles = asyncHandler(async (req: Request, res: Response) => {
        const tenantId = requireTenantId(req)
        const {search, tags, mimeType, page, pageSize, sortBy, sortOrder} = req.body || {}

        const groupIds = req.user?.isSuperAdmin
            ? []
            : await groupService.getUserGroupIdList(tenantId, req.userId as string)

        const result = await fileService.listFiles({
            tenantId,
            groupIds,
            search,
            tags,
            mimeType,
            page: page || 1,
            pageSize: pageSize || 20,
            sortBy,
            sortOrder,
        })
        res.json(success(result, '文件列表获取成功'))
    })

    /** PUT /api/file/:fileId */
    updateFile = asyncHandler(async (req: Request, res: Response) => {
        const { tenantId, isSuperAdmin } = tenantContext(req)
        const {tags, description, filename} = req.body || {}
        const result = await fileService.updateFile(req.params.fileId, {tags, description, filename}, tenantId, isSuperAdmin)
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

    // ========== Version endpoints ==========

    /** POST /api/file/:fileId/version — upload a new version */
    uploadNewVersion = [
        upload.single('file'),
        asyncHandler(async (req: Request, res: Response) => {
            const { tenantId, isSuperAdmin } = tenantContext(req)
            const file = req.file
            if (!file) throw new AppError(400, '请选择文件')

            const filename = decodeFilename(file.originalname)
            const displayName = req.body.displayName || undefined
            const result = await fileService.uploadNewVersion(req.params.fileId, {
                buffer: file.buffer,
                originalname: filename,
                mimetype: file.mimetype,
                displayName,
                uploadedBy: req.userId,
            }, tenantId, isSuperAdmin)
            res.json(created(result, `新版本 V${result.currentVersion} 上传成功`))
        }),
    ]

    /** GET /api/file/:fileId/versions — list all versions */
    listVersions = asyncHandler(async (req: Request, res: Response) => {
        const { tenantId, isSuperAdmin } = tenantContext(req)
        const result = await fileService.listVersions(req.params.fileId, tenantId, isSuperAdmin)
        res.json(success(result, '版本列表获取成功'))
    })

    /** GET /api/file/:fileId/versions/:version/download — presigned URL for specific version */
    downloadVersion = asyncHandler(async (req: Request, res: Response) => {
        const { tenantId, isSuperAdmin } = tenantContext(req)
        const version = parseInt(req.params.version, 10)
        if (isNaN(version) || version < 1) throw new AppError(400, '无效的版本号')
        const url = await fileService.getVersionDownloadUrl(req.params.fileId, version, tenantId, isSuperAdmin)
        res.json(success(url, '版本下载链接获取成功'))
    })

    // ========== Trash / Recycle Bin ==========

    /** POST /api/file/trash/list — list soft-deleted files */
    listTrash = asyncHandler(async (req: Request, res: Response) => {
        const tenantId = requireTenantId(req)
        const { search, mimeType, page, pageSize, sortBy, sortOrder } = req.body || {}

        const groupIds = req.user?.isSuperAdmin
            ? []
            : await groupService.getUserGroupIdList(tenantId, req.userId as string)

        const result = await fileService.listTrash({
            tenantId,
            groupIds,
            search,
            mimeType,
            page: page || 1,
            pageSize: pageSize || 20,
            sortBy,
            sortOrder,
        })
        res.json(success(result, '回收站列表获取成功'))
    })

    /** POST /api/file/trash/restore — restore one or many files */
    restoreFiles = asyncHandler(async (req: Request, res: Response) => {
        const { tenantId, isSuperAdmin } = tenantContext(req)
        const { fileIds } = req.body || {}
        if (!fileIds || !Array.isArray(fileIds) || fileIds.length === 0) {
            throw new AppError(400, '请提供要恢复的文件ID列表')
        }

        if (fileIds.length === 1) {
            const result = await fileService.restoreFile(fileIds[0], tenantId, isSuperAdmin)
            res.json(success(result, '文件已恢复'))
        } else {
            const result = await fileService.batchRestoreFiles(fileIds, tenantId, isSuperAdmin)
            res.json(success(result, `已恢复 ${result.restored} 个文件${result.failed > 0 ? `，${result.failed} 个失败` : ''}`))
        }
    })

    /** POST /api/file/trash/permanent-delete — permanently delete files from trash */
    permanentDelete = asyncHandler(async (req: Request, res: Response) => {
        const { tenantId, isSuperAdmin } = tenantContext(req)
        const { fileIds } = req.body || {}
        if (!fileIds || !Array.isArray(fileIds) || fileIds.length === 0) {
            throw new AppError(400, '请提供要永久删除的文件ID列表')
        }

        if (fileIds.length === 1) {
            await fileService.permanentDeleteFile(fileIds[0], tenantId, isSuperAdmin)
            res.json(success(null, '文件已永久删除'))
        } else {
            const result = await fileService.batchPermanentDelete(fileIds, tenantId, isSuperAdmin)
            res.json(success(result, `已永久删除 ${result.deleted} 个文件${result.failed > 0 ? `，${result.failed} 个失败` : ''}`))
        }
    })

    /** POST /api/file/trash/empty — empty entire trash for the tenant */
    emptyTrash = asyncHandler(async (req: Request, res: Response) => {
        const tenantId = requireTenantId(req)
        const result = await fileService.emptyTrash(tenantId)
        res.json(success(result, `已清空回收站，共删除 ${result.deleted} 个文件`))
    })
}

export const fileController = new FileController()
