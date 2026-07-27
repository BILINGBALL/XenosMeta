import express from 'express'
import cors from 'cors'
import dotenv from 'dotenv'
import http from 'http'
import { WebSocketServer } from 'ws'
import router from '@routes/index'
import { errorHandler } from './middleware/error.middleware'
import { logger } from '@common/logger'
import { ensureBucket } from '@config/minio'
import { cleanupExpiredDeleted } from '@common/cleanup'
import { handleAsrConnection } from '@modules/agent/agent.asr'
import { verifyToken } from '@config/jwt'


dotenv.config()
const app = express()
const PORT = process.env.PORT || 3000
const CLEANUP_RETENTION_DAYS = Number(process.env.CLEANUP_RETENTION_DAYS) || 90
const CLEANUP_INTERVAL_MS = 24 * 60 * 60 * 1000 // 每天一次

app.use(cors({
    origin: [
        'http://localhost:3000',
        'http://192.168.1.23:3000',
        'https://www.oxth.com',
        process.env.CORS_ORIGIN || '',
    ].filter(Boolean),
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
    allowedHeaders: ['Content-Type', 'Authorization'],
}))
app.use(express.json())


// 全局前缀 /api
app.use('/api', router)

// 全局错误处理（必须在路由之后）
app.use(errorHandler)


// 定期清理过期软删除数据
function scheduleCleanup() {
    // 启动后延迟 60 秒首次执行（等所有服务就绪）
    setTimeout(async () => {
        try { await cleanupExpiredDeleted(CLEANUP_RETENTION_DAYS) } catch { /* 已内部 catch */ }
    }, 60_000)

    // 后续每 24 小时执行
    setInterval(async () => {
        try { await cleanupExpiredDeleted(CLEANUP_RETENTION_DAYS) } catch { /* 已内部 catch */ }
    }, CLEANUP_INTERVAL_MS)
}

// 创建 HTTP 服务器（用于 WebSocket 升级）
const server = http.createServer(app)

// WebSocket 服务：语音识别代理
const wss = new WebSocketServer({ noServer: true })

server.on('upgrade', (request, socket, head) => {
    const url = request.url || ''

    // ASR 语音识别 WebSocket
    if (url.startsWith('/api/agent/asr')) {
        // 简单鉴权：从 query 参数取 token（WebSocket 无法自定义 header）
        const tokenMatch = url.match(/[?&]token=([^&]+)/)
        const token = tokenMatch ? decodeURIComponent(tokenMatch[1]) : null

        if (!token) {
            socket.write('HTTP/1.1 401 Unauthorized\r\n\r\n')
            socket.destroy()
            return
        }

        try {
            const decoded = verifyToken(token)
            const userId = (decoded as any).id

            wss.handleUpgrade(request, socket, head, (ws) => {
                handleAsrConnection(ws, userId)
            })
        } catch {
            socket.write('HTTP/1.1 401 Unauthorized\r\n\r\n')
            socket.destroy()
        }
        return
    }

    // 其他路径拒绝
    socket.write('HTTP/1.1 404 Not Found\r\n\r\n')
    socket.destroy()
})

server.listen(PORT, () => {
    logger.info(`Server started: http://localhost:${PORT}`)
    // Initialize MinIO bucket (non-blocking with timeout)
    const timeout = new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 5000))
    Promise.race([ensureBucket(), timeout])
      .then(() => logger.info('MinIO bucket ready'))
      .catch(() => logger.warn('MinIO not available — file upload disabled'))
    // 软删除自动清理（暂不激活）
    // logger.info({ retentionDays: CLEANUP_RETENTION_DAYS }, '软删除清理已启用')
    // scheduleCleanup()
})