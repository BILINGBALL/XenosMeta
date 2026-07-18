-- AlterTable
ALTER TABLE "Permission" ADD COLUMN     "scope" TEXT NOT NULL DEFAULT 'tenant';

-- AlterTable
ALTER TABLE "Role" ADD COLUMN     "scope" TEXT NOT NULL DEFAULT 'tenant';

-- AlterTable
ALTER TABLE "Tenant" ADD COLUMN     "type" TEXT NOT NULL DEFAULT 'normal';
