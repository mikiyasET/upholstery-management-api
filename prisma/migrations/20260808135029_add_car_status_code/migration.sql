/*
  Warnings:

  - A unique constraint covering the columns `[code]` on the table `CarStatus` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "CarStatus" ADD COLUMN     "code" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "CarStatus_code_key" ON "CarStatus"("code");
