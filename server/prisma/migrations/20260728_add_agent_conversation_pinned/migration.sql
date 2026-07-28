-- AlterTable
ALTER TABLE "agent_conversation" ADD COLUMN "pinned" BOOLEAN NOT NULL DEFAULT false;

-- CreateIndex
CREATE INDEX "agent_conversation_userId_pinned_updatedAt_idx" ON "agent_conversation"("userId", "pinned", "updatedAt");
