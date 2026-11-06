-- DropForeignKey
ALTER TABLE "OrderServiceMaterialDeduction" DROP CONSTRAINT IF EXISTS "OrderServiceMaterialDeduction_orderServiceLineId_fkey";

-- AlterTable
ALTER TABLE "OrderServiceMaterialDeduction" ADD COLUMN IF NOT EXISTS "materialBrandId" TEXT,
ADD COLUMN IF NOT EXISTS "brandName" TEXT,
ADD COLUMN IF NOT EXISTS "sizeName" TEXT,
ADD COLUMN IF NOT EXISTS "colorName" TEXT,
ADD COLUMN IF NOT EXISTS "typeName" TEXT;

-- CreateIndex
CREATE INDEX IF NOT EXISTS "OrderServiceMaterialDeduction_materialBrandId_idx" ON "OrderServiceMaterialDeduction"("materialBrandId");

-- AddForeignKey
ALTER TABLE "OrderServiceMaterialDeduction" ADD CONSTRAINT "OrderServiceMaterialDeduction_orderServiceLineId_fkey" FOREIGN KEY ("orderServiceLineId") REFERENCES "OrderServiceLine"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderServiceMaterialDeduction" ADD CONSTRAINT "OrderServiceMaterialDeduction_materialBrandId_fkey" FOREIGN KEY ("materialBrandId") REFERENCES "MaterialBrand"("id") ON DELETE SET NULL ON UPDATE CASCADE;

