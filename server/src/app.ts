import express from 'express'
import cors from 'cors'
import dotenv from 'dotenv'
import router from '@routes/index'
import { errorHandler } from './middleware/error.middleware'
import { logger } from '@common/logger'
import { cleanupExpiredDeleted } from '@common/cleanup'


dotenv.config()
const app = express()
const PORT = process.env.PORT || 3000
const CLEANUP_RETENTION_DAYS = Number(process.env.CLEANUP_RETENTION_DAYS) || 90
const CLEANUP_INTERVAL_MS = 24 * 60 * 60 * 1000 // 每天一次

app.use(cors({
    origin: [
        'http://localhost:3000',
        'http://192.168.1.23:3000',
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

app.listen(PORT, () => {
    logger.info(`Server started: http://localhost:${PORT}`)
    // 软删除自动清理（暂不激活）
    // logger.info({ retentionDays: CLEANUP_RETENTION_DAYS }, '软删除清理已启用')
    // scheduleCleanup()
})