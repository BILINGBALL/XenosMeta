import prisma from '@config/db'
import { logger } from '@common/logger'
import { runInSandbox } from '@modules/agent/agent.sandbox'
import { generateRecordId } from '@utils/id-generator'
import type { AgentContext, ToolDefinition } from '@modules/agent/agent.types'

// ==================== 权限图谱工具 ====================

const getPermissionMapDef: ToolDefinition = {
    name: 'get_permission_map',
    description: '获取当前用户的完整权限图谱，包括所有可用权限、角色、群组信息，以及所有可用工具的权限状态。用于了解自己能做什么、不能做什么，规划任务执行路径。',
    parameters: {
        type: 'object',
        properties: {},
        required: [],
    },
    requiredPermissions: [],
}

async function getPermissionMap(_args: Record<string, unknown>, ctx: AgentContext): Promise<unknown> {
    const user = await prisma.user.findUnique({
        where: { id: ctx.userId },
        include: {
            roles: { include: { role: true } },
            groups: { include: { group: true } },
        },
    })

    if (!user) {
        return { found: false, message: '用户不存在' }
    }

    const allTools = Array.from(toolRegistry.values()).map(entry => ({
        name: entry.definition.name,
        description: entry.definition.description,
        requiredPermissions: entry.definition.requiredPermissions,
        available: checkToolPermission(entry.definition.name, ctx),
    }))

    const permissionCategories: Record<string, { code: string; name: string; available: boolean }[]> = {}
    const allPermMeta = await prisma.permission.findMany({
        where: { scope: { in: ['tenant', 'system'] } },
        select: { permCode: true, permName: true, type: true },
    })

    for (const perm of allPermMeta) {
        const parts = perm.permCode.split(':')
        const category = parts[0] || 'other'
        if (!permissionCategories[category]) {
            permissionCategories[category] = []
        }
        permissionCategories[category].push({
            code: perm.permCode,
            name: perm.permName,
            available: ctx.isSuperAdmin || ctx.permissions.includes(perm.permCode),
        })
    }

    const { password, ...safeUser } = user as any

    return {
        user: {
            id: safeUser.id,
            username: safeUser.username,
            nickname: safeUser.nickname,
            email: safeUser.email,
            phone: safeUser.phone,
            tenantId: safeUser.tenantId,
            isSuperAdmin: ctx.isSuperAdmin,
        },
        roles: user.roles.map(ur => ({
            id: ur.role.id,
            roleName: ur.role.roleName,
            roleCode: ur.role.roleCode,
            description: ur.role.description,
        })),
        groups: user.groups.map(ug => ({
            id: ug.group.id,
            groupName: ug.group.groupName,
            groupCode: ug.group.groupCode,
        })),
        permissions: {
            total: ctx.permissions.length,
            isSuperAdmin: ctx.isSuperAdmin,
            codes: ctx.permissions,
            byCategory: permissionCategories,
        },
        availableTools: {
            total: allTools.filter(t => t.available).length,
            totalTools: allTools.length,
            tools: allTools,
        },
    }
}

// ==================== 用户管理工具 ====================

const listUsersDef: ToolDefinition = {
    name: 'list_users',
    description: '分页查询当前租户下的用户列表，支持关键词搜索',
    parameters: {
        type: 'object',
        properties: {
            page: { type: 'number', description: '页码，默认 1' },
            pageSize: { type: 'number', description: '每页数量，默认 20' },
            keyword: { type: 'string', description: '搜索关键词（用户名/昵称）' },
        },
        required: [],
    },
    requiredPermissions: ['sys:user:view'],
}

async function listUsers(args: Record<string, unknown>, ctx: AgentContext): Promise<unknown> {
    const page = typeof args.page === 'number' ? args.page : 1
    const pageSize = typeof args.pageSize === 'number' ? args.pageSize : 20
    const keyword = typeof args.keyword === 'string' ? args.keyword : ''

    const where: any = { tenantId: ctx.tenantId, deletedAt: null }
    if (keyword) {
        where.OR = [
            { username: { contains: keyword } },
            { nickname: { contains: keyword } },
        ]
    }

    const [items, total] = await Promise.all([
        prisma.user.findMany({
            where,
            skip: (page - 1) * pageSize,
            take: pageSize,
            orderBy: { createdAt: 'desc' },
            select: {
                id: true, username: true, nickname: true, email: true,
                phone: true, avatar: true, status: true, createdAt: true,
            },
        }),
        prisma.user.count({ where }),
    ])

    return { items, total, page, pageSize }
}

