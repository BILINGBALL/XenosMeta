import { Client } from 'minio'

const MINIO_ENDPOINT = process.env.MINIO_ENDPOINT || 'localhost'
const MINIO_PORT = parseInt(process.env.MINIO_PORT || '9000', 10)
const MINIO_ACCESS_KEY = process.env.MINIO_ACCESS_KEY || 'minioadmin'
const MINIO_SECRET_KEY = process.env.MINIO_SECRET_KEY || 'minioadmin'
export const MINIO_BUCKET = process.env.MINIO_BUCKET || 'auth-core-files'

export const minioClient = new Client({
  endPoint: MINIO_ENDPOINT,
  port: MINIO_PORT,
  useSSL: false,
  accessKey: MINIO_ACCESS_KEY,
  secretKey: MINIO_SECRET_KEY,
})

export async function ensureBucket(): Promise<void> {
  const exists = await minioClient.bucketExists(MINIO_BUCKET)
  if (!exists) {
    await minioClient.makeBucket(MINIO_BUCKET, '')
    console.log(`[MinIO] Bucket "${MINIO_BUCKET}" created`)
  }
}
