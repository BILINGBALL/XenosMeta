import prisma from '@config/db'
import { getMinioClient, MINIO_BUCKET } from '@config/minio'
import { notDeleted, onlyDeleted } from '@config/soft-delete'
import { generateFileId } from '@utils/file-id-generator'
import { AppError } from '@middleware/error.middleware'
import { Readable } from 'stream'
import crypto from 'crypto'
import fs from 'fs'
import path from 'path'
import os from 'os'
import { execFile } from 'child_process'
import { promisify } from 'util'

const execFileAsync = promisify(execFile)

// Office MIME types supported for PDF conversion
const OFFICE_MIME_TYPES = [
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-powerpoint',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
]

function isOfficeDocument(mimeType: string): boolean {
  return OFFICE_MIME_TYPES.includes(mimeType.toLowerCase())
}

function getOfficeExtension(mimeType: string): string {
  const map: Record<string, string> = {
    'application/msword': '.doc',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document': '.docx',
    'application/vnd.ms-excel': '.xls',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': '.xlsx',
    'application/vnd.ms-powerpoint': '.ppt',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation': '.pptx',
  }
  return map[mimeType.toLowerCase()] || '.bin'
}

function generateVersionId(): string { return `fv_${crypto.randomBytes(8).toString('hex')}` }
function computeSha256(buffer: Buffer): string { return crypto.createHash('sha256').update(buffer).digest('hex') }

export interface UploadFileInput {
  buffer: Buffer
  originalname: string
  mimetype: string
  tenantId: string
  groupId?: string | null
  displayName?: string       // custom filename from user
  tags?: string[]
  description?: string
  uploadedBy?: string
}

export interface ListFilesInput {
  tenantId: string
  groupIds: string[]
  search?: string
  tags?: string[]
  mimeType?: string
  page?: number
  pageSize?: number
  sortBy?: 'filename' | 'size' | 'createdAt' | 'updatedAt'
  sortOrder?: 'asc' | 'desc'
}

class FileService {
  async uploadFile(input: UploadFileInput) {
    const fileId = generateFileId()
    const groupPrefix = input.groupId || '_'
    const finalFilename = input.displayName || input.originalname
    const objectKey = `${input.tenantId}/${groupPrefix}/${fileId}-${input.originalname}`
    const sha256 = computeSha256(input.buffer)

    // Upload to MinIO
    const mc = getMinioClient()
    await mc.putObject(MINIO_BUCKET, objectKey, Readable.from(input.buffer), input.buffer.length, {
      'Content-Type': input.mimetype,
    })

    // Create DB record with V1 version
    const result = await prisma.file.create({
      data: {
        fileId,
        tenantId: input.tenantId,
        groupId: input.groupId || null,
        bucket: MINIO_BUCKET,
        objectKey,
        filename: input.originalname,
        displayName: input.displayName || null,
        mimeType: input.mimetype,
        size: input.buffer.length,
        currentVersion: 1,
        tags: input.tags || [],
        description: input.description || null,
        sha256,
        uploadedBy: input.uploadedBy || null,
        versions: {
          create: {
            versionId: generateVersionId(),
            version: 1,
            objectKey,
            filename: input.originalname,
            mimeType: input.mimetype,
            size: input.buffer.length,
            uploadedBy: input.uploadedBy || null,
          },
        },
      },
      include: { versions: true },
    })
    return result
  }

  /** Get file with tenant isolation check */
  async getFile(fileId: string, tenantId?: string, isSuperAdmin?: boolean) {
    const file = await prisma.file.findUnique({
      where: { fileId },
      include: { versions: { orderBy: { version: 'desc' } } },
    })
    if (!file || file.deletedAt) throw new AppError(404, '文件不存在')
    // Tenant isolation
    if (!isSuperAdmin && tenantId && file.tenantId !== tenantId) {
      throw new AppError(404, '文件不存在')
    }
    return file
  }

  /** Get resolved display name (displayName || filename) */
  static displayName(file: { filename: string; displayName?: string | null }): string {
    return file.displayName || file.filename
  }

