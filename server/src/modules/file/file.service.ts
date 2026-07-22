import prisma from '@config/db'
import { minioClient, MINIO_BUCKET } from '@config/minio'
import { notDeleted } from '@config/soft-delete'
import { generateFileId } from '@utils/file-id-generator'
import { AppError } from '@middleware/error.middleware'
import { Readable } from 'stream'

export interface UploadFileInput {
  buffer: Buffer
  originalname: string
  mimetype: string
  tenantId: string
  groupId?: string | null
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
}

class FileService {
  async uploadFile(input: UploadFileInput) {
    const fileId = generateFileId()
    const groupPrefix = input.groupId || '_'
    const objectKey = `${input.tenantId}/${groupPrefix}/${fileId}-${input.originalname}`

    // Upload to MinIO
    await minioClient.putObject(MINIO_BUCKET, objectKey, Readable.from(input.buffer), input.buffer.length, {
      'Content-Type': input.mimetype,
    })

    // Create DB record
    return prisma.file.create({
      data: {
        fileId,
        tenantId: input.tenantId,
        groupId: input.groupId || null,
        bucket: MINIO_BUCKET,
        objectKey,
        filename: input.originalname,
        mimeType: input.mimetype,
        size: input.buffer.length,
        tags: input.tags || [],
        description: input.description || null,
        uploadedBy: input.uploadedBy || null,
      },
    })
  }

  async getFile(fileId: string) {
    const file = await prisma.file.findUnique({ where: { fileId } })
    if (!file || file.deletedAt) throw new AppError(404, '文件不存在')
    return file
  }

  async getDownloadUrl(fileId: string): Promise<string> {
    const file = await this.getFile(fileId)
    return minioClient.presignedGetObject(file.bucket, file.objectKey, 60 * 60) // 1 hour
  }

  async getFileStream(fileId: string) {
    const file = await this.getFile(fileId)
    return minioClient.getObject(file.bucket, file.objectKey)
  }

  async deleteFile(fileId: string) {
    const file = await this.getFile(fileId)
    // Soft delete — keep MinIO object for existing references
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

    // Group isolation
    if (input.groupIds.length > 0) {
      where.groupId = { in: input.groupIds }
    }

    // Search by filename
    if (input.search) {
      where.filename = { contains: input.search, mode: 'insensitive' }
    }

    // Filter by mimeType prefix (e.g., "image/")
    if (input.mimeType) {
      where.mimeType = { startsWith: input.mimeType }
    }

    // Filter by tags (file must have ALL specified tags)
    if (input.tags && input.tags.length > 0) {
      where.AND = input.tags.map((tag) => ({
        tags: { array_contains: [tag] },
      }))
    }

    const [items, total] = await Promise.all([
      prisma.file.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: pageSize,
      }),
      prisma.file.count({ where }),
    ])

    return { items, total, page, pageSize, totalPages: Math.ceil(total / pageSize) }
  }

  async updateFile(fileId: string, data: { tags?: string[]; description?: string }) {
    const file = await this.getFile(fileId)
    return prisma.file.update({
      where: { fileId },
      data: {
        tags: data.tags !== undefined ? data.tags : undefined,
        description: data.description !== undefined ? data.description : undefined,
      },
    })
  }

  /** Get all unique tags for a tenant (for filter chips) */
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
}

export const fileService = new FileService()
