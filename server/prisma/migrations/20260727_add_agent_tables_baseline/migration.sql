-- ============================================================
-- Baseline: 补齐 agent 三张表的 CREATE TABLE
--
-- 背景：当年 agent_conversation / agent_message 是通过 db push 或
--   手动 SQL 建的，没有走 migrate 流程，迁移历史里从来没有 CREATE TABLE。
--   后来 20260728_add_agent_conversation_pinned 想 ALTER TABLE 加 pinned
--   列，shadow DB 回放到这里时找不到表 → P3006。
--
-- 此迁移在 shadow DB 和真实 DB 上都用 IF NOT EXISTS 保证幂等：
--   - shadow DB（空库）→ 正常建表
--   - 真实 DB（agent_conversation / agent_message 已存在）→ 跳过，
--     只补建缺失的 agent_audit_log
--
-- 注意：agent_conversation 此处不含 pinned 列，留给 20260728 迁移加。
-- ============================================================

-- CreateTable (agent_conversation，无 pinned 列)
CREATE TABLE IF NOT EXISTS "agent_conversation" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL DEFAULT '新对话',
    "userId" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'active',
    "callCount" INTEGER NOT NULL DEFAULT 0,
    "tokenUsage" INTEGER NOT NULL DEFAULT 0,
    "deletedAt" TIMESTAMPTZ(3),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "agent_conversation_pkey" PRIMARY KEY ("id")
);

-- CreateTable (agent_message)
CREATE TABLE IF NOT EXISTS "agent_message" (
    "id" TEXT NOT NULL,
    "conversationId" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "toolCalls" JSONB,
    "toolCallId" TEXT,
    "toolName" TEXT,
    "tokenCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "agent_message_pkey" PRIMARY KEY ("id")
);

-- CreateTable (agent_audit_log) — 真实 DB 里可能不存在，这里补建
CREATE TABLE IF NOT EXISTS "agent_audit_log" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "conversationId" TEXT,
    "action" TEXT NOT NULL,
    "toolName" TEXT,
    "input" JSONB,
    "output" JSONB,
    "duration" INTEGER,
    "success" BOOLEAN NOT NULL DEFAULT true,
    "errorMessage" TEXT,
    "ipAddress" TEXT,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "agent_audit_log_pkey" PRIMARY KEY ("id")
);

-- CreateIndex (agent_conversation，不含 pinned 相关索引，pinned 索引在 20260728 迁移)
CREATE INDEX IF NOT EXISTS "agent_conversation_userId_deletedAt_idx" ON "agent_conversation"("userId", "deletedAt");
CREATE INDEX IF NOT EXISTS "agent_conversation_tenantId_idx" ON "agent_conversation"("tenantId");

-- CreateIndex (agent_message)
CREATE INDEX IF NOT EXISTS "agent_message_conversationId_createdAt_idx" ON "agent_message"("conversationId", "createdAt");

-- CreateIndex (agent_audit_log)
CREATE INDEX IF NOT EXISTS "agent_audit_log_userId_createdAt_idx" ON "agent_audit_log"("userId", "createdAt");
CREATE INDEX IF NOT EXISTS "agent_audit_log_tenantId_action_idx" ON "agent_audit_log"("tenantId", "action");
CREATE INDEX IF NOT EXISTS "agent_audit_log_conversationId_idx" ON "agent_audit_log"("conversationId");

-- AddForeignKey (agent_message → agent_conversation)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints
        WHERE constraint_name = 'agent_message_conversationId_fkey'
          AND table_name = 'agent_message'
    ) THEN
        ALTER TABLE "agent_message" ADD CONSTRAINT "agent_message_conversationId_fkey"
            FOREIGN KEY ("conversationId") REFERENCES "agent_conversation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;
