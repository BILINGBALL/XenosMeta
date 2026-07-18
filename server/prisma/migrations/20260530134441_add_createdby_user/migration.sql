/*
  Warnings:

  - Added the required column `createdBy` to the `dynamic_field` table without a default value. This is not possible if the table is not empty.
  - Added the required column `createdBy` to the `dynamic_record` table without a default value. This is not possible if the table is not empty.
  - Added the required column `createdBy` to the `dynamic_table` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "dynamic_field" ADD COLUMN     "createdBy" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "dynamic_record" ADD COLUMN     "createdBy" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "dynamic_table" ADD COLUMN     "createdBy" TEXT NOT NULL;

-- AddForeignKey
ALTER TABLE "dynamic_table" ADD CONSTRAINT "dynamic_table_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "User"("id") ON DELETE NO ACTION ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dynamic_field" ADD CONSTRAINT "dynamic_field_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "User"("id") ON DELETE NO ACTION ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dynamic_record" ADD CONSTRAINT "dynamic_record_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "User"("id") ON DELETE NO ACTION ON UPDATE CASCADE;
