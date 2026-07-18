import prisma from '@config/db'
import { notDeleted } from '@config/soft-delete'
import {Cacheable, CacheEvict} from '@cache/decorators';
import {CacheKeys, CacheTTL} from '@cache/keys';
import {AppError} from '@middleware/error.middleware';
import {paginate, PaginatedResult} from '@utils/pagination';

class RoleService {
    async getRoles(tenantId: string | undefined, page: number = 1, pageSize: number = 20): Promise<PaginatedResult<any>> {
        // super admin → 看全部
        // 普通用户 → 看自己租户的 + 所有 shared 预设角色
        const where = tenantId
            ? { OR: [{ tenantId }, { scope: 'shared' }], ...notDeleted }
            : { ...notDeleted }
        return paginate(prisma.role, {
            where,
            include: {
                permissions: {
                    include: {permission: true}
                }
            },
            orderBy: {createdAt: 'desc'}
        }, page, pageSize);
    }

    @Cacheable({
        key: CacheKeys.role,
        ttl: CacheTTL.ROLE
    })
    async getRole(id: string, tenantId: string | undefined) {
        const role = await prisma.role.findUnique({
            where: {id},
            include: {
                permissions: {
                    include: {permission: true}
                }
            }
        })
        if (!role || (tenantId && role.tenantId !== tenantId)) {
            throw new AppError(404, '角色不存在')
        }
        return role
    }

    @CacheEvict({
        keys: (data: any) => [CacheKeys.roleList(data.tenantId)]
    })
    async createRole(data: {
        roleName: string,
        roleCode: string,
        tenantId: string,
        scope?: string,
        description?: string,
        status?: boolean
    }) {
        return prisma.role.create({data})
    }

    @CacheEvict({
        keys: async (id: string, tenantId: string, data: any) => [
            CacheKeys.role(id),
            CacheKeys.roleList(tenantId)
        ]
    })
    async updateRole(id: string, tenantId: string | undefined, data: {
        roleName?: string,
        description?: string | null,
        scope?: string,
        status?: boolean
    }) {
        const role = await prisma.role.findUnique({where: {id}})
        if (!role || (tenantId && role.tenantId !== tenantId)) {
            throw new AppError(404, '角色不存在')
        }
        return prisma.role.update({
            where: {id},
            data
        })
    }

    @CacheEvict({
        keys: async (id: string, tenantId: string) => [
            CacheKeys.role(id),
            CacheKeys.roleList(tenantId)
        ]
    })
    async deleteRole(id: string, tenantId: string | undefined) {
        const role = await prisma.role.findUnique({where: {id}})
        if (!role || (tenantId && role.tenantId !== tenantId)) {
            throw new AppError(404, '角色不存在')
        }
        await prisma.role.update({
            where: {id},
            data: {deletedAt: new Date()}
        })
        return {success: true}
    }

    @CacheEvict({
        keys: async (id: string, tenantId: string) => [
            CacheKeys.role(id),
            CacheKeys.roleList(tenantId)
        ]
    })
    async restoreRole(id: string, tenantId: string | undefined) {
        const role = await prisma.role.findUnique({where: {id, deletedAt: {not: null}}})
        if (!role || (tenantId && role.tenantId !== tenantId)) {
            throw new AppError(404, '已删除的角色不存在')
        }
        // 恢复前检查：同租户内是否有同名且未删除的角色（部分唯一索引会在数据库层报错，这里做友好提示）
        const conflict = await prisma.role.findFirst({
            where: { tenantId: role.tenantId, roleCode: role.roleCode, deletedAt: null },
        })
        if (conflict) {
            throw new AppError(409, `角色编码「${role.roleCode}」在当前租户中已存在，无法恢复`)
        }
        return prisma.role.update({
            where: {id},
            data: {deletedAt: null}
        })
    }

    @CacheEvict({
        keys: async (roleId: string, tenantId: string, permissionIds: string[]) => [
            CacheKeys.role(roleId),
            CacheKeys.roleList(tenantId)
        ]
    })
    async assignPermissionsToRole(roleId: string, tenantId: string | undefined, permissionIds: string[]) {
        const role = await prisma.role.findUnique({where: {id: roleId}})
        if (!role || (tenantId && role.tenantId !== tenantId)) {
            throw new AppError(404, '角色不存在')
        }

        // 验证权限 scope 兼容性
        // system  → 可分配任意权限
        // shared  → 只能分配 tenant-scope 权限（预设模板）
        // tenant  → 只能分配 tenant-scope 权限
        if (permissionIds.length > 0) {
            const permissions = await prisma.permission.findMany({
                where: {id: {in: permissionIds}}
            });

            // 校验所有 ID 都存在
            if (permissions.length !== permissionIds.length) {
                const foundIds = new Set(permissions.map(p => p.id))
                const missing = permissionIds.filter(id => !foundIds.has(id))
                throw new AppError(400, `权限不存在，请刷新页面后重试: ${missing.slice(0, 3).join(', ')}`)
            }

            for (const perm of permissions) {
                const allowed = role.scope === 'system' ? true : perm.scope === 'tenant'
                if (!allowed) {
                    throw new AppError(400, `权限 ${perm.permName}（scope=${perm.scope}）不能分配给 scope=${role.scope} 的角色`)
                }
            }
        }

        await prisma.rolePermission.deleteMany({
            where: {roleId}
        })

        if (permissionIds.length > 0) {
            await prisma.rolePermission.createMany({
                data: permissionIds.map(permissionId => ({
                    roleId,
                    permissionId
                }))
            })
        }

        return this.getRole(roleId, tenantId)
    }
}

export const roleService = new RoleService();
