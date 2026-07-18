-- ============================================================
-- 软删除部分唯一索引 + 查询性能索引
--
-- 背景：原 schema 使用 @unique / @@unique 做唯一约束，但软删除后
--       deletedAt 不为 NULL 的行仍然占用唯一索引，导致新建同名记录时
--       触发唯一约束冲突（P2002）。
--
-- 方案：PostgreSQL 部分唯一索引（Partial Unique Index）
--       CREATE UNIQUE INDEX ... WHERE "deletedAt" IS NULL
--
-- 效果说明：
--   ✅ 未删除行（deletedAt IS NULL）      → 唯一约束正常生效
--   ✅ 已删除行（deletedAt IS NOT NULL）  → 不参与唯一校验
--   ✅ 同名记录 → 删除 → 再新建同名记录  → 不冲突
--   ⚠️ 恢复时若与现存的未删除记录冲突    → 数据库报错，业务层需先校验
--
-- 索引分工：
--   部分唯一索引        → 新建/更新时防重名（WHERE deletedAt IS NULL）
--   @@index 普通索引    → 日常查询 + 回收站分页 + 定时清理
--   前导列设计：高区分度字段在前（如 tenantId），deletedAt 在后
-- ============================================================

-- ============================================================
-- 1. 删除旧的全量唯一约束（不再适配软删除场景）
-- ============================================================
DROP INDEX IF EXISTS "Tenant_tenantCode_key";
DROP INDEX IF EXISTS "Group_groupCode_key";
DROP INDEX IF EXISTS "Role_roleCode_key";
DROP INDEX IF EXISTS "User_username_key";
DROP INDEX IF EXISTS "dynamic_field_tableId_name_key";
DROP INDEX IF EXISTS "dynamic_table_groupId_name_key";

-- ============================================================
-- 2. 创建部分唯一索引（仅对未删除的行生效）
--    已软删除的行被 WHERE deletedAt IS NULL 排除，不参与唯一性校验
--    注意：PostgreSQL 中 NULL != NULL，所以 groupId=NULL 的多行不会互相冲突
-- ============================================================

-- Tenant: 租户编码唯一（仅未删除）
CREATE UNIQUE INDEX "Tenant_tenantCode_unique"
    ON "Tenant" ("tenantCode")
    WHERE "deletedAt" IS NULL;

-- Group: 群组编码唯一（仅未删除）
CREATE UNIQUE INDEX "Group_groupCode_unique"
    ON "Group" ("groupCode")
    WHERE "deletedAt" IS NULL;

-- Role: 角色编码唯一（仅未删除）
CREATE UNIQUE INDEX "Role_roleCode_unique"
    ON "Role" ("roleCode")
    WHERE "deletedAt" IS NULL;

-- User: 用户名唯一（仅未删除）
CREATE UNIQUE INDEX "User_username_unique"
    ON "User" ("username")
    WHERE "deletedAt" IS NULL;

-- DynamicField: 同表内字段名唯一（仅未删除）
CREATE UNIQUE INDEX "dynamic_field_tableId_name_unique"
    ON "dynamic_field" ("tableId", "name")
    WHERE "deletedAt" IS NULL;

-- DynamicTable: 同群组下表名唯一（仅未删除）
-- 注意：PostgreSQL 中 NULL != NULL，所以 groupId=NULL 的多行不会冲突
CREATE UNIQUE INDEX "dynamic_table_groupId_name_unique"
    ON "dynamic_table" ("groupId", "name")
    WHERE "deletedAt" IS NULL;

-- ============================================================
-- 3. 创建查询性能索引（按 deletedAt 过滤是高频操作）
--    (a) 业务上下文 + 未删除 → 日常 CRUD（最常用）
--    (b) 纯 deletedAt        → 回收站分页 / 定时清理
--    前导列：高区分度列在前，deletedAt（仅 NULL/NOT NULL）在后
-- ============================================================

-- Tenant
CREATE INDEX "Tenant_deletedAt_idx" ON "Tenant" ("deletedAt");

-- Group
CREATE INDEX "Group_tenantId_deletedAt_idx" ON "Group" ("tenantId", "deletedAt");
CREATE INDEX "Group_deletedAt_idx" ON "Group" ("deletedAt");

-- Role
CREATE INDEX "Role_tenantId_deletedAt_idx" ON "Role" ("tenantId", "deletedAt");
CREATE INDEX "Role_deletedAt_idx" ON "Role" ("deletedAt");

-- User
CREATE INDEX "User_tenantId_deletedAt_idx" ON "User" ("tenantId", "deletedAt");
CREATE INDEX "User_deletedAt_idx" ON "User" ("deletedAt");

-- DynamicTable
CREATE INDEX "dynamic_table_tenantId_deletedAt_idx" ON "dynamic_table" ("tenantId", "deletedAt");
CREATE INDEX "dynamic_table_groupId_deletedAt_idx" ON "dynamic_table" ("groupId", "deletedAt");
CREATE INDEX "dynamic_table_deletedAt_idx" ON "dynamic_table" ("deletedAt");

-- DynamicField
CREATE INDEX "dynamic_field_tableId_deletedAt_idx" ON "dynamic_field" ("tableId", "deletedAt");
CREATE INDEX "dynamic_field_tenantId_deletedAt_idx" ON "dynamic_field" ("tenantId", "deletedAt");
CREATE INDEX "dynamic_field_deletedAt_idx" ON "dynamic_field" ("deletedAt");

-- DynamicRecord
CREATE INDEX "dynamic_record_tableId_deletedAt_idx" ON "dynamic_record" ("tableId", "deletedAt");
CREATE INDEX "dynamic_record_tenantId_deletedAt_idx" ON "dynamic_record" ("tenantId", "deletedAt");
CREATE INDEX "dynamic_record_deletedAt_idx" ON "dynamic_record" ("deletedAt");
