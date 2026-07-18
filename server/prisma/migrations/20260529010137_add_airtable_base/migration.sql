-- CreateTable
CREATE TABLE "dynamic_table" (
    "id" TEXT NOT NULL,
    "tableId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "dynamic_table_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "dynamic_field" (
    "id" TEXT NOT NULL,
    "fieldId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "options" JSONB,
    "tableId" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "dynamic_field_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "dynamic_record" (
    "id" TEXT NOT NULL,
    "recordId" TEXT NOT NULL,
    "tableId" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "data" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "dynamic_record_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "dynamic_table_tableId_key" ON "dynamic_table"("tableId");

-- CreateIndex
CREATE UNIQUE INDEX "dynamic_field_fieldId_key" ON "dynamic_field"("fieldId");

-- CreateIndex
CREATE UNIQUE INDEX "dynamic_record_recordId_key" ON "dynamic_record"("recordId");

-- AddForeignKey
ALTER TABLE "dynamic_table" ADD CONSTRAINT "dynamic_table_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dynamic_field" ADD CONSTRAINT "dynamic_field_tableId_fkey" FOREIGN KEY ("tableId") REFERENCES "dynamic_table"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dynamic_field" ADD CONSTRAINT "dynamic_field_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dynamic_record" ADD CONSTRAINT "dynamic_record_tableId_fkey" FOREIGN KEY ("tableId") REFERENCES "dynamic_table"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dynamic_record" ADD CONSTRAINT "dynamic_record_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
