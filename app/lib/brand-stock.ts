import { StoreType } from '@prisma/client';

/**
 * Checks if a branded material has unallocated stock in the given store.
 * If total store stock > sum of brand stocks in that store, it throws an error
 * preventing the material from being sold, used, or transferred until properly allocated.
 */
export async function checkMaterialBrandAllocation(
  tx: any,
  materialId: string,
  storeType: StoreType,
  actionDescription = 'use'
): Promise<void> {
  const material = await tx.material.findFirst({
    where: {
      OR: [{ id: materialId }, { itemCode: materialId }],
    },
    include: {
      brands: true,
    },
  });

  if (!material) return;
  // If no brands are defined for this material, allocation check does not apply
  if (!material.brands || material.brands.length === 0) return;

  const store = await tx.store.findUnique({ where: { type: storeType } });
  if (!store) return;

  const matStock = await tx.materialStock.findUnique({
    where: { materialId_storeId: { materialId: material.id, storeId: store.id } },
  });
  const totalQuantity = matStock?.quantity ? (typeof matStock.quantity.toNumber === 'function' ? matStock.quantity.toNumber() : Number(matStock.quantity)) : 0;
  if (totalQuantity <= 0) return;

  const rawBrandStocks = tx.materialBrandStock
    ? await tx.materialBrandStock.findMany({
        where: {
          storeId: store.id,
          materialBrandId: { in: material.brands.map((b: any) => b.id) },
        },
      })
    : [];
  const brandStocks = Array.isArray(rawBrandStocks) ? rawBrandStocks : [];

  const brandTotal = brandStocks.reduce(
    (sum: number, bs: any) => sum + (bs.quantity ? (typeof bs.quantity.toNumber === 'function' ? bs.quantity.toNumber() : Number(bs.quantity)) : 0),
    0
  );

  const unallocated = totalQuantity - brandTotal;
  if (unallocated > 0) {
    const storeLabel = storeType === StoreType.MINI ? 'Mini Store' : 'Main Store';
    throw new Error(
      `Cannot ${actionDescription} material "${material.nameEn}". It has ${unallocated} unallocated ${material.unit || 'units'} in ${storeLabel} and must be allocated across brands in Storage before use.`
    );
  }
}
