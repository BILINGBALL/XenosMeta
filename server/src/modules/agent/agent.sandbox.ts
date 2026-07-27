import vm from 'vm'
import { logger } from '@common/logger'
import { agentConfig } from '@modules/agent/agent.config'

// ==================== 沙箱配置（带默认值兜底，防止配置缺失导致崩溃）====================

// 沙箱最大执行时长（毫秒），从 agentConfig.timeout 读取，默认 5000ms
const SANDBOX_TIMEOUT_MS: number = agentConfig?.timeout ?? 5000
// 沙箱内 setTimeout 的最大延迟（毫秒），防止脚本长时间挂起
const SANDBOX_MAX_SET_TIMEOUT_MS: number = agentConfig?.timeout ?? 5000

// ==================== 沙箱执行结果类型 ====================

export interface SandboxResult {
    result: unknown
    error?: string
    durationMs: number
    logs?: string[]
}

// ==================== 辅助函数 ====================

// 将参数数组格式化为字符串（用于日志输出，避免序列化异常）
function formatArgs(args: unknown[]): string {
    return args
        .map(a => {
            if (typeof a === 'string') return a
            try {
                return JSON.stringify(a)
            } catch {
                return String(a)
            }
        })
        .join(' ')
}

// 清理所有未完成的沙箱定时器，防止泄漏到宿主事件循环
function cleanupTimers(timers: NodeJS.Timeout[]): void {
    while (timers.length > 0) {
        const id = timers.pop()
        if (id) {
            try {
                clearTimeout(id)
            } catch {
                /* 忽略清理错误 */
            }
        }
    }
}

// 构建受限的全局对象集合：仅暴露安全的内置对象
// 明确不暴露：process / require / import / fetch / globalThis / Buffer / __dirname 等
function createSandboxGlobals(
    pendingTimers: NodeJS.Timeout[],
    logCollector: string[],
): Record<string, unknown> {
    const captureLog = (level: string, args: unknown[]) => {
        const msg = formatArgs(args)
        logCollector.push(`[${level}] ${msg}`)
        ;(logger as any)[level === 'log' ? 'info' : level]({ sandbox: true }, msg)
    }
    return {
        // 受限 console：同时输出到日志和收集器（Agent 可以看到输出）
        console: {
            log: (...args: unknown[]) => captureLog('log', args),
            info: (...args: unknown[]) => captureLog('info', args),
            warn: (...args: unknown[]) => captureLog('warn', args),
            error: (...args: unknown[]) => captureLog('error', args),
            debug: (...args: unknown[]) => captureLog('debug', args),
        },
        // 安全的内置对象
        JSON,
        Math,
        Date,
        parseInt,
        parseFloat,
        String,
        Number,
        Boolean,
        Array,
        Object,
        // Promise / Error 为 async/await 与异常处理所需
        Promise,
        Error,
        // 受限的 setTimeout：限制最大延迟，并跟踪所有定时器以便沙箱退出时统一清理
        setTimeout: (fn: (...args: unknown[]) => void, delay?: number, ...args: unknown[]) => {
            const safeDelay = Math.min(Math.max(delay ?? 0, 0), SANDBOX_MAX_SET_TIMEOUT_MS)
            const id = setTimeout(() => {
                // 触发后从待清理列表移除
                const idx = pendingTimers.indexOf(id)
                if (idx >= 0) pendingTimers.splice(idx, 1)
                try {
                    fn(...args)
                } catch (err) {
                    logger.warn({ sandbox: true, err: (err as Error).message }, '沙箱定时器回调异常')
                }
            }, safeDelay)
            pendingTimers.push(id)
            return id
        },
        clearTimeout: (id: NodeJS.Timeout) => {
            const idx = pendingTimers.indexOf(id)
            if (idx >= 0) pendingTimers.splice(idx, 1)
            clearTimeout(id)
        },
    }
}

// ==================== 沙箱执行入口 ====================

