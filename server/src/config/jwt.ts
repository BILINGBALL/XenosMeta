import jwt from 'jsonwebtoken'
import dotenv from 'dotenv'

dotenv.config()

const ACCESS_SECRET = process.env.JWT_ACCESS_SECRET as string
const REFRESH_SECRET = process.env.JWT_REFRESH_SECRET as string
const ACCESS_EXPIRES_IN = process.env.JWT_ACCESS_EXPIRES || '15m'
const REFRESH_EXPIRES_IN = process.env.JWT_REFRESH_EXPIRES || '7d'

// 生成 Access Token（短期，用于 API 请求）
export const generateAccessToken = (payload: Record<string, any>) => {
    return jwt.sign(payload, ACCESS_SECRET, { expiresIn: ACCESS_EXPIRES_IN as any })
}

// 生成 Refresh Token（长期，用于刷新 access token）
export const generateRefreshToken = (payload: Record<string, any>) => {
    return jwt.sign(payload, REFRESH_SECRET, { expiresIn: REFRESH_EXPIRES_IN as any })
}

// 验证 Access Token
export const verifyAccessToken = (token: string) => {
    return jwt.verify(token, ACCESS_SECRET)
}

// 验证 Refresh Token
export const verifyRefreshToken = (token: string) => {
    return jwt.verify(token, REFRESH_SECRET)
}

// 兼容旧版调用（authMiddleware 使用）
export const verifyToken = verifyAccessToken

// 兼容旧版调用（login 使用，现在返回 access + refresh 两个 token）
export const generateToken = (payload: Record<string, any>) => {
    return {
        accessToken: generateAccessToken(payload),
        refreshToken: generateRefreshToken(payload),
        expiresIn: ACCESS_EXPIRES_IN,
    }
}
