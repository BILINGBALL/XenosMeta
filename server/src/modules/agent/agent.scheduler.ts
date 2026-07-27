/**
 * Agent 调度核心
 * 负责：LLM 调用 → 意图识别 → Function Calling → 工具执行 → 权限双层校验 → 结果回传
 * 所有业务逻辑在后端运行，前端仅做数据渲染
 */
import { logger } from '@common/logger'
import { agentConfig } from '@modules/agent/agent.config'
import { toolRegistry, getToolDefinitions, checkToolPermission } from '@modules/agent/agent.tools'
import type {
    AgentContext,
    ChatMessage,
    SSEEvent,
    SSEEventData,
    ToolCallRequest,
    ToolCallResult,
} from '@modules/agent/agent.types'

// ==================== 类型定义 ====================

/** SSE 发送回调函数类型 */
type SSESend = <E extends SSEEvent>(event: E, data: SSEEventData[E]) => void

/** LLM 响应结构 */
interface LLMResponse {
    content: string
    toolCalls?: ToolCallRequest[]
    promptTokens: number
    completionTokens: number
    totalTokens: number
}

// ==================== 辅助函数 ====================

/**
 * 生成用户可用工具的摘要文本（拼接到系统提示词末尾）
 * 让 Agent 一开始就知道自己能做什么，不需要再调用 get_permission_map
 */
function buildAvailableToolsPrompt(context: AgentContext): string {
    const available: string[] = []
    const unavailable: string[] = []

    for (const [name, entry] of toolRegistry.entries()) {
        const isAvailable = checkToolPermission(name, context)
        const desc = entry.definition.description.split('（')[0].split('。')[0]
        if (isAvailable) {
            available.push(`- ${name}: ${desc}`)
        } else {
            unavailable.push(`- ${name}: ${desc}（无权限）`)
        }
    }

    const lines: string[] = []
    lines.push('')
    lines.push('---')
    lines.push('')
    lines.push(`## 当前用户权限状态（${context.isSuperAdmin ? '超级管理员' : '普通用户'}）`)
    lines.push('')
    lines.push(`可用工具 ${available.length} 个：`)
    lines.push(...available)
    if (unavailable.length > 0 && !context.isSuperAdmin) {
        lines.push('')
        lines.push(`不可用工具 ${unavailable.length} 个（仅作参考，不要尝试调用）：`)
        lines.push(...unavailable)
    }
    lines.push('')
    lines.push('> 提示：get_permission_map 工具可以查看更详细的权限信息，但通常你不需要调用它，上面的列表已经足够。')

    return lines.join('\n')
}

// ==================== LLM 调用 ====================

/**
 * 调用 OpenAI 兼容的 LLM API
 * 支持 Function Calling，返回文本内容与工具调用请求
 */
