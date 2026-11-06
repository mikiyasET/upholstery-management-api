-- AlterTable
ALTER TABLE "Material" ADD COLUMN "itemCode" TEXT;

-- Backfill existing rows with deterministic unique item codes (e.g. MAT-0001, MAT-0002)
WITH numbered AS (
  SELECT id, ROW_NUMBER() OVER (ORDER BY "createdAt" ASC, id ASC) as rn
  FROM "Material"
)
UPDATE "Material"
SET "itemCode" = 'MAT-' || LPAD(numbered.rn::text, 4, '0')
FROM numbered
WHERE "Material".id = numbered.id;

-- AlterTable to set NOT NULL
ALTER TABLE "Material" ALTER COLUMN "itemCode" SET NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "Material_itemCode_key" ON "Material"("itemCode");

-- CreateIndex
CREATE INDEX "Material_itemCode_idx" ON "Material"("itemCode");