/**
 * 在受限沙箱中执行用户 JavaScript 代码
 *
 * 安全措施：
 * 1. 仅暴露白名单全局对象（console/JSON/Math/Date 等），不暴露 process/require/Buffer/globalThis 等
 * 2. 禁用 eval / new Function（codeGeneration.strings = false），阻断原型链逃逸
 * 3. 同步死循环通过 vm.runInContext 的 timeout 选项拦截
 * 4. 异步死循环/超时通过 Promise.race + setTimeout 拦截
 * 5. RangeError（内存溢出）单独捕获
 * 6. 沙箱退出时清理所有未完成的定时器
 * 7. 测量执行耗时
 *
 * @param code 用户代码（支持 await）
 * @param context 只读上下文数据（如 userId/tenantId，不应包含 token 等敏感信息）
 */
export async function runInSandbox(
    code: string,
    context?: Record<string, unknown>,
): Promise<SandboxResult> {
    const start = Date.now()
    // 跟踪所有沙箱内创建的定时器，便于退出时统一清理
    const pendingTimers: NodeJS.Timeout[] = []
    // 收集 console 输出，返回给 Agent
    const logCollector: string[] = []

    // 构建沙箱对象：白名单全局 + 只读上下文
    const sandbox: Record<string, unknown> = {
        ...createSandboxGlobals(pendingTimers, logCollector),
        ...(context ?? {}),
    }

    // 创建 vm 上下文（禁用 eval / new Function）
    try {
        vm.createContext(sandbox, {
            name: 'agent-sandbox',
            codeGeneration: {
                strings: false,
                wasm: false,
            },
        })
    } catch (err) {
        return {
            result: null,
            error: `沙箱上下文创建失败: ${(err as Error).message}`,
            durationMs: Date.now() - start,
            logs: logCollector,
        }
    }

    // 将用户代码包裹在 async IIFE 中，支持 await 与 return
    const wrappedCode = `(async () => {\n${code}\n})()`

    // 同步执行阶段：vm.runInContext 的 timeout 选项可拦截同步死循环
    let promise: Promise<unknown>
    try {
        const ret = vm.runInContext(wrappedCode, sandbox, {
            timeout: SANDBOX_TIMEOUT_MS,
            filename: 'agent-sandbox.js',
            displayErrors: true,
        })
        // 用户代码应返回 Promise（包裹在 async IIFE 中）；做一次防御性判断
        promise = (ret && typeof ret.then === 'function')
            ? (ret as Promise<unknown>)
            : Promise.resolve(ret)
    } catch (err) {
        // 同步阶段错误：语法错误、同步死循环超时、同步异常等
        cleanupTimers(pendingTimers)
        return {
            result: null,
            error: `代码执行错误: ${(err as Error).message}`,
            durationMs: Date.now() - start,
            logs: logCollector,
        }
    }

    // 异步执行阶段：用 Promise.race 拦截异步死循环/超时
    let timeoutId: NodeJS.Timeout | undefined
    const timeoutPromise = new Promise<never>((_, reject) => {
        timeoutId = setTimeout(() => {
            reject(new Error(`执行超时（${SANDBOX_TIMEOUT_MS}ms）`))
        }, SANDBOX_TIMEOUT_MS)
    })

    try {
        const result = await Promise.race([promise, timeoutPromise])
        return {
            result,
            durationMs: Date.now() - start,
            logs: logCollector,
        }
    } catch (err) {
        // 内存溢出（RangeError）单独处理
        if (err instanceof RangeError) {
            return {
                result: null,
                error: `内存溢出: ${(err as Error).message}`,
                durationMs: Date.now() - start,
                logs: logCollector,
            }
        }
        return {
            result: null,
            error: `执行错误: ${(err as Error).message}`,
            durationMs: Date.now() - start,
            logs: logCollector,
        }
    } finally {
        // 无论成功失败，清理超时定时器与沙箱内残留定时器
        if (timeoutId) clearTimeout(timeoutId)
        cleanupTimers(pendingTimers)
    }
}
