import { Request, Response } from 'express'
import prisma from '@config/db'
import { success, fail } from '@utils/response'
import { Audited } from '@common/audit'
import { cleanupExpiredDeleted } from '@common/cleanup'

class SystemController {
    private ALL_PERMISSIONS = [
        // 系统级权限
        { permName: '租户查看', permCode: 'sys:tenant:view', sort: 1, scope: 'system' },
        { permName: '租户新增', permCode: 'sys:tenant:add', sort: 2, scope: 'system' },
        { permName: '租户编辑', permCode: 'sys:tenant:edit', sort: 3, scope: 'system' },
        { permName: '租户删除', permCode: 'sys:tenant:delete', sort: 4, scope: 'system' },
        { permName: '权限新增', permCode: 'sys:permission:add', sort: 12, scope: 'system' },
        { permName: '权限编辑', permCode: 'sys:permission:edit', sort: 13, scope: 'system' },
        { permName: '权限删除', permCode: 'sys:permission:delete', sort: 14, scope: 'system' },
        // 租户级权限
        { permName: '权限查看', permCode: 'sys:permission:view', sort: 11, scope: 'tenant' },
        { permName: '用户查看', permCode: 'sys:user:view', sort: 21, scope: 'tenant' },
        { permName: '用户新增', permCode: 'sys:user:add', sort: 22, scope: 'tenant' },
        { permName: '用户编辑', permCode: 'sys:user:edit', sort: 23, scope: 'tenant' },
        { permName: '用户删除', permCode: 'sys:user:delete', sort: 24, scope: 'tenant' },
        { permName: '用户分配', permCode: 'sys:user:assign', sort: 25, scope: 'tenant' },
        { permName: '角色查看', permCode: 'sys:role:view', sort: 31, scope: 'tenant' },
        { permName: '角色新增', permCode: 'sys:role:add', sort: 32, scope: 'tenant' },
        { permName: '角色编辑', permCode: 'sys:role:edit', sort: 33, scope: 'tenant' },
        { permName: '角色删除', permCode: 'sys:role:delete', sort: 34, scope: 'tenant' },
        { permName: '角色分配', permCode: 'sys:role:assign', sort: 35, scope: 'tenant' },
        { permName: '群组查看', permCode: 'sys:group:view', sort: 41, scope: 'tenant' },
        { permName: '群组新增', permCode: 'sys:group:add', sort: 42, scope: 'tenant' },
        { permName: '群组编辑', permCode: 'sys:group:edit', sort: 43, scope: 'tenant' },
        { permName: '群组删除', permCode: 'sys:group:delete', sort: 44, scope: 'tenant' },
        { permName: '表查看', permCode: 'dynamic:table:view', sort: 51, scope: 'tenant' },
        { permName: '表新增', permCode: 'dynamic:table:add', sort: 52, scope: 'tenant' },
        { permName: '表编辑', permCode: 'dynamic:table:edit', sort: 53, scope: 'tenant' },
        { permName: '表删除', permCode: 'dynamic:table:delete', sort: 54, scope: 'tenant' },
        { permName: '字段查看', permCode: 'dynamic:field:view', sort: 61, scope: 'tenant' },
        { permName: '字段新增', permCode: 'dynamic:field:add', sort: 62, scope: 'tenant' },
        { permName: '字段编辑', permCode: 'dynamic:field:edit', sort: 63, scope: 'tenant' },
        { permName: '字段删除', permCode: 'dynamic:field:delete', sort: 64, scope: 'tenant' },
        { permName: '记录查看', permCode: 'dynamic:record:view', sort: 71, scope: 'tenant' },
        { permName: '记录新增', permCode: 'dynamic:record:add', sort: 72, scope: 'tenant' },
        { permName: '记录编辑', permCode: 'dynamic:record:edit', sort: 73, scope: 'tenant' },
        { permName: '记录删除', permCode: 'dynamic:record:delete', sort: 74, scope: 'tenant' },
        { permName: '开发者模式', permCode: 'dev:access', sort: 81, scope: 'tenant' },
        { permName: '蓝图查看', permCode: 'bp:view', sort: 91, scope: 'tenant' },
        { permName: '蓝图编辑', permCode: 'bp:edit', sort: 92, scope: 'tenant' },
        { permName: '蓝图执行', permCode: 'bp:execute', sort: 93, scope: 'tenant' },
        { permName: '蓝图发布', permCode: 'bp:publish', sort: 94, scope: 'tenant' },
    ]

