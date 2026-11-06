-- AlterTable
ALTER TABLE "DirectSaleLine" ADD COLUMN IF NOT EXISTS "brandName" TEXT,
ADD COLUMN IF NOT EXISTS "materialBrandId" TEXT;

-- AlterTable
ALTER TABLE "OrderStandaloneItemLine" ADD COLUMN IF NOT EXISTS "brandName" TEXT,
ADD COLUMN IF NOT EXISTS "materialBrandId" TEXT;

-- AlterTable
ALTER TABLE "PriceHistory" ADD COLUMN IF NOT EXISTS "brandName" TEXT;

-- CreateTable
CREATE TABLE IF NOT EXISTS "MaterialBrand" (
    "id" TEXT NOT NULL,
    "materialId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "price" DECIMAL(10,2) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MaterialBrand_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "MaterialBrand_materialId_idx" ON "MaterialBrand"("materialId");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "MaterialBrand_materialId_name_key" ON "MaterialBrand"("materialId", "name");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Order_fsrNumber_idx" ON "Order"("fsrNumber");

-- AddForeignKey
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'MaterialBrand_materialId_fkey'
    ) THEN
        ALTER TABLE "MaterialBrand" ADD CONSTRAINT "MaterialBrand_materialId_fkey" FOREIGN KEY ("materialId") REFERENCES "Material"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;

-- AddForeignKey
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'OrderStandaloneItemLine_materialBrandId_fkey'
    ) THEN
        ALTER TABLE "OrderStandaloneItemLine" ADD CONSTRAINT "OrderStandaloneItemLine_materialBrandId_fkey" FOREIGN KEY ("materialBrandId") REFERENCES "MaterialBrand"("id") ON DELETE SET NULL ON UPDATE CASCADE;
    END IF;
END $$;

-- AddForeignKey
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'DirectSaleLine_materialBrandId_fkey'
    ) THEN
        ALTER TABLE "DirectSaleLine" ADD CONSTRAINT "DirectSaleLine_materialBrandId_fkey" FOREIGN KEY ("materialBrandId") REFERENCES "MaterialBrand"("id") ON DELETE SET NULL ON UPDATE CASCADE;
    END IF;
END $$;

