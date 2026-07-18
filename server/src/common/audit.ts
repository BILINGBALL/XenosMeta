import prisma from '@config/db'
import { logger } from '@common/logger'

type AuditAction = 'CREATE' | 'UPDATE' | 'DELETE' | 'RESTORE' | 'AUTH'

interface AuditParams {
    userId: string
    tenantId: string
    action: AuditAction
    resource: string
    resourceId: string
    oldValue?: any
    newValue?: any
}

class AuditService {
    /**
     * 异步记录审计日志，不阻塞主流程
     */
    log(params: AuditParams): void {
        prisma.auditLog.create({
            data: {
                userId: params.userId,
                tenantId: params.tenantId,
                action: params.action,
                resource: params.resource,
                resourceId: params.resourceId,
                oldValue: sanitize(params.oldValue),
                newValue: sanitize(params.newValue),
            },
        }).catch(err => {
            logger.error({ err, resource: params.resource, action: params.action }, 'Audit log write failed')
        })
    }
}

/** 移除敏感字段（密码等） */
function sanitize(value: any): any {
    if (!value) return value
    if (typeof value === 'object') {
        const clone = { ...value }
        delete clone.password
        return clone
    }
    return value
}

/**
 * 从方法名自动推断操作类型
 * createXxx / register → CREATE
 * updateXxx → UPDATE
 * deleteXxx / removeXxx → DELETE
 * restoreXxx → RESTORE
 * login → AUTH
 */
function detectAction(methodName: string): AuditAction {
    const n = methodName.toLowerCase()
    if (n.includes('create') || n.includes('register')) return 'CREATE'
    if (n.includes('update')) return 'UPDATE'
    if (n.includes('delete') || n.includes('remove')) return 'DELETE'
    if (n.includes('restore')) return 'RESTORE'
    if (n.includes('login')) return 'AUTH'
    return 'UPDATE'
}

export const auditService = new AuditService()

/**
 * 审计日志装饰器 — 与 @Cacheable/@CacheEvict 同模式（2 参数 Stage 3 decorator）
 *
 * 自动记录 CRUD 操作的审计日志（异步、不阻塞响应）。
 * 操作类型从方法名自动推断，resourceId 从 req.params 自动提取。
 *
 * @example
 * class TenantController {
 *   @Audited('Tenant')
 *   async create(req, res) { ... }
 * }
 */
export function Audited(resource: string) {
    return function (_target: any, _context: any) {
        const methodName = (_context && _context.name) ? String(_context.name) : ''
        const action = detectAction(methodName)

        // 返回 triple-arg 函数 (req, res, next) — 兼 asyncHandler 的错误捕获
        // eslint-disable-next-line
        const wrapper: any = function (this: any, req: any, res: any, next: any) {
            return (async () => {
                const result = await _target.apply(this, [req, res, next])

                if (res.statusCode >= 200 && res.statusCode < 300) {
                    auditService.log({
                        userId: req.userId || '',
                        tenantId: req.tenantId || '',
                        action,
                        resource,
                        resourceId: req.params?.id || req.params?.tableId || req.params?.mirrorId || '',
                    })
                }

                return result
            })().catch(next)
        }
        return wrapper
    }
}
