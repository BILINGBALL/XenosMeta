import { Client } from 'minio'

const MINIO_ENDPOINT = process.env.MINIO_ENDPOINT || 'localhost'
const MINIO_PORT = parseInt(process.env.MINIO_PORT || '9000', 10)
const MINIO_USE_SSL = process.env.MINIO_USE_SSL === 'true' || process.env.MINIO_PORT === '443'
const MINIO_ACCESS_KEY = process.env.MINIO_ACCESS_KEY || 'minioadmin'
const MINIO_SECRET_KEY = process.env.MINIO_SECRET_KEY || 'minioadmin'
export const MINIO_BUCKET = process.env.MINIO_BUCKET || 'auth-core-files'
// 阿里云 OSS 等需要自定义 region 时使用
const MINIO_REGION = process.env.MINIO_REGION || ''

let client: Client | null = null
let available = false

function getClient(): Client {
  if (!client) {
    client = new Client({
      endPoint: MINIO_ENDPOINT,
      port: MINIO_PORT,
      useSSL: MINIO_USE_SSL,
      accessKey: MINIO_ACCESS_KEY,
      secretKey: MINIO_SECRET_KEY,
      // 阿里云 OSS 等 S3 兼容服务可能需要指定 region
      ...(MINIO_REGION ? { region: MINIO_REGION } : {}),
    })
  }
  return client
}

export function isMinioAvailable(): boolean {
  return available
}

export function getMinioClient(): Client {
  if (!available) throw new Error('OSS 存储服务不可用，请联系管理员')
  return getClient()
}

export async function ensureBucket(): Promise<void> {
  try {
    const c = getClient()
    const exists = await c.bucketExists(MINIO_BUCKET)
    if (!exists) {
      // 阿里云 OSS 的 bucket 在控制台创建，不要在代码中创建
      console.warn(`[OSS] Bucket "${MINIO_BUCKET}" 不存在，请到 OSS 控制台创建`)
      available = false
      return
    }
    available = true
    console.log(`[OSS] Connected to ${MINIO_USE_SSL ? 'https' : 'http'}://${MINIO_ENDPOINT}:${MINIO_PORT}, bucket "${MINIO_BUCKET}" ready`)
  } catch (e: any) {
    console.warn(`[OSS] Not available at ${MINIO_ENDPOINT}:${MINIO_PORT} — ${e.message || e.code || 'connection failed'}. File upload disabled.`)
    available = false
  }
}
