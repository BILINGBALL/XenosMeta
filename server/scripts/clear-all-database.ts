/**
 * 完全清空数据库脚本
 * 用途：清空所有表数据，让数据库回到全新状态
 * ⚠️ 警告：此操作会删除所有数据！
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function clearAllDatabase() {
    console.log('=== 开始完全清空数据库 ===');
    console.log('⚠️⚠️⚠️ 警告：此操作将删除所有数据！\n');

    try {
        // 1. 删除动态业务记录（DynamicRecord）
        console.log('1. 删除动态记录...');
        const deletedRecords = await prisma.dynamicRecord.deleteMany({});
        console.log(`   已删除 ${deletedRecords.count} 条`);

        // 2. 删除动态业务字段（DynamicField）
        console.log('2. 删除动态字段...');
        const deletedFields = await prisma.dynamicField.deleteMany({});
        console.log(`   已删除 ${deletedFields.count} 个`);

        // 3. 删除动态业务表（DynamicTable）
        console.log('3. 删除动态表...');
        const deletedTables = await prisma.dynamicTable.deleteMany({});
        console.log(`   已删除 ${deletedTables.count} 张`);

        // 4. 删除用户-群组关联
        console.log('4. 删除用户-群组关联...');
        const deletedUserGroups = await prisma.userGroup.deleteMany({});
        console.log(`   已删除 ${deletedUserGroups.count} 条`);

        // 5. 删除用户-角色关联
        console.log('5. 删除用户-角色关联...');
        const deletedUserRoles = await prisma.userRole.deleteMany({});
        console.log(`   已删除 ${deletedUserRoles.count} 条`);

        // 6. 删除角色-权限关联
        console.log('6. 删除角色-权限关联...');
        const deletedRolePermissions = await prisma.rolePermission.deleteMany({});
        console.log(`   已删除 ${deletedRolePermissions.count} 条`);

        // 7. 删除群组
        console.log('7. 删除群组...');
        const deletedGroups = await prisma.group.deleteMany({});
        console.log(`   已删除 ${deletedGroups.count} 个`);

        // 8. 删除用户
        console.log('8. 删除用户...');
        const deletedUsers = await prisma.user.deleteMany({});
        console.log(`   已删除 ${deletedUsers.count} 个`);

        // 9. 删除角色
        console.log('9. 删除角色...');
        const deletedRoles = await prisma.role.deleteMany({});
        console.log(`   已删除 ${deletedRoles.count} 个`);

        // 10. 删除权限
        console.log('10. 删除权限...');
        const deletedPermissions = await prisma.permission.deleteMany({});
        console.log(`   已删除 ${deletedPermissions.count} 个`);

        // 11. 删除租户
        console.log('11. 删除租户...');
        const deletedTenants = await prisma.tenant.deleteMany({});
        console.log(`   已删除 ${deletedTenants.count} 个`);

        console.log('\n✅ 数据库完全清空完成！');
        console.log('   现在数据库是全新的空状态。\n');

        // 验证数据已清空
        console.log('=== 验证清空结果 ===');
        const counts = {
            Tenant: await prisma.tenant.count(),
            User: await prisma.user.count(),
            Role: await prisma.role.count(),
            Permission: await prisma.permission.count(),
            Group: await prisma.group.count(),
            UserGroup: await prisma.userGroup.count(),
            UserRole: await prisma.userRole.count(),
            RolePermission: await prisma.rolePermission.count(),
            DynamicTable: await prisma.dynamicTable.count(),
            DynamicField: await prisma.dynamicField.count(),
            DynamicRecord: await prisma.dynamicRecord.count(),
        };

        for (const [name, count] of Object.entries(counts)) {
            const status = count === 0 ? '✅' : '⚠️';
            console.log(`${status} ${name}: ${count}`);
        }

        const isAllEmpty = Object.values(counts).every(c => c === 0);
        if (isAllEmpty) {
            console.log('\n✅ 所有表已完全清空！');
        } else {
            console.log('\n⚠️ 部分表还有数据！');
        }

    } catch (error) {
        console.error('\n❌ 清空失败:', error);
        throw error;
    } finally {
        await prisma.$disconnect();
    }
}

// 执行清空
clearAllDatabase()
    .then(() => {
        console.log('\n脚本执行成功完成');
        process.exit(0);
    })
    .catch((error) => {
        console.error('\n脚本执行失败:', error);
        process.exit(1);
    });
