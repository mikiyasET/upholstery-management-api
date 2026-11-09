import { DirectSalesService } from '../direct-sales.service';
import prisma from '../../../lib/prisma';
import { CustomersVehiclesService } from '../../customers-vehicles/customers-vehicles.service';
import { AuditService } from '../../../lib/audit';
import { StoreType } from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';

jest.mock('../../../lib/prisma', () => ({
  $transaction: jest.fn((callback) => callback(prisma)),
  store: {
    findUnique: jest.fn(),
  },
  material: {
    findFirst: jest.fn(),
    findUnique: jest.fn(),
  },
  materialStock: {
    findUnique: jest.fn(),
    update: jest.fn(),
    upsert: jest.fn(),
  },
  materialBrand: {
    findUnique: jest.fn(),
  },
  materialBrandStock: {
    findUnique: jest.fn(),
    findMany: jest.fn().mockResolvedValue([]),
    upsert: jest.fn(),
  },
  directSale: {
    create: jest.fn(),
    findFirst: jest.fn(),
    findUnique: jest.fn(),
    findMany: jest.fn(),
    update: jest.fn(),
  },
  directSaleLine: {
    create: jest.fn(),
    deleteMany: jest.fn(),
  },
  directSalePayment: {
    create: jest.fn(),
    deleteMany: jest.fn(),
  },
}));

jest.mock('../../customers-vehicles/customers-vehicles.service', () => ({
  CustomersVehiclesService: {
    resolveCustomerAndVehicle: jest.fn().mockResolvedValue({ customer: { id: 'cust-1', name: 'John Doe' }, vehicle: null }),
    searchCustomerByPhone: jest.fn().mockResolvedValue({ id: 'cust-1', name: 'John Doe' }),
  },
}));

jest.mock('../../../lib/audit', () => ({
  AuditService: {
    record: jest.fn(),
  },
}));

jest.mock('../../reports/daily-stats.service', () => ({
  DailyStatsService: {
    recordDirectSale: jest.fn().mockResolvedValue(undefined),
    syncStatsForDate: jest.fn().mockResolvedValue(undefined),
    formatDateKey: jest.fn().mockReturnValue('2026-11-09'),
  },
}));