const getUserDetailDef: ToolDefinition = {
    name: 'get_user_detail',
    description: '获取指定用户的详细信息，包括角色和群组',
    parameters: {
        type: 'object',
        properties: {
            userId: { type: 'string', description: '用户 ID' },
        },
        required: ['userId'],
    },
    requiredPermissions: ['sys:user:view'],
}

async function getUserDetail(args: Record<string, unknown>, ctx: AgentContext): Promise<unknown> {
    const userId = String(args.userId)
    const user = await prisma.user.findFirst({
        where: { id: userId, tenantId: ctx.tenantId, deletedAt: null },
        include: {
            roles: { include: { role: true } },
            groups: { include: { group: true } },
        },
    })
    if (!user) return { found: false, message: '用户不存在' }
    const { password, ...safe } = user as any
    return safe
}

const searchUsersDef: ToolDefinition = {
    name: 'search_users',
    description: '按用户名或昵称搜索当前租户内的用户（最多 10 条）',
    parameters: {
        type: 'object',
        properties: {
            keyword: { type: 'string', description: '搜索关键词' },
        },
        required: ['keyword'],
    },
    requiredPermissions: ['sys:user:view'],
}

async function searchUsers(args: Record<string, unknown>, ctx: AgentContext): Promise<unknown> {
    const keyword = String(args.keyword || '')
    if (!keyword) return []
    return prisma.user.findMany({
        where: {
            tenantId: ctx.tenantId,
            OR: [{ username: { contains: keyword } }, { nickname: { contains: keyword } }],
            deletedAt: null,
        },
        take: 10,
        select: { id: true, username: true, nickname: true, email: true, phone: true, avatar: true },
    })
}

// ==================== 角色管理工具 ====================

const listRolesDef: ToolDefinition = {
    name: 'list_roles',
    description: '获取当前租户下的角色列表',
    parameters: {
        type: 'object',
        properties: {},
        required: [],
    },
    requiredPermissions: ['sys:role:view'],
}

async function listRoles(_args: Record<string, unknown>, ctx: AgentContext): Promise<unknown> {
    return prisma.role.findMany({
        where: { tenantId: ctx.tenantId, deletedAt: null },
        orderBy: { createdAt: 'desc' },
    })
}

const getRoleDetailDef: ToolDefinition = {
    name: 'get_role_detail',
    description: '获取角色详情及其拥有的权限列表',
    parameters: {
        type: 'object',
        properties: {
            roleId: { type: 'string', description: '角色 ID' },
        },
        required: ['roleId'],
    },
    requiredPermissions: ['sys:role:view'],
}

async function getRoleDetail(args: Record<string, unknown>, ctx: AgentContext): Promise<unknown> {
    const roleId = String(args.roleId)
    const role = await prisma.role.findFirst({
        where: { id: roleId, tenantId: ctx.tenantId, deletedAt: null },
        include: { permissions: { include: { permission: true } } },
    })
    if (!role) return { found: false, message: '角色不存在' }
    return role
}

// ==================== 群组管理工具 ====================

const listGroupsDef: ToolDefinition = {
    name: 'list_groups',
    description: '获取当前租户下的群组列表',
    parameters: {
        type: 'object',
        properties: {},
        required: [],
    },
    requiredPermissions: ['sys:group:view'],
}

async function listGroups(_args: Record<string, unknown>, ctx: AgentContext): Promise<unknown> {
    return prisma.group.findMany({
        where: { tenantId: ctx.tenantId, deletedAt: null },
        orderBy: { createdAt: 'desc' },
        take: 50,
    })
}

const getMyGroupsDef: ToolDefinition = {
    name: 'get_my_groups',
    description: '获取当前用户所属的所有群组',
    parameters: {
        type: 'object',
        properties: {},
        required: [],
    },
    requiredPermissions: [],
}

async function getMyGroups(_args: Record<string, unknown>, ctx: AgentContext): Promise<unknown> {
    const userGroups = await prisma.userGroup.findMany({
        where: { userId: ctx.userId },
        include: { group: true },
    })
    return userGroups.map(ug => ug.group).filter(g => !g.deletedAt)
}

// ==================== 动态表工具 ====================

const listTablesDef: ToolDefinition = {
    name: 'list_tables',
    description: '获取当前租户下的所有动态表（多维表格）列表',
    parameters: {
        type: 'object',
        properties: {},
        required: [],
    },
    requiredPermissions: ['dynamic:table:view'],
}

async function listTables(_args: Record<string, unknown>, ctx: AgentContext): Promise<unknown> {
    return prisma.dynamicTable.findMany({
        where: { tenantId: ctx.tenantId, deletedAt: null },
        orderBy: { createdAt: 'desc' },
        select: {
            tableId: true, name: true, description: true,
            groupId: true, createdAt: true, updatedAt: true,
        },
    })
}

