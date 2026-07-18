/**
 * 完整测试数据生成脚本
 * 功能：
 * 1. 创建一个新租户
 * 2. 创建3-5个用户，分配不同权限类型和群组
 * 3. 每个用户创建一个业务表（至少5个字段）
 * 4. 保留所有测试数据
 */

import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import {generateTableId, generateFieldId, generateRecordId} from '../src/utils/id-generator';

const prisma = new PrismaClient();

async function generateCompleteTestData() {
    console.log('=== 开始生成完整测试数据 ===\n');

    try {
        // 1. 创建新租户
        console.log('1. 创建新租户...');
        const testTenant = await prisma.tenant.create({
            data: {
                id: 'test-company-2026',
                tenantName: '创新科技有限公司',
                tenantCode: 'innovation-tech',
                status: true,
            },
        });
        console.log(`   ✅ 租户创建成功: ${testTenant.tenantName} (ID: ${testTenant.id})\n`);

        // 2. 创建所有权限
        console.log('2. 确保权限存在...');
        const allPermissions = [
            { permName: '用户查看', permCode: 'sys:user:view', type: 2, sort: 1 },
            { permName: '用户新增', permCode: 'sys:user:add', type: 2, sort: 2 },
            { permName: '用户编辑', permCode: 'sys:user:edit', type: 2, sort: 3 },
            { permName: '用户删除', permCode: 'sys:user:delete', type: 2, sort: 4 },
            { permName: '用户分配', permCode: 'sys:user:assign', type: 2, sort: 5 },
            { permName: '角色查看', permCode: 'sys:role:view', type: 2, sort: 11 },
            { permName: '角色新增', permCode: 'sys:role:add', type: 2, sort: 12 },
            { permName: '角色编辑', permCode: 'sys:role:edit', type: 2, sort: 13 },
            { permName: '角色删除', permCode: 'sys:role:delete', type: 2, sort: 14 },
            { permName: '角色分配', permCode: 'sys:role:assign', type: 2, sort: 15 },
            { permName: '权限查看', permCode: 'sys:permission:view', type: 2, sort: 21 },
            { permName: '群组查看', permCode: 'sys:group:view', type: 2, sort: 31 },
            { permName: '群组新增', permCode: 'sys:group:add', type: 2, sort: 32 },
            { permName: '群组编辑', permCode: 'sys:group:edit', type: 2, sort: 33 },
            { permName: '群组删除', permCode: 'sys:group:delete', type: 2, sort: 34 },
            { permName: '租户查看', permCode: 'sys:tenant:view', type: 2, sort: 41 },
            { permName: '表查看', permCode: 'base:table:view', type: 2, sort: 51 },
            { permName: '表新增', permCode: 'base:table:add', type: 2, sort: 52 },
            { permName: '表编辑', permCode: 'base:table:edit', type: 2, sort: 53 },
            { permName: '表删除', permCode: 'base:table:delete', type: 2, sort: 54 },
            { permName: '字段查看', permCode: 'base:field:view', type: 2, sort: 61 },
            { permName: '字段新增', permCode: 'base:field:add', type: 2, sort: 62 },
            { permName: '字段编辑', permCode: 'base:field:edit', type: 2, sort: 63 },
            { permName: '字段删除', permCode: 'base:field:delete', type: 2, sort: 64 },
            { permName: '记录查看', permCode: 'base:record:view', type: 2, sort: 71 },
            { permName: '记录新增', permCode: 'base:record:add', type: 2, sort: 72 },
            { permName: '记录编辑', permCode: 'base:record:edit', type: 2, sort: 73 },
            { permName: '记录删除', permCode: 'base:record:delete', type: 2, sort: 74 },
        ];

        const createdPermissions: any[] = [];
        for (const perm of allPermissions) {
            const existing = await prisma.permission.findFirst({
                where: { permCode: perm.permCode },
            });
            if (!existing) {
                const permission = await prisma.permission.create({ data: perm });
                createdPermissions.push(permission);
            }
        }
        console.log(`   ✅ 权限准备完成，已创建 ${createdPermissions.length} 个新权限\n`);

        // 3. 创建根群组
        console.log('3. 创建根群组...');
        const rootGroup = await prisma.group.create({
            data: {
                groupName: '创新科技总公司',
                groupCode: `ROOT_innovation-tech`,
                tenantId: testTenant.id,
                parentId: null,
                status: true,
            },
        });
        console.log(`   ✅ 根群组创建成功: ${rootGroup.groupName}\n`);

        // 4. 创建子群组
        console.log('4. 创建子群组...');
        const deptGroups = [
            { name: '研发部', code: 'rnd-dept' },
            { name: '产品部', code: 'product-dept' },
            { name: '销售部', code: 'sales-dept' },
            { name: '运营部', code: 'operation-dept' },
        ];

        const createdDeptGroups: any[] = [];
        for (const dept of deptGroups) {
            const group = await prisma.group.create({
                data: {
                    groupName: dept.name,
                    groupCode: dept.code,
                    tenantId: testTenant.id,
                    parentId: rootGroup.id,
                    status: true,
                },
            });
            createdDeptGroups.push(group);
            console.log(`   ✅ ${dept.name} 创建成功`);
        }
        console.log('');

        // 5. 创建3-5个测试用户，分配不同角色和权限
        console.log('5. 创建测试用户和角色...');
        const testUserConfigs = [
            {
                username: 'manager_wang',
                password: '123456',
                nickname: '王经理',
                groupIndex: 0,
                roleName: '部门经理',
                roleCode: 'department-manager',
                permissions: [
                    'sys:user:view', 'sys:user:add', 'sys:user:edit', 'sys:user:assign',
                    'sys:group:view',
                    'base:table:view', 'base:table:add', 'base:table:edit',
                    'base:field:view', 'base:field:add', 'base:field:edit',
                    'base:record:view', 'base:record:add', 'base:record:edit', 'base:record:delete',
                ],
            },
            {
                username: 'dev_li',
                password: '123456',
                nickname: '李开发',
                groupIndex: 0,
                roleName: '开发工程师',
                roleCode: 'developer',
                permissions: [
                    'sys:user:view', 'sys:group:view',
                    'base:table:view',
                    'base:field:view',
                    'base:record:view', 'base:record:add', 'base:record:edit',
                ],
            },
            {
                username: 'product_zhang',
                password: '123456',
                nickname: '张产品',
                groupIndex: 1,
                roleName: '产品经理',
                roleCode: 'product-manager',
                permissions: [
                    'sys:user:view', 'sys:group:view',
                    'base:table:view', 'base:table:add',
                    'base:field:view', 'base:field:add',
                    'base:record:view', 'base:record:add',
                ],
            },
            {
                username: 'sales_zhao',
                password: '123456',
                nickname: '赵销售',
                groupIndex: 2,
                roleName: '销售代表',
                roleCode: 'sales-rep',
                permissions: [
                    'sys:user:view',
                    'base:table:view',
                    'base:field:view',
                    'base:record:view', 'base:record:add',
                ],
            },
        ];

        const createdUsers: any[] = [];

        for (const config of testUserConfigs) {
            // 创建用户
            const user = await prisma.user.create({
                data: {
                    username: config.username,
                    password: await bcrypt.hash(config.password, 10),
                    nickname: config.nickname,
                    tenantId: testTenant.id,
                    status: true,
                },
            });

            // 创建角色
            const role = await prisma.role.create({
                data: {
                    roleName: config.roleName,
                    roleCode: config.roleCode,
                    tenantId: testTenant.id,
                    status: true,
                },
            });

            // 关联用户和角色
            await prisma.userRole.create({
                data: {
                    userId: user.id,
                    roleId: role.id,
                },
            });

            // 关联用户和群组
            const group = createdDeptGroups[config.groupIndex];
            await prisma.userGroup.create({
                data: {
                    userId: user.id,
                    groupId: group.id,
                },
            });

            // 分配权限给角色
            const permissionsToAssign = await prisma.permission.findMany({
                where: { permCode: { in: config.permissions } },
            });

            if (permissionsToAssign.length > 0) {
                await prisma.rolePermission.createMany({
                    data: permissionsToAssign.map(perm => ({
                        roleId: role.id,
                        permissionId: perm.id,
                    })),
                });
            }

            createdUsers.push({
                user,
                role,
                group,
                password: config.password,
                roleName: config.roleName,
            });

            console.log(`   ✅ 用户 ${config.nickname} (${config.username}) 创建成功`);
        }
        console.log('');

        // 6. 为每个用户创建业务表和字段
        console.log('6. 为每个用户创建业务表...');

        const tableConfigs = [
            {
                tableName: '研发项目管理表',
                description: '研发部项目跟踪管理',
                fields: [
                    { name: '项目名称', type: 'text' },
                    { name: '项目进度', type: 'number' },
                    { name: '项目状态', type: 'select' },
                    { name: '项目描述', type: 'text' },
                    { name: '开始日期', type: 'date' },
                    { name: '是否紧急', type: 'checkbox' },
                    { name: '负责人', type: 'text' },
                ],
            },
            {
                tableName: 'Bug跟踪表',
                description: '开发部Bug问题跟踪',
                fields: [
                    { name: 'Bug标题', type: 'text' },
                    { name: '严重程度', type: 'number' },
                    { name: '优先级', type: 'select' },
                    { name: '复现步骤', type: 'text' },
                    { name: '发现日期', type: 'date' },
                    { name: '是否已修复', type: 'checkbox' },
                    { name: '修复版本', type: 'text' },
                ],
            },
            {
                tableName: '需求收集表',
                description: '产品部需求收集',
                fields: [
                    { name: '需求标题', type: 'text' },
                    { name: '优先级', type: 'number' },
                    { name: '状态', type: 'select' },
                    { name: '详细描述', type: 'text' },
                    { name: '期望上线日期', type: 'date' },
                    { name: '是否已评审', type: 'checkbox' },
                    { name: '提出人', type: 'text' },
                ],
            },
            {
                tableName: '客户线索表',
                description: '销售部客户线索管理',
                fields: [
                    { name: '客户姓名', type: 'text' },
                    { name: '预算金额', type: 'number' },
                    { name: '线索来源', type: 'select' },
                    { name: '客户需求', type: 'text' },
                    { name: '联系日期', type: 'date' },
                    { name: '是否有意向', type: 'checkbox' },
                    { name: '联系方式', type: 'text' },
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
                    tableId: generateTableId(),
                    name: config.tableName,
                    tenantId: testTenant.id,
                    groupId: userData.group.id,
                    createdBy: userData.user.id,
                },
            });

            // 创建字段
            const fields = await Promise.all(
                config.fields.map((field) =>
                    prisma.dynamicField.create({
                        data: {
                            fieldId: generateFieldId(),
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
generateCompleteTestData()
    .then(() => {
        console.log('\n脚本执行成功完成');
        process.exit(0);
    })
    .catch((error) => {
        console.error('\n脚本执行失败:', error);
        process.exit(1);
    });