  /** Get presigned download URL for the latest version */
  async getDownloadUrl(fileId: string, tenantId?: string, isSuperAdmin?: boolean): Promise<string> {
    const file = await this.getFile(fileId, tenantId, isSuperAdmin)
    const latestVersion = file.versions[0]
    const objectKey = latestVersion?.objectKey || file.objectKey
    return getMinioClient().presignedGetObject(file.bucket, objectKey, 60 * 60)
  }

  /** Get presigned download URL for a specific version */
  async getVersionDownloadUrl(fileId: string, version: number, tenantId?: string, isSuperAdmin?: boolean): Promise<string> {
    const file = await this.getFile(fileId, tenantId, isSuperAdmin)
    const v = await prisma.fileVersion.findFirst({
      where: { fileId, version },
    })
    if (!v) throw new AppError(404, `版本 V${version} 不存在`)
    return getMinioClient().presignedGetObject(file.bucket, v.objectKey, 60 * 60)
  }

  /** Get file content stream + metadata (for authenticated proxy) */
  async getFileContent(fileId: string, tenantId?: string, isSuperAdmin?: boolean) {
    const file = await this.getFile(fileId, tenantId, isSuperAdmin)
    const latestVersion = file.versions[0]
    const objectKey = latestVersion?.objectKey || file.objectKey
    const stream = await getMinioClient().getObject(file.bucket, objectKey)
    return {
      stream: stream as Readable,
      mimeType: file.mimeType,
      filename: FileService.displayName(file),
      size: file.size,
      sha256: file.sha256,
      updatedAt: file.updatedAt,
      bucket: file.bucket,
      objectKey,
    }
  }

