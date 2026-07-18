import prisma from '@config/db'
import { notDeleted } from '@config/soft-delete';
import { logger } from '@common/logger'

/**
 * 根据 tableId 获取所有字段
 * 返回 map：{ 字段name: 字段fieldId }
 * 用于前端传 name → 自动转 fieldId
 */

export async function getFieldNameMap(tableId: string, tenantId: string) {

    // 内部查询需要全量字段，不走分页
    const fields = await prisma.dynamicField.findMany({
        where: {tableId, tenantId},
        select: {name: true, fieldId: true},
    });

    const map: Record<string, string> = {};

    for (const field of fields) {
        map[field.name] = field.fieldId;
    }

    return map;
}


/**
 * 反向：数据库取出来 fieldId → 转回 中文名 给前端
 * @param nameMap { 客户姓名: 'fldXXX' }  ← 你传的是这个！
 * @param records 数据库查出的完整记录数组
 */
export function convertIdToName(nameMap: Record<string, string>, records: any[]) {
    // 1. 反转成 { fldXXX: 客户姓名 }
    const reversedMap = Object.fromEntries(
        Object.entries(nameMap).map(([k, v]) => [v, k])
    );

    // 2. 转换每条记录（必须 return 出去！）
    return records.map(record => {
        const newData: Record<string, any> = {};

        for (const fldId in record.data) {
            const newKey = reversedMap[fldId] || fldId;
            newData[newKey] = record.data[fldId];
        }

        return {...record, data: newData};
    });
}


/**
 * 工具：自动把前端传来的 字段名 查询 → 转成 fldId JSONB 查询
 */
export async function buildDynamicWhere(
    tableId: string,
    tenantId: string,
    frontFilter: Record<string, any> // 前端传 { 字段名: 值 }
) {
    const conditions = frontFilter.conditions || {};
    logger.info("conditions", conditions)


    // 1. 获取本表所有字段 name => fieldId
    const fields = await prisma.dynamicField.findMany({
        where: {tableId, tenantId},
        select: {name: true, fieldId: true},
    });

    const nameToFid = Object.fromEntries(
        fields.map((f: any) => [f.name, f.fieldId])
    );

    // 2. 构建 JSONB 条件
    const jsonConditions = [];

    for (const [fieldName, condition] of Object.entries(conditions)) {
        const fieldId = nameToFid[fieldName];
        if (!fieldId) continue;

        // 是对象条件，如 { gt: 20 }
        if (typeof condition === 'object' && condition !== null) {
            jsonConditions.push({
                data: {path: [fieldId], ...condition}
            });
        }
        // 是直接值
        else {
            jsonConditions.push({
                data: {path: [fieldId], equals: condition}
            });
        }
    }

    // 3. 最终 where
    const where: any = {tableId, tenantId};
    const conjunction = frontFilter.conjunction || 'AND';

    //不支持复杂查询
    if (jsonConditions.length > 1 && conjunction === 'NOT') {
        return Error("目前不支持复杂查询,not只能限定一个条件.")
    }

    if (jsonConditions.length > 0) {
        if (conjunction === 'NOT') {
            where.NOT = jsonConditions[0];
        } else {
            where[conjunction] = jsonConditions;
        }
    }


    logger.info("where", where)
    return where;
}