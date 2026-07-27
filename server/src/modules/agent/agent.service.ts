/**
 * Agent Service — 会话管理、限流、审计日志
 */
import prisma from '@config/db'
import redis from '@common/redis'
import { logger } from '@common/logger'
import { agentConfig, buildRateLimitKey } from '@modules/agent/agent.config'
import { runAgentLoop } from '@modules/agent/agent.scheduler'
import type { AgentContext, ChatMessage, SSEEvent, SSEEventData } from '@modules/agent/agent.types'

// ==================== 限流 ====================

/**
 * 检查用户限流（基于 Redis 每分钟计数）
 * @returns 是否允许通过
 */
export async function checkRateLimit(userId: string): Promise<boolean> {
    const now = Date.now()
    const minuteKey = new Date(now).toISOString().slice(0, 16).replace(/[-T:]/g, '') // YYYYMMDDHHMM
    const redisKey = buildRateLimitKey(userId, minuteKey)

    const count = await redis.incr(redisKey)
    if (count === 1) {
        // 第一次请求，设置过期时间（60秒 + 5秒缓冲）
        await redis.expire(redisKey, 65)
    }

    if (count > agentConfig.rateLimitPerMinute) {
        logger.warn({ userId, count, limit: agentConfig.rateLimitPerMinute }, 'Agent 限流触发')
        return false
    }
    return true
}

// ==================== 会话管理 ====================

/** 创建新会话 */
export async function createConversation(userId: string, tenantId: string, title?: string) {
    return prisma.agentConversation.create({
        data: {
            userId,
            tenantId,
            title: title || '新对话',
        },
    })
}

/** 获取会话列表 */
export async function listConversations(userId: string, tenantId: string, page = 1, pageSize = 20) {
    const where = { userId, tenantId, deletedAt: null }
    const [items, total] = await Promise.all([
        prisma.agentConversation.findMany({
            where,
            orderBy: { updatedAt: 'desc' },
            skip: (page - 1) * pageSize,
            take: pageSize,
        }),
        prisma.agentConversation.count({ where }),
    ])
    return { items, total, page, pageSize }
}

/** 获取会话消息历史 */
export async function getConversationMessages(conversationId: string, userId: string, tenantId: string) {
    // 权限校验：确保会话属于当前用户
    const conv = await prisma.agentConversation.findFirst({
        where: { id: conversationId, userId, tenantId, deletedAt: null },
    })
    if (!conv) return null

    const messages = await prisma.agentMessage.findMany({
        where: { conversationId },
        orderBy: { createdAt: 'asc' },
    })
    return { conversation: conv, messages }
}

/** 删除会话（软删除） */
export async function deleteConversation(conversationId: string, userId: string, tenantId: string) {
    const conv = await prisma.agentConversation.findFirst({
        where: { id: conversationId, userId, tenantId, deletedAt: null },
    })
    if (!conv) return false
    await prisma.agentConversation.update({
        where: { id: conversationId },
        data: { deletedAt: new Date() },
    })
    return true
}

// ==================== 消息持久化 ====================

/** 保存用户消息 */
async function saveUserMessage(conversationId: string, content: string) {
    return prisma.agentMessage.create({
        data: { conversationId, role: 'user', content },
    })
}

/** 保存助手消息 */
async function saveAssistantMessage(conversationId: string, content: string, tokenCount: number) {
    return prisma.agentMessage.create({
        data: { conversationId, role: 'assistant', content, tokenCount },
    })
}

/** 更新会话统计（调用次数、token 用量） */
async function updateConversationStats(conversationId: string, callCount: number, tokenUsage: number) {
    await prisma.agentConversation.update({
        where: { id: conversationId },
        data: { callCount: { increment: callCount }, tokenUsage: { increment: tokenUsage } },
    })
}

// ==================== 审计日志 ====================

