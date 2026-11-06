-- AlterTable
ALTER TABLE "Order" ADD COLUMN "fsrNumber" TEXT;

-- Create partial index on fsrNumber where fsrNumber is not null
CREATE INDEX "Order_fsrNumber_idx" ON "Order"("fsrNumber") WHERE "fsrNumber" IS NOT NULL;
