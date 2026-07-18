import { z } from 'zod'

/** 分页查询参数验证 — 用于 query string */
export const paginationSchema = z.object({
    page: z.coerce.number().int().min(1).default(1),
    pageSize: z.coerce.number().int().min(1).max(100).default(20),
})
