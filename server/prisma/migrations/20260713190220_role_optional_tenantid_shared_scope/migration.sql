-- Role.tenantId 改为可选（NULL 表示跨租户共享预设）
ALTER TABLE "Role" ALTER COLUMN "tenantId" DROP NOT NULL;
