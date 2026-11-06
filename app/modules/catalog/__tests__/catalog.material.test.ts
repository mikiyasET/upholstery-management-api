import { CatalogService } from '../catalog.service';
import prisma from '../../../lib/prisma';
import { AuditService } from '../../../lib/audit';
import { Unit } from '@prisma/client';

jest.mock('../../../lib/prisma', () => {
  const mMaterial = {
    findMany: jest.fn(),
    findUnique: jest.fn(),
    findFirst: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    count: jest.fn(),
  };
  const mMaterialBrand = {
    create: jest.fn(),
    update: jest.fn(),
    deleteMany: jest.fn(),
  };
  const mPriceHistory = {
    create: jest.fn(),
  };
  return {
    __esModule: true,
    default: {
      material: mMaterial,
      materialBrand: mMaterialBrand,
      priceHistory: mPriceHistory,
      $transaction: jest.fn((cb: any) => cb({
        material: mMaterial,
        materialBrand: mMaterialBrand,
        priceHistory: mPriceHistory,
      })),
    },
  };
});

jest.mock('../../../lib/audit', () => ({
  AuditService: {
    record: jest.fn(),
  },
}));

describe('CatalogService - Material itemCode, brands, and fetching', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('createMaterial', () => {
    it('creates material with custom modifiable itemCode if provided', async () => {
      (prisma.material.findUnique as jest.Mock).mockResolvedValue(null);
      (prisma.material.create as jest.Mock).mockResolvedValue({
        id: 'mat-1',
        itemCode: 'CUSTOM-001',
        nameEn: 'Tint Film',
        nameAm: 'ቲንት',
        unit: Unit.PCS,
        lowStockThreshold: 10,
        currentPrice: 200,
      });

      const result = await CatalogService.createMaterial(
        {
          itemCode: 'CUSTOM-001',
          nameEn: 'Tint Film',
          nameAm: 'ቲንት',
          unit: Unit.PCS,
          lowStockThreshold: 10,
          currentPrice: 200,
        },
        'user-1'
      );

      expect(prisma.material.findUnique).toHaveBeenCalledWith({ where: { itemCode: 'CUSTOM-001' } });
      expect(prisma.material.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          itemCode: 'CUSTOM-001',
          nameEn: 'Tint Film',
          nameAm: 'ቲንት',
          unit: Unit.PCS,
          lowStockThreshold: 10,
          currentPrice: 200,
        }),
      });
      expect(result.itemCode).toBe('CUSTOM-001');
    });

    it('creates material with multiple brands and prices', async () => {
      (prisma.material.findUnique as jest.Mock).mockResolvedValue(null);
      (prisma.material.create as jest.Mock).mockResolvedValue({
        id: 'mat-polish',
        itemCode: 'MAT-0001',
        nameEn: 'Polish',
        nameAm: 'ፖሊሽ',
        unit: Unit.PCS,
        lowStockThreshold: 5,
        currentPrice: 500,
      });

      const result = await CatalogService.createMaterial(
        {
          itemCode: 'MAT-0001',
          nameEn: 'Polish',
          nameAm: 'ፖሊሽ',
          unit: Unit.PCS,
          lowStockThreshold: 5,
          brands: [
            { name: 'Abro', price: 500 },
            { name: 'Flamingo', price: 800 },
          ],
        },
        'user-1'
      );

      expect((prisma as any).materialBrand.create).toHaveBeenCalledTimes(2);
      expect((prisma as any).materialBrand.create).toHaveBeenCalledWith({
        data: {
          materialId: 'mat-polish',
          name: 'Abro',
          size: null,
          color: null,
          type: null,
          price: 500,
        },
      });
      expect((prisma as any).materialBrand.create).toHaveBeenCalledWith({
        data: {
          materialId: 'mat-polish',
          name: 'Flamingo',
          size: null,
          color: null,
          type: null,
          price: 800,
        },
      });
      expect(result.id).toBe('mat-polish');
    });

    it('creates material with brands and specific sizes', async () => {
      const result = await CatalogService.createMaterial(
        {
          nameEn: 'Car Polish Spray',
          nameAm: 'ፖሊሽ ስፕሬይ',
          unit: 'PCS',
          lowStockThreshold: 10,
          brands: [
            { name: 'Abro', size: '200ml', price: 250 },
            { name: 'Abro', size: '500ml', price: 500 },
          ],
        },
        'user-1'
      );

      expect((prisma as any).materialBrand.create).toHaveBeenCalledWith({
        data: {
          materialId: 'mat-polish',
          name: 'Abro',
          size: '200ml',
          color: null,
          type: null,
          price: 250,
        },
      });
      expect((prisma as any).materialBrand.create).toHaveBeenCalledWith({
        data: {
          materialId: 'mat-polish',
          name: 'Abro',
          size: '500ml',
          color: null,
          type: null,
          price: 500,
        },
      });
      expect(result.id).toBe('mat-polish');
    });

    it('auto-generates itemCode if omitted or empty', async () => {
      (prisma.material.count as jest.Mock).mockResolvedValue(5);
      (prisma.material.findUnique as jest.Mock).mockResolvedValue(null);
      (prisma.material.create as jest.Mock).mockResolvedValue({
        id: 'mat-2',
        itemCode: 'MAT-0006',
        nameEn: 'Seat Cover',
        nameAm: 'ኮቨር',
        unit: Unit.PCS,
        lowStockThreshold: 5,
        currentPrice: 150,
      });

      const result = await CatalogService.createMaterial(
        {
          nameEn: 'Seat Cover',
          nameAm: 'ኮቨር',
          unit: Unit.PCS,
          lowStockThreshold: 5,
          currentPrice: 150,
        },
        'user-1'
      );

      expect(prisma.material.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          itemCode: 'MAT-0006',
          nameEn: 'Seat Cover',
        }),
      });
      expect(result.itemCode).toBe('MAT-0006');
    });
  });

  describe('updateMaterial', () => {
    it('modifies itemCode when a unique new code is provided', async () => {
      (prisma.material.findFirst as jest.Mock).mockResolvedValueOnce({
        id: 'mat-1',
        itemCode: 'OLD-001',
        nameEn: 'Tint Film',
        nameAm: 'ቲንት',
        unit: Unit.PCS,
        lowStockThreshold: 10,
        currentPrice: 200,
      });
      (prisma.material.findFirst as jest.Mock).mockResolvedValueOnce(null);
      (prisma.material.update as jest.Mock).mockResolvedValue({
        id: 'mat-1',
        itemCode: 'NEW-001',
        nameEn: 'Tint Film',
        nameAm: 'ቲንት',
        unit: Unit.PCS,
        lowStockThreshold: 10,
        currentPrice: 250,
      });

      const result = await CatalogService.updateMaterial(
        'mat-1',
        {
          itemCode: 'NEW-001',
          currentPrice: 250,
        },
        'user-1'
      );

      expect(prisma.material.update).toHaveBeenCalledWith({
        where: { id: 'mat-1' },
        data: expect.objectContaining({
          itemCode: 'NEW-001',
          currentPrice: 250,
        }),
      });
      expect(result.itemCode).toBe('NEW-001');
    });

    it('syncs brands when brands are updated', async () => {
      (prisma.material.findFirst as jest.Mock).mockResolvedValueOnce({
        id: 'mat-1',
        itemCode: 'OLD-001',
        nameEn: 'Polish',
        brands: [
          { id: 'b-abro', name: 'Abro', price: 500 },
          { id: 'b-old', name: 'OldBrand', price: 400 },
        ],
      });
      (prisma.material.update as jest.Mock).mockResolvedValue({
        id: 'mat-1',
        itemCode: 'OLD-001',
        nameEn: 'Polish',
      });

      await CatalogService.updateMaterial(
        'mat-1',
        {
          brands: [
            { name: 'Abro', price: 550 },
            { name: 'Haminga', price: 650 },
          ],
        },
        'user-1'
      );

      expect((prisma as any).materialBrand.deleteMany).toHaveBeenCalledWith({
        where: { id: { in: ['b-old'] } },
      });
      expect((prisma as any).materialBrand.update).toHaveBeenCalledWith({
        where: { id: 'b-abro' },
        data: { name: 'Abro', size: null, color: null, type: null, price: 550 },
      });
      expect((prisma as any).materialBrand.create).toHaveBeenCalledWith({
        data: { materialId: 'mat-1', name: 'Haminga', size: null, color: null, type: null, price: 650 },
      });
    });

    it('rejects updating to an itemCode already used by another material', async () => {
      (prisma.material.findFirst as jest.Mock).mockResolvedValueOnce({
        id: 'mat-1',
        itemCode: 'OLD-001',
        nameEn: 'Tint Film',
      });
      (prisma.material.findFirst as jest.Mock).mockResolvedValueOnce({
        id: 'mat-2',
        itemCode: 'TAKEN-001',
      });

      await expect(
        CatalogService.updateMaterial(
          'mat-1',
          { itemCode: 'TAKEN-001' },
          'user-1'
        )
      ).rejects.toThrow('Item code "TAKEN-001" is already in use by another material');
    });
  });

  describe('getMaterial and alternative fetching', () => {
    it('fetches material using id or itemCode in getMaterial', async () => {
      (prisma.material.findFirst as jest.Mock).mockResolvedValue({
        id: 'cmv123',
        itemCode: 'MAT-0001',
        nameEn: 'Vinyl Wrap',
      });

      const byCode = await CatalogService.getMaterial('MAT-0001');
      expect(prisma.material.findFirst).toHaveBeenCalledWith({
        where: {
          OR: [
            { id: 'MAT-0001' },
            { itemCode: 'MAT-0001' },
          ],
        },
        include: {
          materialStocks: { include: { store: true } },
          brands: {
            include: {
              brandStocks: { include: { store: true } },
            },
            orderBy: { createdAt: 'asc' },
          },
        },
      });
      expect(byCode?.itemCode).toBe('MAT-0001');
    });

    it('fetches material explicitly using getMaterialByCode', async () => {
      (prisma.material.findUnique as jest.Mock).mockResolvedValue({
        id: 'cmv123',
        itemCode: 'MAT-0002',
        nameEn: 'Floor Mat',
      });

      const result = await CatalogService.getMaterialByCode('MAT-0002');
      expect(prisma.material.findUnique).toHaveBeenCalledWith({
        where: { itemCode: 'MAT-0002' },
        include: {
          materialStocks: { include: { store: true } },
          brands: {
            include: {
              brandStocks: { include: { store: true } },
            },
            orderBy: { createdAt: 'asc' },
          },
        },
      });
      expect(result?.nameEn).toBe('Floor Mat');
    });

    it('filters getMaterials list by itemCode or search query', async () => {
      (prisma.material.findMany as jest.Mock).mockResolvedValue([
        { id: 'mat-1', itemCode: 'MAT-0001', nameEn: 'Leather' },
      ]);

      await CatalogService.getMaterials({ itemCode: 'MAT-0001' });
      expect(prisma.material.findMany).toHaveBeenCalledWith({
        where: { isActive: true, itemCode: 'MAT-0001' },
        include: {
          materialStocks: { include: { store: true } },
          brands: {
            include: {
              brandStocks: { include: { store: true } },
            },
            orderBy: { createdAt: 'asc' },
          },
        },
        orderBy: { createdAt: 'desc' },
      });

      await CatalogService.getMaterials({ search: 'MAT' });
      expect(prisma.material.findMany).toHaveBeenCalledWith({
        where: {
          isActive: true,
          OR: [
            { nameEn: { contains: 'MAT', mode: 'insensitive' } },
            { nameAm: { contains: 'MAT' } },
            { itemCode: { contains: 'MAT', mode: 'insensitive' } },
          ],
        },
        include: {
          materialStocks: { include: { store: true } },
          brands: {
            include: {
              brandStocks: { include: { store: true } },
            },
            orderBy: { createdAt: 'asc' },
          },
        },
        orderBy: { createdAt: 'desc' },
      });
    });
  });
});
