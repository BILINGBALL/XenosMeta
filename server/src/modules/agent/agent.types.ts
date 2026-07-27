/**
 * Agent 模块类型定义
 * 包含对话消息、工具定义、工具调用、SSE 流式事件、Agent 上下文与配置等核心类型
 */

/** 对话角色 */
export type ChatRole = 'user' | 'assistant' | 'system' | 'tool'

/** JSON Schema 类型定义（用于工具参数描述） */
export interface JsonSchema {
    type?: string
    properties?: Record<string, JsonSchema>
    required?: string[]
    description?: string
    items?: JsonSchema
    enum?: unknown[]
    additionalProperties?: boolean | JsonSchema
    [key: string]: unknown
}

/** 对话消息 */
export interface ChatMessage {
    /** 消息角色 */
    role: ChatRole
    /** 消息内容 */
    content: string
    /** 模型生成的工具调用列表（仅 assistant 角色） */
    toolCalls?: ToolCallRequest[]
    /** 工具调用结果对应的调用 ID（仅 tool 角色） */
    toolCallId?: string
    /** 产生该消息的工具名称（仅 tool 角色） */
    toolName?: string
}

/** 工具定义 */
export interface ToolDefinition {
    /** 工具名称（需唯一） */
    name: string
    /** 工具描述，供模型理解何时调用 */
    description: string
    /** 工具参数的 JSON Schema 描述 */
    parameters: JsonSchema
    /** 调用该工具所需的权限码列表（空数组表示无权限要求） */
    requiredPermissions: string[]
}

/** 工具调用请求 */
export interface ToolCallRequest {
    /** 调用唯一标识，用于关联调用结果 */
    id: string
    /** 工具名称 */
    name: string
    /** 调用参数 */
    arguments: Record<string, unknown>
}

/** 工具调用结果 */
export interface ToolCallResult {
    /** 对应的调用 ID */
    toolCallId: string
    /** 是否执行成功 */
    success: boolean
    /** 执行结果（成功时） */
    result: unknown
    /** 错误信息（失败时） */
    error?: string
}

/** SSE 流式事件类型 */
export type SSEEvent =
    | 'thinking'
    | 'text'
    | 'tool_start'
    | 'tool_result'
    | 'error'
    | 'done'
    | 'usage'

/** SSE 流式事件数据，按事件类型映射对应的负载 */
export interface SSEEventData {
    /** 思考过程 */
    thinking: {
        content: string
    }
    /** 文本输出（含增量 delta） */
    text: {
        content: string
        delta: string
    }
    /** 工具开始执行 */
    tool_start: {
        toolCallId: string
        name: string
        arguments: Record<string, unknown>
    }
    /** 工具执行结果 */
    tool_result: {
        toolCallId: string
        success: boolean
        result: unknown
        error?: string
    }
    /** 错误事件 */
    error: {
        message: string
        code?: string
    }
    /** 流结束 */
    done: {
        conversationId: string
    }
    /** Token 用量统计 */
    usage: {
        promptTokens: number
        completionTokens: number
        totalTokens: number
    }
}

/** Agent 运行上下文，由认证中间件注入 */
export interface AgentContext {
    /** 用户 ID */
    userId: string
    /** 租户 ID */
    tenantId: string
    /** 用户名 */
    username: string
    /** 用户权限码列表 */
    permissions: string[]
    /** 是否为超级管理员 */
    isSuperAdmin: boolean
    /** 用户所属群组 ID 列表（可选） */
    groupIds?: string[]
    /** 当前会话 ID */
    conversationId: string
    /** 客户端 IP 地址（可选） */
    ipAddress?: string
}

/** LLM 大模型配置 */
export interface LLMConfig {
    /** API 基础地址 */
    apiBase: string
    /** API 密钥 */
    apiKey: string
    /** 模型名称 */
    model: string
    /** 采样温度 */
    temperature: number
    /** 单次请求最大 Token 数 */
    maxTokens: number
    /** 系统提示词 */
    systemPrompt: string
}

/** 沙箱资源限制配置 */
export interface SandboxConfig {
    /** 执行超时时间（毫秒） */
    timeout: number
    /** 最大内存（MB） */
    maxMemoryMB: number
    /** 最大 CPU 时间（毫秒） */
    maxCpuMs: number
}

/** Agent 完整配置（包含 LLM、沙箱与限流配置） */
export interface AgentConfig extends LLMConfig, SandboxConfig {
    /** 单次会话最大调用次数 */
    maxCallsPerConversation: number
    /** 单次会话最大 Token 数 */
    maxTokensPerConversation: number
    /** 每分钟限流次数 */
    rateLimitPerMinute: number
}

/** 限流信息（基于 Redis 计数） */
export interface RateLimitInfo {
    /** 当前窗口内已用次数 */
    count: number
    /** 窗口重置时间戳（毫秒） */
    resetAt: number
    /** 是否已被限流拦截 */
    blocked: boolean
}
