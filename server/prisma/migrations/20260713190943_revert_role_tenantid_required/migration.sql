-- 恢复 Role.tenantId 为必填（shared 角色归属于系统租户，不是 NULL）
ALTER TABLE "Role" ALTER COLUMN "tenantId" SET NOT NULL;