const getTableDetailDef: ToolDefinition = {
    name: 'get_table_detail',
    description: '获取动态表详情，包括字段列表',
    parameters: {
        type: 'object',
        properties: {
            tableId: { type: 'string', description: '表 ID（形如 tbl_xxx）' },
        },
        required: ['tableId'],
    },
    requiredPermissions: ['dynamic:table:view'],
}

async function getTableDetail(args: Record<string, unknown>, ctx: AgentContext): Promise<unknown> {
    const tableId = String(args.tableId)
    const table = await prisma.dynamicTable.findFirst({
        where: { tableId, tenantId: ctx.tenantId, deletedAt: null },
    })
    if (!table) return { found: false, message: '表不存在' }

    const fields = await prisma.dynamicField.findMany({
        where: { tableId, tenantId: ctx.tenantId, deletedAt: null },
        orderBy: { createdAt: 'asc' },
    })

    return { table, fields }
}

const queryRecordsDef: ToolDefinition = {
    name: 'query_records',
    description: '分页查询动态表中的记录，支持筛选和排序',
    parameters: {
        type: 'object',
        properties: {
            tableId: { type: 'string', description: '表 ID（形如 tbl_xxx）' },
            page: { type: 'number', description: '页码，默认 1' },
            pageSize: { type: 'number', description: '每页数量，默认 20' },
            filters: {
                type: 'object',
                description: '筛选条件，键为字段名，值为匹配值',
                additionalProperties: true,
            },
            sortBy: { type: 'string', description: '排序字段，默认 createdAt' },
            sortOrder: { type: 'string', description: '排序方向，asc 或 desc，默认 desc' },
        },
        required: ['tableId'],
    },
    requiredPermissions: ['dynamic:record:view'],
}

async function queryRecords(args: Record<string, unknown>, ctx: AgentContext): Promise<unknown> {
    const tableId = String(args.tableId)
    const page = typeof args.page === 'number' ? args.page : 1
    const pageSize = typeof args.pageSize === 'number' ? args.pageSize : 20
    const sortBy = typeof args.sortBy === 'string' ? args.sortBy : 'createdAt'
    const sortOrder = typeof args.sortOrder === 'string' && args.sortOrder === 'asc' ? 'asc' : 'desc'

    const table = await prisma.dynamicTable.findFirst({
        where: { tableId, tenantId: ctx.tenantId, deletedAt: null },
    })
    if (!table) return { found: false, message: '表不存在' }

    const where: any = { tableId, tenantId: ctx.tenantId, deletedAt: null }

    if (args.filters && typeof args.filters === 'object') {
        where.data = {}
        for (const [key, value] of Object.entries(args.filters as Record<string, unknown>)) {
            where.data[key] = value
        }
    }

    const [items, total] = await Promise.all([
        prisma.dynamicRecord.findMany({
            where,
            skip: (page - 1) * pageSize,
            take: pageSize,
            orderBy: sortBy === 'createdAt' || sortBy === 'updatedAt'
                ? { [sortBy]: sortOrder }
                : { data: { [sortBy]: sortOrder } } as any,
        }),
        prisma.dynamicRecord.count({ where }),
    ])

    return { items, total, page, pageSize }
}

const getRecordDetailDef: ToolDefinition = {
    name: 'get_record_detail',
    description: '获取单条记录的详细信息',
    parameters: {
        type: 'object',
        properties: {
            tableId: { type: 'string', description: '表 ID（形如 tbl_xxx）' },
            recordId: { type: 'string', description: '记录 ID（形如 rec_xxx）' },
        },
        required: ['tableId', 'recordId'],
    },
    requiredPermissions: ['dynamic:record:view'],
}

async function getRecordDetail(args: Record<string, unknown>, ctx: AgentContext): Promise<unknown> {
    const tableId = String(args.tableId)
    const recordId = String(args.recordId)

    const record = await prisma.dynamicRecord.findFirst({
        where: { recordId, tableId, tenantId: ctx.tenantId, deletedAt: null },
    })
    if (!record) return { found: false, message: '记录不存在' }
    return record
}

const createRecordDef: ToolDefinition = {
    name: 'create_record',
    description: '在动态表中创建一条新记录',
    parameters: {
        type: 'object',
        properties: {
            tableId: { type: 'string', description: '表 ID（形如 tbl_xxx）' },
            data: {
                type: 'object',
                description: '记录数据，键为字段名，值为字段值',
                additionalProperties: true,
            },
        },
        required: ['tableId', 'data'],
    },
    requiredPermissions: ['dynamic:record:add'],
}

