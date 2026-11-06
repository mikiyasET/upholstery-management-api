-- DropIndex
DROP INDEX IF EXISTS "MaterialBrand_materialId_name_size_key";

-- AlterTable
ALTER TABLE "DirectSaleLine" ADD COLUMN IF NOT EXISTS "colorName" TEXT,
ADD COLUMN IF NOT EXISTS "typeName" TEXT;

-- AlterTable
ALTER TABLE "MaterialBrand" ADD COLUMN IF NOT EXISTS "color" TEXT,
ADD COLUMN IF NOT EXISTS "type" TEXT;

-- AlterTable
ALTER TABLE "OrderStandaloneItemLine" ADD COLUMN IF NOT EXISTS "colorName" TEXT,
ADD COLUMN IF NOT EXISTS "typeName" TEXT;

-- AlterTable
ALTER TABLE "PriceHistory" ADD COLUMN IF NOT EXISTS "colorName" TEXT,
ADD COLUMN IF NOT EXISTS "typeName" TEXT;

-- AlterTable
ALTER TABLE "Restock" ADD COLUMN IF NOT EXISTS "colorName" TEXT,
ADD COLUMN IF NOT EXISTS "typeName" TEXT;

-- AlterTable
ALTER TABLE "StockAdjustment" ADD COLUMN IF NOT EXISTS "colorName" TEXT,
ADD COLUMN IF NOT EXISTS "typeName" TEXT;

-- AlterTable
ALTER TABLE "StockCount" ADD COLUMN IF NOT EXISTS "colorName" TEXT,
ADD COLUMN IF NOT EXISTS "typeName" TEXT;

-- AlterTable
ALTER TABLE "StoreTransfer" ADD COLUMN IF NOT EXISTS "colorName" TEXT,
ADD COLUMN IF NOT EXISTS "typeName" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "MaterialBrand_materialId_name_size_color_type_key" ON "MaterialBrand"("materialId", "name", "size", "color", "type");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Order_fsrNumber_idx" ON "Order"("fsrNumber");

