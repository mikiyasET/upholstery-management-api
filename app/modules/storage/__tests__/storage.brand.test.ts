import { StorageService } from '../storage.service';
import prisma from '../../../lib/prisma';
import { StoreType } from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';

jest.mock('../../../lib/prisma', () => {
  const mMaterial = {
    findFirst: jest.fn(),
    findUnique: jest.fn(),
    findMany: jest.fn(),
  };
  const mStore = {
    findUnique: jest.fn(),
    findFirst: jest.fn(),
  };
  const mMaterialStock = {
    findUnique: jest.fn(),
    upsert: jest.fn(),
  };
  const mMaterialBrandStock = {
    findUnique: jest.fn(),
    findMany: jest.fn(),
    upsert: jest.fn(),
  };
  const mRestock = {
    create: jest.fn(),
  };
  const mStockAdjustment = {
    create: jest.fn(),
  };
  const mStoreTransfer = {
    create: jest.fn(),
  };
  const mStockCount = {
    create: jest.fn(),
  };

  const client: any = {
    material: mMaterial,
    store: mStore,
    materialStock: mMaterialStock,
    materialBrandStock: mMaterialBrandStock,
    restock: mRestock,
    stockAdjustment: mStockAdjustment,
    storeTransfer: mStoreTransfer,
    stockCount: mStockCount,
    $transaction: jest.fn((cb: any) => cb(client)),
  };

  return {
    __esModule: true,
    default: client,
  };
});

jest.mock('../../../lib/audit', () => ({
  AuditService: {
    record: jest.fn(),
  },
}));

