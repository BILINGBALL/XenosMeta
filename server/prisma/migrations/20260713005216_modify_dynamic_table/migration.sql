/*
  Warnings:

  - A unique constraint covering the columns `[groupId,name]` on the table `dynamic_table` will be added. If there are existing duplicate values, this will fail.

*/
-- DropForeignKey
ALTER TABLE "dynamic_field" DROP CONSTRAINT "dynamic_field_tableId_fkey";

-- DropForeignKey
ALTER TABLE "dynamic_record" DROP CONSTRAINT "dynamic_record_tableId_fkey";

-- DropIndex
DROP INDEX "idx_dynamic_record_data_gin";

-- DropIndex
DROP INDEX "idx_dynamic_record_data_path_ops";

-- DropIndex
DROP INDEX "dynamic_table_tenantId_name_key";

-- AlterTable
ALTER TABLE "Tenant" ADD COLUMN     "adminId" TEXT;

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "avatar" TEXT,
ADD COLUMN     "email" TEXT,
ADD COLUMN     "lastLoginAt" TIMESTAMP(3),
ADD COLUMN     "phone" TEXT,
ADD COLUMN     "profile" JSONB,
ADD COLUMN     "updatedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ALTER COLUMN "tenantId" DROP NOT NULL;

-- AlterTable
ALTER TABLE "dynamic_field" ADD COLUMN     "description" VARCHAR(500);

-- AlterTable
ALTER TABLE "dynamic_record" ADD COLUMN     "description" VARCHAR(500);

-- AlterTable
ALTER TABLE "dynamic_table" ADD COLUMN     "description" VARCHAR(500);

-- CreateTable
CREATE TABLE "table_mirror" (
    "id" TEXT NOT NULL,
    "mirrorId" TEXT NOT NULL,
    "sourceTableId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" VARCHAR(500),
    "groupId" TEXT,
    "visibleFields" JSONB NOT NULL,
    "tenantId" TEXT NOT NULL,
    "createdBy" TEXT,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "table_mirror_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "table_mirror_mirrorId_key" ON "table_mirror"("mirrorId");

-- CreateIndex
CREATE UNIQUE INDEX "table_mirror_sourceTableId_groupId_key" ON "table_mirror"("sourceTableId", "groupId");

-- CreateIndex
CREATE UNIQUE INDEX "table_mirror_groupId_name_key" ON "table_mirror"("groupId", "name");

-- CreateIndex
CREATE UNIQUE INDEX "dynamic_table_groupId_name_key" ON "dynamic_table"("groupId", "name");

-- AddForeignKey
ALTER TABLE "Tenant" ADD CONSTRAINT "Tenant_adminId_fkey" FOREIGN KEY ("adminId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dynamic_field" ADD CONSTRAINT "dynamic_field_tableId_fkey" FOREIGN KEY ("tableId") REFERENCES "dynamic_table"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dynamic_record" ADD CONSTRAINT "dynamic_record_tableId_fkey" FOREIGN KEY ("tableId") REFERENCES "dynamic_table"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "table_mirror" ADD CONSTRAINT "table_mirror_sourceTableId_fkey" FOREIGN KEY ("sourceTableId") REFERENCES "dynamic_table"("tableId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "table_mirror" ADD CONSTRAINT "table_mirror_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "table_mirror" ADD CONSTRAINT "table_mirror_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "User"("id") ON DELETE NO ACTION ON UPDATE CASCADE;
