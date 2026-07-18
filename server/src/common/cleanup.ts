import prisma from '@config/db'
import { logger } from '@common/logger'

// 需要清理的软删除模型列表
const softDeleteModels = [
  { name: 'Tenant', model: prisma.tenant },
  { name: 'User', model: prisma.user },
  { name: 'Role', model: prisma.role },
  { name: 'Group', model: prisma.group },
  { name: 'DynamicTable', model: prisma.dynamicTable },
  { name: 'DynamicField', model: prisma.dynamicField },
  { name: 'DynamicRecord', model: prisma.dynamicRecord },
] as const

/**
 * 硬删除所有过期软删除记录
 * @param retentionDays 保留天数，默认 90
 * @returns 各模型删除数量汇总
 */
export async function cleanupExpiredDeleted(retentionDays: number = 90): Promise<Record<string, number>> {
  const cutoff = new Date(Date.now() - retentionDays * 24 * 60 * 60 * 1000)
  const summary: Record<string, number> = {}

  logger.info({ retentionDays, cutoff: cutoff.toISOString() }, '开始清理过期软删除数据')

  for (const { name, model } of softDeleteModels) {
    try {
      const result = await (model as any).deleteMany({
        where: {
          deletedAt: {
            not: null,
            lt: cutoff,
          },
        },
      })
      if (result.count > 0) {
        summary[name] = result.count
        logger.info({ model: name, count: result.count }, '已清理过期数据')
      }
    } catch (err: any) {
      logger.error({ err: err.message, model: name }, '清理失败')
    }
  }

  const total = Object.values(summary).reduce((sum, n) => sum + n, 0)
  logger.info({ total, summary }, total > 0 ? '清理完成' : '无过期数据需要清理')

  return summary
}
