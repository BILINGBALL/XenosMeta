-- CreateTable
CREATE TABLE "field_reference" (
    "id" TEXT NOT NULL,
    "refId" TEXT NOT NULL,
    "fieldId" TEXT NOT NULL,
    "sourceTableId" TEXT NOT NULL,
    "displayFields" JSONB NOT NULL,
    "valueField" TEXT NOT NULL,
    "filterJson" JSONB,
    "multiSelect" BOOLEAN NOT NULL DEFAULT false,
    "description" TEXT,
    "groupId" TEXT,
    "createdBy" TEXT,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "field_reference_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "field_reference_refId_key" ON "field_reference"("refId");
CREATE UNIQUE INDEX "field_reference_fieldId_key" ON "field_reference"("fieldId");

-- AddForeignKey
ALTER TABLE "field_reference" ADD CONSTRAINT "field_reference_fieldId_fkey" FOREIGN KEY ("fieldId") REFERENCES "dynamic_field"("fieldId") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "field_reference" ADD CONSTRAINT "field_reference_sourceTableId_fkey" FOREIGN KEY ("sourceTableId") REFERENCES "dynamic_table"("tableId") ON DELETE CASCADE ON UPDATE CASCADE;
