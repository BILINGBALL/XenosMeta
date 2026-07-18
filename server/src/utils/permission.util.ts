import prisma from '@config/db'
import { notDeleted } from '@config/soft-delete'
import redis from '@common/redis'

const PERM_CACHE_PREFIX = 'user:permissions:'
const PERM_CACHE_TTL = 600 // 10分钟

/**
 * 从数据库获取用户的所有权限代码（一次 JOIN 查询）
 */
async function fetchUserPermissionsFromDB(userId: string): Promise<string[]> {
    const userWithRoles = await prisma.user.findUnique({
        where: { id: userId },
        include: {
            roles: {
                include: {
                    role: {
                        include: {
                            permissions: {
                                include: {
                                    permission: {
                                        select: { permCode: true },
                                    },
                                },
                            },
                        },
                    },
                },
            },
        },
    })

    if (!userWithRoles) return []

    const permCodes = new Set<string>()
    for (const userRole of userWithRoles.roles) {
        for (const rp of userRole.role.permissions) {
            permCodes.add(rp.permission.permCode)
        }
    }

    return Array.from(permCodes)
}

/**
 * 检查用户是否为超级管理员
 */
async function checkIsSuperAdmin(userId: string): Promise<boolean> {
    const superAdminRole = await prisma.userRole.findFirst({
        where: {
            userId,
            role: { roleCode: 'system_admin' },
        },
    })
    return !!superAdminRole
}

/**
 * 获取用户权限列表（优先从 Redis 缓存读取）
 */
export async function getUserPermissions(userId: string): Promise<{
    permissions: string[]
    isSuperAdmin: boolean
}> {
    const cacheKey = `${PERM_CACHE_PREFIX}${userId}`

    // 1. 尝试从缓存读取
    const cached = await redis.get(cacheKey)
    if (cached) {
        const parsed = JSON.parse(cached)
        return parsed
    }

    // 2. 缓存未命中，从数据库加载
    const [permissions, isSuperAdmin] = await Promise.all([
        fetchUserPermissionsFromDB(userId),
        checkIsSuperAdmin(userId),
    ])

    const result = { permissions, isSuperAdmin }

    // 3. 写入缓存
    await redis.set(cacheKey, JSON.stringify(result), 'EX', PERM_CACHE_TTL)

    return result
}

/**
 * 清除用户权限缓存（角色变更时调用）
 */
export async function clearUserPermissionsCache(userId: string): Promise<void> {
    const cacheKey = `${PERM_CACHE_PREFIX}${userId}`
    await redis.del(cacheKey)
}
