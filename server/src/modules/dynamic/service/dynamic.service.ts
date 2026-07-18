import prisma from '@config/db'
import { notDeleted } from '@config/soft-delete';
import {Cacheable, CacheEvict} from "@cache/decorators";
import {CacheKeys, CacheTTL} from "@cache/keys";
import {buildDynamicWhere, getFieldNameMap} from "@utils/dynamic.util";
import {AppError} from '@middleware/error.middleware';
import {paginate, PaginatedResult} from '@utils/pagination';

class DynamicService {
    /**
     * ==========================
     * DynamicTable 表
     * ==========================
     */
    async getTables(tenantId: string, groupIds: string[], name?: string, page: number = 1, pageSize: number = 20): Promise<PaginatedResult<any>> {
        return paginate(prisma.dynamicTable, {
            where: {
                tenantId,
                groupId: {in: groupIds},
                ...(name && {name: {equals: name}}),
                ...notDeleted,
            },
            orderBy: {createdAt: 'desc'},
        }, page, pageSize);
    }

    async getTable(tableId: string) {
        const table = await prisma.dynamicTable.findUnique({
            where: {tableId},
        });
        if (!table) {
            throw new AppError(404, '表格不存在');
        }
        const fields = await prisma.dynamicField.findMany({
            where: { tableId, deletedAt: null },
            orderBy: { createdAt: 'asc' },
        });
        return { ...table, fields };
    }

    async createTable(data: any) {
        // 数据库有部分唯一索引兜底，这里做应用层预检提供友好的错误提示
        const conflict = await prisma.dynamicTable.findFirst({
            where: { groupId: data.groupId ?? null, name: data.name, deletedAt: null },
        });
        if (conflict) {
            throw new AppError(409, `该群组下已存在名为「${data.name}」的表格`);
        }
        return prisma.dynamicTable.create({data});
    }

    async updateTable(tableId: string, data: any) {
        const table = await prisma.dynamicTable.findUnique({where: {tableId}});
        if (!table) {
            throw new AppError(404, '表格不存在');
        }
        // 如果改了 name，检查同 group 下是否已存在（仅限未删除的记录）
        if (data.name && data.name !== table.name) {
            const conflict = await prisma.dynamicTable.findFirst({
                where: {groupId: table.groupId, name: data.name, deletedAt: null, tableId: {not: tableId}},
            });
            if (conflict) {
                throw new AppError(409, `该群组下已存在名为「${data.name}」的表格`);
            }
        }
        return prisma.dynamicTable.update({
            where: {tableId},
            data,
        });
    }

    async deleteTable(tableId: string) {
        const table = await prisma.dynamicTable.findUnique({where: {tableId}});
        if (!table) {
            throw new AppError(404, '表格不存在');
        }
        return prisma.dynamicTable.update({
            where: {tableId},
            data: {deletedAt: new Date()},
        });
    }

    async restoreTable(tableId: string) {
        const table = await prisma.dynamicTable.findUnique({where: {tableId, deletedAt: {not: null}}});
        if (!table) {
            throw new AppError(404, '已删除的表格不存在');
        }
        // 恢复前检查：是否有同群组同名且未删除的记录（部分唯一索引会在数据库层报错，这里做友好提示）
        const conflict = await prisma.dynamicTable.findFirst({
            where: { groupId: table.groupId ?? null, name: table.name, deletedAt: null },
        });
        if (conflict) {
            throw new AppError(409, `该群组下已存在名为「${table.name}」的表格，无法恢复`);
        }
        return prisma.dynamicTable.update({
            where: {tableId},
            data: {deletedAt: null},
        });
    }

    /**
     * ==========================
     * DynamicField 获取动态表单的列数据，并且存入redis
     * ==========================
     */
    async getFields(tableId: string, tenantId: string, page: number = 1, pageSize: number = 20): Promise<PaginatedResult<any>> {
        return paginate(prisma.dynamicField, {
            where: { tableId, tenantId, ...notDeleted },
            orderBy: {createdAt: 'asc'},
        }, page, pageSize);
    }

    async getField(fieldId: string, tableId: string) {
        const field = await prisma.dynamicField.findUnique({
            where: {fieldId},
        });
        if (!field || field.tableId !== tableId) {
            throw new AppError(404, '字段不存在');
        }
        return field;
    }

