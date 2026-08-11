import prisma from '@config/db'
import { notDeleted } from '@config/soft-delete';
import { logger } from '@common/logger'

/**
 * 将附件 field 的任意原始值统一成 string[]
 * 兼容：
 *  - 旧版单值: '' | 'fileId' | 'fileId@V2'
 *  - 新版 list: [] | ['fileId@V2'] | null | undefined
 *  - 误传对象 / 嵌套数组 会被尽量 flatten
 * 任何非法项会被过滤（但必须是字符串）
 */
export function normalizeAttachmentList(v: unknown): string[] {
  if (v === null || v === undefined || v === '') return []
  if (typeof v === 'string') return [v]
  if (Array.isArray(v)) {
    const out: string[] = []
    for (const item of v) {
      if (item === null || item === undefined || item === '') continue
      if (typeof item === 'string') out.push(item)
    }
    return out
  }
  // 兜底：JSONB 里误存成对象时不爆脏数据
  return []
}

/**
 * 根据 tableId 获取所有字段
 * 返回 map：{ 字段name: 字段fieldId } + attachment 字段集合
 * 用于前端传 name → 自动转 fieldId
 */

export async function getFieldNameMap(tableId: string, tenantId: string) {
  const fields = await prisma.dynamicField.findMany({
    where: { tableId, tenantId },
    select: { name: true, fieldId: true, type: true },
  })

  const map: Record<string, string> = {}
  const attachmentFieldIds = new Set<string>()
  for (const f of fields) {
    map[f.name] = f.fieldId
    if (f.type === 'attachment') attachmentFieldIds.add(f.fieldId)
  }

  return { nameToFid: map, attachmentFieldIds }
}


/**
 * 反向：数据库取出来 fieldId → 转回 中文名 给前端
 * attachment 字段统一成 string[]（向后兼容旧的单值字符串）
 * @param nameMapResult getFieldNameMap() 的返回值或旧版 { name: fieldId } 对象
 * @param records 数据库查出的完整记录数组
 */
export function convertIdToName(
  nameMapResult: Record<string, string> | { nameToFid: Record<string, string>; attachmentFieldIds?: Set<string> },
  records: any[]
) {
  const nameToFid =
    'nameToFid' in nameMapResult ? (nameMapResult as any).nameToFid : (nameMapResult as Record<string, string>)
  const attachmentFieldIds: Set<string> | undefined =
    'attachmentFieldIds' in nameMapResult ? (nameMapResult as any).attachmentFieldIds : undefined

  const reversedMap = Object.fromEntries(
    Object.entries(nameToFid).map(([k, v]) => [v, k])
  )

  return records.map(record => {
    const newData: Record<string, any> = {}

    for (const fldId in record.data) {
      const newKey = reversedMap[fldId] || fldId
      const raw = record.data[fldId]
      if (attachmentFieldIds?.has(fldId)) {
        newData[newKey] = normalizeAttachmentList(raw)
      } else {
        newData[newKey] = raw
      }
    }

    return { ...record, data: newData }
  })
}

/**
 * 写入时把前端传来的 data（name-keyed）转成 fieldId-keyed
 * attachment 字段统一存成 string[]（向后兼容，空列表存空数组）
 */
export function convertNameToFid(
  bodyData: Record<string, any>,
  nameMapResult: { nameToFid: Record<string, string>; attachmentFieldIds: Set<string> }
): Record<string, any> {
  const { nameToFid, attachmentFieldIds } = nameMapResult
  const converted: Record<string, any> = {}
  for (const key in bodyData) {
    const fid = nameToFid[key] || key
    if (attachmentFieldIds.has(fid)) {
      converted[fid] = normalizeAttachmentList(bodyData[key])
    } else {
      converted[fid] = bodyData[key]
    }
  }
  return converted
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