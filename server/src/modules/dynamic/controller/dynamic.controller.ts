import {Request, Response} from 'express';
import prisma from '@config/db'
import {dynamicService} from '../service/dynamic.service';
import {groupService} from '../../auth-core/service/group.service';
import {generateTableId, generateFieldId, generateRecordId, generateReferenceId} from '@utils/id-generator';
import {convertIdToName, getFieldNameMap} from "@utils/dynamic.util";
import {success, fail, created, noContent} from '@utils/response'
import {asyncHandler} from '@utils/async-handler'
import {paginationSchema} from '@validators/common.validator'
import { Audited } from '@common/audit'
import {AppError} from '@middleware/error.middleware'

function requireTenantId(req: Request): string {
    if (req.user?.isSuperAdmin) return req.tenantId || ''
    const tenantId = req.tenantId
    if (!tenantId) throw new AppError(400, '无租户上下文，请先创建或选择租户')
    return tenantId
}

async function resolveGroupIds(req: Request, tenantId: string): Promise<string[]> {
    const isSuperAdmin = req.user?.isSuperAdmin
    if (isSuperAdmin) return groupService.getAllGroupIds(tenantId)
    return groupService.getUserGroupIdList(tenantId, req.userId as any)
}

/** 验证用户是否属于指定群组（非超管需要） */
async function requireGroupMembership(req: Request, tenantId: string, groupId: string) {
    if (req.user?.isSuperAdmin) return
    const userGroupIds = await groupService.getUserGroupIdList(tenantId, req.userId as any)
    if (!userGroupIds.includes(groupId))
        throw new AppError(403, `您没有在此群组（${groupId}）中操作的权限`)
}

export class DynamicController {
    // ==================== TABLES ====================

    getTables = asyncHandler(async (req: Request, res: Response) => {
        const tenantId = requireTenantId(req);
        const tableName = req.query.tableName as string;
        const {page, pageSize} = paginationSchema.parse(req.query);
        const groupIds = await resolveGroupIds(req, tenantId);
        const list = await dynamicService.getTables(tenantId, groupIds, tableName, page, pageSize);
        res.json(success(list, "表格列表获取成功"));
    })

    getTable = asyncHandler(async (req: Request, res: Response) => {
        const {tableId} = req.params;
        const table = await dynamicService.getTable(tableId);
        res.json(success(table, "表格详情获取成功"));
    })

    @Audited('DynamicTable')
    async createTable(req: Request, res: Response) {
        const tenantId = requireTenantId(req);
        const userId = req.userId;
        const {name, description, groupId: reqGroupId} = req.body;
        let groupId = reqGroupId
        if (!groupId) {
            const groupIds = await resolveGroupIds(req, tenantId);
            groupId = groupIds[0];
        }
        if (!groupId) throw new AppError(400, '无法确定群组：请先分配群组或指定 groupId');
        await requireGroupMembership(req, tenantId, groupId);
        const data = await dynamicService.createTable({
            name, description, tenantId, groupId,
            tableId: generateTableId(), createdBy: userId,
        });
        res.json(created(data, "表格创建成功"));
    }

    @Audited('DynamicTable')
    async updateTable(req: Request, res: Response) {
        const {tableId} = req.params;
        const {name, description} = req.body;
        const table = await dynamicService.updateTable(tableId, {name, description});
        res.json(success(table, "表格更新成功"));
    }

    @Audited('DynamicTable')
    async deleteTable(req: Request, res: Response) {
        const {tableId} = req.params;
        await dynamicService.deleteTable(tableId);
        res.json(success(null, "表格删除成功"));
    }

    @Audited('DynamicTable')
    async restoreTable(req: Request, res: Response) {
        const {tableId} = req.params;
        const table = await dynamicService.restoreTable(tableId);
        res.json(success(table, "表格恢复成功"));
    }

    // ==================== FIELDS ====================

    getFields = asyncHandler(async (req: Request, res: Response) => {
        const tenantId = requireTenantId(req);
        const {tableId} = req.params;

        const {page, pageSize} = paginationSchema.parse(req.query);
        const list = await dynamicService.getFields(tableId, tenantId, page, pageSize);
        res.json(success(list, "字段列表获取成功"));
    })

