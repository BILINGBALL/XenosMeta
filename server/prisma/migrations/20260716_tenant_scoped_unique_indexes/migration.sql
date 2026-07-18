-- ============================================================
-- 租户范围唯一索引：Group / Role
--
-- 背景：原 Group_groupCode_unique 和 Role_roleCode_unique 是全局唯一，
--       导致 tenantA 创建 "sales" 部门后 tenantB 无法再使用同名 groupCode。
--       实际需求是 groupCode/roleCode 仅在各自租户内唯一。
--
-- 修改：唯一索引前缀从 (groupCode) / (roleCode) 改为
--       (tenantId, groupCode) / (tenantId, roleCode)
--
-- 不修改的：
--   User_username_unique   → username 是登录凭据，必须全局唯一
--   Tenant_tenantCode_unique → 租户编码必须全局唯一
-- ============================================================

-- ============================================================
-- 1. 删除旧的全局唯一索引
-- ============================================================
DROP INDEX IF EXISTS "Group_groupCode_unique";
DROP INDEX IF EXISTS "Role_roleCode_unique";

-- ============================================================
-- 2. 创建租户范围部分唯一索引（仅对未删除的行生效）
-- ============================================================

-- Group: 同租户下 groupCode 唯一
CREATE UNIQUE INDEX "Group_tenantId_groupCode_unique"
    ON "Group" ("tenantId", "groupCode")
    WHERE "deletedAt" IS NULL;

-- Role: 同租户下 roleCode 唯一
CREATE UNIQUE INDEX "Role_tenantId_roleCode_unique"
    ON "Role" ("tenantId", "roleCode")
    WHERE "deletedAt" IS NULL;
