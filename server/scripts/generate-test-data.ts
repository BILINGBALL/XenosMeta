/**
 * 测试数据生成脚本
 * 功能：
 * 1. 创建一个新租户
 * 2. 创建3-5个用户，分配不同权限类型
 * 3. 每个用户创建一个业务表（至少5个字段，不同字段类型）
 * 4. 保留所有测试数据
 */

import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function generateTestData() {
    console.log('=== 开始生成测试数据 ===\n');

    try {
        // 1. 创建新租户
        console.log('1. 创建新租户...');
        const testTenant = await prisma.tenant.create({
            data: {
                id: 'test-company-001',
                tenantName: '测试科技有限公司',
                tenantCode: 'test-company',
                status: true,
            },
        });
        console.log(`   ✅ 租户创建成功: ${testTenant.tenantName} (ID: ${testTenant.id})\n`);

        // 2. 创建根群组
        console.log('2. 创建根群组...');
        const rootGroup = await prisma.group.create({
            data: {
                groupName: '测试公司总公司',
                groupCode: `ROOT_test-company`,
                tenantId: testTenant.id,
                parentId: null,
                status: true,
            },
        });
        console.log(`   ✅ 根群组创建成功: ${rootGroup.groupName} (ID: ${rootGroup.id})\n`);

        // 3. 创建3-5个用户，分配不同角色
        console.log('3. 创建测试用户...');
        const testUsers = [
            {
                username: 'test-user-001',
                password: '123456',
                nickname: '张三',
                roleName: '部门经理',
                roleCode: 'department-manager',
                permissions: [
                    'sys:user:view', 'sys:group:view',
                    'base:table:view', 'base:table:add', 'base:table:edit',
                    'base:field:view', 'base:field:add',
                    'base:record:view', 'base:record:add', 'base:record:edit'
                ],
                groupName: '研发部',
                groupCode: 'dev-dept',
            },
            {
                username: 'test-user-002',
                password: '123456',
                nickname: '李四',
                roleName: '普通员工',
                roleCode: 'regular-staff',
                permissions: [
                    'sys:user:view', 'sys:group:view',
                    'base:table:view', 'base:field:view',
                    'base:record:view', 'base:record:add'
                ],
                groupName: '产品部',
                groupCode: 'product-dept',
            },
            {
                username: 'test-user-003',
                password: '123456',
                nickname: '王五',
                roleName: '实习生',
                roleCode: 'intern',
                permissions: [
                    'sys:user:view', 'base:table:view',
                    'base:field:view', 'base:record:view'
                ],
                groupName: '设计部',
                groupCode: 'design-dept',
            },
        ];

        const createdUsers: any[] = [];

        for (const userInfo of testUsers) {
            // 创建子群组
            const group = await prisma.group.create({
                data: {
                    groupName: userInfo.groupName,
                    groupCode: userInfo.groupCode,
                    tenantId: testTenant.id,
                    parentId: rootGroup.id,
                    status: true,
                },
            });

            // 创建用户
            const user = await prisma.user.create({
                data: {
                    username: userInfo.username,
                    password: await bcrypt.hash(userInfo.password, 10),
                    nickname: userInfo.nickname,
                    tenantId: testTenant.id,
                    status: true,
                },
            });

            // 创建角色
            const role = await prisma.role.create({
                data: {
                    roleName: userInfo.roleName,
                    roleCode: userInfo.roleCode,
                    tenantId: testTenant.id,
                    status: true,
                },
            });

            // 关联角色和用户
            await prisma.userRole.create({
                data: {
                    userId: user.id,
                    roleId: role.id,
                },
            });

            // 关联用户和群组
            await prisma.userGroup.create({
                data: {
                    userId: user.id,
                    groupId: group.id,
                },
            });

            // 获取权限并分配
            const permissions = await prisma.permission.findMany({
                where: {
                    permCode: {
                        in: userInfo.permissions,
                    },
                },
            });

            if (permissions.length > 0) {
                await prisma.rolePermission.createMany({
                    data: permissions.map(perm => ({
                        roleId: role.id,
                        permissionId: perm.id,
                    })),
                });
            }

            createdUsers.push({
                user,
                role,
                group,
                password: userInfo.password,
                roleName: userInfo.roleName,
            });

            console.log(`   ✅ 用户 ${user.nickname} (${user.username}) 创建成功`);
        }
        console.log('');

        // 4. 为每个用户创建业务表和字段
        console.log('4. 为每个用户创建业务表...');

        const tableConfigs = [
            {
                tableName: '客户管理表',
                description: '研发部客户信息管理',
                fields: [
                    { name: '客户姓名', type: 'text' },
                    { name: '客户年龄', type: 'number' },
                    { name: '联系电话', type: 'text' },
                    { name: '客户等级', type: 'select' },
                    { name: '是否VIP', type: 'checkbox' },
                    { name: '创建日期', type: 'date' },
                    { name: '备注信息', type: 'text' },
                ],
            },
            {
                tableName: '产品需求表',
                description: '产品部需求跟踪',
                fields: [
                    { name: '需求名称', type: 'text' },
                    { name: '优先级', type: 'number' },
                    { name: '状态', type: 'select' },
                    { name: '需求描述', type: 'text' },
                    { name: '截止日期', type: 'date' },
                    { name: '是否紧急', type: 'checkbox' },
                    { name: '预估工时', type: 'number' },
                ],
            },
            {
                tableName: '设计稿管理表',
                description: '设计部设计稿管理',
                fields: [
                    { name: '设计稿名称', type: 'text' },
                    { name: '设计师', type: 'text' },
                    { name: '版本号', type: 'number' },
                    { name: '设计状态', type: 'select' },
                    { name: '是否定稿', type: 'checkbox' },
                    { name: '创建日期', type: 'date' },
                    { name: '文件大小', type: 'number' },
                ],
            },
        ];

        const createdTables: any[] = [];

        for (let i = 0; i < createdUsers.length; i++) {
            const userData = createdUsers[i];
            const config = tableConfigs[i];

            // 创建动态表
            const table = await prisma.dynamicTable.create({
                data: {
                    tableId: `tbl_test_${Date.now()}_${i}`,
                    name: config.tableName,
                    tenantId: testTenant.id,
                    groupId: userData.group.id,
                    createdBy: userData.user.id,
                },
            });

            // 创建字段
            const fields = await Promise.all(
                config.fields.map((field, idx) =>
                    prisma.dynamicField.create({
                        data: {
                            fieldId: `fld_test_${Date.now()}_${i}_${idx}`,
                            name: field.name,
                            type: field.type,
                            tableId: table.tableId,
                            tenantId: testTenant.id,
                            groupId: userData.group.id,
                            createdBy: userData.user.id,
                        },
                    })
                )
            );

            createdTables.push({
                table,
                fields,
                user: userData.user,
                tableName: config.tableName,
            });

            console.log(`   ✅ ${userData.user.nickname} 的表 ${config.tableName} 创建成功，包含 ${fields.length} 个字段`);
        }

        // 5. 输出测试数据总结
        console.log('\n=== 测试数据生成完成 ===');
        console.log('');
        console.log('📋 租户信息:');
        console.log(`  - 租户名称: ${testTenant.tenantName}`);
        console.log(`  - 租户ID: ${testTenant.id}`);
        console.log('');
        console.log('👥 用户信息:');

        for (const userData of createdUsers) {
            console.log(`  - 用户: ${userData.user.nickname}`);
            console.log(`    用户名: ${userData.user.username}`);
            console.log(`    密码: ${userData.password}`);
            console.log(`    角色: ${userData.roleName}`);
            console.log(`    群组: ${userData.group.groupName}`);
            console.log('');
        }

        console.log('📊 业务表信息:');
        for (const tableData of createdTables) {
            console.log(`  - 表名: ${tableData.tableName}`);
            console.log(`    创建者: ${tableData.user.nickname}`);
            console.log(`    字段数: ${tableData.fields.length}`);
            console.log('');
        }

        console.log('✅ 所有测试数据已保留！');

        return {
            tenant: testTenant,
            users: createdUsers,
            tables: createdTables,
        };

    } catch (error) {
        console.error('\n❌ 生成测试数据失败:', error);
        throw error;
    } finally {
        await prisma.$disconnect();
    }
}

// 执行
generateTestData()
    .then(() => {
        console.log('\n脚本执行成功完成');
        process.exit(0);
    })
    .catch((error) => {
        console.error('\n脚本执行失败:', error);
        process.exit(1);
    });
