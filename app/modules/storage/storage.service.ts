import prisma from '../../lib/prisma';
import { AuditService } from '../../lib/audit';
import { AuditAction, StoreType, AdjustmentReason } from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';
import { validateQuantityForUnit } from '../../lib/units';
import { checkMaterialBrandAllocation } from '../../lib/brand-stock';

export class StorageService {
  // Helper to upsert material stock safely (supports brand-level stock)
  static async updateMaterialStock(
    tx: any,
    materialId: string,
    storeId: string,
    quantityDelta: number,
    materialBrandId?: string | null
  ) {
    if (materialBrandId) {
      const currentBrandStock = await tx.materialBrandStock.findUnique({
        where: { materialBrandId_storeId: { materialBrandId, storeId } },
      });

      const newBrandQuantity = (currentBrandStock?.quantity ? currentBrandStock.quantity.toNumber() : 0) + quantityDelta;

      await tx.materialBrandStock.upsert({
        where: { materialBrandId_storeId: { materialBrandId, storeId } },
        update: { quantity: newBrandQuantity },
        create: { materialBrandId, storeId, quantity: newBrandQuantity },
      });
    }

    const current = await tx.materialStock.findUnique({
      where: { materialId_storeId: { materialId, storeId } },
    });

    const newQuantity = (current?.quantity ? current.quantity.toNumber() : 0) + quantityDelta;

    const stock = await tx.materialStock.upsert({
      where: { materialId_storeId: { materialId, storeId } },
      update: { quantity: newQuantity },
      create: { materialId, storeId, quantity: newQuantity },
    });

    return stock;
  }

  static async getLowStockMaterials() {
    const miniStore = await prisma.store.findUnique({ where: { type: StoreType.MINI } });
    if (!miniStore) throw new Error('Mini store not found');

    const materials = await prisma.material.findMany({
      where: { isActive: true },
      include: {
        materialStocks: {
          where: { storeId: miniStore.id },
        },
        brands: {
          include: {
            brandStocks: {
              where: { storeId: miniStore.id },
            },
          },
          orderBy: { createdAt: 'asc' },
        },
      },
    });

    return materials.filter((m) => {
      const threshold = m.lowStockThreshold.toNumber();
      if (m.brands && m.brands.length > 0) {
        return m.brands.some((b) => {
          const bStock = b.brandStocks[0]?.quantity?.toNumber() || 0;
          return bStock <= threshold;
        });
      }
      const stock = m.materialStocks[0]?.quantity?.toNumber() || 0;
      return stock <= threshold;
    });
  }

  static async restock(materialId: string, data: any, userId: string) {
    return prisma.$transaction(async (tx) => {
      const material = await tx.material.findFirst({
        where: {
          OR: [{ id: materialId }, { itemCode: materialId }],
        },
        include: { brands: true },
      });
      if (!material) throw new Error('Material not found');

      validateQuantityForUnit(data.quantityAdded, material.unit, 'Quantity added');

      let brandName: string | undefined = undefined;
      let sizeName: string | undefined = undefined;
      let colorName: string | undefined = undefined;
      let typeName: string | undefined = undefined;
      let brandId: string | undefined = undefined;
      if (data.materialBrandId) {
        const brand = material.brands?.find((b: any) => b.id === data.materialBrandId);
        if (brand) {
          brandId = brand.id;
          brandName = brand.name;
          sizeName = brand.size || undefined;
          colorName = brand.color || undefined;
          typeName = brand.type || undefined;
        }
      }

      const targetStoreType = material.isBulkTracked ? StoreType.MAIN : StoreType.MINI;
      const store = await tx.store.findUnique({ where: { type: targetStoreType } });
      if (!store) throw new Error(`${targetStoreType} store not found`);

      const restock = await tx.restock.create({
        data: {
          materialId: material.id,
          materialBrandId: brandId,
          brandName: brandName,
          sizeName: sizeName,
          colorName: colorName,
          typeName: typeName,
          storeId: store.id,
          quantityAdded: data.quantityAdded,
          unitCost: data.unitCost,
          supplierId: data.supplierId,
          recordedById: userId,
        },
      });

      await this.updateMaterialStock(tx, material.id, store.id, data.quantityAdded, brandId);
      
      await AuditService.record('Restock', restock.id, AuditAction.CREATE, userId, null, restock);

      return restock;
    });
  }

  static async adjustStock(materialId: string, data: any, userId: string) {
    return prisma.$transaction(async (tx) => {
      const material = await tx.material.findFirst({
        where: {
          OR: [{ id: materialId }, { itemCode: materialId }],
        },
        include: { brands: true },
      });
      if (!material) throw new Error('Material not found');

      validateQuantityForUnit(data.quantityDelta, material.unit, 'Adjustment quantity');

      let brandName: string | undefined = undefined;
      let sizeName: string | undefined = undefined;
      let colorName: string | undefined = undefined;
      let typeName: string | undefined = undefined;
      let brandId: string | undefined = undefined;
      if (data.materialBrandId) {
        const brand = material.brands?.find((b: any) => b.id === data.materialBrandId);
        if (brand) {
          brandId = brand.id;
          brandName = brand.name;
          sizeName = brand.size || undefined;
          colorName = brand.color || undefined;
          typeName = brand.type || undefined;
        }
      }

      const adjustment = await tx.stockAdjustment.create({
        data: {
          materialId: material.id,
          materialBrandId: brandId,
          brandName: brandName,
          sizeName: sizeName,
          colorName: colorName,
          typeName: typeName,
          storeId: data.storeId,
          quantityDelta: data.quantityDelta,
          reason: data.reason,
          notes: data.notes,
          adjustedById: userId,
        },
      });

      await this.updateMaterialStock(tx, material.id, data.storeId, data.quantityDelta, brandId);
      await AuditService.record('StockAdjustment', adjustment.id, AuditAction.CREATE, userId, null, adjustment);

      return adjustment;
    });
  }

