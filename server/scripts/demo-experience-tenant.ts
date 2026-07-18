/**
 * 体验租户测试脚本
 * 
 * 演示如何创建和管理体验租户
 */

import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
    console.log('=== 体验租户功能演示 ===\n');

    // 1. 获取 system_admin 用户（用于演示）
    const systemAdmin = await prisma.user.findUnique({
        where: { username: 'system_admin' },
        include: { roles: true }
    });
    
    if (!systemAdmin) {
        console.log('❌ system_admin 用户不存在，请先运行 npm run init:system\n');
        return;
    }
    
    console.log(`✅ system_admin 用户存在 (ID: ${systemAdmin.id})\n`);

    // 2. 创建一个体验租户
    console.log('创建体验租户...\n');
    const experienceTenant = await prisma.tenant.create({
        data: {
            id: 'exp_demo_tenant',
            tenantName: '演示体验租户',
            tenantCode: 'exp_demo_tenant', // 体验租户必须以 exp_ 开头
            type: 'experience', // 体验租户类型
            status: true,
        },
    });
    console.log(`✅ 体验租户创建成功`);
    console.log(`   ID: ${experienceTenant.id}`);
    console.log(`   名称: ${experienceTenant.tenantName}`);
    console.log(`   类型: ${experienceTenant.type}`);
    console.log();

    // 3. 创建体验租户的根群组
    const expRootGroup = await prisma.group.create({
        data: {
            groupName: '体验公司总部',
            groupCode: 'exp_demo_root',
            tenantId: experienceTenant.id,
            parentId: null,
            status: true,
        },
    });
    console.log(`✅ 体验租户根群组创建成功 (ID: ${expRootGroup.id})\n`);

    // 4. 创建一个普通用户
    const hashedPassword = await bcrypt.hash('user123', 10);
    const expUser = await prisma.user.create({
        data: {
            username: 'exp_demo_user',
            password: hashedPassword,
            nickname: '体验用户',
            tenantId: experienceTenant.id,
            status: true,
        },
    });
    console.log(`✅ 体验用户创建成功 (ID: ${expUser.id})\n`);

    // 5. 创建 tenant_admin 角色（属于体验租户）
    // 先获取租户级权限
    const tenantPermissions = await prisma.permission.findMany({
        where: { scope: 'tenant' }
    });
    
    const tenantAdminRole = await prisma.role.create({
        data: {
            roleName: '体验租户管理员',
            roleCode: 'exp_tenant_admin',
            scope: 'tenant', // 租户级角色
            tenantId: experienceTenant.id,
            status: true,
        },
    });
    
    // 给 tenant_admin 角色分配所有租户级权限
    for (const perm of tenantPermissions) {
        await prisma.rolePermission.create({
            data: {
                roleId: tenantAdminRole.id,
                permissionId: perm.id,
            },
        });
    }
    console.log(`✅ 体验租户管理员角色创建成功 (ID: ${tenantAdminRole.id})\n`);

    // 6. 给体验用户分配 tenant_admin 角色
    await prisma.userRole.create({
        data: {
            userId: expUser.id,
            roleId: tenantAdminRole.id,
        },
    });
    
    // 给体验用户分配根群组
    await prisma.userGroup.create({
        data: {
            userId: expUser.id,
            groupId: expRootGroup.id,
        },
    });
    console.log(`✅ 体验用户已分配 tenant_admin 角色和根群组\n`);

    // 7. 创建一个正式租户（仅供演示）
    console.log('创建正式租户（仅供演示）...\n');
    const formalTenant = await prisma.tenant.create({
        data: {
            id: 'formal_demo_company',
            tenantName: '演示正式公司',
            tenantCode: 'formal_demo_company',
            type: 'normal', // 正式租户
            status: true,
        },
    });
    console.log(`✅ 正式租户创建成功`);
    console.log(`   ID: ${formalTenant.id}`);
    console.log(`   名称: ${formalTenant.tenantName}`);
    console.log(`   类型: ${formalTenant.type}\n`);

    // 总结
    console.log('=== 演示完成 ===\n');
    console.log('📋 体验租户登录信息:');
    console.log('   租户ID: exp_demo_tenant');
    console.log('   用户名: exp_demo_user');
    console.log('   密码: user123');
    console.log('   角色: 体验租户管理员');
    console.log('   权限: 租户级权限（无法管理系统级资源）\n');
    
    console.log('📋 正式租户信息:');
    console.log('   租户ID: formal_demo_company');
    console.log('   类型: normal（正式租户）\n');
    
    console.log('📋 系统管理员登录信息:');
    console.log('   租户ID: ROOT');
    console.log('   用户名: system_admin');
    console.log('   密码: admin123');
    console.log('   角色: system_admin');
    console.log('   权限: 所有系统级和租户级权限\n');

    console.log('💡 说明:');
    console.log('   - 体验租户用户只能管理自己租户内的资源');
    console.log('   - 体验租户用户无法创建/删除其他租户');
    console.log('   - 体验租户用户无法管理系统级权限');
    console.log('   - 只有 system_admin 可以管理系统资源\n');

    await prisma.$disconnect();
}

main()
    .catch((e) => {
        console.error('演示失败:', e);
        process.exit(1);
    });