describe('StorageService - Brand Stock Management', () => {
  const mockMaterial = {
    id: 'mat-1',
    nameEn: 'Polish',
    nameAm: 'ፖሊሽ',
    isBulkTracked: true,
    lowStockThreshold: 10,
    brands: [
      { id: 'brand-abro', name: 'Abro', price: 250 },
      { id: 'brand-flam', name: 'Flamingo', price: 300 },
    ],
  };

  const mockMainStore = { id: 'store-main', type: StoreType.MAIN, name: 'Main Store' };
  const mockMiniStore = { id: 'store-mini', type: StoreType.MINI, name: 'Mini Store' };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('restock with brand', () => {
    it('restocks brand stock and keeps aggregate material stock in sync', async () => {
      (prisma.material.findFirst as jest.Mock).mockResolvedValue(mockMaterial);
      (prisma.store.findUnique as jest.Mock).mockResolvedValue(mockMainStore);
      (prisma.materialBrandStock.findUnique as jest.Mock).mockResolvedValue({
        id: 'mbs-1',
        materialBrandId: 'brand-abro',
        storeId: 'store-main',
        quantity: new Decimal(20),
      });
      (prisma.materialStock.findUnique as jest.Mock).mockResolvedValue({
        id: 'ms-1',
        materialId: 'mat-1',
        storeId: 'store-main',
        quantity: new Decimal(50),
      });
      (prisma.restock.create as jest.Mock).mockResolvedValue({
        id: 'restock-1',
        materialId: 'mat-1',
        materialBrandId: 'brand-abro',
        brandName: 'Abro',
        quantityAdded: 15,
      });

      const res = await StorageService.restock('mat-1', {
        quantityAdded: 15,
        unitCost: 200,
        materialBrandId: 'brand-abro',
      }, 'user-1');

      expect(prisma.restock.create).toHaveBeenCalledWith(expect.objectContaining({
        data: expect.objectContaining({
          materialId: 'mat-1',
          materialBrandId: 'brand-abro',
          brandName: 'Abro',
          quantityAdded: 15,
        }),
      }));

      // Brand stock upserted
      expect(prisma.materialBrandStock.upsert).toHaveBeenCalledWith(expect.objectContaining({
        where: { materialBrandId_storeId: { materialBrandId: 'brand-abro', storeId: 'store-main' } },
        create: { materialBrandId: 'brand-abro', storeId: 'store-main', quantity: 35 },
        update: { quantity: 35 },
      }));

      // Aggregate material stock upserted
      expect(prisma.materialStock.upsert).toHaveBeenCalledWith(expect.objectContaining({
        where: { materialId_storeId: { materialId: 'mat-1', storeId: 'store-main' } },
        create: { materialId: 'mat-1', storeId: 'store-main', quantity: 65 },
        update: { quantity: 65 },
      }));

      expect(res.id).toBe('restock-1');
    });

    it('allows restocking a non-bulk-tracked material into Main Store when specified', async () => {
      const nonBulkMaterial = { ...mockMaterial, isBulkTracked: false };
      (prisma.material.findFirst as jest.Mock).mockResolvedValue(nonBulkMaterial);
      (prisma.store.findUnique as jest.Mock).mockResolvedValue(mockMainStore);
      (prisma.materialBrandStock.findUnique as jest.Mock).mockResolvedValue(null);
      (prisma.materialStock.findUnique as jest.Mock).mockResolvedValue(null);
      (prisma.restock.create as jest.Mock).mockResolvedValue({
        id: 'restock-nonbulk-main',
        materialId: 'mat-1',
        materialBrandId: 'brand-abro',
        storeId: 'store-main',
        quantityAdded: 10,
      });

      const res = await StorageService.restock('mat-1', {
        quantityAdded: 10,
        unitCost: 150,
        materialBrandId: 'brand-abro',
        storeType: StoreType.MAIN,
      }, 'user-1');

      expect(prisma.store.findUnique).toHaveBeenCalledWith({ where: { type: StoreType.MAIN } });
      expect(prisma.restock.create).toHaveBeenCalledWith(expect.objectContaining({
        data: expect.objectContaining({
          storeId: 'store-main',
          quantityAdded: 10,
        }),
      }));
      expect(res.id).toBe('restock-nonbulk-main');
    });

    it('allows restocking into Mini Store when storeType MINI is specified', async () => {
      const nonBulkMaterial = { ...mockMaterial, isBulkTracked: false };
      (prisma.material.findFirst as jest.Mock).mockResolvedValue(nonBulkMaterial);
      (prisma.store.findUnique as jest.Mock).mockResolvedValue(mockMiniStore);
      (prisma.materialBrandStock.findUnique as jest.Mock).mockResolvedValue(null);
      (prisma.materialStock.findUnique as jest.Mock).mockResolvedValue(null);
      (prisma.restock.create as jest.Mock).mockResolvedValue({
        id: 'restock-nonbulk-mini',
        materialId: 'mat-1',
        materialBrandId: 'brand-abro',
        storeId: 'store-mini',
        quantityAdded: 10,
      });

      const res = await StorageService.restock('mat-1', {
        quantityAdded: 10,
        unitCost: 150,
        materialBrandId: 'brand-abro',
        storeType: StoreType.MINI,
      }, 'user-1');

      expect(prisma.store.findUnique).toHaveBeenCalledWith({ where: { type: StoreType.MINI } });
      expect(prisma.restock.create).toHaveBeenCalledWith(expect.objectContaining({
        data: expect.objectContaining({
          storeId: 'store-mini',
          quantityAdded: 10,
        }),
      }));
      expect(res.id).toBe('restock-nonbulk-mini');
    });
  });

  describe('storeTransfer with brand', () => {
    it('transfers chosen brand stock from Main Store to Mini Store', async () => {
      (prisma.store.findUnique as jest.Mock).mockImplementation(({ where }) => {
        if (where.type === StoreType.MAIN) return Promise.resolve(mockMainStore);
        if (where.type === StoreType.MINI) return Promise.resolve(mockMiniStore);
        return Promise.resolve(null);
      });
      (prisma.material.findFirst as jest.Mock).mockResolvedValue(mockMaterial);

      // Main store has 20 Abro
      (prisma.materialBrandStock.findUnique as jest.Mock).mockImplementation(({ where }) => {
        if (where.materialBrandId_storeId.storeId === 'store-main') {
          return Promise.resolve({ quantity: new Decimal(20) });
        }
        return Promise.resolve({ quantity: new Decimal(5) });
      });

      // Brands are fully allocated in main store (20 + 30 = 50)
      (prisma.materialBrandStock.findMany as jest.Mock).mockResolvedValue([
        { materialBrandId: 'brand-abro', quantity: new Decimal(20) },
        { materialBrandId: 'brand-flam', quantity: new Decimal(30) },
      ]);

      (prisma.materialStock.findUnique as jest.Mock).mockImplementation(({ where }) => {
        if (where.materialId_storeId.storeId === 'store-main') {
          return Promise.resolve({ quantity: new Decimal(50) });
        }
        return Promise.resolve({ quantity: new Decimal(10) });
      });

      (prisma.storeTransfer.create as jest.Mock).mockResolvedValue({
        id: 'transfer-1',
        materialId: 'mat-1',
        materialBrandId: 'brand-abro',
        brandName: 'Abro',
        fromStoreId: 'store-main',
        toStoreId: 'store-mini',
        quantityTransferred: 5,
      });

      const res = await StorageService.storeTransfer({
        materialId: 'mat-1',
        materialBrandId: 'brand-abro',
        direction: 'MAIN_TO_MINI',
        quantityTransferred: 5,
      }, 'user-1');

      expect(prisma.storeTransfer.create).toHaveBeenCalledWith(expect.objectContaining({
        data: expect.objectContaining({
          materialBrandId: 'brand-abro',
          brandName: 'Abro',
          quantityTransferred: 5,
        }),
      }));

      // Main store deduction for brand (20 - 5 = 15)
      expect(prisma.materialBrandStock.upsert).toHaveBeenCalledWith(expect.objectContaining({
        where: { materialBrandId_storeId: { materialBrandId: 'brand-abro', storeId: 'store-main' } },
        update: { quantity: 15 },
      }));

      // Mini store addition for brand (5 + 5 = 10)
      expect(prisma.materialBrandStock.upsert).toHaveBeenCalledWith(expect.objectContaining({
        where: { materialBrandId_storeId: { materialBrandId: 'brand-abro', storeId: 'store-mini' } },
        update: { quantity: 10 },
      }));

      expect(res.id).toBe('transfer-1');
    });

    it('rejects transfer when chosen brand has insufficient stock in source store', async () => {
      (prisma.store.findUnique as jest.Mock).mockImplementation(({ where }) => {
        if (where.type === StoreType.MAIN) return Promise.resolve(mockMainStore);
        if (where.type === StoreType.MINI) return Promise.resolve(mockMiniStore);
        return Promise.resolve(null);
      });
      (prisma.material.findFirst as jest.Mock).mockResolvedValue(mockMaterial);

      // Main store has only 3 Abro
      (prisma.materialBrandStock.findUnique as jest.Mock).mockResolvedValue({
        quantity: new Decimal(3),
      });

      // Fully allocated (3 + 47 = 50)
      (prisma.materialStock.findUnique as jest.Mock).mockResolvedValue({
        quantity: new Decimal(50),
      });
      (prisma.materialBrandStock.findMany as jest.Mock).mockResolvedValue([
        { materialBrandId: 'brand-abro', quantity: new Decimal(3) },
        { materialBrandId: 'brand-flam', quantity: new Decimal(47) },
      ]);

      await expect(
        StorageService.storeTransfer({
          materialId: 'mat-1',
          materialBrandId: 'brand-abro',
          direction: 'MAIN_TO_MINI',
          quantityTransferred: 10,
        }, 'user-1')
      ).rejects.toThrow('Insufficient stock for brand "Abro" in Main Store');
    });

    it('rejects transfer when branded material has unallocated stock in source store', async () => {
      (prisma.store.findUnique as jest.Mock).mockImplementation(({ where }) => {
        if (where.type === StoreType.MAIN) return Promise.resolve(mockMainStore);
        if (where.type === StoreType.MINI) return Promise.resolve(mockMiniStore);
        return Promise.resolve(null);
      });
      (prisma.material.findFirst as jest.Mock).mockResolvedValue(mockMaterial);

      // Main store has 50 total stock, but brand stocks sum to only 20 (30 unallocated)
      (prisma.materialStock.findUnique as jest.Mock).mockResolvedValue({
        quantity: new Decimal(50),
      });
      (prisma.materialBrandStock.findMany as jest.Mock).mockResolvedValue([
        { materialBrandId: 'brand-abro', quantity: new Decimal(20) },
      ]);

      await expect(
        StorageService.storeTransfer({
          materialId: 'mat-1',
          materialBrandId: 'brand-abro',
          direction: 'MAIN_TO_MINI',
          quantityTransferred: 5,
        }, 'user-1')
      ).rejects.toThrow(/Cannot transfer material "Polish". It has 30 unallocated/);
    });
  });

  describe('adjustStock with brand', () => {
    it('adjusts brand quantity and records adjustment with brand info', async () => {
      (prisma.material.findFirst as jest.Mock).mockResolvedValue(mockMaterial);
      (prisma.materialBrandStock.findUnique as jest.Mock).mockResolvedValue({
        quantity: new Decimal(10),
      });
      (prisma.materialStock.findUnique as jest.Mock).mockResolvedValue({
        quantity: new Decimal(25),
      });
      (prisma.stockAdjustment.create as jest.Mock).mockResolvedValue({
        id: 'adj-1',
        materialBrandId: 'brand-abro',
        brandName: 'Abro',
        quantityDelta: -2,
      });

      const res = await StorageService.adjustStock('mat-1', {
        storeId: 'store-mini',
        materialBrandId: 'brand-abro',
        quantityDelta: -2,
        reason: 'DAMAGE',
        notes: 'Broken bottle',
      }, 'user-1');

      expect(prisma.stockAdjustment.create).toHaveBeenCalledWith(expect.objectContaining({
        data: expect.objectContaining({
          materialBrandId: 'brand-abro',
          brandName: 'Abro',
          quantityDelta: -2,
        }),
      }));

      // Brand stock updated: 10 - 2 = 8
      expect(prisma.materialBrandStock.upsert).toHaveBeenCalledWith(expect.objectContaining({
        where: { materialBrandId_storeId: { materialBrandId: 'brand-abro', storeId: 'store-mini' } },
        update: { quantity: 8 },
      }));

      expect(res.id).toBe('adj-1');
    });
  });

  describe('stockCount with brand', () => {
    it('replaces system brand stock with physical count and updates aggregate stock', async () => {
      (prisma.material.findFirst as jest.Mock).mockResolvedValue(mockMaterial);
      // System had 12 Abro in Mini Store
      (prisma.materialBrandStock.findUnique as jest.Mock).mockResolvedValue({
        quantity: new Decimal(12),
      });
      // System had 30 total in Mini Store
      (prisma.materialStock.findUnique as jest.Mock).mockResolvedValue({
        quantity: new Decimal(30),
      });
      (prisma.stockCount.create as jest.Mock).mockResolvedValue({
        id: 'count-1',
        systemQuantity: 12,
        countedQuantity: 10,
        discrepancy: -2,
      });

      const res = await StorageService.stockCount({
        materialId: 'mat-1',
        materialBrandId: 'brand-abro',
        storeId: 'store-mini',
        countedQuantity: 10,
        notes: 'Monthly physical audit',
      }, 'user-1');

      // Brand stock set to counted quantity 10
      expect(prisma.materialBrandStock.upsert).toHaveBeenCalledWith(expect.objectContaining({
        where: { materialBrandId_storeId: { materialBrandId: 'brand-abro', storeId: 'store-mini' } },
        update: { quantity: 10 },
      }));

      // Aggregate stock adjusted by discrepancy (-2): 30 - 2 = 28
      expect(prisma.materialStock.upsert).toHaveBeenCalledWith(expect.objectContaining({
        where: { materialId_storeId: { materialId: 'mat-1', storeId: 'store-mini' } },
        update: { quantity: 28 },
      }));

      expect(prisma.stockCount.create).toHaveBeenCalledWith(expect.objectContaining({
        data: expect.objectContaining({
          materialBrandId: 'brand-abro',
          brandName: 'Abro',
          systemQuantityAtCount: 12,
          countedQuantity: 10,
          discrepancy: -2,
        }),
      }));

      expect(res.id).toBe('count-1');
    });
  });

  describe('allocateBrandStock', () => {
    it('allocates unassigned stock across brands and sets total material stock', async () => {
      (prisma.material.findFirst as jest.Mock).mockResolvedValue(mockMaterial);
      (prisma.store.findUnique as jest.Mock).mockResolvedValue(mockMainStore);
      (prisma.materialBrandStock.findMany as jest.Mock).mockResolvedValue([]);
      (prisma.materialStock.findUnique as jest.Mock).mockResolvedValue({
        quantity: new Decimal(100),
      });

      const res = await StorageService.allocateBrandStock('mat-1', {
        storeType: 'MAIN',
        allocations: [
          { materialBrandId: 'brand-abro', quantity: 60 },
          { materialBrandId: 'brand-flam', quantity: 40 },
        ],
        notes: 'Initial distribution of existing 100 stock',
      }, 'user-1');

      expect(prisma.materialBrandStock.upsert).toHaveBeenCalledWith(expect.objectContaining({
        where: { materialBrandId_storeId: { materialBrandId: 'brand-abro', storeId: 'store-main' } },
        update: { quantity: 60 },
        create: { materialBrandId: 'brand-abro', storeId: 'store-main', quantity: 60 },
      }));

      expect(prisma.materialBrandStock.upsert).toHaveBeenCalledWith(expect.objectContaining({
        where: { materialBrandId_storeId: { materialBrandId: 'brand-flam', storeId: 'store-main' } },
        update: { quantity: 40 },
        create: { materialBrandId: 'brand-flam', storeId: 'store-main', quantity: 40 },
      }));

      expect(prisma.materialStock.upsert).toHaveBeenCalledWith(expect.objectContaining({
        where: { materialId_storeId: { materialId: 'mat-1', storeId: 'store-main' } },
        update: { quantity: 100 },
        create: { materialId: 'mat-1', storeId: 'store-main', quantity: 100 },
      }));

      expect(prisma.stockAdjustment.create).toHaveBeenCalledWith(expect.objectContaining({
        data: expect.objectContaining({
          materialId: 'mat-1',
          storeId: 'store-main',
          quantityDelta: 0,
          notes: expect.stringContaining('Brand stock allocation: Abro: 60, Flamingo: 40'),
        }),
      }));

      expect(res.totalQuantity).toBe(100);
      expect(res.allocations).toHaveLength(2);
    });

    it('rejects decimal allocation when material unit is PCS', async () => {
      (prisma.material.findFirst as jest.Mock).mockResolvedValue({
        ...mockMaterial,
        unit: 'PCS',
      });
      (prisma.store.findUnique as jest.Mock).mockResolvedValue(mockMainStore);

      await expect(
        StorageService.allocateBrandStock('mat-1', {
          storeType: 'MAIN',
          allocations: [
            { materialBrandId: 'brand-abro', quantity: 4.5 },
            { materialBrandId: 'brand-flam', quantity: 5.5 },
          ],
        }, 'user-1')
      ).rejects.toThrow(/Allocation quantity for items measured in PCS must be a whole number/);
    });

    it('allows decimal allocation when material unit is METERS or LITERS', async () => {
      (prisma.material.findFirst as jest.Mock).mockResolvedValue({
        ...mockMaterial,
        unit: 'METERS',
      });
      (prisma.store.findUnique as jest.Mock).mockResolvedValue(mockMainStore);
      (prisma.materialBrandStock.findMany as jest.Mock).mockResolvedValue([]);
      (prisma.materialStock.findUnique as jest.Mock).mockResolvedValue({
        id: 'ms-1',
        materialId: 'mat-1',
        storeId: 'store-main',
        quantity: new Decimal(10),
      });

      const res = await StorageService.allocateBrandStock('mat-1', {
        storeType: 'MAIN',
        allocations: [
          { materialBrandId: 'brand-abro', quantity: 4.5 },
          { materialBrandId: 'brand-flam', quantity: 5.5 },
        ],
      }, 'user-1');

      expect(res.totalQuantity).toBe(10);
    });
  });

  describe('unit-based decimal validation on restock', () => {
    it('rejects fractional quantity for PCS restock (e.g. 4.5)', async () => {
      (prisma.material.findFirst as jest.Mock).mockResolvedValue({
        ...mockMaterial,
        unit: 'PCS',
      });
      (prisma.store.findUnique as jest.Mock).mockResolvedValue(mockMainStore);

      await expect(
        StorageService.restock('mat-1', {
          quantityAdded: 4.5,
          materialBrandId: 'brand-abro',
        }, 'user-1')
      ).rejects.toThrow(/Quantity added for items measured in PCS must be a whole number/);
    });

    it('allows fractional quantity for METERS or LITERS restock (e.g. 4.5)', async () => {
      (prisma.material.findFirst as jest.Mock).mockResolvedValue({
        ...mockMaterial,
        unit: 'METERS',
      });
      (prisma.store.findUnique as jest.Mock).mockResolvedValue(mockMainStore);
      (prisma.restock.create as jest.Mock).mockResolvedValue({ id: 'r-1', quantityAdded: 4.5 });
      (prisma.materialBrandStock.findUnique as jest.Mock).mockResolvedValue(null);
      (prisma.materialStock.findUnique as jest.Mock).mockResolvedValue(null);

      const res = await StorageService.restock('mat-1', {
        quantityAdded: 4.5,
        materialBrandId: 'brand-abro',
      }, 'user-1');

      expect(res).toBeDefined();
    });
  });
});