  static async storeTransfer(data: any, userId: string) {
    return prisma.$transaction(async (tx) => {
      const mainStore = await tx.store.findUnique({ where: { type: StoreType.MAIN } });
      const miniStore = await tx.store.findUnique({ where: { type: StoreType.MINI } });
      if (!mainStore || !miniStore) throw new Error('Stores missing');

      const isMiniToMain = data.direction === 'MINI_TO_MAIN';
      const fromStore = isMiniToMain ? miniStore : mainStore;
      const toStore = isMiniToMain ? mainStore : miniStore;

      const material = await tx.material.findFirst({
        where: { id: data.materialId },
        include: { brands: true },
      });
      if (!material) throw new Error('Material not found');

      validateQuantityForUnit(data.quantityTransferred, material.unit, 'Transferred quantity');
      await checkMaterialBrandAllocation(tx, data.materialId, fromStore.type as StoreType, 'transfer');

      let brandName: string | undefined = undefined;
      let sizeName: string | undefined = undefined;
      let colorName: string | undefined = undefined;
      let typeName: string | undefined = undefined;
      let brandId: string | undefined = undefined;
      if (data.materialBrandId) {
        const brand = material.brands?.find((b: any) => b.id === data.materialBrandId);
        if (brand) {
          brandId = brand.id;
          brandName = brand.name;
          sizeName = brand.size || undefined;
          colorName = brand.color || undefined;
          typeName = brand.type || undefined;
        }
      }

      if (brandId) {
        const fromBrandStock = await tx.materialBrandStock.findUnique({
          where: { materialBrandId_storeId: { materialBrandId: brandId, storeId: fromStore.id } },
        });
        const currentBrandQty = fromBrandStock?.quantity?.toNumber() || 0;
        if (currentBrandQty < data.quantityTransferred) {
          const labelParts = [brandName, sizeName, colorName, typeName].filter(Boolean);
          const brandLabel = labelParts.join(' • ');
          throw new Error(`Insufficient stock for brand "${brandLabel}" in ${fromStore.type === 'MAIN' ? 'Main' : 'Mini'} Store for transfer. Available: ${currentBrandQty}`);
        }
      } else {
        const fromStock = await tx.materialStock.findUnique({
          where: { materialId_storeId: { materialId: data.materialId, storeId: fromStore.id } },
        });

        const currentFromQuantity = fromStock?.quantity?.toNumber() || 0;
        if (currentFromQuantity < data.quantityTransferred) {
          throw new Error(`Insufficient stock in ${fromStore.type === 'MAIN' ? 'Main' : 'Mini'} Store for transfer. Available: ${currentFromQuantity}`);
        }
      }

      const transfer = await tx.storeTransfer.create({
        data: {
          materialId: data.materialId,
          materialBrandId: brandId,
          brandName: brandName,
          sizeName: sizeName,
          colorName: colorName,
          typeName: typeName,
          fromStoreId: fromStore.id,
          toStoreId: toStore.id,
          quantityTransferred: data.quantityTransferred,
          approvedById: userId,
          responsibleEmployeeId: data.responsibleEmployeeId,
          notes: data.notes,
        },
      });

      await this.updateMaterialStock(tx, data.materialId, fromStore.id, -data.quantityTransferred, brandId);
      await this.updateMaterialStock(tx, data.materialId, toStore.id, data.quantityTransferred, brandId);

      await AuditService.record('StoreTransfer', transfer.id, AuditAction.CREATE, userId, null, transfer);

      return transfer;
    });
  }

  static async stockCount(data: any, userId: string) {
    return prisma.$transaction(async (tx) => {
      const material = await tx.material.findFirst({
        where: { id: data.materialId },
        include: { brands: true },
      });
      if (!material) throw new Error('Material not found');

      validateQuantityForUnit(data.countedQuantity, material.unit, 'Counted quantity');

      let brandName: string | undefined = undefined;
      let sizeName: string | undefined = undefined;
      let colorName: string | undefined = undefined;
      let typeName: string | undefined = undefined;
      let brandId: string | undefined = undefined;
      if (data.materialBrandId) {
        const brand = material.brands?.find((b: any) => b.id === data.materialBrandId);
        if (brand) {
          brandId = brand.id;
          brandName = brand.name;
          sizeName = brand.size || undefined;
          colorName = brand.color || undefined;
          typeName = brand.type || undefined;
        }
      }

      let systemQty = 0;
      if (brandId) {
        const currentBrandStock = await tx.materialBrandStock.findUnique({
          where: { materialBrandId_storeId: { materialBrandId: brandId, storeId: data.storeId } },
        });
        systemQty = currentBrandStock?.quantity?.toNumber() || 0;
      } else {
        const currentStock = await tx.materialStock.findUnique({
          where: { materialId_storeId: { materialId: data.materialId, storeId: data.storeId } },
        });
        systemQty = currentStock?.quantity?.toNumber() || 0;
      }

      const discrepancy = data.countedQuantity - systemQty;

      const count = await tx.stockCount.create({
        data: {
          storeId: data.storeId,
          materialId: data.materialId,
          materialBrandId: brandId,
          brandName: brandName,
          sizeName: sizeName,
          colorName: colorName,
          typeName: typeName,
          countedQuantity: data.countedQuantity,
          systemQuantityAtCount: systemQty,
          discrepancy,
          countedById: userId,
          notes: data.notes,
        },
      });

      // Update the actual stock to match the counted quantity
      if (brandId) {
        await tx.materialBrandStock.upsert({
          where: { materialBrandId_storeId: { materialBrandId: brandId, storeId: data.storeId } },
          update: { quantity: data.countedQuantity },
          create: { materialBrandId: brandId, storeId: data.storeId, quantity: data.countedQuantity },
        });

        // Also adjust aggregate materialStock by discrepancy
        const currentMatStock = await tx.materialStock.findUnique({
          where: { materialId_storeId: { materialId: data.materialId, storeId: data.storeId } },
        });
        const newMatQty = (currentMatStock?.quantity ? currentMatStock.quantity.toNumber() : 0) + discrepancy;
        await tx.materialStock.upsert({
          where: { materialId_storeId: { materialId: data.materialId, storeId: data.storeId } },
          update: { quantity: newMatQty },
          create: { materialId: data.materialId, storeId: data.storeId, quantity: newMatQty },
        });
      } else {
        await tx.materialStock.upsert({
          where: { materialId_storeId: { materialId: data.materialId, storeId: data.storeId } },
          update: { quantity: data.countedQuantity },
          create: { materialId: data.materialId, storeId: data.storeId, quantity: data.countedQuantity },
        });
      }

      await AuditService.record('StockCount', count.id, AuditAction.CREATE, userId, null, count);

      return count;
    });
  }

