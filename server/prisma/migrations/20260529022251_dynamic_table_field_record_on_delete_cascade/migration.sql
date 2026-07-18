-- DropForeignKey
ALTER TABLE "dynamic_field" DROP CONSTRAINT "dynamic_field_tableId_fkey";

-- DropForeignKey
ALTER TABLE "dynamic_field" DROP CONSTRAINT "dynamic_field_tenantId_fkey";

-- DropForeignKey
ALTER TABLE "dynamic_record" DROP CONSTRAINT "dynamic_record_tableId_fkey";

-- DropForeignKey
ALTER TABLE "dynamic_record" DROP CONSTRAINT "dynamic_record_tenantId_fkey";

-- DropForeignKey
ALTER TABLE "dynamic_table" DROP CONSTRAINT "dynamic_table_tenantId_fkey";

-- AddForeignKey
ALTER TABLE "dynamic_table" ADD CONSTRAINT "dynamic_table_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dynamic_field" ADD CONSTRAINT "dynamic_field_tableId_fkey" FOREIGN KEY ("tableId") REFERENCES "dynamic_table"("tableId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dynamic_field" ADD CONSTRAINT "dynamic_field_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dynamic_record" ADD CONSTRAINT "dynamic_record_tableId_fkey" FOREIGN KEY ("tableId") REFERENCES "dynamic_table"("tableId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dynamic_record" ADD CONSTRAINT "dynamic_record_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
