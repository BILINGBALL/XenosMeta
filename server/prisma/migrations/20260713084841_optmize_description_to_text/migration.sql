-- AlterTable
ALTER TABLE "Group" ADD COLUMN     "description" TEXT;

-- AlterTable
ALTER TABLE "dynamic_field" ALTER COLUMN "description" SET DATA TYPE TEXT;

-- AlterTable
ALTER TABLE "dynamic_record" ALTER COLUMN "description" SET DATA TYPE TEXT;

-- AlterTable
ALTER TABLE "dynamic_table" ALTER COLUMN "description" SET DATA TYPE TEXT;
