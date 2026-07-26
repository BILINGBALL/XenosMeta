import { Client } from 'minio'

const MINIO_ENDPOINT = process.env.MINIO_ENDPOINT || 'localhost'
const MINIO_PORT = parseInt(process.env.MINIO_PORT || '9000', 10)
const MINIO_ACCESS_KEY = process.env.MINIO_ACCESS_KEY || 'minioadmin'
const MINIO_SECRET_KEY = process.env.MINIO_SECRET_KEY || 'minioadmin'
export const MINIO_BUCKET = process.env.MINIO_BUCKET || 'auth-core-files'

let client: Client | null = null
let available = false

function getClient(): Client {
  if (!client) {
    client = new Client({
      endPoint: MINIO_ENDPOINT,
      port: MINIO_PORT,
      useSSL: false,
      accessKey: MINIO_ACCESS_KEY,
      secretKey: MINIO_SECRET_KEY,
    })
  }
  return client
}

export function isMinioAvailable(): boolean {
  return available
}

export function getMinioClient(): Client {
  if (!available) throw new Error('MinIO 存储服务不可用，请联系管理员')
  return getClient()
}

export async function ensureBucket(): Promise<void> {
  try {
    const c = getClient()
    const exists = await c.bucketExists(MINIO_BUCKET)
    if (!exists) {
      await c.makeBucket(MINIO_BUCKET, '')
      console.log(`[MinIO] Bucket "${MINIO_BUCKET}" created`)
    }
    available = true
    console.log(`[MinIO] Connected to ${MINIO_ENDPOINT}:${MINIO_PORT}, bucket "${MINIO_BUCKET}" ready`)
  } catch (e: any) {
    console.warn(`[MinIO] Not available at ${MINIO_ENDPOINT}:${MINIO_PORT} — ${e.message || e.code || 'connection failed'}. File upload disabled.`)
    available = false
  }
}
