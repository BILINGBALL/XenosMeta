/**
 * 综合 Seed 脚本 — 初始化所有基础数据
 *
 * 执行顺序：
 *  1. ROOT 系统租户
 *  2. 全量权限码（38个）
 *  3. super_admin / system_admin 角色 + 权限分配
 *  4. 系统管理员用户
 *  5. ROOT 根群组
 *  6. 预设共享角色（tenant_admin, member, hr_manager）
 */

import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient({ log: ['warn', 'error'] })

// ==================== 全量权限定义 ====================
const ALL_PERMISSIONS = [
    // 系统级权限 (scope=system)
    { permName: '租户查看', permCode: 'sys:tenant:view', sort: 1, scope: 'system' },
    { permName: '租户新增', permCode: 'sys:tenant:add', sort: 2, scope: 'system' },
    { permName: '租户编辑', permCode: 'sys:tenant:edit', sort: 3, scope: 'system' },
    { permName: '租户删除', permCode: 'sys:tenant:delete', sort: 4, scope: 'system' },
    { permName: '权限新增', permCode: 'sys:permission:add', sort: 12, scope: 'system' },
    { permName: '权限编辑', permCode: 'sys:permission:edit', sort: 13, scope: 'system' },
    { permName: '权限删除', permCode: 'sys:permission:delete', sort: 14, scope: 'system' },
    // 租户级权限 (scope=tenant)
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

// ==================== 预设角色定义 ====================
const PRESET_ROLES = [
    {
        roleName: '租户管理员',
        roleCode: 'tenant_admin',
        description: '拥有除租户增删外的全部租户管理权限',
        permCodes: ALL_PERMISSIONS.filter(p => p.scope === 'tenant').map(p => p.permCode),
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

async function main() {
    console.log('╔══════════════════════════════════════╗')
    console.log('║   Auth Core — 初始化 Seed 数据      ║')
    console.log('╚══════════════════════════════════════╝\n')

    // ============================================================
    // Step 1: 创建 ROOT 系统租户
    // ============================================================
    console.log('▶ Step 1/7  创建 ROOT 系统租户...')
    let rootTenant = await prisma.tenant.findFirst({
        where: { scope: 'system', tenantCode: 'ROOT', deletedAt: null },
    })
    if (!rootTenant) {
        rootTenant = await prisma.tenant.create({
            data: {
                tenantName: '系统管理租户',
                tenantCode: 'ROOT',
                scope: 'system',
                status: true,
            },
        })
    }
    console.log(`  ✅ ROOT 系统租户  id=${rootTenant.id}\n`)

    // ============================================================
    // Step 2: 创建全量权限码
    // ============================================================
    console.log(`▶ Step 2/7  创建 ${ALL_PERMISSIONS.length} 个权限码...`)
    const createdPerms: Record<string, string> = {} // permCode -> id
    for (const p of ALL_PERMISSIONS) {
        let perm = await prisma.permission.findUnique({ where: { permCode: p.permCode } })
        if (!perm) {
            perm = await prisma.permission.create({
                data: {
                    permName: p.permName,
                    permCode: p.permCode,
                    type: 2,
                    sort: p.sort,
                    scope: p.scope,
                },
            })
        } else {
            perm = await prisma.permission.update({
                where: { id: perm.id },
                data: { scope: p.scope, sort: p.sort },
            })
        }
        createdPerms[p.permCode] = perm.id
    }
    console.log(`  ✅ 权限码就绪  ${Object.keys(createdPerms).length} 个\n`)

    // ============================================================
    // Step 3: 创建 super_admin 角色（系统级，拥有全部权限）
    // ============================================================
    console.log('▶ Step 3/7  创建 super_admin 角色...')
    let superAdminRole = await prisma.role.findFirst({
        where: { roleCode: 'super_admin', deletedAt: null },
    })
    if (superAdminRole) {
        superAdminRole = await prisma.role.update({
            where: { id: superAdminRole.id },
            data: { scope: 'system', tenantId: rootTenant.id },
        })
    } else {
        superAdminRole = await prisma.role.create({
            data: {
                roleName: '超级管理员',
                roleCode: 'super_admin',
                scope: 'system',
                tenantId: rootTenant.id,
                status: true,
            },
        })
    }

    // 分配全部权限给 super_admin
    await prisma.rolePermission.deleteMany({ where: { roleId: superAdminRole.id } })
    const allPermIds = Object.values(createdPerms)
    await prisma.rolePermission.createMany({
        data: allPermIds.map(permId => ({ roleId: superAdminRole.id, permissionId: permId })),
    })
    console.log(`  ✅ super_admin 角色  id=${superAdminRole.id}  权限=${allPermIds.length}\n`)

    // ============================================================
    // Step 4: 创建 system_admin 角色（系统级，同样全部权限）
    // ============================================================
    console.log('▶ Step 4/7  创建 system_admin 角色...')
    let systemAdminRole = await prisma.role.findFirst({
        where: { roleCode: 'system_admin', deletedAt: null },
    })
    if (systemAdminRole) {
        systemAdminRole = await prisma.role.update({
            where: { id: systemAdminRole.id },
            data: { scope: 'system', tenantId: rootTenant.id },
        })
    } else {
        systemAdminRole = await prisma.role.create({
            data: {
                roleName: '系统管理员',
                roleCode: 'system_admin',
                scope: 'system',
                tenantId: rootTenant.id,
                status: true,
            },
        })
    }
    await prisma.rolePermission.deleteMany({ where: { roleId: systemAdminRole.id } })
    await prisma.rolePermission.createMany({
        data: allPermIds.map(permId => ({ roleId: systemAdminRole.id, permissionId: permId })),
    })
    console.log(`  ✅ system_admin 角色  id=${systemAdminRole.id}  权限=${allPermIds.length}\n`)

    // ============================================================
    // Step 5: 创建系统管理员用户
    // ============================================================
    console.log('▶ Step 5/7  创建系统管理员用户...')
    const pwdHash = await bcrypt.hash('admin123', 10)

    // system_admin 用户
    let sysUser = await prisma.user.findFirst({
        where: { username: 'system_admin', deletedAt: null },
    })
    if (sysUser) {
        sysUser = await prisma.user.update({
            where: { id: sysUser.id },
            data: { password: pwdHash, tenantId: rootTenant.id, nickname: '系统管理员' },
        })
    } else {
        sysUser = await prisma.user.create({
            data: {
                username: 'system_admin',
                password: pwdHash,
                nickname: '系统管理员',
                tenantId: rootTenant.id,
                status: true,
            },
        })
    }
    await prisma.userRole.upsert({
        where: { userId_roleId: { userId: sysUser.id, roleId: systemAdminRole.id } },
        update: {},
        create: { userId: sysUser.id, roleId: systemAdminRole.id },
    })
    console.log(`  ✅ system_admin 用户  id=${sysUser.id}\n`)

    // admin 用户（普通租户管理员）
    let adminUser = await prisma.user.findFirst({
        where: { username: 'admin', deletedAt: null },
    })
    if (adminUser) {
        adminUser = await prisma.user.update({
            where: { id: adminUser.id },
            data: { password: pwdHash, tenantId: rootTenant.id, nickname: '管理员' },
        })
    } else {
        adminUser = await prisma.user.create({
            data: {
                username: 'admin',
                password: pwdHash,
                nickname: '管理员',
                tenantId: rootTenant.id,
                status: true,
            },
        })
    }
    await prisma.userRole.upsert({
        where: { userId_roleId: { userId: adminUser.id, roleId: superAdminRole.id } },
        update: {},
        create: { userId: adminUser.id, roleId: superAdminRole.id },
    })
    console.log(`  ✅ admin 用户  id=${adminUser.id}\n`)

    // ============================================================
    // Step 6: 创建 ROOT 根群组 + 分配用户
    // ============================================================
    console.log('▶ Step 6/7  创建 ROOT 根群组...')
    let rootGroup = await prisma.group.findFirst({
        where: { id: 'ROOT_GROUP' },
    })
    if (!rootGroup) {
        rootGroup = await prisma.group.create({
            data: {
                id: 'ROOT_GROUP',
                groupName: '系统管理组',
                groupCode: 'ROOT_GROUP',
                tenantId: rootTenant.id,
                parentId: null,
                status: true,
            },
        })
    }
    // 分配两个用户到根群组
    for (const uid of [sysUser.id, adminUser.id]) {
        await prisma.userGroup.upsert({
            where: { userId_groupId: { userId: uid, groupId: rootGroup.id } },
            update: {},
            create: { userId: uid, groupId: rootGroup.id },
        })
    }
    console.log(`  ✅ ROOT 根群组  id=${rootGroup.id}  成员=2\n`)

    // ============================================================
    // Step 7: 创建预设共享角色（scope=shared）
    // ============================================================
    console.log(`▶ Step 7/7  创建 ${PRESET_ROLES.length} 个预设共享角色...`)
    for (const preset of PRESET_ROLES) {
        let role = await prisma.role.findFirst({
            where: { roleCode: preset.roleCode, deletedAt: null },
        })
        if (role) {
            role = await prisma.role.update({
                where: { id: role.id },
                data: { roleName: preset.roleName, scope: 'shared', tenantId: rootTenant.id },
            })
        } else {
            role = await prisma.role.create({
                data: {
                    roleName: preset.roleName,
                    roleCode: preset.roleCode,
                    scope: 'shared',
                    tenantId: rootTenant.id,
                    status: true,
                },
            })
        }
        await prisma.rolePermission.deleteMany({ where: { roleId: role.id } })
        if (preset.permCodes.length > 0) {
            const permIds = preset.permCodes
                .map(code => createdPerms[code])
                .filter(Boolean)
            if (permIds.length > 0) {
                await prisma.rolePermission.createMany({
                    data: permIds.map(permId => ({ roleId: role.id, permissionId: permId })),
                })
            }
        }
        console.log(`  ✅ ${preset.roleName} (${preset.roleCode})  权限=${preset.permCodes.length}`)
    }

    // ============================================================
    // 总结
    // ============================================================
    console.log('\n╔══════════════════════════════════════╗')
    console.log('║         ✅ 初始化完成               ║')
    console.log('╚══════════════════════════════════════╝\n')
    console.log('📋 登录凭据:')
    console.log('   ┌──────────────┬───────────────┐')
    console.log('   │ username      │ password      │')
    console.log('   ├──────────────┼───────────────┤')
    console.log('   │ system_admin  │ admin123      │')
    console.log('   │ admin         │ admin123      │')
    console.log('   └──────────────┴───────────────┘\n')
    console.log('📊 数据统计:')
    console.log(`   租户:     1 (ROOT)`)
    console.log(`   权限码:   ${Object.keys(createdPerms).length} 个`)
    console.log(`   系统角色: 2 (super_admin, system_admin)`)
    console.log(`   共享角色: ${PRESET_ROLES.length} (tenant_admin, member, hr_manager)`)
    console.log(`   用户:     2 (system_admin, admin)`)
    console.log(`   群组:     1 (ROOT_GROUP)\n`)

    await prisma.$disconnect()
}

main()
    .catch((e) => {
        console.error('❌ 初始化失败:', e)
        process.exit(1)
    })