/** 记录审计日志（异步不阻塞） */
function logAudit(params: {
    userId: string
    tenantId: string
    conversationId: string
    action: string
    toolName?: string
    input?: unknown
    output?: unknown
    durationMs?: number
    success?: boolean
    errorMessage?: string
    ipAddress?: string
}) {
    prisma.agentAuditLog.create({
        data: {
            userId: params.userId,
            tenantId: params.tenantId,
            conversationId: params.conversationId,
            action: params.action,
            toolName: params.toolName || null,
            input: params.input as any,
            output: params.output as any,
            duration: params.durationMs || null,
            success: params.success ?? true,
            errorMessage: params.errorMessage || null,
            ipAddress: params.ipAddress || null,
        },
    }).catch(err => logger.error({ err }, 'Agent 审计日志写入失败'))
}

// ==================== 对话执行 ===================

type SSESend = <E extends SSEEvent>(event: E, data: SSEEventData[E]) => void

/**
 * 执行一次完整对话
 *
 * 1. 保存用户消息到数据库
 * 2. 加载历史消息
 * 3. 调用 Agent 调度核心
 * 4. 收集最终结果并持久化
 * 5. 全程通过 SSE 推送进度
 */
export async function executeChat(
    conversationId: string,
    userMessage: string,
    context: AgentContext,
    send: SSESend,
): Promise<void> {
    const startTime = Date.now()
    let assistantContent = ''
    let totalTokens = 0
    let callCount = 0

    try {
        // 1. 保存用户消息
        await saveUserMessage(conversationId, userMessage)

        // 2. 加载历史消息（最近 20 条，防止 token 爆炸）
        const dbMessages = await prisma.agentMessage.findMany({
            where: { conversationId },
            orderBy: { createdAt: 'asc' },
            take: 20,
        })

        const history: ChatMessage[] = dbMessages.map(m => ({
            role: m.role as ChatMessage['role'],
            content: m.content,
        }))

        // 3. 包装 send 回调以收集结果
        const wrappedSend: SSESend = (event, data) => {
            // 收集最终文本
            if (event === 'text') {
                assistantContent = (data as SSEEventData['text']).content
            }
            // 累计 token
            if (event === 'usage') {
                totalTokens += (data as SSEEventData['usage']).totalTokens
                callCount++
            }
            // 透传给前端
            send(event, data)
        }

        // 4. 调用 Agent 调度核心
        await runAgentLoop(history, context, wrappedSend)

        // 5. 保存助手回复
        if (assistantContent) {
            await saveAssistantMessage(conversationId, assistantContent, totalTokens)
        }

        // 6. 更新会话统计
        await updateConversationStats(conversationId, callCount, totalTokens)

        // 7. 审计日志
        logAudit({
            userId: context.userId,
            tenantId: context.tenantId,
            conversationId,
            action: 'chat',
            input: { message: userMessage.slice(0, 500) },
            output: { response: assistantContent.slice(0, 500), callCount, totalTokens },
            durationMs: Date.now() - startTime,
            success: true,
            ipAddress: context.ipAddress,
        })
    } catch (err) {
        const errorMsg = (err as Error).message

        // 错误事件推送给前端
        send('error', { message: errorMsg, code: 'AGENT_ERROR' })
        send('done', { conversationId })

        // 审计日志
        logAudit({
            userId: context.userId,
            tenantId: context.tenantId,
            conversationId,
            action: 'error',
            input: { message: userMessage.slice(0, 500) },
            durationMs: Date.now() - startTime,
            success: false,
            errorMessage: errorMsg,
            ipAddress: context.ipAddress,
        })

        logger.error({ err: errorMsg, userId: context.userId, conversationId }, 'Agent 对话执行失败')
    }
}

// ==================== 会话次数检查 ====================

/** 检查会话是否超出调用次数限制 */
export async function checkConversationLimit(conversationId: string): Promise<boolean> {
    const conv = await prisma.agentConversation.findUnique({
        where: { id: conversationId },
        select: { callCount: true, tokenUsage: true },
    })
    if (!conv) return false
    if (conv.callCount >= agentConfig.maxCallsPerConversation) return false
    if (conv.tokenUsage >= agentConfig.maxTokensPerConversation) return false
    return true
}
