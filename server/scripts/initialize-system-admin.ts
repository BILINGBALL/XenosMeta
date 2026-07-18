/**
 * 系统管理员初始化脚本
 * 
 * 功能：
 * 1. 创建 ROOT 系统租户
 * 2. 创建 system_admin 角色（系统级别）
 * 3. 创建系统级权限（tenant 和 permission 管理）
 * 4. 创建系统管理员用户
 * 5. 分配所有权限给 system_admin
 */

import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

// 系统级权限定义
const SYSTEM_PERMISSIONS = [
    // 租户管理权限
    { permName: '租户查看', permCode: 'sys:tenant:view', sort: 1, scope: 'system' },
    { permName: '租户新增', permCode: 'sys:tenant:add', sort: 2, scope: 'system' },
    { permName: '租户编辑', permCode: 'sys:tenant:edit', sort: 3, scope: 'system' },
    { permName: '租户删除', permCode: 'sys:tenant:delete', sort: 4, scope: 'system' },
    
    // 权限管理权限（增删改仅 system，查看权限同步放到租户级让 tenant 可见）
    { permName: '权限新增', permCode: 'sys:permission:add', sort: 12, scope: 'system' },
    { permName: '权限编辑', permCode: 'sys:permission:edit', sort: 13, scope: 'system' },
    { permName: '权限删除', permCode: 'sys:permission:delete', sort: 14, scope: 'system' },
];

// 租户级权限定义
const TENANT_PERMISSIONS = [
    // 权限查看（tenant 需要查看权限列表，但不可增删改）
    { permName: '权限查看', permCode: 'sys:permission:view', sort: 11, scope: 'tenant' },

    // 用户管理权限
    { permName: '用户查看', permCode: 'sys:user:view', sort: 21, scope: 'tenant' },
    { permName: '用户新增', permCode: 'sys:user:add', sort: 22, scope: 'tenant' },
    { permName: '用户编辑', permCode: 'sys:user:edit', sort: 23, scope: 'tenant' },
    { permName: '用户删除', permCode: 'sys:user:delete', sort: 24, scope: 'tenant' },
    { permName: '用户分配', permCode: 'sys:user:assign', sort: 25, scope: 'tenant' },
    
    // 角色管理权限
    { permName: '角色查看', permCode: 'sys:role:view', sort: 31, scope: 'tenant' },
    { permName: '角色新增', permCode: 'sys:role:add', sort: 32, scope: 'tenant' },
    { permName: '角色编辑', permCode: 'sys:role:edit', sort: 33, scope: 'tenant' },
    { permName: '角色删除', permCode: 'sys:role:delete', sort: 34, scope: 'tenant' },
    { permName: '角色分配', permCode: 'sys:role:assign', sort: 35, scope: 'tenant' },
    
    // 群组管理权限
    { permName: '群组查看', permCode: 'sys:group:view', sort: 41, scope: 'tenant' },
    { permName: '群组新增', permCode: 'sys:group:add', sort: 42, scope: 'tenant' },
    { permName: '群组编辑', permCode: 'sys:group:edit', sort: 43, scope: 'tenant' },
    { permName: '群组删除', permCode: 'sys:group:delete', sort: 44, scope: 'tenant' },
    
    // 业务表管理权限
    { permName: '表查看', permCode: 'base:table:view', sort: 51, scope: 'tenant' },
    { permName: '表新增', permCode: 'base:table:add', sort: 52, scope: 'tenant' },
    { permName: '表编辑', permCode: 'base:table:edit', sort: 53, scope: 'tenant' },
    { permName: '表删除', permCode: 'base:table:delete', sort: 54, scope: 'tenant' },
    
    // 字段管理权限
    { permName: '字段查看', permCode: 'base:field:view', sort: 61, scope: 'tenant' },
    { permName: '字段新增', permCode: 'base:field:add', sort: 62, scope: 'tenant' },
    { permName: '字段编辑', permCode: 'base:field:edit', sort: 63, scope: 'tenant' },
    { permName: '字段删除', permCode: 'base:field:delete', sort: 64, scope: 'tenant' },
    
    // 记录管理权限
    { permName: '记录查看', permCode: 'base:record:view', sort: 71, scope: 'tenant' },
    { permName: '记录新增', permCode: 'base:record:add', sort: 72, scope: 'tenant' },
    { permName: '记录编辑', permCode: 'base:record:edit', sort: 73, scope: 'tenant' },
    { permName: '记录删除', permCode: 'base:record:delete', sort: 74, scope: 'tenant' },
];

