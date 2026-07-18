-- 重命名 column: type -> scope
ALTER TABLE "Tenant" RENAME COLUMN "type" TO "scope";
-- 修改默认值
ALTER TABLE "Tenant" ALTER COLUMN "scope" SET DEFAULT 'tenant';
-- 已有数据的值迁移
UPDATE "Tenant" SET "scope" = 'tenant' WHERE "scope" = 'normal';
