import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { generateTableId, generateFieldId, generateRecordId } from '../src/utils/id-generator';

const prisma = new PrismaClient();

async function main() {
    console.log('=== 创建测试租户和Admin用户 ===\n');

    // 1. 创建测试租户
    const testTenant = await prisma.tenant.upsert({
        where: { id: 'test-tenant' },
        update: {},
        create: {
            id: 'test-tenant',
            tenantName: '测试公司',
            tenantCode: 'test_company',
            status: true,
        },
    });
    console.log(`✅ 测试租户创建成功: ${testTenant.tenantName} (ID: ${testTenant.id})\n`);

    // 2. 创建根群组
    const rootGroup = await prisma.group.upsert({
        where: { id: 'test-root-group' },
        update: {},
        create: {
            id: 'test-root-group',
            groupName: '测试公司总部',
            groupCode: 'ROOT_test_company',
            tenantId: testTenant.id,
            parentId: null,
            status: true,
        },
    });
    console.log(`✅ 根群组创建成功: ${rootGroup.groupName} (ID: ${rootGroup.id})\n`);

    // 3. 检查或创建admin角色
    let adminRole = await prisma.role.findFirst({
        where: { roleCode: 'admin' }
    });

    if (!adminRole) {
        // 获取所有权限
        const allPermissions = await prisma.permission.findMany();
        
        adminRole = await prisma.role.create({
            data: {
                id: 'test-admin-role',
                roleName: '管理员',
                roleCode: 'admin',
                tenantId: testTenant.id,
                status: true,
                permissions: {
                    create: allPermissions.map(perm => ({
                        permissionId: perm.id,
                    })),
                },
            },
        });
        console.log(`✅ 管理员角色创建成功 (ID: ${adminRole.id})，已分配 ${allPermissions.length} 个权限\n`);
    } else {
        console.log(`✅ 管理员角色已存在 (ID: ${adminRole.id})\n`);
    }

    // 4. 加密密码
    const hashedPassword = await bcrypt.hash('admin123', 10);

    // 5. 创建admin用户
    const adminUser = await prisma.user.upsert({
        where: { username: 'admin' },
        update: {
            password: hashedPassword,
            tenantId: testTenant.id,
        },
        create: {
            username: 'admin',
            password: hashedPassword,
            nickname: '管理员',
            tenantId: testTenant.id,
            status: true,
        },
    });
    console.log(`✅ Admin用户创建成功: ${adminUser.username} (ID: ${adminUser.id})\n`);

    // 6. 给用户分配admin角色
    const userRoleExists = await prisma.userRole.findFirst({
        where: {
            userId: adminUser.id,
            roleId: adminRole.id,
        },
    });

    if (!userRoleExists) {
        await prisma.userRole.create({
            data: {
                userId: adminUser.id,
                roleId: adminRole.id,
            },
        });
        console.log(`✅ 用户已分配 admin 角色\n`);
    } else {
        console.log(`✅ 用户已有 admin 角色\n`);
    }

    // 7. 给用户分配根群组
    const userGroupExists = await prisma.userGroup.findFirst({
        where: {
            userId: adminUser.id,
            groupId: rootGroup.id,
        },
    });

    if (!userGroupExists) {
        await prisma.userGroup.create({
            data: {
                userId: adminUser.id,
                groupId: rootGroup.id,
            },
        });
        console.log(`✅ 用户已分配根群组\n`);
    } else {
        console.log(`✅ 用户已有根群组\n`);
    }

    console.log('=== 创建完成 ===\n');
    console.log('📋 登录信息:');
    console.log(`   租户: ${testTenant.tenantName}`);
    console.log(`   用户名: admin`);
    console.log(`   密码: admin123`);
    console.log(`   角色: 管理员 (拥有所有权限)`);
    console.log(`   群组: ${rootGroup.groupName}`);

    await prisma.$disconnect();
}

main()
    .catch((e) => {
        console.error('创建失败:', e);
        process.exit(1);
    });
