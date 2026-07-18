import prisma from '@config/db'
import { notDeleted } from '@config/soft-delete'
import {Cacheable, CacheEvict} from '@cache/decorators';
import {CacheKeys, CacheTTL} from '@cache/keys';
import {AppError} from '@middleware/error.middleware';

class PermissionService {
    /** 权限表数据量小（~40条），不分页，一次性全部返回 */
    async getPermissions() {
        const items = await prisma.permission.findMany({
            orderBy: { sort: 'asc' },
        })
        return { items, total: items.length }
    }

    @Cacheable({
        key: CacheKeys.permission,
        ttl: CacheTTL.PERMISSION
    })
    async getPermission(id: string) {
        const permission = await prisma.permission.findUnique({
            where: { id }
        })
        if (!permission) {
            throw new AppError(404, '权限不存在')
        }
        return permission
    }

    @CacheEvict({
        keys: () => [CacheKeys.permissionList()]
    })
    async createPermission(data: {
        permName: string,
        permCode: string,
        type: number,
        parentId?: string,
        sort?: number
    }) {
        return prisma.permission.create({
            data: {
                ...data,
                sort: data.sort || 0
            }
        })
    }

    @CacheEvict({
        keys: (id: string) => [CacheKeys.permission(id), CacheKeys.permissionList()]
    })
    async updatePermission(id: string, data: {
        permName?: string,
        type?: number,
        parentId?: string,
        sort?: number
    }) {
        const permission = await prisma.permission.findUnique({ where: { id } })
        if (!permission) {
            throw new AppError(404, '权限不存在')
        }
        return prisma.permission.update({
            where: { id },
            data
        })
    }

    @CacheEvict({
        keys: (id: string) => [CacheKeys.permission(id), CacheKeys.permissionList()]
    })
    async deletePermission(id: string) {
        const permission = await prisma.permission.findUnique({ where: { id } })
        if (!permission) {
            throw new AppError(404, '权限不存在')
        }
        await prisma.permission.delete({
            where: { id }
        })
        return { success: true }
    }
}

export const permissionService = new PermissionService();