async function createRecord(args: Record<string, unknown>, ctx: AgentContext): Promise<unknown> {
    const tableId = String(args.tableId)
    const data = args.data as Record<string, unknown>

    const table = await prisma.dynamicTable.findFirst({
        where: { tableId, tenantId: ctx.tenantId, deletedAt: null },
    })
    if (!table) return { success: false, message: '表不存在' }

    const record = await prisma.dynamicRecord.create({
        data: {
            recordId: generateRecordId(),
            tableId,
            tenantId: ctx.tenantId,
            groupId: table.groupId,
            data: data as any,
            createdBy: ctx.userId,
        },
    })

    return { success: true, record }
}

const updateRecordDef: ToolDefinition = {
    name: 'update_record',
    description: '更新动态表中的一条记录，只更新传入的字段，未传入的字段保持不变',
    parameters: {
        type: 'object',
        properties: {
            tableId: { type: 'string', description: '表 ID（形如 tbl_xxx）' },
            recordId: { type: 'string', description: '记录 ID（形如 rec_xxx）' },
            data: {
                type: 'object',
                description: '要更新的字段数据，键为字段名，值为新的字段值（只传需要修改的字段）',
                additionalProperties: true,
            },
        },
        required: ['tableId', 'recordId', 'data'],
    },
    requiredPermissions: ['dynamic:record:edit'],
}

async function updateRecord(args: Record<string, unknown>, ctx: AgentContext): Promise<unknown> {
    const tableId = String(args.tableId)
    const recordId = String(args.recordId)
    const data = args.data as Record<string, unknown>

    const table = await prisma.dynamicTable.findFirst({
        where: { tableId, tenantId: ctx.tenantId, deletedAt: null },
    })
    if (!table) return { success: false, message: '表不存在' }

    const existing = await prisma.dynamicRecord.findFirst({
        where: { recordId, tableId, tenantId: ctx.tenantId, deletedAt: null },
    })
    if (!existing) return { success: false, message: '记录不存在' }

    const mergedData = { ...(existing.data as object), ...data }

    const record = await prisma.dynamicRecord.update({
        where: { recordId },
        data: { data: mergedData as any },
    })

    return { success: true, record }
}

const deleteRecordDef: ToolDefinition = {
    name: 'delete_record',
    description: '删除动态表中的一条记录（软删除，可恢复）',
    parameters: {
        type: 'object',
        properties: {
            tableId: { type: 'string', description: '表 ID（形如 tbl_xxx）' },
            recordId: { type: 'string', description: '记录 ID（形如 rec_xxx）' },
        },
        required: ['tableId', 'recordId'],
    },
    requiredPermissions: ['dynamic:record:delete'],
}

async function deleteRecord(args: Record<string, unknown>, ctx: AgentContext): Promise<unknown> {
    const tableId = String(args.tableId)
    const recordId = String(args.recordId)

    const table = await prisma.dynamicTable.findFirst({
        where: { tableId, tenantId: ctx.tenantId, deletedAt: null },
    })
    if (!table) return { success: false, message: '表不存在' }

    const existing = await prisma.dynamicRecord.findFirst({
        where: { recordId, tableId, tenantId: ctx.tenantId, deletedAt: null },
    })
    if (!existing) return { success: false, message: '记录不存在' }

    await prisma.dynamicRecord.update({
        where: { recordId },
        data: { deletedAt: new Date() },
    })

    return { success: true, message: '记录已删除' }
}

// ==================== 文件管理工具 ====================

const listFilesDef: ToolDefinition = {
    name: 'list_files',
    description: '列出当前租户下的文件（支持分页）',
    parameters: {
        type: 'object',
        properties: {
            page: { type: 'number', description: '页码，默认 1' },
            pageSize: { type: 'number', description: '每页数量，默认 20' },
        },
        required: [],
    },
    requiredPermissions: [],
}

async function listFiles(args: Record<string, unknown>, ctx: AgentContext): Promise<unknown> {
    const page = typeof args.page === 'number' ? args.page : 1
    const pageSize = typeof args.pageSize === 'number' ? args.pageSize : 20

    const where = { tenantId: ctx.tenantId, deletedAt: null }
    const [items, total] = await Promise.all([
        prisma.file.findMany({
            where,
            skip: (page - 1) * pageSize,
            take: pageSize,
            orderBy: { createdAt: 'desc' },
            select: {
                fileId: true, filename: true, displayName: true,
                mimeType: true, size: true, tags: true, createdAt: true,
            },
        }),
        prisma.file.count({ where }),
    ])

    return { items, total, page, pageSize }
}

