/**
 * 软删除查询过滤器
 * 在 Service 层的 findMany/findUnique/findFirst/count 中显式使用
 *
 * 注意：由于 Prisma v5 $extends 在 TypeScript strict 模式下与模型 WhereInput 类型冲突，
 * 改为在各 Service 方法中显式添加 deletedAt: null 过滤条件。
 *
 * 使用方式：
 *   import { notDeleted } from '@config/soft-delete'
 *   const where = { ...notDeleted, tenantId }
 */
export const notDeleted = { deletedAt: null } as const

/** 查询已删除记录时使用 */
export const onlyDeleted = { deletedAt: { not: null } } as const