    getField = asyncHandler(async (req: Request, res: Response) => {
        const {tableId, fieldId} = req.params;

        const field = await dynamicService.getField(fieldId, tableId);
        res.json(success(field, "字段详情获取成功"));
    })

    @Audited('DynamicField')
    async createField(req: Request, res: Response) {
        const tenantId = requireTenantId(req);
        const userId = req.userId;
        const {tableId} = req.params;

        const {name, type, options, description, groupId: reqGroupId} = req.body;
        let groupId = reqGroupId
        if (!groupId) {
            const groupIds = await resolveGroupIds(req, tenantId);
            groupId = groupIds[0];
        }
        if (!groupId) throw new AppError(400, '无法确定群组：请先分配群组或指定 groupId');
        await requireGroupMembership(req, tenantId, groupId);
        const data = await dynamicService.createField({
            name, type, options, description,
            tableId: tableId, tenantId,
            fieldId: generateFieldId(), groupId, createdBy: userId,
        });
        res.json(created(data, "字段创建成功"));
    }

    @Audited('DynamicField')
    async updateField(req: Request, res: Response) {
        const {tableId, fieldId} = req.params;

        const {name, type, options, description} = req.body;
        const field = await dynamicService.updateField(fieldId, tableId, {name, type, options, description});
        res.json(success(field, "字段更新成功"));
    }

    @Audited('DynamicField')
    async deleteField(req: Request, res: Response) {
        const {tableId, fieldId} = req.params;

        await dynamicService.deleteField(fieldId, tableId);
        res.json(success(null, "字段删除成功"));
    }

    @Audited('DynamicField')
    async restoreField(req: Request, res: Response) {
        const {tableId, fieldId} = req.params;

        const field = await dynamicService.restoreField(fieldId, tableId);
        res.json(success(field, "字段恢复成功"));
    }

    // ==================== RECORDS ====================

    getRecords = asyncHandler(async (req: Request, res: Response) => {
        const tenantId = requireTenantId(req);
        const {tableId} = req.params;

        const filter = req.body?.filter ?? {};
        const {page, pageSize} = paginationSchema.parse(req.query);
        const sortField = req.query.sortField as string | undefined;
        const sortOrder = (req.query.sortOrder as string || 'desc') === 'asc' ? 'asc' : 'desc';
        const groupIds = await resolveGroupIds(req, tenantId);

        // Convert sortField name to fieldId (JSONB key)
        let sortFieldId: string | undefined;
        if (sortField) {
            const fieldMap = await getFieldNameMap(tableId, tenantId);
            sortFieldId = fieldMap[sortField] || sortField;
        }

        const result = await dynamicService.getRecords(tableId, tenantId, groupIds, filter, page, pageSize, sortFieldId, sortOrder);
        const fieldMap = await getFieldNameMap(tableId, tenantId);
        result.items = convertIdToName(fieldMap, result.items) as any;
        res.json(success(result, "记录列表获取成功"));
    })

    getRecord = asyncHandler(async (req: Request, res: Response) => {
        const tenantId = requireTenantId(req);
        const {tableId, recordId} = req.params;

        const record = await dynamicService.getRecord(recordId, tableId);
        const fieldMap = await getFieldNameMap(tableId, tenantId);
        const data = convertIdToName(fieldMap, [record])
        res.json(success(data[0], "记录详情获取成功"));
    })

    @Audited('DynamicRecord')
    async createRecord(req: Request, res: Response) {
        const tenantId = requireTenantId(req);
        const userId = req.userId;
        const {tableId} = req.params;

        const {data, groupId: reqGroupId} = req.body;
        let groupId = reqGroupId
        if (!groupId) {
            const groupIds = await resolveGroupIds(req, tenantId);
            groupId = groupIds[0];
        }
        if (!groupId) throw new AppError(400, '无法确定群组：请先分配群组或指定 groupId');
        await requireGroupMembership(req, tenantId, groupId);
        const fieldMap = await getFieldNameMap(tableId, tenantId);
        const convertedData: Record<string, any> = {};
        for (const key in data) {
            const fid = fieldMap[key] || key;
            convertedData[fid] = data[key];
        }
        const result = await dynamicService.createRecord({
            recordId: generateRecordId(), tableId: tableId, tenantId, groupId,
            data: convertedData, description: req.body.description, createdBy: userId,
        });
        res.json(created(result, "记录创建成功"));
    }

