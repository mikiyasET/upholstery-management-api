-- AlterTable
ALTER TABLE "Restock" ADD COLUMN IF NOT EXISTS "brandName" TEXT,
ADD COLUMN IF NOT EXISTS "materialBrandId" TEXT;

-- AlterTable
ALTER TABLE "StockAdjustment" ADD COLUMN IF NOT EXISTS "brandName" TEXT,
ADD COLUMN IF NOT EXISTS "materialBrandId" TEXT;

-- AlterTable
ALTER TABLE "StockCount" ADD COLUMN IF NOT EXISTS "brandName" TEXT,
ADD COLUMN IF NOT EXISTS "materialBrandId" TEXT;

-- AlterTable
ALTER TABLE "StoreTransfer" ADD COLUMN IF NOT EXISTS "brandName" TEXT,
ADD COLUMN IF NOT EXISTS "materialBrandId" TEXT;

-- CreateTable
CREATE TABLE IF NOT EXISTS "MaterialBrandStock" (
    "id" TEXT NOT NULL,
    "materialBrandId" TEXT NOT NULL,
    "storeId" TEXT NOT NULL,
    "quantity" DECIMAL(10,2) NOT NULL DEFAULT 0,

    CONSTRAINT "MaterialBrandStock_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "MaterialBrandStock_materialBrandId_idx" ON "MaterialBrandStock"("materialBrandId");
CREATE INDEX IF NOT EXISTS "MaterialBrandStock_storeId_idx" ON "MaterialBrandStock"("storeId");
CREATE UNIQUE INDEX IF NOT EXISTS "MaterialBrandStock_materialBrandId_storeId_key" ON "MaterialBrandStock"("materialBrandId", "storeId");

CREATE INDEX IF NOT EXISTS "Order_fsrNumber_idx" ON "Order"("fsrNumber");
CREATE INDEX IF NOT EXISTS "Restock_materialBrandId_idx" ON "Restock"("materialBrandId");
CREATE INDEX IF NOT EXISTS "StockAdjustment_materialBrandId_idx" ON "StockAdjustment"("materialBrandId");
CREATE INDEX IF NOT EXISTS "StockCount_materialBrandId_idx" ON "StockCount"("materialBrandId");
CREATE INDEX IF NOT EXISTS "StoreTransfer_materialBrandId_idx" ON "StoreTransfer"("materialBrandId");

-- AddForeignKey
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'MaterialBrandStock_materialBrandId_fkey') THEN
    ALTER TABLE "MaterialBrandStock" ADD CONSTRAINT "MaterialBrandStock_materialBrandId_fkey" FOREIGN KEY ("materialBrandId") REFERENCES "MaterialBrand"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'MaterialBrandStock_storeId_fkey') THEN
    ALTER TABLE "MaterialBrandStock" ADD CONSTRAINT "MaterialBrandStock_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'StoreTransfer_materialBrandId_fkey') THEN
    ALTER TABLE "StoreTransfer" ADD CONSTRAINT "StoreTransfer_materialBrandId_fkey" FOREIGN KEY ("materialBrandId") REFERENCES "MaterialBrand"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'StockCount_materialBrandId_fkey') THEN
    ALTER TABLE "StockCount" ADD CONSTRAINT "StockCount_materialBrandId_fkey" FOREIGN KEY ("materialBrandId") REFERENCES "MaterialBrand"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Restock_materialBrandId_fkey') THEN
    ALTER TABLE "Restock" ADD CONSTRAINT "Restock_materialBrandId_fkey" FOREIGN KEY ("materialBrandId") REFERENCES "MaterialBrand"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'StockAdjustment_materialBrandId_fkey') THEN
    ALTER TABLE "StockAdjustment" ADD CONSTRAINT "StockAdjustment_materialBrandId_fkey" FOREIGN KEY ("materialBrandId") REFERENCES "MaterialBrand"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

