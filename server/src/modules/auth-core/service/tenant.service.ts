import prisma from '@config/db'
import { notDeleted } from '@config/soft-delete';
import {Cacheable, CacheEvict} from '@cache/decorators';
import {CacheKeys, CacheTTL} from '@cache/keys';
import {groupService} from './group.service';
import {AppError} from '@middleware/error.middleware';
import {paginate, PaginatedResult} from '@utils/pagination';
import { clearUserPermissionsCache } from '@utils/permission.util';

// 租户管理员自动获得的全部 tenant-scope 权限（与 system.controller.ts 的租户级权限一致）
const TENANT_ADMIN_PERMS = [
    { permName: '权限查看', permCode: 'sys:permission:view', sort: 11 },
    { permName: '租户查看', permCode: 'sys:tenant:view', sort: 1 },
    { permName: '租户编辑', permCode: 'sys:tenant:edit', sort: 3 },
    { permName: '用户查看', permCode: 'sys:user:view', sort: 21 },
    { permName: '用户新增', permCode: 'sys:user:add', sort: 22 },
    { permName: '用户编辑', permCode: 'sys:user:edit', sort: 23 },
    { permName: '用户删除', permCode: 'sys:user:delete', sort: 24 },
    { permName: '用户分配', permCode: 'sys:user:assign', sort: 25 },
    { permName: '角色查看', permCode: 'sys:role:view', sort: 31 },
    { permName: '角色新增', permCode: 'sys:role:add', sort: 32 },
    { permName: '角色编辑', permCode: 'sys:role:edit', sort: 33 },
    { permName: '角色删除', permCode: 'sys:role:delete', sort: 34 },
    { permName: '角色分配', permCode: 'sys:role:assign', sort: 35 },
    { permName: '群组查看', permCode: 'sys:group:view', sort: 41 },
    { permName: '群组新增', permCode: 'sys:group:add', sort: 42 },
    { permName: '群组编辑', permCode: 'sys:group:edit', sort: 43 },
    { permName: '群组删除', permCode: 'sys:group:delete', sort: 44 },
    { permName: '表查看', permCode: 'dynamic:table:view', sort: 51 },
    { permName: '表新增', permCode: 'dynamic:table:add', sort: 52 },
    { permName: '表编辑', permCode: 'dynamic:table:edit', sort: 53 },
    { permName: '表删除', permCode: 'dynamic:table:delete', sort: 54 },
    { permName: '字段查看', permCode: 'dynamic:field:view', sort: 61 },
    { permName: '字段新增', permCode: 'dynamic:field:add', sort: 62 },
    { permName: '字段编辑', permCode: 'dynamic:field:edit', sort: 63 },
    { permName: '字段删除', permCode: 'dynamic:field:delete', sort: 64 },
    { permName: '记录查看', permCode: 'dynamic:record:view', sort: 71 },
    { permName: '记录新增', permCode: 'dynamic:record:add', sort: 72 },
    { permName: '记录编辑', permCode: 'dynamic:record:edit', sort: 73 },
    { permName: '记录删除', permCode: 'dynamic:record:delete', sort: 74 },
    { permName: '开发者模式', permCode: 'dev:access', sort: 81 },
    { permName: '蓝图查看', permCode: 'bp:view', sort: 91 },
    { permName: '蓝图编辑', permCode: 'bp:edit', sort: 92 },
    { permName: '蓝图执行', permCode: 'bp:execute', sort: 93 },
    { permName: '蓝图发布', permCode: 'bp:publish', sort: 94 },
]

const TENANT_ADMIN_CODES = TENANT_ADMIN_PERMS.map(p => p.permCode)

class TenantService {
    /**
     * 任命用户为租户管理员：创建角色 + 分配全部 tenant-scope 权限 + 用户关联
     */
    private async ensureTenantAdmin(tenantId: string, userId: string) {
        // 1. 确保全部 34 个 tenant-scope 权限码存在（含中文名 + 排序）
        for (const p of TENANT_ADMIN_PERMS) {
            await prisma.permission.upsert({
                where: { permCode: p.permCode },
                update: { scope: 'tenant' },
                create: {
                    permName: p.permName,
                    permCode: p.permCode,
                    type: 2,
                    sort: p.sort,
                    scope: 'tenant',
                },
            })
        }

        // 2. 查找或创建 "租户管理员" 角色（仅未删除的）
        let role = await prisma.role.findFirst({
            where: { tenantId, roleCode: `tenant_admin_${tenantId}`, deletedAt: null },
        })
        if (!role) {
            role = await prisma.role.create({
                data: {
                    roleName: '租户管理员',
                    roleCode: `tenant_admin_${tenantId}`,
                    tenantId,
                    scope: 'tenant',
                    status: true,
                },
            })
        }

        // 3. 给角色分配所有权限
        const allPerms = await prisma.permission.findMany({
            where: { permCode: { in: TENANT_ADMIN_CODES } },
        })
        for (const perm of allPerms) {
            await prisma.rolePermission.upsert({
                where: { roleId_permissionId: { roleId: role.id, permissionId: perm.id } },
                update: {},
                create: { roleId: role.id, permissionId: perm.id },
            })
        }

        // 4. 将角色分配给管理员用户
        await prisma.userRole.upsert({
            where: { userId_roleId: { userId, roleId: role.id } },
            update: {},
            create: { userId, roleId: role.id },
        })

        // 5. 如果用户还没有租户归属，设为此租户
        const user = await prisma.user.findUnique({ where: { id: userId } })
        if (user && !user.tenantId) {
            await prisma.user.update({
                where: { id: userId },
                data: { tenantId },
            })
        }

        // 6. 清除用户权限缓存，下次请求时重新加载
        await clearUserPermissionsCache(userId)
    }