    @Audited('DynamicRecord')
    async updateRecord(req: Request, res: Response) {
        const tenantId = requireTenantId(req);
        const {tableId, recordId} = req.params;

        const {data} = req.body;
        const fieldMap = await getFieldNameMap(tableId, tenantId);
        const convertedData: Record<string, any> = {};
        for (const key in data) {
            const fid = fieldMap[key] || key;
            convertedData[fid] = data[key];
        }

        // 校验自引用：不允许 reference 字段的值指向正在编辑的记录自身
        const tableFields = await prisma.dynamicField.findMany({
            where: { tableId, type: 'reference', deletedAt: null },
            select: { fieldId: true, name: true },
        })
        for (const f of tableFields) {
            const val = convertedData[f.fieldId]
            if (val && val === recordId) {
                throw new AppError(400, `字段「${f.name}」不能引用记录自身`)
            }
        }

        const result = await dynamicService.updateRecord(recordId, tableId, {data: convertedData, description: req.body.description});
        const convertedResult = convertIdToName(fieldMap, [result])[0];
        res.json(success(convertedResult, "记录更新成功"));
    }

    @Audited('DynamicRecord')
    async deleteRecord(req: Request, res: Response) {
        const {tableId, recordId} = req.params;

        await dynamicService.deleteRecord(recordId, tableId);
        res.json(success(null, "记录删除成功"));
    }

    @Audited('DynamicRecord')
    async restoreRecord(req: Request, res: Response) {
        const {tableId, recordId} = req.params;

        const record = await dynamicService.restoreRecord(recordId, tableId);
        res.json(success(record, "记录恢复成功"));
    }

    // ==================== FIELD REFERENCES ====================

    @Audited('FieldReference')
    async createReference(req: Request, res: Response) {
        const tenantId = requireTenantId(req);
        const userId = req.userId;
        const { tableId } = req.params;
        const { fieldId, sourceTableId, sourceFields, displayField, valueField, filterJson, description } = req.body;

        const groupIds = await resolveGroupIds(req, tenantId);
        const groupId = groupIds[0];
        if (!groupId) throw new AppError(400, '无法确定群组');
        await requireGroupMembership(req, tenantId, groupId);

        const data = await dynamicService.createReference({
            fieldId, sourceTableId, sourceFields, displayField: displayField || '', valueField,
            filterJson: filterJson ?? undefined,
            description,
            groupId, createdBy: userId,
            refId: generateReferenceId(),
        });
        res.json(created(data, "引用配置创建成功"));
    }

    @Audited('FieldReference')
    async getReferences(req: Request, res: Response) {
        const { tableId } = req.params;
        const data = await dynamicService.getReferences(tableId);
        res.json(success(data, "引用配置列表获取成功"));
    }

    @Audited('FieldReference')
    async getReference(req: Request, res: Response) {
        const { refId } = req.params;
        const data = await dynamicService.getReference(refId);
        res.json(success(data, "引用配置详情获取成功"));
    }

    @Audited('FieldReference')
    async updateReference(req: Request, res: Response) {
        const { refId } = req.params;
        const { sourceFields, displayField, valueField, filterJson, description } = req.body;
        const data = await dynamicService.updateReference(refId, {
            sourceFields, displayField, valueField,
            filterJson: filterJson ?? undefined,
            description,
        });
        res.json(success(data, "引用配置更新成功"));
    }

    @Audited('FieldReference')
    async deleteReference(req: Request, res: Response) {
        const { refId } = req.params;
        await dynamicService.deleteReference(refId);
        res.json(success(null, "引用配置删除成功"));
    }

    async lookupRecords(req: Request, res: Response) {
        const tenantId = requireTenantId(req);
        const { refId } = req.params;
        const { search, page, pageSize, recordId } = req.body;
        const data = await dynamicService.lookupRecords(refId, tenantId, search, page || 1, pageSize || 20, recordId);
        res.json(success(data, "查询成功"));
    }
}

export const dynamicController = new DynamicController();