  /** Convert an office document to PDF via LibreOffice, return stream + metadata */
  async convertToPdf(fileId: string, tenantId?: string, isSuperAdmin?: boolean) {
    const file = await this.getFile(fileId, tenantId, isSuperAdmin)

    if (!isOfficeDocument(file.mimeType)) {
      throw new AppError(400, '此文件类型不支持 PDF 转换')
    }

    const latestVersion = file.versions[0]
    const sourceKey = latestVersion?.objectKey || file.objectKey
    const cachedPdfKey = `${file.tenantId}/_converted/${fileId}.pdf`

    // Check if we already have a cached converted PDF
    const mc = getMinioClient()
    try {
      const cachedStream = await mc.getObject(file.bucket, cachedPdfKey)
      // Return cached PDF — collect to check it's valid
      const chunks: Buffer[] = []
      for await (const chunk of cachedStream) { chunks.push(chunk) }
      const buffer = Buffer.concat(chunks)
      if (buffer.length > 0) {
        return {
          stream: Readable.from(buffer),
          mimeType: 'application/pdf' as const,
          filename: `${FileService.displayName(file)}.pdf`,
          size: buffer.length,
          cached: true,
        }
      }
    } catch {
      // No cached copy — proceed with conversion
    }

    // Download source file from MinIO
    const objStream = await mc.getObject(file.bucket, sourceKey)
    const chunks: Buffer[] = []
    for await (const chunk of objStream) { chunks.push(chunk) }
    const sourceBuffer = Buffer.concat(chunks)

    // Write to temp file for LibreOffice
    const ext = getOfficeExtension(file.mimeType)
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'office-convert-'))
    const inputPath = path.join(tmpDir, `input${ext}`)

    try {
      fs.writeFileSync(inputPath, sourceBuffer)

      // Convert via LibreOffice headless
      await execFileAsync('soffice', [
        '--headless',
        '--convert-to', 'pdf',
        '--outdir', tmpDir,
        inputPath,
      ], { timeout: 30000 })

      const pdfPath = path.join(tmpDir, 'input.pdf')
      if (!fs.existsSync(pdfPath)) {
        throw new AppError(500, 'PDF 转换失败：输出文件未生成，请确认服务器已安装 LibreOffice')
      }

      const pdfBuffer = fs.readFileSync(pdfPath)

      // Upload converted PDF to MinIO cache
      try {
        await mc.putObject(
          file.bucket,
          cachedPdfKey,
          Readable.from(pdfBuffer),
          pdfBuffer.length,
          { 'Content-Type': 'application/pdf' },
        )
      } catch (e) {
        // Cache upload failure is non-fatal — still return the result
        console.warn(`[ConvertToPdf] Failed to cache PDF for ${fileId}:`, (e as any)?.message)
      }

      return {
        stream: Readable.from(pdfBuffer),
        mimeType: 'application/pdf' as const,
        filename: `${FileService.displayName(file)}.pdf`,
        size: pdfBuffer.length,
        cached: false,
      }
    } finally {
      try { fs.rmSync(tmpDir, { recursive: true, force: true }) } catch { /* cleanup best-effort */ }
    }
  }

  /** Get thumbnail — resize images via sharp; return placeholder for non-images */
  async getThumbnail(fileId: string, width: number = 200, tenantId?: string, isSuperAdmin?: boolean) {
    const file = await this.getFile(fileId, tenantId, isSuperAdmin)
    const latestVersion = file.versions[0]
    const objectKey = latestVersion?.objectKey || file.objectKey
    const objStream = await getMinioClient().getObject(file.bucket, objectKey)

    // Collect chunks
    const chunks: Buffer[] = []
    for await (const chunk of objStream) { chunks.push(chunk) }
    const buffer = Buffer.concat(chunks)

    if (file.mimeType.startsWith('image/')) {
      try {
        const sharp = require('sharp')
        const resized = await sharp(buffer)
          .resize(width, undefined, { fit: 'inside', withoutEnlargement: true })
          .jpeg({ quality: 75 })
          .toBuffer()
        return { buffer: resized, mimeType: 'image/jpeg' }
      } catch {
        // sharp not installed or processing failed — fall through to raw
      }
    }
    // Non-image: return first 4KB as "preview" placeholder
    return { buffer: buffer.slice(0, 4096), mimeType: file.mimeType }
  }

  /** Upload a new version of an existing file */
  async uploadNewVersion(fileId: string, input: { buffer: Buffer; originalname: string; mimetype: string; displayName?: string; uploadedBy?: string }, tenantId?: string, isSuperAdmin?: boolean) {
    const file = await this.getFile(fileId, tenantId, isSuperAdmin)

    const newVersion = file.currentVersion + 1
    const groupPrefix = file.groupId || '_'
    const objectKey = `${file.tenantId}/${groupPrefix}/${fileId}/v${newVersion}-${input.originalname}`
    const sha256 = computeSha256(input.buffer)

    // Upload to MinIO
    const mc = getMinioClient()
    await mc.putObject(MINIO_BUCKET, objectKey, Readable.from(input.buffer), input.buffer.length, {
      'Content-Type': input.mimetype,
    })

    return prisma.file.update({
      where: { fileId },
      data: {
        currentVersion: newVersion,
        objectKey,
        filename: input.originalname,
        displayName: input.displayName || null,
        mimeType: input.mimetype,
        size: input.buffer.length,
        sha256,
        versions: {
          create: {
            versionId: generateVersionId(),
            version: newVersion,
            objectKey,
            filename: input.originalname,
            mimeType: input.mimetype,
            size: input.buffer.length,
            uploadedBy: input.uploadedBy || null,
          },
        },
      },
      include: { versions: { orderBy: { version: 'desc' } } },
    })
  }

  /** List all versions for a file */
  async listVersions(fileId: string, tenantId?: string, isSuperAdmin?: boolean) {
    await this.getFile(fileId, tenantId, isSuperAdmin)
    return prisma.fileVersion.findMany({
      where: { fileId },
      orderBy: { version: 'desc' },
    })
  }

  /** Check if any DynamicRecord references this file in attachment fields */
  async checkFileReferences(fileId: string): Promise<{ referenced: boolean; count: number }> {
    const rows: any[] = await prisma.$queryRaw`
      SELECT "recordId" FROM "dynamic_record"
      WHERE "deletedAt" IS NULL
      AND "data"::text LIKE ${`%${fileId}%`}
      LIMIT 1
    `
    return { referenced: rows.length > 0, count: rows.length }
  }

  /** Soft-delete a file (move to trash) */
  async deleteFile(fileId: string, tenantId?: string, isSuperAdmin?: boolean) {
    const file = await this.getFile(fileId, tenantId, isSuperAdmin)
    return prisma.file.update({
      where: { fileId },
      data: { deletedAt: new Date() },
    })
  }

  async listFiles(input: ListFilesInput) {
    const page = input.page || 1
    const pageSize = input.pageSize || 20
    const skip = (page - 1) * pageSize

    const where: any = {
      tenantId: input.tenantId,
      ...notDeleted,
    }

    if (input.groupIds.length > 0) {
      where.groupId = { in: input.groupIds }
    }

    if (input.search) {
      where.filename = { contains: input.search, mode: 'insensitive' }
    }

    if (input.mimeType) {
      where.mimeType = { startsWith: input.mimeType }
    }

    if (input.tags && input.tags.length > 0) {
      where.AND = input.tags.map((tag) => ({
        tags: { array_contains: [tag] },
      }))
    }

    const sortBy = input.sortBy || 'createdAt'
    const sortOrder = input.sortOrder || 'desc'

    const [items, total] = await Promise.all([
      prisma.file.findMany({
        where,
        orderBy: { [sortBy]: sortOrder },
        skip,
        take: pageSize,
      }),
      prisma.file.count({ where }),
    ])

    return { items, total, page, pageSize, totalPages: Math.ceil(total / pageSize) }
  }

  /** Rename a file (set displayName) */
  async renameFile(fileId: string, newName: string, tenantId?: string, isSuperAdmin?: boolean) {
    await this.getFile(fileId, tenantId, isSuperAdmin)
    return prisma.file.update({
      where: { fileId },
      data: { displayName: newName },
    })
  }

  /** Update file metadata (tags, description, filename/displayName) */
  async updateFile(fileId: string, data: { tags?: string[]; description?: string; filename?: string }, tenantId?: string, isSuperAdmin?: boolean) {
    await this.getFile(fileId, tenantId, isSuperAdmin)
    return prisma.file.update({
      where: { fileId },
      data: {
        tags: data.tags !== undefined ? data.tags : undefined,
        description: data.description !== undefined ? data.description : undefined,
        displayName: data.filename !== undefined ? data.filename : undefined,
      },
    })
  }

  /** Get all unique tags for a tenant */
  async getTags(tenantId: string, groupIds: string[]) {
    const files = await prisma.file.findMany({
      where: {
        tenantId,
        ...notDeleted,
        ...(groupIds.length > 0 ? { groupId: { in: groupIds } } : {}),
      },
      select: { tags: true },
    })
    const tagSet = new Set<string>()
    for (const f of files) {
      for (const t of (f.tags as string[]) || []) tagSet.add(t)
    }
    return Array.from(tagSet).sort()
  }

  /** Check SHA256 duplicate within tenant */
  async checkDuplicate(tenantId: string, sha256: string) {
    const existing = await prisma.file.findFirst({
      where: { tenantId, sha256, ...notDeleted },
      select: { fileId: true, filename: true, displayName: true },
    })
    return existing || null
  }

  // ========== Trash / Recycle Bin ==========

  /** List soft-deleted files (trash) */
  async listTrash(input: ListFilesInput) {
    const page = input.page || 1
    const pageSize = input.pageSize || 20
    const skip = (page - 1) * pageSize

    const where: any = {
      tenantId: input.tenantId,
      ...onlyDeleted,
    }

    if (input.groupIds.length > 0) {
      where.groupId = { in: input.groupIds }
    }

    if (input.search) {
      where.filename = { contains: input.search, mode: 'insensitive' }
    }

    if (input.mimeType) {
      where.mimeType = { startsWith: input.mimeType }
    }

    if (input.tags && input.tags.length > 0) {
      where.AND = input.tags.map((tag) => ({
        tags: { array_contains: [tag] },
      }))
    }

    const sortBy = input.sortBy || 'deletedAt'
    const sortOrder = input.sortOrder || 'desc'

    const [items, total] = await Promise.all([
      prisma.file.findMany({
        where,
        orderBy: { [sortBy]: sortOrder },
        skip,
        take: pageSize,
      }),
      prisma.file.count({ where }),
    ])

    return { items, total, page, pageSize, totalPages: Math.ceil(total / pageSize) }
  }

  /** Restore a single file from trash */
  async restoreFile(fileId: string, tenantId?: string, isSuperAdmin?: boolean) {
    const file = await prisma.file.findUnique({ where: { fileId } })
    if (!file) throw new AppError(404, '文件不存在')
    if (!isSuperAdmin && tenantId && file.tenantId !== tenantId) throw new AppError(404, '文件不存在')
    if (!file.deletedAt) throw new AppError(400, '文件不在回收站中')

    return prisma.file.update({
      where: { fileId },
      data: { deletedAt: null },
    })
  }

  /** Permanently delete a file */
  async permanentDeleteFile(fileId: string, tenantId?: string, isSuperAdmin?: boolean) {
    const file = await prisma.file.findUnique({
      where: { fileId },
      include: { versions: { select: { objectKey: true } } },
    })
    if (!file) throw new AppError(404, '文件不存在')
    if (!isSuperAdmin && tenantId && file.tenantId !== tenantId) throw new AppError(404, '文件不存在')
    if (!file.deletedAt) throw new AppError(400, '文件不在回收站中，请先移入回收站')

    const mc = getMinioClient()
    for (const v of file.versions) {
      try { await mc.removeObject(file.bucket, v.objectKey) } catch { /* ignore */ }
    }
    try { await mc.removeObject(file.bucket, file.objectKey) } catch { /* ignore */ }

    return prisma.file.delete({ where: { fileId } })
  }

  /** Batch restore files from trash */
  async batchRestoreFiles(fileIds: string[], tenantId?: string, isSuperAdmin?: boolean) {
    const results = { restored: 0, failed: 0, errors: [] as string[] }
    for (const fileId of fileIds) {
      try {
        await this.restoreFile(fileId, tenantId, isSuperAdmin)
        results.restored++
      } catch (e: any) {
        results.failed++
        results.errors.push(`${fileId}: ${e.message}`)
      }
    }
    return results
  }

  /** Batch permanent-delete files from trash */
  async batchPermanentDelete(fileIds: string[], tenantId?: string, isSuperAdmin?: boolean) {
    const results = { deleted: 0, failed: 0, errors: [] as string[] }
    for (const fileId of fileIds) {
      try {
        await this.permanentDeleteFile(fileId, tenantId, isSuperAdmin)
        results.deleted++
      } catch (e: any) {
        results.failed++
        results.errors.push(`${fileId}: ${e.message}`)
      }
    }
    return results
  }

  /** Empty entire trash for a tenant */
  async emptyTrash(tenantId: string) {
    const files = await prisma.file.findMany({
      where: { tenantId, ...onlyDeleted },
      include: { versions: { select: { objectKey: true } } },
    })
    const mc = getMinioClient()

    // Process in parallel batches for performance
    const BATCH_SIZE = 10
    for (let i = 0; i < files.length; i += BATCH_SIZE) {
      const batch = files.slice(i, i + BATCH_SIZE)
      await Promise.allSettled(batch.map(async (file) => {
        for (const v of file.versions) {
          try { await mc.removeObject(file.bucket, v.objectKey) } catch { /* ignore */ }
        }
        try { await mc.removeObject(file.bucket, file.objectKey) } catch { /* ignore */ }
      }))
    }

    // Delete all DB records in one shot
    await prisma.file.deleteMany({
      where: { fileId: { in: files.map(f => f.fileId) } },
    })

    return { deleted: files.length, total: files.length }
  }
}

export const fileService = new FileService()
