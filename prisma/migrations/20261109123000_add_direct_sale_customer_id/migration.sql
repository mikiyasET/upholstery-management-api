-- AlterTable
ALTER TABLE "DirectSale" ADD COLUMN IF NOT EXISTS "customerId" TEXT;

-- CreateIndex
CREATE INDEX IF NOT EXISTS "DirectSale_customerId_idx" ON "DirectSale"("customerId");

-- AddForeignKey
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'DirectSale_customerId_fkey'
  ) THEN
    ALTER TABLE "DirectSale" ADD CONSTRAINT "DirectSale_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

-- Backfill existing DirectSales where customerPhone matches Customer.phoneNumber
UPDATE "DirectSale" ds
SET "customerId" = c."id"
FROM "Customer" c
WHERE ds."customerPhone" = c."phoneNumber"
  AND ds."customerPhone" IS NOT NULL
  AND ds."customerId" IS NULL;
