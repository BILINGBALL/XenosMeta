import bcrypt from 'bcryptjs'
import prisma from '@config/db'
import { notDeleted } from '@config/soft-delete'
import {generateAccessToken, generateRefreshToken, verifyRefreshToken} from '@config/jwt'
import {Cacheable, CacheEvict} from "@cache/decorators";
import {CacheKeys, CacheTTL} from "@cache/keys";
import {AppError} from '@middleware/error.middleware';
import redis from '@common/redis';
import { clearUserPermissionsCache } from '@utils/permission.util';
import {paginate, PaginatedResult} from '@utils/pagination';

const REFRESH_TOKEN_PREFIX = 'refresh_token:'
const REFRESH_TOKEN_TTL = 7 * 24 * 60 * 60 // 7天（秒）

class UserService {
    // 注册业务
    @CacheEvict({
        keys: (data: any) => data.tenantId ? [CacheKeys.userList(data.tenantId)] : []
    })
    async registerUser(data: {
        username: string;
        password: string;
        nickname?: string;
        avatar?: string;
        email?: string;
        phone?: string;
        profile?: Record<string, any>;
        tenantId?: string
    }) {
        const {username, password, nickname, avatar, email, phone, profile, tenantId} = data

        if (!username || !password) {
            throw new AppError(400, '账号、密码不能为空')
        }

        // 如果传了 tenantId，校验租户存在
        if (tenantId) {
            const tenant = await prisma.tenant.findUnique({ where: { id: tenantId } })
            if (!tenant) {
                throw new AppError(404, '租户不存在')
            }
        }

        // 查重（username 的唯一性由部分唯一索引保证：WHERE deletedAt IS NULL）
        // 使用 findFirst 而非 findUnique，因为 @unique 已移除，唯一约束在数据库层由部分索引实现
        const existUser = await prisma.user.findFirst({where: {username, deletedAt: null}})
        if (existUser) {
            throw new AppError(409, '账号已存在')
        }

        // 密码加密
        const salt = await bcrypt.genSalt(10)
        const pwdHash = await bcrypt.hash(password, salt)

        // 创建用户
        const user = await prisma.user.create({
            data: {
                username,
                password: pwdHash,
                nickname,
                avatar: avatar || undefined,
                email: email || undefined,
                phone: phone || undefined,
                profile: profile ?? undefined,
                tenantId: tenantId || null,
                status: true
            },
            select: {id: true, username: true, nickname: true, avatar: true, email: true, phone: true, profile: true, tenantId: true, createdAt: true}
        })

        // 自动加入租户根群组
        if (tenantId) {
            try {
                const root = await prisma.group.findFirst({
                    where: { tenantId, groupCode: { startsWith: 'ROOT_' } },
                })
                if (root) {
                    await prisma.userGroup.create({ data: { userId: user.id, groupId: root.id } })
                }
            } catch { /* 非致命 */ }
        }

        return user
    }

    // 登录业务
    async loginUser(data: { username: string; password: string }) {
        const {username, password} = data

        if (!username || !password) {
            throw new AppError(400, '账号密码不能为空')
        }

        // 查询用户（username 的唯一性由部分唯一索引保证：WHERE deletedAt IS NULL）
        // 使用 findFirst 而非 findUnique，因为 @unique 已移除，唯一约束在数据库层由部分索引实现
        const user = await prisma.user.findFirst({where: {username, deletedAt: null}})
        if (!user || !user.status) {
            throw new AppError(401, '账号不存在或已禁用')
        }

        // 校验密码
        const isOk = await bcrypt.compare(password, user.password)
        if (!isOk) {
            throw new AppError(401, '密码错误')
        }

        const payload = {
            id: user.id,
            username: user.username,
            tenantId: user.tenantId ?? undefined,
        }

        // 生成 access + refresh token
        const accessToken = generateAccessToken(payload)
        const refreshToken = generateRefreshToken(payload)

        // 将 refresh token 存入 Redis（支持撤销）
        const refreshKey = `${REFRESH_TOKEN_PREFIX}${user.id}`
        await redis.set(refreshKey, refreshToken, 'EX', REFRESH_TOKEN_TTL)

        // 更新最后登录时间（异步，不阻塞登录返回）
        prisma.user.update({
            where: { id: user.id },
            data: { lastLoginAt: new Date() },
        }).catch(() => {})

        return {
            accessToken,
            refreshToken,
            expiresIn: '15m',
            id: user.id,
            username: user.username,
            nickname: user.nickname,
            avatar: user.avatar,
            email: user.email,
            phone: user.phone,
        }
    }