    @Audited('System')
    async initSuperAdmin(req: Request, res: Response) {
        const { userId, tenantId: inputTenantId } = req.body
        if (!userId) {
            return res.json(fail('userId 不能为空', 400))
        }

        // 自动查找系统租户，不需要手动填 tenantId
        const tenantId = inputTenantId || await (async () => {
            const sysTenant = await prisma.tenant.findFirst({
                where: { scope: 'system', deletedAt: null },
                orderBy: { createdAt: 'asc' },
            })
            return sysTenant?.id || null
        })()

        if (!tenantId) {
            return res.json(fail('未找到系统租户（scope=system）。请先创建系统租户，或手动传 tenantId', 400))
        }

        // 创建/更新 super_admin 角色（scope = system）
        // 注意：roleCode 的 @unique 已移除，改为 findFirst + create/update
        let role = await prisma.role.findFirst({
            where: { roleCode: 'super_admin', deletedAt: null },
        })
        if (role) {
            role = await prisma.role.update({
                where: { id: role.id },
                data: { scope: 'system', tenantId },
            })
        } else {
            role = await prisma.role.create({
                data: {
                    roleName: '超级管理员',
                    roleCode: 'super_admin',
                    scope: 'system',
                    tenantId,
                    status: true,
                },
            })
        }

        // 用户关联角色
        await prisma.userRole.upsert({
            where: { userId_roleId: { userId, roleId: role.id } },
            update: {},
            create: { userId, roleId: role.id },
        })

        // 如果用户没有租户，自动挂到系统租户
        await prisma.user.update({
            where: { id: userId },
            data: { tenantId },
        })

        // 写入全部 38 个权限码，并分配给 super_admin 角色
        let assigned = 0
        for (const p of this.ALL_PERMISSIONS) {
            const perm = await prisma.permission.upsert({
                where: { permCode: p.permCode },
                update: { scope: p.scope },
                create: {
                    permName: p.permName,
                    permCode: p.permCode,
                    type: 2,
                    sort: p.sort,
                    scope: p.scope,
                },
            })
            await prisma.rolePermission.upsert({
                where: { roleId_permissionId: { roleId: role.id, permissionId: perm.id } },
                update: {},
                create: { roleId: role.id, permissionId: perm.id },
            })
            assigned++
        }

        res.json(success(
            { userId, tenantId, role: role.roleCode, permissionsAssigned: assigned },
            '超级管理员初始化成功，拥有全部权限'
        ))
    }

    /** 初始化全量权限码（独立调用，不分配角色） */
    seedPermissions = async (_req: Request, res: Response) => {
        let created = 0
        for (let i = 0; i < this.ALL_PERMISSIONS.length; i++) {
            const p = this.ALL_PERMISSIONS[i]
            const exists = await prisma.permission.findUnique({ where: { permCode: p.permCode } })
            if (!exists) {
                await prisma.permission.create({
                    data: {
                        permName: p.permName,
                        permCode: p.permCode,
                        type: 2,
                        sort: p.sort,
                        scope: p.scope,
                        parentId: null,
                    },
                })
                created++
            }
        }
        res.json(success({ total: this.ALL_PERMISSIONS.length, created }, `权限初始化完成，新增 ${created} 条`))
    }

    /** 初始化预设角色（scope=shared，归属于系统租户，所有租户可见） */
    seedPresetRoles = async (_req: Request, res: Response) => {
        // 找到系统租户
        const sysTenant = await prisma.tenant.findFirst({
            where: { scope: 'system', deletedAt: null },
            orderBy: { createdAt: 'asc' },
        })
        if (!sysTenant) {
            return res.json(fail('未找到系统租户，请先创建 scope=system 的租户', 400))
        }

        const tenantPerms = this.ALL_PERMISSIONS.filter(p => p.scope === 'tenant')

        const presets = [
            {
                roleName: '租户管理员',
                roleCode: 'tenant_admin',
                description: '拥有除租户增删外的全部租户管理权限',
                permCodes: tenantPerms.map(p => p.permCode),
            },
            {
                roleName: '普通成员',
                roleCode: 'member',
                description: '仅查看和编辑多维表格',
                permCodes: [
                    'dynamic:table:view', 'dynamic:field:view', 'dynamic:record:view',
                    'dynamic:record:add', 'dynamic:record:edit',
                ],
            },
            {
                roleName: '人事管理',
                roleCode: 'hr_manager',
                description: '管理用户账号和群组',
                permCodes: [
                    'sys:user:view', 'sys:user:add', 'sys:user:edit', 'sys:user:assign',
                    'sys:group:view', 'sys:group:add', 'sys:group:edit',
                    'sys:role:view',
                    'dynamic:table:view', 'dynamic:field:view', 'dynamic:record:view',
                ],
            },
        ]

        const result: any[] = []
        for (const preset of presets) {
            // 注意：roleCode 的 @unique 已移除，改为 findFirst + create/update
            let role = await prisma.role.findFirst({
                where: { roleCode: preset.roleCode, deletedAt: null },
            })
            if (role) {
                role = await prisma.role.update({
                    where: { id: role.id },
                    data: { roleName: preset.roleName, scope: 'shared', tenantId: sysTenant.id },
                })
            } else {
                role = await prisma.role.create({
                    data: {
                        roleName: preset.roleName,
                        roleCode: preset.roleCode,
                        scope: 'shared',
                        tenantId: sysTenant.id,
                        status: true,
                    },
                })
            }

            // 分配权限
            const perms = await prisma.permission.findMany({
                where: { permCode: { in: preset.permCodes } },
            })
            await prisma.rolePermission.deleteMany({ where: { roleId: role.id } })
            for (const p of perms) {
                await prisma.rolePermission.create({ data: { roleId: role.id, permissionId: p.id } })
            }

            result.push({ role: preset.roleCode, name: preset.roleName, permissions: perms.length })
        }

        res.json(success(result, `预设角色初始化完成，共 ${result.length} 个`))
    }

    /** 手动触发软删除数据清理 */
    async cleanup(req: Request, res: Response) {
        const days = Number(req.query.days) || Number(process.env.CLEANUP_RETENTION_DAYS) || 90
        const summary = await cleanupExpiredDeleted(days)
        res.json(success(summary, `清理完成，保留 ${days} 天内的数据`))
    }
}

export const systemController = new SystemController()