const getFileDetailDef: ToolDefinition = {
    name: 'get_file_detail',
    description: '获取文件的详细信息',
    parameters: {
        type: 'object',
        properties: {
            fileId: { type: 'string', description: '文件 ID' },
        },
        required: ['fileId'],
    },
    requiredPermissions: [],
}

async function getFileDetail(args: Record<string, unknown>, ctx: AgentContext): Promise<unknown> {
    const fileId = String(args.fileId)
    const file = await prisma.file.findFirst({
        where: { fileId, tenantId: ctx.tenantId, deletedAt: null },
        include: { versions: { orderBy: { version: 'desc' }, take: 5 } },
    })
    if (!file) return { found: false, message: '文件不存在' }
    return file
}

const searchFilesDef: ToolDefinition = {
    name: 'search_files',
    description: '按文件名搜索文件（最多返回 20 条）',
    parameters: {
        type: 'object',
        properties: {
            keyword: { type: 'string', description: '搜索关键词（文件名）' },
            mimeType: { type: 'string', description: '按 MIME 类型筛选，如 image/、video/、application/pdf' },
        },
        required: ['keyword'],
    },
    requiredPermissions: [],
}

async function searchFiles(args: Record<string, unknown>, ctx: AgentContext): Promise<unknown> {
    const keyword = String(args.keyword || '')
    const mimeType = typeof args.mimeType === 'string' ? args.mimeType : ''
    if (!keyword) return []

    const where: any = {
        tenantId: ctx.tenantId,
        deletedAt: null,
        OR: [
            { filename: { contains: keyword } },
            { displayName: { contains: keyword } },
        ],
    }
    if (mimeType) where.mimeType = { startsWith: mimeType }

    return prisma.file.findMany({
        where,
        take: 20,
        orderBy: { createdAt: 'desc' },
        select: {
            fileId: true, filename: true, displayName: true,
            mimeType: true, size: true, tags: true, createdAt: true,
        },
    })
}

const renameFileDef: ToolDefinition = {
    name: 'rename_file',
    description: '重命名文件',
    parameters: {
        type: 'object',
        properties: {
            fileId: { type: 'string', description: '文件 ID' },
            newName: { type: 'string', description: '新的文件名' },
        },
        required: ['fileId', 'newName'],
    },
    requiredPermissions: [],
}

async function renameFile(args: Record<string, unknown>, ctx: AgentContext): Promise<unknown> {
    const fileId = String(args.fileId)
    const newName = String(args.newName).trim()
    if (!newName) return { success: false, message: '文件名不能为空' }

    const file = await prisma.file.findFirst({
        where: { fileId, tenantId: ctx.tenantId, deletedAt: null },
    })
    if (!file) return { success: false, message: '文件不存在' }

    const updated = await prisma.file.update({
        where: { fileId },
        data: { filename: newName },
    })
    return { success: true, file: { fileId: updated.fileId, filename: updated.filename } }
}

const updateFileDef: ToolDefinition = {
    name: 'update_file',
    description: '更新文件信息（标签、描述、显示名）',
    parameters: {
        type: 'object',
        properties: {
            fileId: { type: 'string', description: '文件 ID' },
            tags: {
                type: 'array',
                description: '文件标签列表（会覆盖原有标签）',
                items: { type: 'string' },
            },
            description: { type: 'string', description: '文件描述' },
            displayName: { type: 'string', description: '文件显示名' },
        },
        required: ['fileId'],
    },
    requiredPermissions: [],
}

async function updateFile(args: Record<string, unknown>, ctx: AgentContext): Promise<unknown> {
    const fileId = String(args.fileId)
    const file = await prisma.file.findFirst({
        where: { fileId, tenantId: ctx.tenantId, deletedAt: null },
    })
    if (!file) return { success: false, message: '文件不存在' }

    const data: any = {}
    if (Array.isArray(args.tags)) data.tags = args.tags
    if (typeof args.description === 'string') data.description = args.description
    if (typeof args.displayName === 'string') data.displayName = args.displayName

    const updated = await prisma.file.update({ where: { fileId }, data })
    return { success: true, file: updated }
}

const deleteFileDef: ToolDefinition = {
    name: 'delete_file',
    description: '将文件移入回收站（软删除，可恢复）',
    parameters: {
        type: 'object',
        properties: {
            fileId: { type: 'string', description: '文件 ID' },
        },
        required: ['fileId'],
    },
    requiredPermissions: [],
}

