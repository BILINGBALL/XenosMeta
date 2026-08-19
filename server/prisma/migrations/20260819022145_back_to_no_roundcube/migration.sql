-- AlterTable
ALTER TABLE "Group" ADD COLUMN     "public" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "table_mirror" ADD COLUMN     "sourceGroupId" TEXT,
ADD COLUMN     "status" TEXT NOT NULL DEFAULT 'accepted';

-- CreateTable
CREATE TABLE "group_relation" (
    "id" TEXT NOT NULL,
    "fromGroupId" TEXT NOT NULL,
    "toGroupId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "note" VARCHAR(200),
    "tenantId" TEXT NOT NULL,
    "createdBy" TEXT,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "group_relation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "file" (
    "id" TEXT NOT NULL,
    "fileId" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "groupId" TEXT,
    "bucket" TEXT NOT NULL,
    "objectKey" TEXT NOT NULL,
    "filename" TEXT NOT NULL,
    "displayName" TEXT,
    "mimeType" TEXT NOT NULL,
    "size" INTEGER NOT NULL,
    "currentVersion" INTEGER NOT NULL DEFAULT 1,
    "tags" JSONB,
    "description" TEXT,
    "sha256" TEXT,
    "uploadedBy" TEXT,
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "file_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "file_version" (
    "id" TEXT NOT NULL,
    "versionId" TEXT NOT NULL,
    "fileId" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "objectKey" TEXT NOT NULL,
    "filename" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "size" INTEGER NOT NULL,
    "uploadedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "file_version_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "group_relation_toGroupId_status_idx" ON "group_relation"("toGroupId", "status");

-- CreateIndex
CREATE INDEX "group_relation_fromGroupId_idx" ON "group_relation"("fromGroupId");

-- CreateIndex
CREATE UNIQUE INDEX "group_relation_fromGroupId_toGroupId_key" ON "group_relation"("fromGroupId", "toGroupId");

-- CreateIndex
CREATE UNIQUE INDEX "file_fileId_key" ON "file"("fileId");

-- CreateIndex
CREATE INDEX "file_tenantId_idx" ON "file"("tenantId");

-- CreateIndex
CREATE INDEX "file_groupId_idx" ON "file"("groupId");

-- CreateIndex
CREATE INDEX "file_fileId_idx" ON "file"("fileId");

-- CreateIndex
CREATE INDEX "file_tenantId_sha256_idx" ON "file"("tenantId", "sha256");

-- CreateIndex
CREATE UNIQUE INDEX "file_version_versionId_key" ON "file_version"("versionId");

-- CreateIndex
CREATE INDEX "file_version_fileId_idx" ON "file_version"("fileId");

-- CreateIndex
CREATE INDEX "file_version_fileId_version_idx" ON "file_version"("fileId", "version");

-- CreateIndex
CREATE INDEX "Group_public_idx" ON "Group"("public");

-- CreateIndex
CREATE INDEX "table_mirror_groupId_status_idx" ON "table_mirror"("groupId", "status");

-- CreateIndex
CREATE INDEX "table_mirror_sourceGroupId_idx" ON "table_mirror"("sourceGroupId");

-- AddForeignKey
ALTER TABLE "group_relation" ADD CONSTRAINT "group_relation_fromGroupId_fkey" FOREIGN KEY ("fromGroupId") REFERENCES "Group"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "group_relation" ADD CONSTRAINT "group_relation_toGroupId_fkey" FOREIGN KEY ("toGroupId") REFERENCES "Group"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "group_relation" ADD CONSTRAINT "group_relation_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "group_relation" ADD CONSTRAINT "group_relation_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "table_mirror" ADD CONSTRAINT "table_mirror_sourceGroupId_fkey" FOREIGN KEY ("sourceGroupId") REFERENCES "Group"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "file_version" ADD CONSTRAINT "file_version_fileId_fkey" FOREIGN KEY ("fileId") REFERENCES "file"("fileId") ON DELETE CASCADE ON UPDATE CASCADE;
