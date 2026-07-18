-- AlterTable
ALTER TABLE "Group" ADD COLUMN     "deletedAt" TIMESTAMPTZ(3),
ADD COLUMN     "path" TEXT;

-- AlterTable
ALTER TABLE "Role" ADD COLUMN     "deletedAt" TIMESTAMPTZ(3);

-- AlterTable
ALTER TABLE "Tenant" ADD COLUMN     "deletedAt" TIMESTAMPTZ(3);

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "deletedAt" TIMESTAMPTZ(3);

-- AlterTable
ALTER TABLE "dynamic_field" ADD COLUMN     "deletedAt" TIMESTAMPTZ(3);

-- AlterTable
ALTER TABLE "dynamic_record" ADD COLUMN     "deletedAt" TIMESTAMPTZ(3);

-- AlterTable
ALTER TABLE "dynamic_table" ADD COLUMN     "deletedAt" TIMESTAMPTZ(3);

-- CreateTable
CREATE TABLE "audit_log" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "resource" TEXT NOT NULL,
    "resourceId" TEXT NOT NULL,
    "oldValue" JSONB,
    "newValue" JSONB,
    "tenantId" TEXT NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_log_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "audit_log_tenantId_resource_idx" ON "audit_log"("tenantId", "resource");

-- CreateIndex
CREATE INDEX "audit_log_resource_resourceId_idx" ON "audit_log"("resource", "resourceId");

-- CreateIndex
CREATE INDEX "audit_log_createdAt_idx" ON "audit_log"("createdAt");

-- CreateIndex
CREATE INDEX "Group_path_idx" ON "Group"("path");
