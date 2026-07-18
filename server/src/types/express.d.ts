// 扩展Request挂载用户信息
declare global {
    namespace Express {
        interface Request {
            user?: any
            // userId?: string
            tenantId?: string
            groupIds: string[]
        }
    }
}

export {};