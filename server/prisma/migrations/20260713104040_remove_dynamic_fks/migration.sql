-- ============================================================
-- 移除 DynamicField / DynamicRecord 对 DynamicTable 的外键约束
-- tableId 改为直接存储业务ID（如 tbl_xxxx），不做数据库层关联
-- ============================================================

-- 1. 删除外键约束
ALTER TABLE "dynamic_field" DROP CONSTRAINT IF EXISTS "dynamic_field_tableId_fkey";
ALTER TABLE "dynamic_record" DROP CONSTRAINT IF EXISTS "dynamic_record_tableId_fkey";

-- 2. 将 dynamic_field.tableId 从 UUID 转回业务ID
UPDATE "dynamic_field" df
SET "tableId" = dt."tableId"
FROM "dynamic_table" dt
WHERE df."tableId" = dt."id";

-- 3. 将 dynamic_record.tableId 从 UUID 转回业务ID
UPDATE "dynamic_record" dr
SET "tableId" = dt."tableId"
FROM "dynamic_table" dt
WHERE dr."tableId" = dt."id";