    /**
     * 刷新 Access Token
     * 使用有效的 refresh token 换取新的 access token
     */
    async refreshAccessToken(refreshToken: string) {
        if (!refreshToken) {
            throw new AppError(400, 'refreshToken 不能为空')
        }

        // 验证 refresh token 签名
        let decoded: any
        try {
            decoded = verifyRefreshToken(refreshToken)
        } catch {
            throw new AppError(401, 'refreshToken 无效或已过期，请重新登录')
        }

        // 检查 Redis 中是否存在（未被撤销）
        const refreshKey = `${REFRESH_TOKEN_PREFIX}${decoded.id}`
        const storedToken = await redis.get(refreshKey)
        if (!storedToken || storedToken !== refreshToken) {
            throw new AppError(401, 'refreshToken 已被撤销，请重新登录')
        }

        // 签发新的 access token
        const accessToken = generateAccessToken({
            id: decoded.id,
            username: decoded.username,
            tenantId: decoded.tenantId ?? undefined,
        })

        return {
            accessToken,
            expiresIn: '15m',
        }
    }

    /**
     * 用户登出 — 撤销 refresh token
     */
    async logoutUser(userId: string) {
        if (!userId) {
            throw new AppError(400, '用户ID不能为空')
        }

        // 删除 Redis 中的 refresh token
        const refreshKey = `${REFRESH_TOKEN_PREFIX}${userId}`
        await redis.del(refreshKey)

        // 清除用户权限缓存
        await clearUserPermissionsCache(userId)

        return { success: true }
    }

    // 获取当前租户用户列表（带缓存） — tenantId 为空时返回全部用户（super admin）
    async getUserListByTenant(tenantId: string | undefined, page: number = 1, pageSize: number = 20): Promise<PaginatedResult<any>> {
        return paginate(prisma.user, {
            where: {
                ...(tenantId ? { tenantId } : {}),
                ...notDeleted,
            },
            include: {
                tenant: { select: { id: true, tenantName: true } },
                roles: { include: { role: true } },
                groups: { include: { group: true } }
            }
        }, page, pageSize);
    }

    // 获取用户详情（带缓存）
    @Cacheable({
        key: CacheKeys.user,
        ttl: CacheTTL.USER
    })
    async getUserById(id: string) {
        const user = await prisma.user.findUnique({
            where: {id},
            include: {
                roles: { include: { role: true } },
                groups: { include: { group: true } }
            }
        })
        if (!user) {
            throw new AppError(404, '用户不存在')
        }
        return user
    }

    // 更新用户
    @CacheEvict({
        keys: async (id: string, data: any) => {
            const user = await prisma.user.findUnique({ where: { id } })
            return [
                CacheKeys.user(id),
                user?.tenantId ? CacheKeys.userList(user.tenantId) : null
            ].filter(Boolean) as string[]
        }
    })
    async updateUser(id: string, data: {
        nickname?: string;
        avatar?: string;
        email?: string;
        phone?: string;
        status?: boolean;
        profile?: Record<string, any>;
        tenantId?: string;
    }) {
        const user = await prisma.user.findUnique({ where: { id } })
        if (!user) {
            throw new AppError(404, '用户不存在')
        }
        // 如果修改了 tenantId，校验租户存在
        if (data.tenantId) {
            const tenant = await prisma.tenant.findUnique({ where: { id: data.tenantId } })
            if (!tenant) throw new AppError(404, '租户不存在')
        }
        return prisma.user.update({
            where: { id },
            data,
            include: {
                roles: { include: { role: true } },
                groups: { include: { group: true } }
            }
        })
    }