async function deleteFile(args: Record<string, unknown>, ctx: AgentContext): Promise<unknown> {
    const fileId = String(args.fileId)
    const file = await prisma.file.findFirst({
        where: { fileId, tenantId: ctx.tenantId, deletedAt: null },
    })
    if (!file) return { success: false, message: '文件不存在' }

    await prisma.file.update({
        where: { fileId },
        data: { deletedAt: new Date() },
    })
    return { success: true, message: `文件 "${file.filename}" 已移入回收站` }
}

const listTrashDef: ToolDefinition = {
    name: 'list_trash',
    description: '列出回收站中的文件（支持分页）',
    parameters: {
        type: 'object',
        properties: {
            page: { type: 'number', description: '页码，默认 1' },
            pageSize: { type: 'number', description: '每页数量，默认 20' },
        },
        required: [],
    },
    requiredPermissions: [],
}

async function listTrash(args: Record<string, unknown>, ctx: AgentContext): Promise<unknown> {
    const page = typeof args.page === 'number' ? args.page : 1
    const pageSize = typeof args.pageSize === 'number' ? args.pageSize : 20
    const where = { tenantId: ctx.tenantId, deletedAt: { not: null } }

    const [items, total] = await Promise.all([
        prisma.file.findMany({
            where,
            skip: (page - 1) * pageSize,
            take: pageSize,
            orderBy: { deletedAt: 'desc' },
            select: {
                fileId: true, filename: true, displayName: true,
                mimeType: true, size: true, deletedAt: true,
            },
        }),
        prisma.file.count({ where }),
    ])
    return { items, total, page, pageSize }
}

const restoreFileDef: ToolDefinition = {
    name: 'restore_file',
    description: '从回收站恢复文件',
    parameters: {
        type: 'object',
        properties: {
            fileId: { type: 'string', description: '文件 ID' },
        },
        required: ['fileId'],
    },
    requiredPermissions: [],
}

async function restoreFile(args: Record<string, unknown>, ctx: AgentContext): Promise<unknown> {
    const fileId = String(args.fileId)
    const file = await prisma.file.findFirst({
        where: { fileId, tenantId: ctx.tenantId, deletedAt: { not: null } },
    })
    if (!file) return { success: false, message: '文件不在回收站中' }

    await prisma.file.update({
        where: { fileId },
        data: { deletedAt: null },
    })
    return { success: true, message: `文件 "${file.filename}" 已恢复` }
}

const listFileVersionsDef: ToolDefinition = {
    name: 'list_file_versions',
    description: '获取文件的所有版本列表',
    parameters: {
        type: 'object',
        properties: {
            fileId: { type: 'string', description: '文件 ID' },
        },
        required: ['fileId'],
    },
    requiredPermissions: [],
}

async function listFileVersions(args: Record<string, unknown>, ctx: AgentContext): Promise<unknown> {
    const fileId = String(args.fileId)
    const file = await prisma.file.findFirst({
        where: { fileId, tenantId: ctx.tenantId },
    })
    if (!file) return { found: false, message: '文件不存在' }

    const versions = await prisma.fileVersion.findMany({
        where: { fileId },
        orderBy: { version: 'desc' },
        select: {
            version: true, filename: true, mimeType: true,
            size: true, uploadedBy: true, createdAt: true,
        },
    })
    return { fileId: file.fileId, filename: file.filename, versions }
}

const getFileTagsDef: ToolDefinition = {
    name: 'get_file_tags',
    description: '获取当前租户下所有文件的标签列表（用于了解有哪些标签可用）',
    parameters: {
        type: 'object',
        properties: {},
        required: [],
    },
    requiredPermissions: [],
}

async function getFileTags(_args: Record<string, unknown>, ctx: AgentContext): Promise<unknown> {
    const files = await prisma.file.findMany({
        where: { tenantId: ctx.tenantId, deletedAt: null },
        select: { tags: true },
    })
    const tagSet = new Set<string>()
    for (const f of files) {
        const tags = (f.tags as string[]) || []
        for (const t of tags) tagSet.add(t)
    }
    return Array.from(tagSet).sort()
}

const uploadTextFileDef: ToolDefinition = {
    name: 'upload_text_file',
    description: '上传一个文本文件到系统（如 HTML、Markdown、JSON、CSV、TXT 等）。传入文件名和文本内容，自动创建文件记录并存储。',
    parameters: {
        type: 'object',
        properties: {
            filename: { type: 'string', description: '文件名（包含扩展名，如 product.html）' },
            content: { type: 'string', description: '文件的文本内容' },
            displayName: { type: 'string', description: '可选：文件显示名（给用户看的名字）' },
            tags: {
                type: 'array',
                description: '可选：文件标签列表',
                items: { type: 'string' },
            },
            description: { type: 'string', description: '可选：文件描述' },
            mimeType: { type: 'string', description: '可选：MIME 类型，不传则根据扩展名自动推断' },
        },
        required: ['filename', 'content'],
    },
    requiredPermissions: [],
}

