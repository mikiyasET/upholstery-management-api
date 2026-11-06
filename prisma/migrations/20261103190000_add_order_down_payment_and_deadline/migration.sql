-- AlterTable Order
ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "downPayment" DECIMAL(10,2) NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS "deadline" TIMESTAMP(3),
ADD COLUMN IF NOT EXISTS "deadlineWarningSent" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS "deadlineWarningSentAt" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Order_deadline_idx" ON "Order"("deadline");
CREATE INDEX IF NOT EXISTS "Order_deadlineWarningSent_idx" ON "Order"("deadlineWarningSent");