    @CacheEvict({
        keys: (data: any) => [
            CacheKeys.dynamicTableFields(data.tenantId, data.tableId)
        ]
    })
    async createField(data: any) {
        // 数据库有部分唯一索引兜底，这里做应用层预检提供友好的错误提示
        const conflict = await prisma.dynamicField.findFirst({
            where: { tableId: data.tableId, name: data.name, deletedAt: null },
        });
        if (conflict) {
            throw new AppError(409, `该表中已存在名为「${data.name}」的字段`);
        }
        return prisma.dynamicField.create({data});
    }

    @CacheEvict({
        keys: async (fieldId: string, tableId: string) => {
            const field = await prisma.dynamicField.findUnique({where: {fieldId}})
            if (!field) return []
            return [
                CacheKeys.dynamicTableFields(field.tenantId, tableId)
            ]
        }
    })
    async updateField(fieldId: string, tableId: string, data: any) {
        const field = await prisma.dynamicField.findUnique({where: {fieldId}});
        if (!field || field.tableId !== tableId) {
            throw new AppError(404, '字段不存在');
        }
        return prisma.dynamicField.update({
            where: {fieldId},
            data,
        });
    }

    @CacheEvict({
        keys: async (fieldId: string, tableId: string) => {
            const field = await prisma.dynamicField.findUnique({where: {fieldId}})
            if (!field) return []
            return [
                CacheKeys.dynamicTableFields(field.tenantId, tableId)
            ]
        }
    })
    async deleteField(fieldId: string, tableId: string) {
        const field = await prisma.dynamicField.findUnique({where: {fieldId}});
        if (!field || field.tableId !== tableId) {
            throw new AppError(404, '字段不存在');
        }
        return prisma.dynamicField.update({
            where: {fieldId},
            data: {deletedAt: new Date()},
        });
    }

    async restoreField(fieldId: string, tableId: string) {
        const field = await prisma.dynamicField.findUnique({where: {fieldId, deletedAt: {not: null}}});
        if (!field || field.tableId !== tableId) {
            throw new AppError(404, '已删除的字段不存在');
        }
        // 恢复前检查：是否有同表同名且未删除的字段
        const conflict = await prisma.dynamicField.findFirst({
            where: { tableId: field.tableId, name: field.name, deletedAt: null, fieldId: { not: fieldId } },
        });
        if (conflict) {
            throw new AppError(409, `该表中已存在名为「${field.name}」的字段，无法恢复`);
        }
        return prisma.dynamicField.update({
            where: {fieldId},
            data: {deletedAt: null},
        });
    }

    /**
     * ==========================
     * DynamicRecord 行（核心！JsonB 最优查询）
     * ==========================
     */
    async getRecords(
        tableId: string,
        tenantId: string,
        groupIds: string[],
        jsonFilter?: any,
        page: number = 1,
        pageSize: number = 20,
    ): Promise<PaginatedResult<any>> {
        const where = {
            ...(await buildDynamicWhere(tableId, tenantId as any, jsonFilter)),
            ...notDeleted,
        };

        return paginate(prisma.dynamicRecord, {
            where,
            orderBy: {createdAt: 'desc'},
        }, page, pageSize);
    }

    async getRecord(recordId: string, tableId: string) {
        const record = await prisma.dynamicRecord.findUnique({
            where: {recordId, tableId},
        });
        if (!record) {
            throw new AppError(404, '记录不存在');
        }
        return record;
    }

    async createRecord(data: any) {
        return prisma.dynamicRecord.create({data});
    }

    async updateRecord(recordId: string, tableId: string, data: any) {
        const record = await prisma.dynamicRecord.findUnique({where: {recordId, tableId}});
        if (!record) {
            throw new AppError(404, '记录不存在');
        }
        return prisma.dynamicRecord.update({
            where: {recordId, tableId},
            data,
        });
    }

    async deleteRecord(recordId: string, tableId: string) {
        const record = await prisma.dynamicRecord.findUnique({where: {recordId, tableId}});
        if (!record) {
            throw new AppError(404, '记录不存在');
        }
        return prisma.dynamicRecord.update({
            where: {recordId, tableId},
            data: {deletedAt: new Date()},
        });
    }

    async restoreRecord(recordId: string, tableId: string) {
        const record = await prisma.dynamicRecord.findUnique({where: {recordId, tableId, deletedAt: {not: null}}});
        if (!record) {
            throw new AppError(404, '已删除的记录不存在');
        }
        return prisma.dynamicRecord.update({
            where: {recordId, tableId},
            data: {deletedAt: null},
        });
    }

