-- Rename displayFields to sourceFields, add displayField, remove multiSelect
ALTER TABLE "field_reference" RENAME COLUMN "displayFields" TO "sourceFields";
ALTER TABLE "field_reference" ADD COLUMN "displayField" TEXT NOT NULL DEFAULT '';
ALTER TABLE "field_reference" DROP COLUMN "multiSelect";