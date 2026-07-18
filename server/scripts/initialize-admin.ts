/**
 * 初始化管理员角色和权限脚本
 * 运行此脚本会创建：
 * 1. admin 角色（拥有所有权限）
 * 2. 所有系统权限（sys:*）
 * 3. 所有业务权限（base:*）
 * 4. admin 用户（属于根群组，拥有 admin 角色）
 */

import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function initializeAdmin() {
    console.log('=== 开始初始化管理员角色和权限 ===\n');

    try {
        // 1. 定义所有权限
        const permissions = [
            // 系统管理权限
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
            { permName: '权限新增', permCode: 'sys:permission:add', type: 2, sort: 22 },
            { permName: '权限编辑', permCode: 'sys:permission:edit', type: 2, sort: 23 },
            { permName: '权限删除', permCode: 'sys:permission:delete', type: 2, sort: 24 },

            { permName: '群组查看', permCode: 'sys:group:view', type: 2, sort: 31 },
            { permName: '群组新增', permCode: 'sys:group:add', type: 2, sort: 32 },
            { permName: '群组编辑', permCode: 'sys:group:edit', type: 2, sort: 33 },
            { permName: '群组删除', permCode: 'sys:group:delete', type: 2, sort: 34 },

            { permName: '租户查看', permCode: 'sys:tenant:view', type: 2, sort: 41 },
            { permName: '租户新增', permCode: 'sys:tenant:add', type: 2, sort: 42 },
            { permName: '租户编辑', permCode: 'sys:tenant:edit', type: 2, sort: 43 },
            { permName: '租户删除', permCode: 'sys:tenant:delete', type: 2, sort: 44 },

            // 基础业务权限
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

        console.log('1. 创建所有权限...');
        const createdPermissions = [];
        for (const perm of permissions) {
            const permission = await prisma.permission.upsert({
                where: { permCode: perm.permCode },
                update: perm,
                create: perm,
            });
            createdPermissions.push(permission);
            console.log(`   ✓ ${perm.permName} (${perm.permCode})`);
        }
        console.log(`   共创建 ${createdPermissions.length} 个权限\n`);

        // 2. 创建 system 租户（如果不存在）
        console.log('2. 检查 system 租户...');
        let systemTenant = await prisma.tenant.findUnique({
            where: { id: 'system' }
        });

        if (!systemTenant) {
            systemTenant = await prisma.tenant.create({
                data: {
                    id: 'system',
                    tenantName: '系统',
                    tenantCode: 'system',
                    status: true,
                },
            });
            console.log(`   ✓ system 租户创建成功 (ID: ${systemTenant.id})\n`);
        } else {
            console.log(`   ✓ system 租户已存在 (ID: ${systemTenant.id})\n`);
        }

        // 3. 创建 admin 角色
        console.log('3. 创建 admin 角色...');
        const adminRole = await prisma.role.upsert({
            where: { roleCode: 'admin' },
            update: {
                roleName: '管理员',
                status: true,
            },
            create: {
                roleName: '管理员',
                roleCode: 'admin',
                tenantId: systemTenant.id,
                status: true,
            },
        });
        console.log(`   ✓ admin 角色创建成功 (ID: ${adminRole.id})\n`);

        // 4. 给 admin 角色分配所有权限
        console.log('4. 给 admin 角色分配所有权限...');
        // 先删除现有的权限关联
        await prisma.rolePermission.deleteMany({
            where: { roleId: adminRole.id }
        });

        // 创建新的权限关联
        const rolePermissions = createdPermissions.map(perm => ({
            roleId: adminRole.id,
            permissionId: perm.id,
        }));

        await prisma.rolePermission.createMany({
            data: rolePermissions,
        });
        console.log(`   ✓ admin 角色已分配 ${createdPermissions.length} 个权限\n`);

        // 5. 创建默认租户（如果不存在）
        console.log('5. 检查默认租户...');
        let defaultTenant = await prisma.tenant.findUnique({
            where: { id: 'default' }
        });

        if (!defaultTenant) {
            defaultTenant = await prisma.tenant.create({
                data: {
                    id: 'default',
                    tenantName: '默认租户',
                    tenantCode: 'default',
                    status: true,
                },
            });
            console.log(`   ✓ 默认租户创建成功 (ID: ${defaultTenant.id})\n`);

            // 6. 为默认租户创建根群组
            console.log('6. 创建默认租户的根群组...');
            const rootGroup = await prisma.group.create({
                data: {
                    groupName: '根组织',
                    groupCode: `ROOT_default`,
                    tenantId: defaultTenant.id,
                    parentId: null,
                    status: true,
                },
            });
            console.log(`   ✓ 根群组创建成功 (ID: ${rootGroup.id})\n`);

            // 7. 创建 admin 用户
            console.log('7. 创建 admin 用户...');
            const password = 'admin123';
            const salt = await bcrypt.genSalt(10);
            const pwdHash = await bcrypt.hash(password, salt);

            const adminUser = await prisma.user.create({
                data: {
                    username: 'admin',
                    password: pwdHash,
                    nickname: '系统管理员',
                    tenantId: defaultTenant.id,
                    status: true,
                },
            });
            console.log(`   ✓ admin 用户创建成功 (ID: ${adminUser.id})\n`);

            // 8. 给 admin 用户分配 admin 角色
            console.log('8. 给 admin 用户分配 admin 角色...');
            await prisma.userRole.create({
                data: {
                    userId: adminUser.id,
                    roleId: adminRole.id,
                },
            });
            console.log(`   ✓ admin 用户已分配 admin 角色\n`);

            // 9. 给 admin 用户分配根群组
            console.log('9. 给 admin 用户分配根群组...');
            await prisma.userGroup.create({
                data: {
                    userId: adminUser.id,
                    groupId: rootGroup.id,
                },
            });
            console.log(`   ✓ admin 用户已分配根群组\n`);

            console.log('=== 初始化完成！===\n');
            console.log('Admin 用户信息：');
            console.log(`  用户名: admin`);
            console.log(`  密码: ${password}`);
            console.log(`  租户: ${defaultTenant.tenantName}`);
            console.log(`  角色: 管理员 (admin)`);
            console.log(`  群组: 根组织`);
            console.log('\n提示：首次使用后请立即修改密码！');
        } else {
            console.log(`   ✓ 默认租户已存在 (ID: ${defaultTenant.id})\n`);

            // 检查是否已有 admin 用户
            const existingAdmin = await prisma.user.findUnique({
                where: { username: 'admin' }
            });

            if (existingAdmin) {
                console.log('   ✓ admin 用户已存在，跳过创建\n');
            } else {
                // 创建 admin 用户
                console.log('6. 创建 admin 用户...');
                const password = 'admin123';
                const salt = await bcrypt.genSalt(10);
                const pwdHash = await bcrypt.hash(password, salt);

                const adminUser = await prisma.user.create({
                    data: {
                        username: 'admin',
                        password: pwdHash,
                        nickname: '系统管理员',
                        tenantId: defaultTenant.id,
                        status: true,
                    },
                });
                console.log(`   ✓ admin 用户创建成功 (ID: ${adminUser.id})\n`);

                // 给 admin 用户分配 admin 角色
                console.log('7. 给 admin 用户分配 admin 角色...');
                await prisma.userRole.create({
                    data: {
                        userId: adminUser.id,
                        roleId: adminRole.id,
                    },
                });
                console.log(`   ✓ admin 用户已分配 admin 角色\n`);

                // 获取根群组
                const rootGroup = await prisma.group.findFirst({
                    where: {
                        tenantId: defaultTenant.id,
                        groupCode: { startsWith: 'ROOT_' }
                    }
                });

                if (rootGroup) {
                    // 给 admin 用户分配根群组
                    console.log('8. 给 admin 用户分配根群组...');
                    await prisma.userGroup.create({
                        data: {
                            userId: adminUser.id,
                            groupId: rootGroup.id,
                        },
                    });
                    console.log(`   ✓ admin 用户已分配根群组\n`);
                }

                console.log('=== 初始化完成！===\n');
                console.log('Admin 用户信息：');
                console.log(`  用户名: admin`);
                console.log(`  密码: ${password}`);
                console.log(`  租户: ${defaultTenant.tenantName}`);
                console.log(`  角色: 管理员 (admin)`);
                console.log(`  群组: 根组织`);
                console.log('\n提示：首次使用后请立即修改密码！');
            }
        }

        console.log('\n=== 所有初始化工作已完成！===');

    } catch (error) {
        console.error('初始化失败：', error);
        throw error;
    } finally {
        await prisma.$disconnect();
    }
}

// 运行初始化
initializeAdmin()
    .then(() => {
        console.log('\n初始化脚本执行成功！');
        process.exit(0);
    })
    .catch((error) => {
        console.error('\n初始化脚本执行失败：', error);
        process.exit(1);
    });