async function callLLM(
    messages: ChatMessage[],
    context: AgentContext,
): Promise<LLMResponse> {
    const tools = getToolDefinitions()

    // 构造 OpenAI 格式的消息体
    const apiMessages = messages.map(m => {
        const msg: Record<string, unknown> = { role: m.role, content: m.content }
        if (m.toolCalls) msg.tool_calls = m.toolCalls.map(tc => ({
            id: tc.id,
            type: 'function',
            function: { name: tc.name, arguments: JSON.stringify(tc.arguments) },
        }))
        if (m.toolCallId) msg.tool_call_id = m.toolCallId
        return msg
    })

    // 构造工具定义（OpenAI function calling 格式）
    const apiTools = tools.map(t => ({
        type: 'function' as const,
        function: {
            name: t.name,
            description: t.description,
            parameters: t.parameters,
        },
    }))

    const body: Record<string, unknown> = {
        model: agentConfig.model,
        messages: apiMessages,
        temperature: agentConfig.temperature,
        max_tokens: agentConfig.maxTokens,
    }
    // 有工具时才传 tools 参数
    if (apiTools.length > 0) {
        body.tools = apiTools
    }

    const url = `${agentConfig.apiBase}/chat/completions`
    logger.debug({ model: agentConfig.model, messageCount: apiMessages.length }, 'Agent LLM 请求')

    const res = await fetch(url, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${agentConfig.apiKey}`,
        },
        body: JSON.stringify(body),
    })

    if (!res.ok) {
        const errText = await res.text().catch(() => res.statusText)
        throw new Error(`LLM API 错误 (${res.status}): ${errText}`)
    }

    const json = await res.json() as any
    const choice = json.choices?.[0]
    if (!choice) throw new Error('LLM 返回空响应')

    const message = choice.message
    const content: string = message.content || ''

    // 解析工具调用
    let toolCalls: ToolCallRequest[] | undefined
    if (message.tool_calls && Array.isArray(message.tool_calls)) {
        toolCalls = message.tool_calls.map((tc: any) => ({
            id: tc.id,
            name: tc.function.name,
            arguments: safeParseJSON(tc.function.arguments, {}),
        }))
    }

    return {
        content,
        toolCalls,
        promptTokens: json.usage?.prompt_tokens ?? 0,
        completionTokens: json.usage?.completion_tokens ?? 0,
        totalTokens: json.usage?.total_tokens ?? 0,
    }
}

/** 安全解析 JSON，失败时返回默认值 */
function safeParseJSON<T>(str: string, defaultValue: T): T {
    try {
        return JSON.parse(str) as T
    } catch {
        return defaultValue
    }
}

// ==================== 工具执行 ====================

/**
 * 执行单个工具调用
 * 双层权限校验：① checkToolPermission 内存校验 ② 工具内部租户/数据隔离校验
 */
async function executeTool(
    request: ToolCallRequest,
    context: AgentContext,
    send: SSESend,
): Promise<ToolCallResult> {
    const { id, name, arguments: args } = request

    // 第一层：权限校验（内存比较，防止 LLM 幻觉越权）
    if (!checkToolPermission(name, context)) {
        logger.warn(
            { userId: context.userId, toolName: name, permissions: context.permissions },
            'Agent 工具调用权限不足',
        )
        send('tool_result', {
            toolCallId: id,
            success: false,
            result: null,
            error: `权限不足：调用工具 "${name}" 需要相应权限`,
        })
        return {
            toolCallId: id,
            success: false,
            result: null,
            error: `权限不足：调用工具 "${name}" 需要相应权限`,
        }
    }

    const entry = toolRegistry.get(name)
    if (!entry) {
        send('tool_result', {
            toolCallId: id,
            success: false,
            result: null,
            error: `工具 "${name}" 不存在`,
        })
        return { toolCallId: id, success: false, result: null, error: `工具不存在: ${name}` }
    }

    // 通知前端工具开始执行
    send('tool_start', { toolCallId: id, name, arguments: args })

    const startTime = Date.now()
    try {
        // 第二层：工具内部自行校验租户隔离与数据权限
        const result = await entry.execute(args, context)
        const durationMs = Date.now() - startTime

        // 截断过长的结果（防止 token 爆炸）
        const truncated = truncateResult(result)

        send('tool_result', {
            toolCallId: id,
            success: true,
            result: truncated,
        })

        logger.info(
            { userId: context.userId, toolName: name, durationMs },
            'Agent 工具调用完成',
        )

        return { toolCallId: id, success: true, result: truncated }
    } catch (err) {
        const durationMs = Date.now() - startTime
        const errorMsg = (err as Error).message

        send('tool_result', {
            toolCallId: id,
            success: false,
            result: null,
            error: errorMsg,
        })

        logger.error(
            { userId: context.userId, toolName: name, durationMs, err: errorMsg },
            'Agent 工具调用失败',
        )

        return { toolCallId: id, success: false, result: null, error: errorMsg }
    }
}

/** 截断过长的工具返回结果，避免超出 LLM 上下文限制 */
function truncateResult(result: unknown, maxLength = 4000): unknown {
    if (result === null || result === undefined) return result
    try {
        const str = JSON.stringify(result)
        if (str.length <= maxLength) return result
        return {
            _truncated: true,
            preview: str.slice(0, maxLength),
            totalLength: str.length,
        }
    } catch {
        return String(result).slice(0, maxLength)
    }
}

// ==================== Agent 主循环 ====================

/**
 * Agent 调度主循环
 *
 * 流程：
 * 1. 将用户消息加入对话历史
 * 2. 调用 LLM（携带工具定义）
 * 3. 如果 LLM 请求工具调用：
 *    a. 重复调用检测（防止死循环）
 *    b. 逐个执行工具（双层权限校验）
 *    c. 将工具结果作为 tool 消息加入历史
 *    d. 回到步骤 2 继续调用 LLM
 * 4. 如果 LLM 返回纯文本，作为最终回答
 * 5. 通过 SSE 实时推送进度
 *
 * @param messages 对话历史（含本次用户消息）
 * @param context Agent 运行上下文
 * @param send SSE 发送回调
 * @param maxRounds 最大工具调用轮次（防止无限循环）
 */
export async function runAgentLoop(
    messages: ChatMessage[],
    context: AgentContext,
    send: SSESend,
    maxRounds: number = 15,
): Promise<void> {
    let callCount = 0
    let totalTokens = 0

    // 调用签名记录：用于检测重复调用（防止死循环）
    const callSignatures = new Map<string, number>()

    // 注入系统提示词 + 当前用户可用工具状态
    const systemPromptWithPerm = agentConfig.systemPrompt + buildAvailableToolsPrompt(context)
    const fullMessages: ChatMessage[] = [
        { role: 'system', content: systemPromptWithPerm },
        ...messages,
    ]

    for (let round = 0; round < maxRounds; round++) {
        // 调用 LLM
        const llmRes = await callLLM(fullMessages, context)
        callCount++
        totalTokens += llmRes.totalTokens

        // 推送 token 用量
        send('usage', {
            promptTokens: llmRes.promptTokens,
            completionTokens: llmRes.completionTokens,
            totalTokens: llmRes.totalTokens,
        })

        // 如果有工具调用，先执行工具
        if (llmRes.toolCalls && llmRes.toolCalls.length > 0) {
            // 将 assistant 的工具调用消息加入历史
            fullMessages.push({
                role: 'assistant',
                content: llmRes.content,
                toolCalls: llmRes.toolCalls,
            })

            // 逐个执行工具
            for (const tc of llmRes.toolCalls) {
                // 重复调用检测：相同工具+相同参数超过 3 次直接终止
                const sig = `${tc.name}:${JSON.stringify(tc.arguments).slice(0, 200)}`
                const count = (callSignatures.get(sig) || 0) + 1
                callSignatures.set(sig, count)

                if (count >= 3) {
                    const errorMsg = `检测到工具 "${tc.name}" 已重复调用 ${count} 次且参数相同，为避免死循环已停止。请换一种方式或拆分任务。`
                    logger.warn(
                        { userId: context.userId, toolName: tc.name, round },
                        'Agent 工具重复调用，触发防死循环保护',
                    )
                    send('tool_result', {
                        toolCallId: tc.id,
                        success: false,
                        result: null,
                        error: errorMsg,
                    })
                    fullMessages.push({
                        role: 'tool',
                        content: JSON.stringify({ error: errorMsg }),
                        toolCallId: tc.id,
                        toolName: tc.name,
                    })
                    continue
                }

                const result = await executeTool(tc, context, send)
                // 将工具结果作为 tool 消息加入历史
                fullMessages.push({
                    role: 'tool',
                    content: JSON.stringify(result.result ?? result.error),
                    toolCallId: result.toolCallId,
                    toolName: tc.name,
                })
            }

            // 继续下一轮 LLM 调用（让模型处理工具结果）
            continue
        }

        // 没有工具调用 → 最终文本回答
        send('text', { content: llmRes.content, delta: llmRes.content })
        send('done', { conversationId: context.conversationId })

        logger.info(
            { userId: context.userId, conversationId: context.conversationId, callCount, totalTokens, rounds: round + 1 },
            'Agent 对话完成',
        )
        return
    }

    // 超过最大轮次
    send('error', {
        message: `任务过于复杂，已执行 ${maxRounds} 轮工具调用仍未完成。请将任务拆分为更小的步骤，分步执行。`,
        code: 'MAX_ROUNDS_EXCEEDED',
    })
    send('done', { conversationId: context.conversationId })
}