    // 删除用户
    @CacheEvict({
        keys: async (id: string) => {
            const user = await prisma.user.findUnique({ where: { id } })
            return [
                CacheKeys.user(id),
                user?.tenantId ? CacheKeys.userList(user.tenantId) : null
            ].filter(Boolean) as string[]
        }
    })
    async deleteUser(id: string) {
        const user = await prisma.user.findUnique({ where: { id } })
        if (!user) {
            throw new AppError(404, '用户不存在')
        }
        await prisma.user.update({
            where: { id },
            data: { deletedAt: new Date() }
        })
        return { success: true }
    }

    @CacheEvict({
        keys: async (id: string) => {
            const user = await prisma.user.findUnique({ where: { id, deletedAt: { not: null } } })
            return [
                CacheKeys.user(id),
                user?.tenantId ? CacheKeys.userList(user.tenantId) : null
            ].filter(Boolean) as string[]
        }
    })
    async restoreUser(id: string) {
        const user = await prisma.user.findUnique({ where: { id, deletedAt: { not: null } } })
        if (!user) {
            throw new AppError(404, '已删除的用户不存在')
        }
        // 恢复前检查：是否有同名且未删除的用户（部分唯一索引会在数据库层报错，这里做友好提示）
        const conflict = await prisma.user.findFirst({
            where: { username: user.username, deletedAt: null },
        })
        if (conflict) {
            throw new AppError(409, `用户名「${user.username}」已存在，无法恢复`)
        }
        return prisma.user.update({
            where: { id },
            data: { deletedAt: null }
        })
    }

    /**
     * 给用户 关联【单个】群组
     * @param userId 用户ID
     * @param groupId 群组ID
     * @param tenantId 租户ID（安全隔离）
     */
    @CacheEvict({
        keys: (userId: string, groupId: string, tenantId: string) => [CacheKeys.user(userId)]
    })
    async assignGroupToUser(
        userId: string,
        groupId: string,
        tenantId: string
    ) {
        // 1. 基础校验
        if (!userId || !groupId) {
            throw new AppError(400, '用户ID 和 群组ID 不能为空');
        }

        // 2. 校验用户存在 & 属于当前租户
        const user = await prisma.user.findUnique({
            where: {id: userId},
        });
        if (!user || user.tenantId !== tenantId) {
            throw new AppError(404, '用户不存在或租户不匹配');
        }

        // 3. 校验群组存在 & 属于当前租户
        const group = await prisma.group.findUnique({
            where: {id: groupId},
        });
        if (!group || group.tenantId !== tenantId) {
            throw new AppError(404, '群组不存在或租户不匹配');
        }

        // 4. 创建关联（自动跳过重复，不报错）
        await prisma.userGroup.createMany({
            data: [{userId, groupId}],
            skipDuplicates: true,
        });

        return {
            message: '用户关联群组成功',
            userId,
            groupId,
        };
    }

    async removeGroupFromUser(userId: string, groupId: string) {
        await prisma.userGroup.deleteMany({ where: { userId, groupId } })
        return { message: '已退出群组' }
    }

    async assignRoleToUser(userId: string, roleId: string) {
        await prisma.userRole.create({ data: { userId, roleId } })
        return { message: '角色分配成功' }
    }

    async removeRoleFromUser(userId: string, roleId: string) {
        await prisma.userRole.deleteMany({ where: { userId, roleId } })
        return { message: '已移除角色' }
    }

    async getMyTenant(userId: string) {
        const user = await prisma.user.findUnique({
            where: { id: userId },
            select: { tenant: { select: { id: true, tenantName: true, tenantCode: true } } },
        })
        return user?.tenant || null
    }
}

export const userService = new UserService();
