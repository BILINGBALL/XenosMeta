import { Request, Response, NextFunction } from 'express'
import { Prisma } from '@prisma/client'
import { fail } from '@utils/response'
import { logger } from '@common/logger'

/**
 * 业务异常类 — 在 Service 层抛出，全局 errorHandler 统一捕获
 */
export class AppError extends Error {
    public readonly statusCode: number
    public readonly code: number

    constructor(statusCode: number, message: string, code?: number) {
        super(message)
        this.name = 'AppError'
        this.statusCode = statusCode
        this.code = code || statusCode
    }
}

/**
 * 全局错误处理中间件
 * - AppError → 按指定状态码返回
 * - Prisma 已知错误 (P2002唯一冲突等) → 400/409
 * - 其他 Error → 500 内部错误
 */
export const errorHandler = (
    err: Error,
    _req: Request,
    res: Response,
    _next: NextFunction
) => {
    if (err instanceof AppError) {
        return res.status(err.statusCode).json(fail(err.message, err.code))
    }

    // Prisma 已知错误码处理
    if (err instanceof Prisma.PrismaClientKnownRequestError) {
        switch (err.code) {
            case 'P2002': // 唯一约束冲突
                const target = (err.meta?.target as string[])?.join(', ') || '字段'
                return res.status(409).json(fail(`${target} 已存在，不能重复`))
            case 'P2025': // 记录不存在
                return res.status(404).json(fail('资源不存在'))
            default:
                logger.error({ err }, '[Prisma Error]')
                return res.status(500).json(fail('服务器内部错误', 500))
        }
    }

    logger.error({ err }, '[Unhandled Error]')
    return res.status(500).json(fail('服务器内部错误', 500))
}
