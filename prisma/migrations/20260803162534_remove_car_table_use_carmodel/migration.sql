/*
  Warnings:

  - You are about to drop the column `carId` on the `Vehicle` table. All the data in the column will be lost.
  - You are about to drop the `Car` table. If the table is not empty, all the data it contains will be lost.
  - Added the required column `carModelId` to the `Vehicle` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE "Car" DROP CONSTRAINT "Car_brandId_fkey";

-- DropForeignKey
ALTER TABLE "Car" DROP CONSTRAINT "Car_modelId_fkey";

-- DropForeignKey
ALTER TABLE "Vehicle" DROP CONSTRAINT "Vehicle_carId_fkey";

-- AlterTable
ALTER TABLE "CarModel" ADD COLUMN     "imageUrl" TEXT;

-- AlterTable
ALTER TABLE "Vehicle" DROP COLUMN "carId",
ADD COLUMN     "carModelId" TEXT NOT NULL;

-- DropTable
DROP TABLE "Car";

-- AddForeignKey
ALTER TABLE "Vehicle" ADD CONSTRAINT "Vehicle_carModelId_fkey" FOREIGN KEY ("carModelId") REFERENCES "CarModel"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
