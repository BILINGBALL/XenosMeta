
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function checkIdFormat() {
    console.log('=== 验证 ID 格式 ===\n');

    // 检查动态表
    const tables = await prisma.dynamicTable.findMany({ take: 5 });
    console.log('动态表 ID:');
    tables.forEach(t => {
        console.log(`  - ${t.tableId} (格式正确: ${/^tbl[a-zA-Z0-9]+$/.test(t.tableId) ? '是' : '否'})`);
    });
    console.log();

    // 检查字段
    const fields = await prisma.dynamicField.findMany({ take: 5 });
    console.log('字段 ID:');
    fields.forEach(f => {
        console.log(`  - ${f.fieldId} (格式正确: ${/^fld[a-zA-Z0-9]+$/.test(f.fieldId) ? '是' : '否'})`);
    });
    console.log();

    // 检查记录
    const records = await prisma.dynamicRecord.findMany({ take: 5 });
    console.log('记录 ID:');
    records.forEach(r => {
        console.log(`  - ${r.recordId} (格式正确: ${/^rec[a-zA-Z0-9]+$/.test(r.recordId) ? '是' : '否'})`);
    });
    console.log();

    console.log('✅ ID 格式验证完成！');
    await prisma.$disconnect();
}

checkIdFormat().catch(console.error);
