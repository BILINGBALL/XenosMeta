/**
 * Agent Controller — SSE 流式对话 + 会话 CRUD
 */
import { Request, Response } from 'express'
import { asyncHandler } from '@utils/async-handler'
import { success, fail, notFound } from '@utils/response'
import {
    createConversation,
    listConversations,
    getConversationMessages,
    deleteConversation,
    executeChat,
    checkRateLimit,
    checkConversationLimit,
} from '@modules/agent/agent.service'
import type { AgentContext, SSEEvent, SSEEventData } from '@modules/agent/agent.types'

// ==================== SSE 辅助 ====================

/**
 * 创建 SSE 发送函数
 * 设置正确的 SSE 响应头，提供类型安全的 send 方法
 */
function createSSEStream(res: Response) {
    res.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
        'X-Accel-Buffering': 'no', // Nginx 禁用缓冲
    })
    res.flushHeaders()

    const send = <E extends SSEEvent>(event: E, data: SSEEventData[E]) => {
        res.write(`event: ${event}\n`)
        res.write(`data: ${JSON.stringify(data)}\n\n`)
    }

    // 心跳保活（每 30 秒发送注释行，防止代理超时断开）
    const heartbeat = setInterval(() => {
        res.write(': heartbeat\n\n')
    }, 30000)

    // 清理函数
    const cleanup = () => {
        clearInterval(heartbeat)
        res.end()
    }

    return { send, cleanup }
}

/** 从 Request 构建 AgentContext */
function buildContext(req: Request, conversationId: string): AgentContext {
    return {
        userId: req.userId || '',
        tenantId: req.tenantId || '',
        username: req.username || '',
        permissions: req.userPermissions || [],
        isSuperAdmin: !!req.user?.isSuperAdmin,
        groupIds: req.user?.groupIds,
        conversationId,
        ipAddress: req.ip,
    }
}

// ==================== Controller ====================

class AgentController {
    /** POST /api/agent/conversations — 创建会话 */
    createConversation = asyncHandler(async (req: Request, res: Response) => {
        const userId = req.userId!
        const tenantId = req.tenantId!
        const { title } = req.body as { title?: string }
        const conv = await createConversation(userId, tenantId, title)
        res.json(success(conv, '会话创建成功'))
    })

    /** GET /api/agent/conversations — 会话列表 */
    listConversations = asyncHandler(async (req: Request, res: Response) => {
        const userId = req.userId!
        const tenantId = req.tenantId!
        const page = Number(req.query.page) || 1
        const pageSize = Number(req.query.pageSize) || 20
        const result = await listConversations(userId, tenantId, page, pageSize)
        res.json(success(result))
    })

    /** GET /api/agent/conversations/:id/messages — 获取会话消息历史 */
    getMessages = asyncHandler(async (req: Request, res: Response) => {
        const result = await getConversationMessages(
            req.params.id,
            req.userId!,
            req.tenantId!,
        )
        if (!result) {
            return res.status(404).json(notFound('会话不存在'))
        }
        res.json(success(result))
    })

    /** DELETE /api/agent/conversations/:id — 删除会话 */
    deleteConversation = asyncHandler(async (req: Request, res: Response) => {
        const ok = await deleteConversation(req.params.id, req.userId!, req.tenantId!)
        if (!ok) return res.status(404).json(notFound('会话不存在'))
        res.json(success(null, '删除成功'))
    })

    /**
     * POST /api/agent/chat — SSE 流式对话
     *
     * 请求体：{ conversationId: string, message: string }
     * 响应：SSE 流，事件类型包括 thinking / text / tool_start / tool_result / error / done / usage
     */
    chat = asyncHandler(async (req: Request, res: Response) => {
        const { conversationId, message } = req.body as { conversationId: string; message: string }

        if (!conversationId || !message?.trim()) {
            return res.status(400).json(fail('缺少 conversationId 或 message'))
        }

        // 1. 限流检查
        const rateLimited = await checkRateLimit(req.userId!)
        if (!rateLimited) {
            return res.status(429).json(fail('请求过于频繁，请稍后再试', 429))
        }

        // 2. 会话归属权校验 + 调用次数检查
        const convMessages = await getConversationMessages(conversationId, req.userId!, req.tenantId!)
        if (!convMessages) {
            return res.status(404).json(notFound('会话不存在'))
        }

        const withinLimit = await checkConversationLimit(conversationId)
        if (!withinLimit) {
            return res.status(429).json(fail('会话调用次数或 token 用量已达上限', 429))
        }

        // 3. 构建 Agent 上下文
        const context = buildContext(req, conversationId)

        // 4. 开启 SSE 流
        const { send, cleanup } = createSSEStream(res)

        // 5. 客户端断开连接时清理
        req.on('close', () => {
            cleanup()
        })

        // 6. 执行对话（异步，不阻塞请求）
        executeChat(conversationId, message.trim(), context, send)
            .finally(() => {
                cleanup()
            })
    })

    /** GET /api/agent/tools — 获取可用工具列表（供前端展示） */
    getTools = asyncHandler(async (req: Request, res: Response) => {
        // 动态导入避免循环依赖
        const { getToolDefinitions, checkToolPermission } = await import('@modules/agent/agent.tools')
        const ctx = buildContext(req, '')
        const tools = getToolDefinitions().map(t => ({
            name: t.name,
            description: t.description,
            available: checkToolPermission(t.name, ctx),
        }))
        res.json(success(tools))
    })
}

export const agentController = new AgentController()
