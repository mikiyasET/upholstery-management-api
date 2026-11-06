-- AlterTable
ALTER TABLE "MaterialBrand" ADD COLUMN IF NOT EXISTS "size" TEXT;

-- Drop existing unique index on (materialId, name)
DROP INDEX IF EXISTS "MaterialBrand_materialId_name_key";

-- Create unique index on (materialId, name, size)
CREATE UNIQUE INDEX IF NOT EXISTS "MaterialBrand_materialId_name_size_key" ON "MaterialBrand"("materialId", "name", "size");

-- AlterTable for line items and stock transactions
ALTER TABLE "OrderStandaloneItemLine" ADD COLUMN IF NOT EXISTS "sizeName" TEXT;
ALTER TABLE "DirectSaleLine" ADD COLUMN IF NOT EXISTS "sizeName" TEXT;
ALTER TABLE "PriceHistory" ADD COLUMN IF NOT EXISTS "sizeName" TEXT;
ALTER TABLE "StoreTransfer" ADD COLUMN IF NOT EXISTS "sizeName" TEXT;
ALTER TABLE "StockCount" ADD COLUMN IF NOT EXISTS "sizeName" TEXT;
ALTER TABLE "Restock" ADD COLUMN IF NOT EXISTS "sizeName" TEXT;
ALTER TABLE "StockAdjustment" ADD COLUMN IF NOT EXISTS "sizeName" TEXT;

