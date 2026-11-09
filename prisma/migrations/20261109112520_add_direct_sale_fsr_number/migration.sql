-- AlterTable
ALTER TABLE "DirectSale" ADD COLUMN IF NOT EXISTS "fsrNumber" TEXT;

-- CreateIndex
CREATE INDEX IF NOT EXISTS "DirectSale_fsrNumber_idx" ON "DirectSale"("fsrNumber");

