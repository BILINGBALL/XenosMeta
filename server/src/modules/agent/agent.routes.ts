/**
 * Agent 路由 — 独立路由组，与原有业务解耦
 *
 * 所有路由均挂载在 /api/agent 前缀下，复用全局 authMiddleware
 * 路由结构：
 *   POST   /conversations          创建会话
 *   GET    /conversations          会话列表
 *   GET    /conversations/:id/messages  获取消息历史
 *   PATCH  /conversations/:id      更新会话（重命名、置顶）
 *   DELETE /conversations/:id      删除会话
 *   POST   /chat                   SSE 流式对话
 *   GET    /tools                  可用工具列表
 */
import { Router } from 'express'
import { authMiddleware } from '@middleware/auth'
import { agentController } from '@modules/agent/agent.controller'

const router = Router()

// 整个 Agent 路由组要求登录
router.use(authMiddleware)

// 会话管理
router.post('/conversations', agentController.createConversation)
router.get('/conversations', agentController.listConversations)
router.get('/conversations/:id/messages', agentController.getMessages)
router.patch('/conversations/:id', agentController.updateConversation)
router.delete('/conversations/:id', agentController.deleteConversation)

// SSE 流式对话
router.post('/chat', agentController.chat)

// 工具列表
router.get('/tools', agentController.getTools)

export default router
