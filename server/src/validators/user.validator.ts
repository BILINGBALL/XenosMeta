import { z } from 'zod'

export const registerSchema = z.object({
    username: z.string().min(3, '用户名至少3个字符').max(50, '用户名最多50个字符'),
    password: z.string().min(8, '密码至少8个字符'),
    nickname: z.string().max(50).optional(),
    avatar: z.string().url('头像必须为有效URL').optional().or(z.literal('')),
    email: z.string().email('邮箱格式不正确').optional().or(z.literal('')),
    phone: z.string().max(20).optional(),
    profile: z.record(z.any()).optional(),
    tenantId: z.string().min(1, '租户ID不能为空').optional(),
})

export const loginSchema = z.object({
    username: z.string().min(1, '账号不能为空'),
    password: z.string().min(1, '密码不能为空'),
})

export const updateUserSchema = z.object({
    nickname: z.string().max(50).optional(),
    avatar: z.string().url('头像必须为有效URL').optional().or(z.literal('')),
    email: z.string().email('邮箱格式不正确').optional().or(z.literal('')),
    phone: z.string().max(20).optional(),
    status: z.boolean().optional(),
    profile: z.record(z.any()).optional(),
    tenantId: z.string().min(1).optional(),
})

export const assignGroupSchema = z.object({
    groupId: z.string().min(1, '群组ID不能为空'),
})

export const refreshTokenSchema = z.object({
    refreshToken: z.string().min(1, 'refreshToken 不能为空'),
})
