import { z } from 'zod'

export const createRoleSchema = z.object({
    roleName: z.string().min(1, '角色名称不能为空').max(50),
    roleCode: z.string().min(1, '角色代码不能为空').max(50),
    description: z.string().max(500).optional(),
    scope: z.enum(['system', 'shared', 'tenant']).optional(),
    status: z.boolean().optional(),
})

export const updateRoleSchema = z.object({
    roleName: z.string().min(1).max(50).optional(),
    description: z.string().max(500).nullable().optional(),
    scope: z.enum(['system', 'shared', 'tenant']).optional(),
    status: z.boolean().optional(),
})

export const assignPermissionsSchema = z.object({
    permissionIds: z.array(z.string()).min(0),
})
