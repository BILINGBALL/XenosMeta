-- 1. 先删除旧的 FK（旧 FK 指向 DynamicTable.tableId）
ALTER TABLE "dynamic_field" DROP CONSTRAINT IF EXISTS "dynamic_field_tableId_fkey";

-- 2. 将 dynamic_field.tableId 的值转换为对应的 DynamicTable.id (UUID)
UPDATE "dynamic_field" df
SET "tableId" = dt."id"
FROM "dynamic_table" dt
WHERE df."tableId" = dt."tableId";

-- 3. 重建 FK，指向 DynamicTable.id
ALTER TABLE "dynamic_field" ADD CONSTRAINT "dynamic_field_tableId_fkey"
  FOREIGN KEY ("tableId") REFERENCES "dynamic_table"("id") ON DELETE CASCADE;
