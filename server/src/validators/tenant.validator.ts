import { z } from 'zod'

export const createTenantSchema = z.object({
    tenantName: z.string().min(1, '租户名称不能为空').max(100),
    tenantCode: z.string().min(1, '租户代码不能为空').max(50),
    scope: z.enum(['system', 'tenant', 'experience']).optional(),
    status: z.boolean().optional(),
})

export const updateTenantSchema = z.object({
    tenantName: z.string().min(1).max(100).optional(),
    status: z.boolean().optional(),
    adminId: z.string().min(1).optional(),
})