  static async allocateBrandStock(
    materialId: string,
    data: { storeType: 'MAIN' | 'MINI'; allocations: { materialBrandId: string; quantity: number }[]; notes?: string | null },
    userId: string
  ) {
    return prisma.$transaction(async (tx) => {
      const material = await tx.material.findFirst({
        where: { OR: [{ id: materialId }, { itemCode: materialId }] },
        include: { brands: true },
      });
      if (!material) throw new Error('Material not found');
      if (!material.brands || material.brands.length === 0) {
        throw new Error('This material does not have any brands defined');
      }

      const store = await tx.store.findUnique({
        where: { type: data.storeType as StoreType },
      });
      if (!store) throw new Error(`Store of type ${data.storeType} not found`);

      // Verify each brand in allocations belongs to the material
      const brandMap = new Map(material.brands.map((b) => [b.id, b]));
      for (const alloc of data.allocations) {
        if (!brandMap.has(alloc.materialBrandId)) {
          throw new Error(`Brand ${alloc.materialBrandId} does not belong to this material`);
        }
        validateQuantityForUnit(alloc.quantity, material.unit, 'Allocation quantity');
      }

      // Record before-state for audit
      const existingBrandStocks = await tx.materialBrandStock.findMany({
        where: {
          storeId: store.id,
          materialBrandId: { in: material.brands.map((b) => b.id) },
        },
      });
      const previousTotalStock = await tx.materialStock.findUnique({
        where: { materialId_storeId: { materialId: material.id, storeId: store.id } },
      });

      // Update brand stocks
      let newTotalBrandStock = 0;
      const allocatedSummary: string[] = [];

      for (const alloc of data.allocations) {
        const brand = brandMap.get(alloc.materialBrandId)!;
        await tx.materialBrandStock.upsert({
          where: {
            materialBrandId_storeId: {
              materialBrandId: alloc.materialBrandId,
              storeId: store.id,
            },
          },
          update: { quantity: alloc.quantity },
          create: {
            materialBrandId: alloc.materialBrandId,
            storeId: store.id,
            quantity: alloc.quantity,
          },
        });
        newTotalBrandStock += alloc.quantity;
        const labelParts = [brand.name, brand.size, brand.color, brand.type].filter(Boolean);
        const brandLabel = labelParts.join(' • ');
        allocatedSummary.push(`${brandLabel}: ${alloc.quantity}`);
      }

      // If there are other brands belonging to this material not in allocations, include their current stock
      const allocatedBrandIdSet = new Set(data.allocations.map((a) => a.materialBrandId));
      for (const b of material.brands) {
        if (!allocatedBrandIdSet.has(b.id)) {
          const eb = existingBrandStocks.find((s) => s.materialBrandId === b.id);
          if (eb) {
            newTotalBrandStock += eb.quantity.toNumber();
          }
        }
      }

      // Synchronize parent MaterialStock with sum of brands
      await tx.materialStock.upsert({
        where: {
          materialId_storeId: {
            materialId: material.id,
            storeId: store.id,
          },
        },
        update: { quantity: newTotalBrandStock },
        create: {
          materialId: material.id,
          storeId: store.id,
          quantity: newTotalBrandStock,
        },
      });

      // Record a StockAdjustment for transparent timeline and history
      const prevQty = previousTotalStock?.quantity?.toNumber() || 0;
      const delta = newTotalBrandStock - prevQty;
      const adjustmentNotes = `Brand stock allocation: ${allocatedSummary.join(', ')}.${data.notes ? ` Notes: ${data.notes}` : ''}`;

      await tx.stockAdjustment.create({
        data: {
          materialId: material.id,
          storeId: store.id,
          quantityDelta: delta,
          reason: AdjustmentReason.CORRECTION,
          notes: adjustmentNotes,
          adjustedById: userId,
        },
      });

      await AuditService.record(
        'BrandStockAllocation',
        material.id,
        AuditAction.UPDATE,
        userId,
        { previousBrandStocks: existingBrandStocks, previousTotalStock },
        { newTotalBrandStock, allocations: data.allocations }
      );

      return {
        materialId: material.id,
        storeId: store.id,
        storeType: store.type,
        totalQuantity: newTotalBrandStock,
        allocations: data.allocations,
      };
    });
  }