function guessMimeType(filename: string): string {
    const ext = filename.split('.').pop()?.toLowerCase() || ''
    const map: Record<string, string> = {
        html: 'text/html',
        htm: 'text/html',
        css: 'text/css',
        js: 'application/javascript',
        json: 'application/json',
        md: 'text/markdown',
        markdown: 'text/markdown',
        csv: 'text/csv',
        txt: 'text/plain',
        xml: 'application/xml',
        svg: 'image/svg+xml',
        yml: 'text/yaml',
        yaml: 'text/yaml',
    }
    return map[ext] || 'text/plain'
}

async function uploadTextFile(args: Record<string, unknown>, ctx: AgentContext): Promise<unknown> {
    const filename = String(args.filename).trim()
    const content = String(args.content)
    const displayName = typeof args.displayName === 'string' ? args.displayName : undefined
    const tags = Array.isArray(args.tags) ? args.tags : []
    const description = typeof args.description === 'string' ? args.description : undefined
    const mimeType = typeof args.mimeType === 'string' && args.mimeType
        ? args.mimeType
        : guessMimeType(filename)

    if (!filename) return { success: false, message: '文件名不能为空' }
    if (content.length === 0) return { success: false, message: '文件内容不能为空' }

    // 安全限制：单个文本文件最大 5MB
    const MAX_SIZE = 5 * 1024 * 1024
    const buffer = Buffer.from(content, 'utf-8')
    if (buffer.length > MAX_SIZE) {
        return { success: false, message: `文件过大（${(buffer.length / 1024 / 1024).toFixed(2)}MB），最大支持 5MB` }
    }

    try {
        // 延迟导入避免循环依赖
        const { fileService } = await import('@modules/file/file.service')
        const result = await fileService.uploadFile({
            buffer,
            originalname: filename,
            mimetype: mimeType,
            tenantId: ctx.tenantId,
            displayName,
            tags,
            description,
            uploadedBy: ctx.userId,
        })
        return {
            success: true,
            message: `文件 "${filename}" 上传成功`,
            file: {
                fileId: result.fileId,
                filename: result.filename,
                displayName: result.displayName,
                mimeType: result.mimeType,
                size: result.size,
            },
        }
    } catch (err) {
        logger.error({ err, userId: ctx.userId, filename }, 'Agent 上传文件失败')
        return { success: false, message: `上传失败：${(err as Error).message}` }
    }
}

// ==================== 租户信息工具 ====================

const getTenantInfoDef: ToolDefinition = {
    name: 'get_tenant_info',
    description: '获取当前用户所属租户的信息',
    parameters: {
        type: 'object',
        properties: {},
        required: [],
    },
    requiredPermissions: [],
}

async function getTenantInfo(_args: Record<string, unknown>, ctx: AgentContext): Promise<unknown> {
    const tenant = await prisma.tenant.findUnique({
        where: { id: ctx.tenantId },
    })
    if (!tenant) return { found: false, message: '租户不存在' }
    return tenant
}

// ==================== 系统信息工具 ====================

const getSystemInfoDef: ToolDefinition = {
    name: 'get_system_info',
    description: '获取系统运行信息：Node 版本、平台、运行时长、内存占用',
    parameters: {
        type: 'object',
        properties: {},
        required: [],
    },
    requiredPermissions: [],
}

async function getSystemInfo(_args: Record<string, unknown>, _ctx: AgentContext): Promise<unknown> {
    return {
        nodeVersion: process.version,
        platform: process.platform,
        uptime: process.uptime(),
        memoryUsage: {
            rss: process.memoryUsage().rss,
            heapTotal: process.memoryUsage().heapTotal,
            heapUsed: process.memoryUsage().heapUsed,
        },
    }
}

// ==================== 查询当前用户信息工具 ====================

const queryUserInfoDef: ToolDefinition = {
    name: 'query_user_info',
    description: '查询当前登录用户的详细信息，包括角色和所属群组',
    parameters: {
        type: 'object',
        properties: {},
        required: [],
    },
    requiredPermissions: ['sys:user:view'],
}

async function queryUserInfo(_args: Record<string, unknown>, ctx: AgentContext): Promise<unknown> {
    const user = await prisma.user.findUnique({
        where: { id: ctx.userId },
        include: {
            roles: { include: { role: true } },
            groups: { include: { group: true } },
        },
    })
    if (!user) return { found: false, message: '用户不存在' }
    const { password, ...sanitized } = user as any
    return sanitized
}

