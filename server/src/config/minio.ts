/**
 * OSS 存储配置 — 阿里云 OSS (ali-oss SDK)
 *
 * 兼容层：对外暴露与 minio 相同的 API 签名，file.service.ts 无需修改。
 *
 * .env 配置项：
 *   OSS_ENDPOINT       — OSS endpoint，例如 oss-cn-hangzhou.aliyuncs.com
 *   OSS_REGION         — OSS region，例如 oss-cn-hangzhou
 *   OSS_ACCESS_KEY     — RAM AccessKeyId
 *   OSS_ACCESS_SECRET  — RAM AccessKeySecret
 *   OSS_BUCKET         — Bucket 名称
 *   OSS_INTERNAL       — 是否使用内网 endpoint（ECS 同 region 免流量），默认 false
 *   OSS_SECURE         — 是否 HTTPS，默认 true
 */

import OSS from 'ali-oss'
import { Readable } from 'stream'

// ---- 环境变量读取 ----
const OSS_REGION = process.env.OSS_REGION || process.env.MINIO_REGION || 'oss-cn-hangzhou'
const OSS_ACCESS_KEY = process.env.OSS_ACCESS_KEY || process.env.MINIO_ACCESS_KEY || ''
const OSS_ACCESS_SECRET = process.env.OSS_ACCESS_SECRET || process.env.MINIO_SECRET_KEY || ''
export const MINIO_BUCKET = process.env.OSS_BUCKET || process.env.MINIO_BUCKET || 'xenosmeta'
const OSS_INTERNAL = process.env.OSS_INTERNAL === 'true'
const OSS_SECURE = process.env.OSS_SECURE !== 'false'

let client: OSS | null = null
let available = false

function buildEndpoint(): string {
  if (OSS_INTERNAL) {
    return `${OSS_REGION}-internal.aliyuncs.com`
  }
  return `${OSS_REGION}.aliyuncs.com`
}

function getClient(): OSS {
  if (!client) {
    client = new OSS({
      region: OSS_REGION,
      accessKeyId: OSS_ACCESS_KEY,
      accessKeySecret: OSS_ACCESS_SECRET,
      bucket: MINIO_BUCKET,
      secure: OSS_SECURE,
      timeout: 600000,
      // 内网 endpoint
      ...(OSS_INTERNAL ? { endpoint: buildEndpoint() } : {}),
    })
  }
  return client
}

export function isMinioAvailable(): boolean {
  return available
}

/**
 * 兼容层 — 模拟 minio.Client 接口
 * file.service.ts 调用的方法都在这里桥接到 ali-oss
 */
class OssCompatClient {
  private oss: OSS

  constructor(oss: OSS) {
    this.oss = oss
  }

  /** minio.putObject → oss.put */
  async putObject(bucket: string, objectName: string, stream: Readable, size?: number, metadata?: Record<string, string>) {
    const buffers: Buffer[] = []
    for await (const chunk of stream) { buffers.push(chunk) }
    const buffer = Buffer.concat(buffers)

    const headers: Record<string, string> = {}
    if (metadata?.['Content-Type']) {
      headers['Content-Type'] = metadata['Content-Type']
    }

    return this.oss.put(objectName, buffer, { headers }) as any
  }

  /** minio.getObject → oss.getStream (真流式，避免大文件全量读入内存) */
  async getObject(bucket: string, objectName: string): Promise<Readable> {
    const result = await this.oss.getStream(objectName)
    return result.stream as Readable
  }

  /** minio.getPartialObject → oss.getStream + Range header (支持 PDF.js 分块请求) */
  async getPartialObject(bucket: string, objectName: string, start: number, length: number): Promise<Readable> {
    const end = start + length - 1
    const result = await this.oss.getStream(objectName, {
      headers: { Range: `bytes=${start}-${end}` },
    })
    return result.stream as Readable
  }

  /** minio.removeObject → oss.delete */
  async removeObject(bucket: string, objectName: string) {
    await this.oss.delete(objectName)
  }

  /** minio.presignedGetObject → oss.signatureUrl */
  async presignedGetObject(bucket: string, objectName: string, expires: number): Promise<string> {
    return this.oss.signatureUrl(objectName, { expires })
  }

  /** minio.bucketExists → oss.getBucketInfo */
  async bucketExists(bucket: string): Promise<boolean> {
    try {
      await this.oss.getBucketInfo(bucket)
      return true
    } catch {
      return false
    }
  }
}

let compatClient: OssCompatClient | null = null

export function getMinioClient(): OssCompatClient {
  if (!available) throw new Error('OSS 存储服务不可用，请联系管理员')
  if (!compatClient) {
    compatClient = new OssCompatClient(getClient())
  }
  return compatClient
}

export async function ensureBucket(): Promise<void> {
  const displayEndpoint = buildEndpoint()
  try {
    const c = getClient()
    const info = await c.getBucketInfo(MINIO_BUCKET)
    available = true
    console.log(`[OSS] Connected to ${OSS_SECURE ? 'https' : 'http'}://${displayEndpoint}, bucket "${MINIO_BUCKET}" ready`)
  } catch (e: any) {
    const msg = e.message || e.code || 'connection failed'
    console.warn(`[OSS] Not available at ${displayEndpoint}:${OSS_SECURE ? 443 : 80} — ${msg}. File upload disabled.`)
    available = false
  }
}
