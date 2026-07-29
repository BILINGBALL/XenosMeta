/**
 * Agent Service — 会话管理、限流、审计日志
 */
import prisma from '@config/db'
import redis from '@common/redis'
import { logger } from '@common/logger'
import { agentConfig, buildRateLimitKey } from '@modules/agent/agent.config'
import { runAgentLoop } from '@modules/agent/agent.scheduler'
import type { AgentContext, ChatMessage, SSEEvent, SSEEventData } from '@modules/agent/agent.types'

// ==================== AI 标题生成 ====================

const TITLE_PROMPT = `你是对话标题生成助手。请根据用户的第一条消息，生成一个简洁、准确的对话标题。

要求：
1. 标题长度不超过12个字符（中文）
2. 不要包含标点符号
3. 直接输出标题，不要有任何解释
4. 如果消息是问题，保留核心关键词
5. 如果消息是操作请求，概括操作内容

用户消息：`

/**
 * 调用 LLM 生成对话标题
 * 异步 fire-and-forget，不阻塞主对话流程
 */
async function generateConversationTitle(conversationId: string, userMessage: string): Promise<void> {
    try {
        const url = `${agentConfig.apiBase}/chat/completions`
        const res = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${agentConfig.apiKey}`,
            },
            body: JSON.stringify({
                model: agentConfig.model,
                messages: [
                    { role: 'system', content: '你是一个对话标题生成助手，只输出标题文本，不输出任何解释。' },
                    { role: 'user', content: `${TITLE_PROMPT}${userMessage}` },
                ],
                temperature: 0.3,
                max_tokens: 30,
            }),
        })

        if (!res.ok) {
            logger.warn({ status: res.status, conversationId }, '标题生成 LLM 请求失败')
            return
        }

        const json = await res.json() as any
        const title = json.choices?.[0]?.message?.content?.trim()
        if (!title) return

        // 清理标题：去除引号、换行，截断到15字
        const cleanTitle = title
            .replace(/^["'""']|["'""']$/g, '')
            .replace(/\n/g, '')
            .replace(/[，。！？.,!?;；]/g, '')
            .slice(0, 12)

        if (cleanTitle) {
            await prisma.agentConversation.update({
                where: { id: conversationId },
                data: { title: cleanTitle },
            })
            logger.debug({ conversationId, title: cleanTitle }, 'AI 生成对话标题')
        }
    } catch (err) {
        logger.warn({ err: (err as Error).message, conversationId }, '标题生成失败，保留默认标题')
    }
}

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

/** 获取会话列表（含最后一条消息预览，供侧边栏展示） */
export async function listConversations(userId: string, tenantId: string, page = 1, pageSize = 20) {
    const where = { userId, tenantId, deletedAt: null }
    const [rawItems, total] = await Promise.all([
        prisma.agentConversation.findMany({
            where,
            orderBy: [
                { pinned: 'desc' },   // 置顶在前
                { updatedAt: 'desc' }, // 同级别按更新时间倒序
            ],
            skip: (page - 1) * pageSize,
            take: pageSize,
            include: {
                messages: {
                    orderBy: { createdAt: 'desc' },
                    take: 1,
                    select: { content: true, role: true },
                },
            },
        }),
        prisma.agentConversation.count({ where }),
    ])
    // 映射：把最后一条消息内容截断为预览文本
    const items = rawItems.map(c => {
        const { messages, ...rest } = c
        const lastMsg = messages[0]
        const preview = lastMsg ? lastMsg.content.replace(/\s+/g, ' ').trim().slice(0, 80) : null
        return { ...rest, lastMessagePreview: preview || null }
    })
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

/** 更新会话（重命名、置顶） */
export async function updateConversation(
    conversationId: string,
    userId: string,
    tenantId: string,
    data: { title?: string; pinned?: boolean },
) {
    const conv = await prisma.agentConversation.findFirst({
        where: { id: conversationId, userId, tenantId, deletedAt: null },
    })
    if (!conv) return null
    const updateData: { title?: string; pinned?: boolean } = {}
    if (typeof data.title === 'string' && data.title.trim()) {
        updateData.title = data.title.trim().slice(0, 100)
    }
    if (typeof data.pinned === 'boolean') {
        updateData.pinned = data.pinned
    }
    if (Object.keys(updateData).length === 0) return conv
    return prisma.agentConversation.update({
        where: { id: conversationId },
        data: updateData,
    })
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

        // 1.5. 首次对话时调用 AI 生成简短标题，方便侧边栏识别
        const userMsgCount = await prisma.agentMessage.count({
            where: { conversationId, role: 'user' },
        })
        if (userMsgCount === 1) {
            // 先设置一个临时标题（首句截取），避免侧边栏显示"新对话"
            const tempTitle = userMessage.trim().slice(0, 12) + (userMessage.trim().length > 12 ? '…' : '')
            await prisma.agentConversation.update({
                where: { id: conversationId },
                data: { title: tempTitle || '新对话' },
            })
            // 异步调用 AI 生成更优标题（不阻塞 SSE 流）
            generateConversationTitle(conversationId, userMessage.trim())
        }

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