// ==================== 沙箱脚本执行工具 ====================

const executeScriptDef: ToolDefinition = {
    name: 'execute_script',
    description: '在受限沙箱中执行 JavaScript 代码（支持 await，最长 5 秒，禁止访问 process/require 等危险 API）。沙箱中可访问的上下文变量：userId, tenantId, username',
    parameters: {
        type: 'object',
        properties: {
            code: { type: 'string', description: '要执行的 JavaScript 代码' },
        },
        required: ['code'],
    },
    requiredPermissions: ['agent:script:execute'],
}

async function executeScript(args: Record<string, unknown>, ctx: AgentContext): Promise<unknown> {
    const code = typeof args.code === 'string' ? args.code : String(args.code ?? '')
    if (!code.trim()) return { error: '代码不能为空' }

    const sandboxContext: Record<string, unknown> = {
        userId: ctx.userId,
        tenantId: ctx.tenantId,
        username: ctx.username,
    }

    logger.debug({ userId: ctx.userId, codeLength: code.length }, 'Agent 沙箱脚本执行')
    return runInSandbox(code, sandboxContext)
}

// ==================== 工具注册表 ====================

interface ToolEntry {
    definition: ToolDefinition
    execute: (args: Record<string, unknown>, ctx: AgentContext) => Promise<unknown>
}

export const toolRegistry = new Map<string, ToolEntry>([
    // 权限图谱（核心）
    ['get_permission_map', { definition: getPermissionMapDef, execute: getPermissionMap }],

    // 用户管理
    ['query_user_info', { definition: queryUserInfoDef, execute: queryUserInfo }],
    ['list_users', { definition: listUsersDef, execute: listUsers }],
    ['get_user_detail', { definition: getUserDetailDef, execute: getUserDetail }],
    ['search_users', { definition: searchUsersDef, execute: searchUsers }],

    // 角色管理
    ['list_roles', { definition: listRolesDef, execute: listRoles }],
    ['get_role_detail', { definition: getRoleDetailDef, execute: getRoleDetail }],

    // 群组管理
    ['list_groups', { definition: listGroupsDef, execute: listGroups }],
    ['get_my_groups', { definition: getMyGroupsDef, execute: getMyGroups }],

    // 动态表 / 多维表格
    ['list_tables', { definition: listTablesDef, execute: listTables }],
    ['get_table_detail', { definition: getTableDetailDef, execute: getTableDetail }],
    ['query_records', { definition: queryRecordsDef, execute: queryRecords }],
    ['get_record_detail', { definition: getRecordDetailDef, execute: getRecordDetail }],
    ['create_record', { definition: createRecordDef, execute: createRecord }],
    ['update_record', { definition: updateRecordDef, execute: updateRecord }],
    ['delete_record', { definition: deleteRecordDef, execute: deleteRecord }],

    // 文件管理
    ['list_files', { definition: listFilesDef, execute: listFiles }],
    ['search_files', { definition: searchFilesDef, execute: searchFiles }],
    ['get_file_detail', { definition: getFileDetailDef, execute: getFileDetail }],
    ['rename_file', { definition: renameFileDef, execute: renameFile }],
    ['update_file', { definition: updateFileDef, execute: updateFile }],
    ['delete_file', { definition: deleteFileDef, execute: deleteFile }],
    ['list_trash', { definition: listTrashDef, execute: listTrash }],
    ['restore_file', { definition: restoreFileDef, execute: restoreFile }],
    ['list_file_versions', { definition: listFileVersionsDef, execute: listFileVersions }],
    ['get_file_tags', { definition: getFileTagsDef, execute: getFileTags }],
    ['upload_text_file', { definition: uploadTextFileDef, execute: uploadTextFile }],

    // 租户信息
    ['get_tenant_info', { definition: getTenantInfoDef, execute: getTenantInfo }],

    // 系统信息
    ['get_system_info', { definition: getSystemInfoDef, execute: getSystemInfo }],

    // 沙箱脚本
    ['execute_script', { definition: executeScriptDef, execute: executeScript }],
])

// 获取所有工具定义（用于发送给 LLM）
export function getToolDefinitions(): ToolDefinition[] {
    return Array.from(toolRegistry.values()).map(entry => entry.definition)
}

// 校验用户是否拥有调用某工具的权限（超级管理员直通）
export function checkToolPermission(toolName: string, ctx: AgentContext): boolean {
    if (ctx.isSuperAdmin) return true
    const entry = toolRegistry.get(toolName)
    if (!entry) return false
    const required = entry.definition.requiredPermissions
    if (required.length === 0) return true
    return required.every(perm => ctx.permissions.includes(perm))
}
