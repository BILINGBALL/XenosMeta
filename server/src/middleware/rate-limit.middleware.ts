import rateLimit from 'express-rate-limit'

/**
 * 登录接口速率限制
 * 15分钟内最多 10 次尝试，防止暴力破解
 */
export const loginLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15分钟
    max: 100,
    message: {
        code: 429,
        message: '登录尝试过于频繁，请15分钟后再试',
        data: null,
        success: false,
    },
    standardHeaders: true,
    legacyHeaders: false,
})

/**
 * 全局 API 速率限制（可选，较宽松）
 * 每分钟 100 次请求
 */
export const globalLimiter = rateLimit({
    windowMs: 60 * 1000,
    max: 100,
    message: {
        code: 429,
        message: '请求过于频繁，请稍后再试',
        data: null,
        success: false,
    },
    standardHeaders: true,
    legacyHeaders: false,
})