  static async getAllStockHistory(query: {
    page?: number;
    limit?: number;
    materialId?: string;
    type?: string;
    storeType?: 'MAIN' | 'MINI' | 'ALL';
    startDate?: string;
    endDate?: string;
    minPrice?: number;
    maxPrice?: number;
    search?: string;
  }) {
    let resolvedMaterialId: string | undefined;
    if (query.materialId && query.materialId !== 'ALL') {
      const mat = await prisma.material.findFirst({
        where: {
          OR: [{ id: query.materialId }, { itemCode: query.materialId }],
        },
        select: { id: true },
      });
      resolvedMaterialId = mat ? mat.id : query.materialId;
    }

    const dateFilter: { gte?: Date; lte?: Date } = {};
    if (query.startDate) {
      const start = new Date(query.startDate);
      if (!isNaN(start.getTime())) {
        dateFilter.gte = start;
      }
    }
    if (query.endDate) {
      const end = new Date(query.endDate);
      if (!isNaN(end.getTime())) {
        if (query.endDate.length <= 10) {
          end.setHours(23, 59, 59, 999);
        }
        dateFilter.lte = end;
      }
    }
    const hasDateFilter = Boolean(dateFilter.gte || dateFilter.lte);

    const minPrice = query.minPrice !== undefined && query.minPrice !== null && !isNaN(Number(query.minPrice)) ? Number(query.minPrice) : undefined;
    const maxPrice = query.maxPrice !== undefined && query.maxPrice !== null && !isNaN(Number(query.maxPrice)) ? Number(query.maxPrice) : undefined;
    const hasPriceFilter = minPrice !== undefined || maxPrice !== undefined;
    const priceRange = hasPriceFilter ? { gte: minPrice, lte: maxPrice } : undefined;

    const s = query.search?.trim();
    const type = query.type;
    const storeType = query.storeType;

    const queries: Promise<any[]>[] = [];
    const queryTypes: string[] = [];

    // 1. Restock
    if (!type || type === 'ALL' || type === 'RESTOCK') {
      const where: any = {};
      if (resolvedMaterialId) where.materialId = resolvedMaterialId;
      if (hasDateFilter) where.purchaseDate = dateFilter;
      if (storeType && storeType !== 'ALL') where.store = { type: storeType as StoreType };
      if (priceRange) where.unitCost = priceRange;
      if (s) {
        where.OR = [
          { material: { nameEn: { contains: s, mode: 'insensitive' } } },
          { material: { nameAm: { contains: s, mode: 'insensitive' } } },
          { material: { itemCode: { contains: s, mode: 'insensitive' } } },
          { recordedBy: { name: { contains: s, mode: 'insensitive' } } },
          { brandName: { contains: s, mode: 'insensitive' } },
          { supplier: { name: { contains: s, mode: 'insensitive' } } },
        ];
      }
      queries.push(
        prisma.restock.findMany({
          where,
          include: {
            store: true,
            material: true,
            materialBrand: true,
            supplier: true,
            recordedBy: { select: { name: true } },
          },
          orderBy: { purchaseDate: 'desc' },
        })
      );
      queryTypes.push('RESTOCK');
    }

    // 2. Adjustments
    if ((!type || type === 'ALL' || type === 'ADJUSTMENT') && !hasPriceFilter) {
      const where: any = {};
      if (resolvedMaterialId) where.materialId = resolvedMaterialId;
      if (hasDateFilter) where.adjustedAt = dateFilter;
      if (storeType && storeType !== 'ALL') where.store = { type: storeType as StoreType };
      if (s) {
        where.OR = [
          { material: { nameEn: { contains: s, mode: 'insensitive' } } },
          { material: { nameAm: { contains: s, mode: 'insensitive' } } },
          { material: { itemCode: { contains: s, mode: 'insensitive' } } },
          { adjustedBy: { name: { contains: s, mode: 'insensitive' } } },
          { notes: { contains: s, mode: 'insensitive' } },
        ];
      }
      queries.push(
        prisma.stockAdjustment.findMany({
          where,
          include: {
            store: true,
            material: true,
            materialBrand: true,
            adjustedBy: { select: { name: true } },
          },
          orderBy: { adjustedAt: 'desc' },
        })
      );
      queryTypes.push('ADJUSTMENT');
    }

    // 3. Transfers
    if ((!type || type === 'ALL' || type === 'TRANSFER') && !hasPriceFilter) {
      const where: any = {};
      if (resolvedMaterialId) where.materialId = resolvedMaterialId;
      if (hasDateFilter) where.transferDate = dateFilter;
      if (storeType && storeType !== 'ALL') {
        where.OR = [
          { fromStore: { type: storeType as StoreType } },
          { toStore: { type: storeType as StoreType } },
        ];
      }
      if (s) {
        const searchConditions = [
          { material: { nameEn: { contains: s, mode: 'insensitive' } } },
          { material: { nameAm: { contains: s, mode: 'insensitive' } } },
          { material: { itemCode: { contains: s, mode: 'insensitive' } } },
          { approvedBy: { name: { contains: s, mode: 'insensitive' } } },
          { notes: { contains: s, mode: 'insensitive' } },
        ];
        if (where.OR) {
          where.AND = [{ OR: where.OR }, { OR: searchConditions }];
          delete where.OR;
        } else {
          where.OR = searchConditions;
        }
      }
      queries.push(
        prisma.storeTransfer.findMany({
          where,
          include: {
            fromStore: true,
            toStore: true,
            material: true,
            materialBrand: true,
            approvedBy: { select: { name: true } },
          },
          orderBy: { transferDate: 'desc' },
        })
      );
      queryTypes.push('TRANSFER');
    }

    // 4. Counts
    if ((!type || type === 'ALL' || type === 'COUNT') && !hasPriceFilter) {
      const where: any = {};
      if (resolvedMaterialId) where.materialId = resolvedMaterialId;
      if (hasDateFilter) where.countedAt = dateFilter;
      if (storeType && storeType !== 'ALL') where.store = { type: storeType as StoreType };
      if (s) {
        where.OR = [
          { material: { nameEn: { contains: s, mode: 'insensitive' } } },
          { material: { nameAm: { contains: s, mode: 'insensitive' } } },
          { material: { itemCode: { contains: s, mode: 'insensitive' } } },
          { countedBy: { name: { contains: s, mode: 'insensitive' } } },
          { notes: { contains: s, mode: 'insensitive' } },
        ];
      }
      queries.push(
        prisma.stockCount.findMany({
          where,
          include: {
            store: true,
            material: true,
            materialBrand: true,
            countedBy: { select: { name: true } },
          },
          orderBy: { countedAt: 'desc' },
        })
      );
      queryTypes.push('COUNT');
    }

    // 5. Direct Sales (MINI Store)
    if ((!type || type === 'ALL' || type === 'DIRECT_SALE') && storeType !== 'MAIN') {
      const where: any = {};
      if (resolvedMaterialId) where.materialId = resolvedMaterialId;
      if (hasDateFilter) where.directSale = { saleDateTime: dateFilter };
      if (priceRange) where.priceAtSaleTime = priceRange;
      if (s) {
        where.OR = [
          { material: { nameEn: { contains: s, mode: 'insensitive' } } },
          { material: { nameAm: { contains: s, mode: 'insensitive' } } },
          { material: { itemCode: { contains: s, mode: 'insensitive' } } },
          { directSale: { saleNumber: { contains: s, mode: 'insensitive' } } },
          { directSale: { customerName: { contains: s, mode: 'insensitive' } } },
          { directSale: { customerPhone: { contains: s, mode: 'insensitive' } } },
          { directSale: { createdBy: { name: { contains: s, mode: 'insensitive' } } } },
        ];
      }
      queries.push(
        prisma.directSaleLine.findMany({
          where,
          include: {
            material: true,
            materialBrand: true,
            directSale: { include: { createdBy: { select: { name: true } } } },
          },
          orderBy: { directSale: { saleDateTime: 'desc' } },
        })
      );
      queryTypes.push('DIRECT_SALE');
    }

    // 6. Orders - Standalone Items (MINI Store)
    if ((!type || type === 'ALL' || type === 'ORDER') && storeType !== 'MAIN') {
      const where: any = {};
      if (resolvedMaterialId) where.materialId = resolvedMaterialId;
      if (hasDateFilter) where.order = { orderDateTime: dateFilter };
      if (priceRange) where.priceAtOrderTime = priceRange;
      if (s) {
        where.OR = [
          { material: { nameEn: { contains: s, mode: 'insensitive' } } },
          { material: { nameAm: { contains: s, mode: 'insensitive' } } },
          { material: { itemCode: { contains: s, mode: 'insensitive' } } },
          { order: { orderNumber: { contains: s, mode: 'insensitive' } } },
          { order: { customer: { name: { contains: s, mode: 'insensitive' } } } },
          { order: { customer: { phoneNumber: { contains: s, mode: 'insensitive' } } } },
          { order: { createdBy: { name: { contains: s, mode: 'insensitive' } } } },
        ];
      }
      queries.push(
        prisma.orderStandaloneItemLine.findMany({
          where,
          include: {
            material: true,
            materialBrand: true,
            order: {
              include: {
                createdBy: { select: { name: true } },
                customer: { select: { name: true, phoneNumber: true } },
              },
            },
          },
          orderBy: { order: { orderDateTime: 'desc' } },
        })
      );
      queryTypes.push('ORDER_ITEM');
    }

    // 7. Orders - Service Material Deductions (MINI Store)
    if ((!type || type === 'ALL' || type === 'ORDER') && storeType !== 'MAIN') {
      const where: any = {};
      if (resolvedMaterialId) where.materialId = resolvedMaterialId;
      if (hasDateFilter) where.orderServiceLine = { order: { orderDateTime: dateFilter } };
      if (priceRange) where.unitPriceAtOrderTime = priceRange;
      if (s) {
        where.OR = [
          { material: { nameEn: { contains: s, mode: 'insensitive' } } },
          { material: { nameAm: { contains: s, mode: 'insensitive' } } },
          { material: { itemCode: { contains: s, mode: 'insensitive' } } },
          { brandName: { contains: s, mode: 'insensitive' } },
          { sizeName: { contains: s, mode: 'insensitive' } },
          { colorName: { contains: s, mode: 'insensitive' } },
          { typeName: { contains: s, mode: 'insensitive' } },
          { materialBrand: { name: { contains: s, mode: 'insensitive' } } },
          { orderServiceLine: { order: { orderNumber: { contains: s, mode: 'insensitive' } } } },
          { orderServiceLine: { order: { customer: { name: { contains: s, mode: 'insensitive' } } } } },
          { orderServiceLine: { order: { customer: { phoneNumber: { contains: s, mode: 'insensitive' } } } } },
          { orderServiceLine: { order: { createdBy: { name: { contains: s, mode: 'insensitive' } } } } },
        ];
      }
      queries.push(
        prisma.orderServiceMaterialDeduction.findMany({
          where,
          include: {
            material: true,
            materialBrand: true,
            orderServiceLine: {
              include: {
                order: {
                  include: {
                    createdBy: { select: { name: true } },
                    customer: { select: { name: true, phoneNumber: true } },
                  },
                },
              },
            },
          },
          orderBy: { orderServiceLine: { order: { orderDateTime: 'desc' } } },
        })
      );
      queryTypes.push('ORDER_SERVICE');
    }

    const results = await Promise.all(queries);
    const history: any[] = [];

    for (let i = 0; i < queryTypes.length; i++) {
      const qType = queryTypes[i];
      const records = results[i] || [];

      if (qType === 'RESTOCK') {
        for (const r of records) {
          const qty = Number(r.quantityAdded);
          const cost = r.unitCost ? Number(r.unitCost) : null;
          history.push({
            id: r.id,
            type: 'RESTOCK',
            date: r.purchaseDate,
            materialId: r.materialId,
            materialNameEn: r.material?.nameEn || 'Unknown',
            materialNameAm: r.material?.nameAm || 'Unknown',
            itemCode: r.material?.itemCode || '',
            unit: r.material?.unit || 'PCS',
            store: r.store?.name || 'MAIN',
            storeType: r.store?.type || 'MAIN',
            brandName: r.brandName || r.materialBrand?.name || null,
            sizeName: r.sizeName || r.materialBrand?.size || null,
            colorName: r.colorName || r.materialBrand?.color || null,
            typeName: r.typeName || r.materialBrand?.type || null,
            quantity: `+${qty}`,
            quantityNum: qty,
            unitPrice: cost,
            totalPrice: cost ? cost * qty : null,
            detail: r.supplier?.name ? `Supplier: ${r.supplier.name}` : (cost ? `Cost: ${cost}` : null),
            user: r.recordedBy?.name || 'Staff',
            notes: null,
            metadata: {
              supplier: r.supplier?.name || null,
              supplierPhone: r.supplier?.phone || null,
            },
          });
        }
      } else if (qType === 'ADJUSTMENT') {
        for (const a of records) {
          const delta = Number(a.quantityDelta);
          const price = a.material?.currentPrice ? Number(a.material.currentPrice) : null;
          history.push({
            id: a.id,
            type: 'ADJUSTMENT',
            date: a.adjustedAt,
            materialId: a.materialId,
            materialNameEn: a.material?.nameEn || 'Unknown',
            materialNameAm: a.material?.nameAm || 'Unknown',
            itemCode: a.material?.itemCode || '',
            unit: a.material?.unit || 'PCS',
            store: a.store?.name || 'MAIN',
            storeType: a.store?.type || 'MAIN',
            brandName: a.brandName || a.materialBrand?.name || null,
            sizeName: a.sizeName || a.materialBrand?.size || null,
            colorName: a.colorName || a.materialBrand?.color || null,
            typeName: a.typeName || a.materialBrand?.type || null,
            quantity: delta >= 0 ? `+${delta}` : `${delta}`,
            quantityNum: delta,
            unitPrice: price,
            totalPrice: price ? price * Math.abs(delta) : null,
            detail: `Reason: ${a.reason}`,
            user: a.adjustedBy?.name || 'Staff',
            notes: a.notes,
            metadata: {
              reason: a.reason,
              notes: a.notes,
            },
          });
        }
      } else if (qType === 'TRANSFER') {
        for (const t of records) {
          const qty = Number(t.quantityTransferred);
          const price = t.material?.currentPrice ? Number(t.material.currentPrice) : null;
          history.push({
            id: t.id,
            type: 'TRANSFER',
            date: t.transferDate,
            materialId: t.materialId,
            materialNameEn: t.material?.nameEn || 'Unknown',
            materialNameAm: t.material?.nameAm || 'Unknown',
            itemCode: t.material?.itemCode || '',
            unit: t.material?.unit || 'PCS',
            store: `${t.fromStore?.name || 'MAIN'} → ${t.toStore?.name || 'MINI'}`,
            storeType: `${t.fromStore?.type || 'MAIN'} → ${t.toStore?.type || 'MINI'}`,
            brandName: t.brandName || t.materialBrand?.name || null,
            sizeName: t.sizeName || t.materialBrand?.size || null,
            colorName: t.colorName || t.materialBrand?.color || null,
            typeName: t.typeName || t.materialBrand?.type || null,
            quantity: `⇄ ${qty}`,
            quantityNum: qty,
            unitPrice: price,
            totalPrice: price ? price * qty : null,
            detail: t.notes || `${t.fromStore?.name} → ${t.toStore?.name}`,
            user: t.approvedBy?.name || 'Staff',
            notes: t.notes,
            metadata: {
              fromStore: t.fromStore?.name || null,
              toStore: t.toStore?.name || null,
            },
          });
        }
      } else if (qType === 'COUNT') {
        for (const c of records) {
          const disc = Number(c.discrepancy);
          const price = c.material?.currentPrice ? Number(c.material.currentPrice) : null;
          history.push({
            id: c.id,
            type: 'COUNT',
            date: c.countedAt,
            materialId: c.materialId,
            materialNameEn: c.material?.nameEn || 'Unknown',
            materialNameAm: c.material?.nameAm || 'Unknown',
            itemCode: c.material?.itemCode || '',
            unit: c.material?.unit || 'PCS',
            store: c.store?.name || 'MAIN',
            storeType: c.store?.type || 'MAIN',
            brandName: c.brandName || c.materialBrand?.name || null,
            sizeName: c.sizeName || c.materialBrand?.size || null,
            colorName: c.colorName || c.materialBrand?.color || null,
            typeName: c.typeName || c.materialBrand?.type || null,
            quantity: `Count: ${c.countedQuantity} (${disc >= 0 ? '+' : ''}${disc})`,
            quantityNum: disc,
            unitPrice: price,
            totalPrice: null,
            detail: `System was ${c.systemQuantityAtCount}, Discrepancy: ${disc >= 0 ? '+' : ''}${disc}`,
            user: c.countedBy?.name || 'Staff',
            notes: c.notes,
            metadata: {
              systemQuantityAtCount: Number(c.systemQuantityAtCount),
              countedQuantity: Number(c.countedQuantity),
              discrepancy: disc,
            },
          });
        }
      } else if (qType === 'DIRECT_SALE') {
        for (const d of records) {
          const qty = Number(d.quantity);
          const price = Number(d.priceAtSaleTime);
          history.push({
            id: d.id,
            type: 'DIRECT_SALE',
            date: d.directSale?.saleDateTime || new Date(),
            materialId: d.materialId,
            materialNameEn: d.material?.nameEn || 'Unknown',
            materialNameAm: d.material?.nameAm || 'Unknown',
            itemCode: d.material?.itemCode || '',
            unit: d.material?.unit || 'PCS',
            store: 'MINI',
            storeType: 'MINI',
            brandName: d.brandName || d.materialBrand?.name || null,
            sizeName: d.sizeName || d.materialBrand?.size || null,
            colorName: d.colorName || d.materialBrand?.color || null,
            typeName: d.typeName || d.materialBrand?.type || null,
            quantity: `-${qty}`,
            quantityNum: -qty,
            unitPrice: price,
            totalPrice: price * qty,
            detail: `Sale #${d.directSale?.saleNumber || ''}`,
            user: d.directSale?.createdBy?.name || 'Staff',
            notes: null,
            metadata: {
              saleId: d.directSale?.id || null,
              number: d.directSale?.saleNumber || null,
              customerName: d.directSale?.customerName || 'Walk-in',
              customerPhone: d.directSale?.customerPhone || 'N/A',
            },
          });
        }
      } else if (qType === 'ORDER_ITEM') {
        for (const s of records) {
          const qty = Number(s.quantity);
          const price = Number(s.priceAtOrderTime);
          history.push({
            id: s.id,
            type: 'ORDER',
            date: s.order?.orderDateTime || new Date(),
            materialId: s.materialId,
            materialNameEn: s.material?.nameEn || 'Unknown',
            materialNameAm: s.material?.nameAm || 'Unknown',
            itemCode: s.material?.itemCode || '',
            unit: s.material?.unit || 'PCS',
            store: 'MINI',
            storeType: 'MINI',
            brandName: s.brandName || s.materialBrand?.name || null,
            sizeName: s.sizeName || s.materialBrand?.size || null,
            colorName: s.colorName || s.materialBrand?.color || null,
            typeName: s.typeName || s.materialBrand?.type || null,
            quantity: `-${qty}`,
            quantityNum: -qty,
            unitPrice: price,
            totalPrice: price * qty,
            detail: `Order #${s.order?.orderNumber || ''} (Standalone)`,
            user: s.order?.createdBy?.name || 'Staff',
            notes: null,
            metadata: {
              orderId: s.order?.id || null,
              number: s.order?.orderNumber || null,
              customerName: s.order?.customer?.name || 'Unknown',
              customerPhone: s.order?.customer?.phoneNumber || 'N/A',
            },
          });
        }
      } else if (qType === 'ORDER_SERVICE') {
        for (const s of records) {
          const qty = Number(s.quantityDeducted);
          const price = Number(s.unitPriceAtOrderTime || 0);
          history.push({
            id: s.id,
            type: 'ORDER',
            date: s.orderServiceLine?.order?.orderDateTime || new Date(),
            materialId: s.materialId,
            materialNameEn: s.material?.nameEn || 'Unknown',
            materialNameAm: s.material?.nameAm || 'Unknown',
            itemCode: s.material?.itemCode || '',
            unit: s.material?.unit || 'PCS',
            store: 'MINI',
            storeType: 'MINI',
            brandName: s.brandName || s.materialBrand?.name || null,
            sizeName: s.sizeName || s.materialBrand?.size || null,
            colorName: s.colorName || s.materialBrand?.color || null,
            typeName: s.typeName || s.materialBrand?.type || null,
            quantity: `-${qty}`,
            quantityNum: -qty,
            unitPrice: price > 0 ? price : null,
            totalPrice: price > 0 ? price * qty : null,
            detail: `Order #${s.orderServiceLine?.order?.orderNumber || ''} (Service)`,
            user: s.orderServiceLine?.order?.createdBy?.name || 'Staff',
            notes: null,
            metadata: {
              orderId: s.orderServiceLine?.order?.id || null,
              number: s.orderServiceLine?.order?.orderNumber || null,
              customerName: s.orderServiceLine?.order?.customer?.name || 'Unknown',
              customerPhone: s.orderServiceLine?.order?.customer?.phoneNumber || 'N/A',
            },
          });
        }
      }
    }

    // Sort newest to oldest
    history.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    // Compute KPIs on filtered set
    let totalRestocksCount = 0;
    let totalRestockQty = 0;
    let totalRestockExpenditure = 0;

    let totalDeductionsCount = 0;
    let totalDeductionQty = 0;
    let totalSalesRevenue = 0;

    let totalTransfersCount = 0;
    let totalAdjustmentsCount = 0;

    for (const item of history) {
      if (item.type === 'RESTOCK') {
        totalRestocksCount++;
        totalRestockQty += Math.max(0, item.quantityNum);
        totalRestockExpenditure += item.totalPrice || 0;
      } else if (item.type === 'DIRECT_SALE' || item.type === 'ORDER') {
        totalDeductionsCount++;
        totalDeductionQty += Math.abs(item.quantityNum);
        totalSalesRevenue += item.totalPrice || 0;
      } else if (item.type === 'TRANSFER') {
        totalTransfersCount++;
      } else if (item.type === 'ADJUSTMENT') {
        totalAdjustmentsCount++;
      }
    }

    const page = Math.max(1, Number(query.page) || 1);
    const limit = Math.max(1, Number(query.limit) || 25);
    const total = history.length;
    const totalPages = Math.ceil(total / limit) || 1;
    const paginatedItems = history.slice((page - 1) * limit, page * limit);

    return {
      items: paginatedItems,
      total,
      page,
      limit,
      totalPages,
      summary: {
        totalMovements: total,
        totalRestocksCount,
        totalRestockQty,
        totalRestockExpenditure,
        totalDeductionsCount,
        totalDeductionQty,
        totalSalesRevenue,
        totalTransfersCount,
        totalAdjustmentsCount,
      },
    };
  }