async function main() {
    console.log('=== 开始初始化系统管理员 ===\n');

    // 1. 创建 ROOT 系统租户（id 由 Prisma @default(uuid()) 自动生成）
    const rootTenant = await prisma.tenant.upsert({
        where: { tenantCode: 'ROOT' },
        update: {},
        create: {
            tenantName: '系统管理租户',
            tenantCode: 'ROOT',
            type: 'system',
            status: true,
        },
    });
    console.log(`✅ ROOT 系统租户创建成功 (ID: ${rootTenant.id}, Code: ${rootTenant.tenantCode})\n`);

    // 2. 创建系统级权限
    console.log('创建系统级权限...');
    const createdSystemPerms = [];
    for (const perm of SYSTEM_PERMISSIONS) {
        const permission = await prisma.permission.upsert({
            where: { permCode: perm.permCode },
            update: { scope: perm.scope },
            create: {
                permName: perm.permName,
                permCode: perm.permCode,
                type: 2, // 按钮类型
                sort: perm.sort,
                scope: perm.scope,
            },
        });
        createdSystemPerms.push(permission);
        console.log(`  ✅ ${permission.permName} (${permission.permCode})`);
    }
    console.log();

    // 3. 创建租户级权限
    console.log('创建租户级权限...');
    const createdTenantPerms = [];
    for (const perm of TENANT_PERMISSIONS) {
        const permission = await prisma.permission.upsert({
            where: { permCode: perm.permCode },
            update: { scope: perm.scope },
            create: {
                permName: perm.permName,
                permCode: perm.permCode,
                type: 2, // 按钮类型
                sort: perm.sort,
                scope: perm.scope,
            },
        });
        createdTenantPerms.push(permission);
        console.log(`  ✅ ${permission.permName} (${permission.permCode})`);
    }
    console.log();

    // 4. 创建 system_admin 角色（属于系统级别）
    const systemAdminRole = await prisma.role.upsert({
        where: { roleCode: 'system_admin' },
        update: {
            scope: 'system',
            tenantId: rootTenant.id,
        },
        create: {
            roleName: '系统管理员',
            roleCode: 'system_admin',
            scope: 'system', // 系统级角色
            tenantId: rootTenant.id,
            status: true,
        },
    });
    console.log(`✅ system_admin 角色创建成功 (ID: ${systemAdminRole.id})\n`);

    // 5. 给 system_admin 角色分配所有权限
    const allPermissions = [...createdSystemPerms, ...createdTenantPerms];
    console.log(`分配 ${allPermissions.length} 个权限给 system_admin...`);
    
    for (const perm of allPermissions) {
        const exists = await prisma.rolePermission.findUnique({
            where: {
                roleId_permissionId: {
                    roleId: systemAdminRole.id,
                    permissionId: perm.id,
                },
            },
        });
        
        if (!exists) {
            await prisma.rolePermission.create({
                data: {
                    roleId: systemAdminRole.id,
                    permissionId: perm.id,
                },
            });
        }
    }
    console.log('✅ system_admin 权限分配完成\n');

    // 6. 创建系统管理员用户
    const hashedPassword = await bcrypt.hash('admin123', 10);
    
    const systemAdminUser = await prisma.user.upsert({
        where: { username: 'system_admin' },
        update: {
            password: hashedPassword,
            tenantId: rootTenant.id,
            nickname: '系统管理员',
        },
        create: {
            username: 'system_admin',
            password: hashedPassword,
            nickname: '系统管理员',
            tenantId: rootTenant.id,
            status: true,
        },
    });
    console.log(`✅ 系统管理员用户创建成功 (ID: ${systemAdminUser.id})\n`);

    // 7. 给系统管理员分配 system_admin 角色
    const userRoleExists = await prisma.userRole.findUnique({
        where: {
            userId_roleId: {
                userId: systemAdminUser.id,
                roleId: systemAdminRole.id,
            },
        },
    });
    
    if (!userRoleExists) {
        await prisma.userRole.create({
            data: {
                userId: systemAdminUser.id,
                roleId: systemAdminRole.id,
            },
        });
    }
    console.log('✅ 系统管理员已分配 system_admin 角色\n');

    // 8. 创建 ROOT 根群组
    const rootGroup = await prisma.group.upsert({
        where: { id: 'ROOT_GROUP' },
        update: {},
        create: {
            id: 'ROOT_GROUP',
            groupName: '系统管理组',
            groupCode: 'ROOT_GROUP',
            tenantId: rootTenant.id,
            parentId: null,
            status: true,
        },
    });
    console.log(`✅ ROOT 根群组创建成功 (ID: ${rootGroup.id})\n`);

    // 9. 给系统管理员分配根群组
    const userGroupExists = await prisma.userGroup.findUnique({
        where: {
            userId_groupId: {
                userId: systemAdminUser.id,
                groupId: rootGroup.id,
            },
        },
    });
    
    if (!userGroupExists) {
        await prisma.userGroup.create({
            data: {
                userId: systemAdminUser.id,
                groupId: rootGroup.id,
            },
        });
    }
    console.log('✅ 系统管理员已分配 ROOT 根群组\n');

    // 总结
    console.log('=== 初始化完成 ===\n');
    console.log('📋 系统管理员登录信息:');
    console.log('   租户: ROOT (系统管理租户)');
    console.log('   用户名: system_admin');
    console.log('   密码: admin123');
    console.log('   角色: system_admin (系统管理员)');
    console.log('   权限: 全部系统级和租户级权限\n');
    
    console.log('📊 权限统计:');
    console.log(`   系统级权限: ${createdSystemPerms.length} 个`);
    console.log(`   租户级权限: ${createdTenantPerms.length} 个`);
    console.log(`   总计: ${allPermissions.length} 个\n`);

    await prisma.$disconnect();
}

main()
    .catch((e) => {
        console.error('初始化失败:', e);
        process.exit(1);
    });