    async getTenants(page: number = 1, pageSize: number = 20): Promise<PaginatedResult<any>> {
        return paginate(prisma.tenant, {
            where: { ...notDeleted },
            include: { admin: { select: { id: true, username: true, nickname: true } } },
            orderBy: { createdAt: 'desc' },
        }, page, pageSize);
    }

    @Cacheable({
        key: CacheKeys.tenant,
        ttl: CacheTTL.TENANT
    })
    async getTenant(id: string) {
        const tenant = await prisma.tenant.findUnique({
            where: { id },
            include: { admin: { select: { id: true, username: true, nickname: true } } },
        });
        if (!tenant) {
            throw new AppError(404, '租户不存在');
        }
        return tenant;
    }

    @CacheEvict({
        keys: (data: any) => [CacheKeys.tenantList()]
    })
    async createTenant(data: {
        tenantName: string;
        tenantCode: string;
        scope?: string;
        status?: boolean;
        adminId?: string;
    }) {
        const tenant = await prisma.tenant.create({
            data: {
                tenantName: data.tenantName,
                tenantCode: data.tenantCode,
                scope: data.scope || 'tenant',
                status: data.status || true,
                adminId: data.adminId || null,
            }
        });

        await groupService.createRootGroup(tenant.id, tenant.tenantCode);

        // 任命管理员时自动赋权
        if (data.adminId) {
            await this.ensureTenantAdmin(tenant.id, data.adminId);
        }

        return tenant;
    }

    @CacheEvict({
        keys: async (id: string, data: any) => [
            CacheKeys.tenant(id),
            CacheKeys.tenantList()
        ]
    })
    async updateTenant(id: string, data: {
        tenantName?: string;
        status?: boolean;
        adminId?: string;
    }) {
        const tenant = await prisma.tenant.findUnique({ where: { id } });
        if (!tenant) {
            throw new AppError(404, '租户不存在');
        }

        // adminId 变更时，给新管理员赋权
        if (data.adminId && data.adminId !== tenant.adminId) {
            await this.ensureTenantAdmin(id, data.adminId);
        }

        return prisma.tenant.update({
            where: { id },
            data: {
                ...(data.tenantName !== undefined && { tenantName: data.tenantName }),
                ...(data.status !== undefined && { status: data.status }),
                ...(data.adminId !== undefined && { adminId: data.adminId }),
            },
            include: { admin: { select: { id: true, username: true, nickname: true } } },
        });
    }

    @CacheEvict({
        keys: async (id: string) => [
            CacheKeys.tenant(id),
            CacheKeys.tenantList()
        ]
    })
    async deleteTenant(id: string) {
        const tenant = await prisma.tenant.findUnique({ where: { id } });
        if (!tenant) {
            throw new AppError(404, '租户不存在');
        }
        await prisma.tenant.update({
            where: { id },
            data: { deletedAt: new Date() }
        });
        return { success: true };
    }

    @CacheEvict({
        keys: async (id: string) => [
            CacheKeys.tenant(id),
            CacheKeys.tenantList()
        ]
    })
    async restoreTenant(id: string) {
        const tenant = await prisma.tenant.findUnique({ where: { id, deletedAt: { not: null } } });
        if (!tenant) {
            throw new AppError(404, '已删除的租户不存在');
        }
        // 恢复前检查：是否有同名且未删除的租户（部分唯一索引会在数据库层报错，这里做友好提示）
        const conflict = await prisma.tenant.findFirst({
            where: { tenantCode: tenant.tenantCode, deletedAt: null },
        });
        if (conflict) {
            throw new AppError(409, `租户编码「${tenant.tenantCode}」已存在，无法恢复`);
        }
        return prisma.tenant.update({
            where: { id },
            data: { deletedAt: null }
        });
    }
}

export const tenantService = new TenantService();