    /**
     * ==========================
     * FieldReference 字段引用
     * ==========================
     */
    async createReference(data: any) {
        const field = await prisma.dynamicField.findUnique({ where: { fieldId: data.fieldId } })
        if (!field) throw new AppError(404, '字段不存在')
        if (field.type !== 'reference') throw new AppError(400, '只有 reference 类型的字段可以创建引用配置')

        const sourceTable = await prisma.dynamicTable.findUnique({ where: { tableId: data.sourceTableId } })
        if (!sourceTable) throw new AppError(404, '引用目标表不存在')

        return prisma.fieldReference.create({ data })
    }

    async getReferences(tableId: string) {
        const fields = await prisma.dynamicField.findMany({
            where: { tableId, type: 'reference', deletedAt: null },
        })
        const fieldIds = fields.map(f => f.fieldId)
        if (fieldIds.length === 0) return []
        return prisma.fieldReference.findMany({
            where: { fieldId: { in: fieldIds } },
            include: { sourceTable: { select: { tableId: true, name: true } } },
        })
    }

    async getReference(refId: string) {
        const ref = await prisma.fieldReference.findUnique({
            where: { refId },
            include: { sourceTable: { select: { tableId: true, name: true } } },
        })
        if (!ref) throw new AppError(404, '引用配置不存在')
        return ref
    }

    async updateReference(refId: string, data: any) {
        const ref = await prisma.fieldReference.findUnique({ where: { refId } })
        if (!ref) throw new AppError(404, '引用配置不存在')
        return prisma.fieldReference.update({ where: { refId }, data })
    }

    async deleteReference(refId: string) {
        const ref = await prisma.fieldReference.findUnique({ where: { refId } })
        if (!ref) throw new AppError(404, '引用配置不存在')
        return prisma.fieldReference.delete({ where: { refId } })
    }

    /**
     * Lookup: 根据引用配置查询目标表的 records
     * 用于前端 searchable combobox
     */
    async lookupRecords(refId: string, tenantId: string, search?: string, page = 1, pageSize = 20, recordId?: string) {
        const ref = await prisma.fieldReference.findUnique({ where: { refId } })
        if (!ref) throw new AppError(404, '引用配置不存在')

        const sourceFields = ref.sourceFields as string[]
        const where: any = { tableId: ref.sourceTableId, tenantId, ...notDeleted }

        // 获取源表的 field 映射: name → fieldId（sourceFields 存的是 name，但 data JSONB key 是 fieldId）
        const sourceTableFields = await prisma.dynamicField.findMany({
            where: { tableId: ref.sourceTableId, tenantId },
            select: { name: true, fieldId: true },
        })
        const nameToFid: Record<string, string> = {}
        for (const f of sourceTableFields) {
            nameToFid[f.name] = f.fieldId
        }

        // 如果传了 recordId，精准查找对应记录
        if (recordId) {
            where.recordId = recordId
        }
        // 搜索：在 data JSONB 中模糊匹配源字段 + recordId
        else if (search && sourceFields.length > 0) {
            const conditions: any[] = sourceFields.map(f => ({
                data: { path: [nameToFid[f] || f], string_contains: search }
            }))
            conditions.push({ recordId: { contains: search } })
            where.OR = conditions
        } else if (search) {
            where.recordId = { contains: search }
        }

        const result = await paginate(prisma.dynamicRecord, {
            where,
            orderBy: { createdAt: 'desc' },
        }, page, pageSize)

        // 裁剪 data 后返回：只保留 sourceFields 范围内的字段
        // 前端自己拼接 label（根据 FieldReference.displayField / sourceFields）
        const allowedFieldIds = sourceFields.map(f => nameToFid[f] || f).filter(Boolean)

        // 构建反向映射 fieldId → fieldName，使返回的 data key 与 records API 保持一致
        const fidToName: Record<string, string> = {}
        for (const [name, fid] of Object.entries(nameToFid)) {
            fidToName[fid] = name
        }

        result.items = result.items.map((r: any) => {
            const trimmedData: Record<string, any> = {}
            for (const fid of allowedFieldIds) {
                if (r.data && r.data[fid] !== undefined) {
                    trimmedData[fidToName[fid] || fid] = r.data[fid]
                }
            }

            return {
                recordId: r.recordId,
                tableId: r.tableId,
                data: trimmedData,
                createdAt: r.createdAt,
                updatedAt: r.updatedAt,
            }
        })

        return result
    }
}

export const dynamicService = new DynamicService();
