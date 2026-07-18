/**
 * 数据库清理脚本
 * 用途：清空动态业务表相关的所有数据（tables、fields、records）
 * 保留租户、用户、角色、权限、群组等基础数据
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function clearDatabase() {
    console.log('=== 开始清理数据库 ===');
    console.log('⚠️ 警告：此操作将删除所有动态业务表数据！\n');

    try {
        // 1. 删除所有 DynamicRecord（记录）
        console.log('1. 删除所有动态记录...');
        const deletedRecords = await prisma.dynamicRecord.deleteMany({});
        console.log(`   已删除 ${deletedRecords.count} 条记录`);

        // 2. 删除所有 DynamicField（字段）
        console.log('2. 删除所有动态字段...');
        const deletedFields = await prisma.dynamicField.deleteMany({});
        console.log(`   已删除 ${deletedFields.count} 个字段`);

        // 3. 删除所有 DynamicTable（表）
        console.log('3. 删除所有动态表...');
        const deletedTables = await prisma.dynamicTable.deleteMany({});
        console.log(`   已删除 ${deletedTables.count} 张表`);

        console.log('\n✅ 数据库清理完成！');
        console.log('   以下数据已保留：');
        console.log('   - 租户 (Tenant)');
        console.log('   - 用户 (User)');
        console.log('   - 角色 (Role)');
        console.log('   - 权限 (Permission)');
        console.log('   - 群组 (Group)');
        console.log('   - 所有关联关系');

        // 4. 统计现有数据
        console.log('\n=== 现有数据统计 ===');
        const tenantCount = await prisma.tenant.count();
        const userCount = await prisma.user.count();
        const roleCount = await prisma.role.count();
        const permissionCount = await prisma.permission.count();
        const groupCount = await prisma.group.count();

        console.log(`- 租户数量: ${tenantCount}`);
        console.log(`- 用户数量: ${userCount}`);
        console.log(`- 角色数量: ${roleCount}`);
        console.log(`- 权限数量: ${permissionCount}`);
        console.log(`- 群组数量: ${groupCount}`);

    } catch (error) {
        console.error('\n❌ 清理失败:', error);
        throw error;
    } finally {
        await prisma.$disconnect();
    }
}

// 执行清理
clearDatabase()
    .then(() => {
        console.log('\n脚本执行成功完成');
        process.exit(0);
    })
    .catch((error) => {
        console.error('\n脚本执行失败:', error);
        process.exit(1);
    });
