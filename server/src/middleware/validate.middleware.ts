import { Request, Response, NextFunction } from 'express'
import { ZodSchema } from 'zod'
import { fail } from '@utils/response'

/**
 * 请求体验证中间件
 * 使用 Zod schema 校验 req.body，自动替换为清洗后的数据
 */
export const validate = (schema: ZodSchema) => {
    return (req: Request, res: Response, next: NextFunction) => {
        const result = schema.safeParse(req.body)
        if (!result.success) {
            const message = result.error.errors
                .map(e => `${e.path.join('.')}: ${e.message}`)
                .join('; ')
            return res.status(400).json(fail(message, 400))
        }
        req.body = result.data
        next()
    }
}