describe('DirectSalesService - fsrNumber', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should store trimmed fsrNumber when provided on createDirectSale', async () => {
    (prisma.store.findUnique as jest.Mock).mockResolvedValue({
      id: 'mini-store-1',
      type: StoreType.MINI,
    });
    (prisma.material.findFirst as jest.Mock).mockResolvedValue({
      id: 'mat-1',
      nameEn: 'Floor Mats',
      unit: 'PIECES',
    });
    (prisma.materialStock.findUnique as jest.Mock).mockResolvedValue({
      quantity: new Decimal(10),
    });
    (prisma.directSale.create as jest.Mock).mockResolvedValue({
      id: 'sale-1',
      saleNumber: 'DS-123456',
      fsrNumber: 'FSR-DS-001',
      lines: [],
    });
    (prisma.directSale.findUnique as jest.Mock).mockResolvedValue({
      id: 'sale-1',
      saleNumber: 'DS-123456',
      fsrNumber: 'FSR-DS-001',
      lines: [],
      payments: [],
    });

    const saleData = {
      customerName: 'Dawit',
      customerPhone: '0912345678',
      fsrNumber: '   FSR-DS-001   ',
      items: [
        {
          materialId: 'mat-1',
          quantity: 2,
          unitPrice: 500,
          discount: 0,
        },
      ],
      additionalDiscount: 0,
      taxEnabled: false,
      taxRate: 0.15,
      payments: [
        {
          method: 'CASH',
          amount: 1000,
        },
      ],
    };

    const result = await DirectSalesService.createDirectSale(saleData, 'user-1');

    expect(prisma.directSale.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          fsrNumber: 'FSR-DS-001',
        }),
      })
    );
    expect(result!.fsrNumber).toBe('FSR-DS-001');
  });

  it('should store null for fsrNumber when omitted on createDirectSale', async () => {
    (prisma.store.findUnique as jest.Mock).mockResolvedValue({
      id: 'mini-store-1',
      type: StoreType.MINI,
    });
    (prisma.material.findFirst as jest.Mock).mockResolvedValue({
      id: 'mat-1',
      nameEn: 'Floor Mats',
      unit: 'PIECES',
    });
    (prisma.materialStock.findUnique as jest.Mock).mockResolvedValue({
      quantity: new Decimal(10),
    });
    (prisma.directSale.create as jest.Mock).mockResolvedValue({
      id: 'sale-2',
      saleNumber: 'DS-654321',
      fsrNumber: null,
      lines: [],
    });
    (prisma.directSale.findUnique as jest.Mock).mockResolvedValue({
      id: 'sale-2',
      saleNumber: 'DS-654321',
      fsrNumber: null,
      lines: [],
      payments: [],
    });

    const saleData = {
      items: [
        {
          materialId: 'mat-1',
          quantity: 1,
          unitPrice: 500,
          discount: 0,
        },
      ],
      additionalDiscount: 0,
      taxEnabled: false,
      taxRate: 0.15,
      payments: [
        {
          method: 'CASH',
          amount: 500,
        },
      ],
    };

    const result = await DirectSalesService.createDirectSale(saleData, 'user-1');

    expect(prisma.directSale.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          fsrNumber: null,
        }),
      })
    );
    expect(result!.fsrNumber).toBeNull();
  });

  it('should search direct sales by fsrNumber in getDirectSales', async () => {
    (prisma.directSale.findMany as jest.Mock).mockResolvedValue([
      { id: 'sale-1', saleNumber: 'DS-100', fsrNumber: 'FSR-888' },
    ]);

    await DirectSalesService.getDirectSales({ search: 'FSR-888' });

    expect(prisma.directSale.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          OR: expect.arrayContaining([
            { fsrNumber: { contains: 'FSR-888', mode: 'insensitive' } },
          ]),
        }),
      })
    );
  });

  it('should retrieve direct sale by fsrNumber in getDirectSale', async () => {
    (prisma.directSale.findFirst as jest.Mock).mockResolvedValue({
      id: 'sale-1',
      saleNumber: 'DS-100',
      fsrNumber: 'FSR-777',
      lines: [],
      payments: [],
    });

    const result = await DirectSalesService.getDirectSale('FSR-777');

    expect(prisma.directSale.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          OR: [
            { id: 'FSR-777' },
            { saleNumber: 'FSR-777' },
            { fsrNumber: 'FSR-777' },
          ],
        },
      })
    );
    expect(result?.fsrNumber).toBe('FSR-777');
  });

  it('should update fsrNumber on direct sale and record audit', async () => {
    (prisma.directSale.findFirst as jest.Mock).mockResolvedValue({
      id: 'sale-1',
      saleNumber: 'DS-100',
      fsrNumber: null,
    });
    (prisma.directSale.update as jest.Mock).mockResolvedValue({
      id: 'sale-1',
      saleNumber: 'DS-100',
      fsrNumber: 'FSR-555',
      lines: [],
      payments: [],
    });

    const result = await DirectSalesService.updateFsrNumber('sale-1', '  FSR-555  ', 'user-1');

    expect(prisma.directSale.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'sale-1' },
        data: { fsrNumber: 'FSR-555' },
      })
    );
    expect(AuditService.record).toHaveBeenCalledWith(
      'DirectSale',
      'sale-1',
      'UPDATE',
      'user-1',
      { fsrNumber: null },
      { fsrNumber: 'FSR-555' }
    );
    expect(result.fsrNumber).toBe('FSR-555');
  });

  it('should link customerId when customer phone is provided on createDirectSale', async () => {
    (prisma.store.findUnique as jest.Mock).mockResolvedValue({ id: 'mini-1', type: StoreType.MINI });
    (prisma.material.findFirst as jest.Mock).mockResolvedValue({
      id: 'mat-1',
      nameEn: 'Tint Film',
      unit: 'PIECES',
    });
    (prisma.materialStock.findUnique as jest.Mock).mockResolvedValue({
      quantity: new Decimal(10),
    });
    (prisma.materialStock.update as jest.Mock).mockResolvedValue({});
    (prisma.directSale.create as jest.Mock).mockResolvedValue({
      id: 'sale-1',
      saleNumber: 'DS-200',
      customerId: 'cust-1',
      customerName: 'John Doe',
      customerPhone: '0911000000',
      lines: [],
      payments: [],
    });

    await DirectSalesService.createDirectSale({
      customerName: 'John Doe',
      customerPhone: '0911000000',
      items: [{ materialId: 'mat-1', quantity: 1, unitPrice: 100, discount: 0 }],
      payments: [{ amount: 100, method: 'CASH' }],
      additionalDiscount: 0,
      taxEnabled: false,
      taxRate: 0.15,
    }, 'user-1');

    expect(prisma.directSale.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          customerId: 'cust-1',
          customerName: 'John Doe',
          customerPhone: '0911000000',
        }),
      })
    );
  });
});