  static async getMaterialHistory(materialId: string) {
    const material = await prisma.material.findFirst({
      where: {
        OR: [{ id: materialId }, { itemCode: materialId }],
      },
      select: { id: true },
    });
    const resolvedId = material ? material.id : materialId;

    const results = await Promise.all([
      prisma.restock.findMany({
        where: { materialId: resolvedId },
        include: { store: true, materialBrand: true, recordedBy: { select: { name: true } } },
        orderBy: { purchaseDate: 'desc' },
      }),
      prisma.stockAdjustment.findMany({
        where: { materialId: resolvedId },
        include: { store: true, materialBrand: true, adjustedBy: { select: { name: true } } },
        orderBy: { adjustedAt: 'desc' },
      }),
      prisma.storeTransfer.findMany({
        where: { materialId: resolvedId },
        include: {
          fromStore: true,
          toStore: true,
          materialBrand: true,
          approvedBy: { select: { name: true } },
        },
        orderBy: { transferDate: 'desc' },
      }),
      prisma.stockCount.findMany({
        where: { materialId: resolvedId },
        include: { store: true, materialBrand: true, countedBy: { select: { name: true } } },
        orderBy: { countedAt: 'desc' },
      }),
      prisma.directSaleLine.findMany({
        where: { materialId: resolvedId },
        include: { directSale: { include: { createdBy: { select: { name: true } } } } },
        orderBy: { directSale: { saleDateTime: 'desc' } }
      }),
      prisma.orderStandaloneItemLine.findMany({
        where: { materialId: resolvedId },
        include: {
          materialBrand: true,
          order: { include: { createdBy: { select: { name: true } }, customer: { select: { name: true, phoneNumber: true } } } },
        },
        orderBy: { order: { orderDateTime: 'desc' } }
      }),
      prisma.orderServiceMaterialDeduction.findMany({
        where: { materialId: resolvedId },
        include: {
          materialBrand: true,
          orderServiceLine: { include: { order: { include: { createdBy: { select: { name: true } }, customer: { select: { name: true, phoneNumber: true } } } } } },
        },
        orderBy: { orderServiceLine: { order: { orderDateTime: 'desc' } } }
      })
    ]);

    const restocks = results[0] as any[];
    const adjustments = results[1] as any[];
    const transfers = results[2] as any[];
    const counts = results[3] as any[];
    const directSales = results[4] as any[];
    const standaloneOrders = results[5] as any[];
    const serviceOrders = results[6] as any[];

    // Normalize into a unified timeline
    const history: any[] = [];

    for (const r of restocks) {
      history.push({
        id: r.id,
        type: 'RESTOCK',
        date: r.purchaseDate,
        store: r.store.name,
        brandName: r.brandName || r.materialBrand?.name || null,
        sizeName: r.sizeName || r.materialBrand?.size || null,
        colorName: r.colorName || r.materialBrand?.color || null,
        typeName: r.typeName || r.materialBrand?.type || null,
        quantity: `+${r.quantityAdded}`,
        detail: r.unitCost ? `Unit cost: ${r.unitCost}` : null,
        user: r.recordedBy.name,
        notes: null,
      });
    }

    for (const a of adjustments) {
      const delta = Number(a.quantityDelta);
      history.push({
        id: a.id,
        type: 'ADJUSTMENT',
        date: a.adjustedAt,
        store: a.store.name,
        brandName: a.brandName || a.materialBrand?.name || null,
        sizeName: a.sizeName || a.materialBrand?.size || null,
        colorName: a.colorName || a.materialBrand?.color || null,
        typeName: a.typeName || a.materialBrand?.type || null,
        quantity: delta >= 0 ? `+${delta}` : `${delta}`,
        detail: `Reason: ${a.reason}`,
        user: a.adjustedBy.name,
        notes: a.notes,
      });
    }

    for (const t of transfers) {
      history.push({
        id: t.id,
        type: 'TRANSFER',
        date: t.transferDate,
        store: `${t.fromStore.name} → ${t.toStore.name}`,
        brandName: t.brandName || t.materialBrand?.name || null,
        sizeName: t.sizeName || t.materialBrand?.size || null,
        colorName: t.colorName || t.materialBrand?.color || null,
        typeName: t.typeName || t.materialBrand?.type || null,
        quantity: `${t.quantityTransferred}`,
        detail: null,
        user: t.approvedBy.name,
        notes: t.notes,
      });
    }

    for (const c of counts) {
      const disc = Number(c.discrepancy);
      history.push({
        id: c.id,
        type: 'COUNT',
        date: c.countedAt,
        store: c.store.name,
        brandName: c.brandName || c.materialBrand?.name || null,
        sizeName: c.sizeName || c.materialBrand?.size || null,
        colorName: c.colorName || c.materialBrand?.color || null,
        typeName: c.typeName || c.materialBrand?.type || null,
        quantity: `Counted: ${c.countedQuantity}`,
        detail: `System was: ${c.systemQuantityAtCount}, Discrepancy: ${disc >= 0 ? '+' : ''}${disc}`,
        user: c.countedBy.name,
        notes: c.notes,
      });
    }

    for (const d of directSales) {
      history.push({
        id: d.id,
        type: 'DIRECT_SALE',
        date: d.directSale.saleDateTime,
        store: 'MINI',
        brandName: d.brandName || null,
        sizeName: d.sizeName || null,
        colorName: d.colorName || null,
        typeName: d.typeName || null,
        quantity: `-${d.quantity}`,
        detail: `Sale #${d.directSale.saleNumber}`,
        user: d.directSale.createdBy.name,
        notes: null,
        metadata: {
          number: d.directSale.saleNumber,
          customerName: d.directSale.customerName || 'Walk-in',
          customerPhone: d.directSale.customerPhone || 'N/A',
          price: d.priceAtSaleTime
        }
      });
    }

    for (const s of standaloneOrders) {
      history.push({
        id: s.id,
        type: 'ORDER',
        date: s.order.orderDateTime,
        store: 'MINI',
        brandName: s.brandName || s.materialBrand?.name || null,
        sizeName: s.sizeName || s.materialBrand?.size || null,
        colorName: s.colorName || s.materialBrand?.color || null,
        typeName: s.typeName || s.materialBrand?.type || null,
        quantity: `-${s.quantity}`,
        detail: `Order #${s.order.orderNumber} (Item)`,
        user: s.order.createdBy.name,
        notes: null,
        metadata: {
          number: s.order.orderNumber,
          customerName: s.order.customer.name,
          customerPhone: s.order.customer.phoneNumber || 'N/A',
          price: s.priceAtOrderTime
        }
      });
    }

    for (const s of serviceOrders) {
      history.push({
        id: s.id,
        type: 'ORDER',
        date: s.orderServiceLine.order.orderDateTime,
        store: 'MINI',
        brandName: s.brandName || s.materialBrand?.name || null,
        sizeName: s.sizeName || s.materialBrand?.size || null,
        colorName: s.colorName || s.materialBrand?.color || null,
        typeName: s.typeName || s.materialBrand?.type || null,
        quantity: `-${s.quantityDeducted}`,
        detail: `Order #${s.orderServiceLine.order.orderNumber} (Service Usage)`,
        user: s.orderServiceLine.order.createdBy.name,
        notes: null,
        metadata: {
          number: s.orderServiceLine.order.orderNumber,
          customerName: s.orderServiceLine.order.customer.name,
          customerPhone: s.orderServiceLine.order.customer.phoneNumber || 'N/A',
          price: s.unitPriceAtOrderTime || 0
        }
      });
    }

    // Sort newest first
    history.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    return history;
  }
}
