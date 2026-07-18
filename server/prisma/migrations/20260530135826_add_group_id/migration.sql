-- AlterTable
ALTER TABLE "dynamic_field" ADD COLUMN     "groupId" TEXT,
ALTER COLUMN "createdBy" DROP NOT NULL;

-- AlterTable
ALTER TABLE "dynamic_record" ADD COLUMN     "groupId" TEXT,
ALTER COLUMN "createdBy" DROP NOT NULL;

-- AlterTable
ALTER TABLE "dynamic_table" ADD COLUMN     "groupId" TEXT,
ALTER COLUMN "createdBy" DROP NOT NULL;
