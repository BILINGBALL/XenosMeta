/*
  Warnings:

  - A unique constraint covering the columns `[tableId,name]` on the table `dynamic_field` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[tenantId,name]` on the table `dynamic_table` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateIndex
CREATE UNIQUE INDEX "dynamic_field_tableId_name_key" ON "dynamic_field"("tableId", "name");

-- CreateIndex
CREATE UNIQUE INDEX "dynamic_table_tenantId_name_key" ON "dynamic_table"("tenantId", "name");
