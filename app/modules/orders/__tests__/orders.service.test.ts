import { OrdersService } from '../orders.service';
import prisma from '../../../lib/prisma';
import { CustomersVehiclesService } from '../../customers-vehicles/customers-vehicles.service';
import { AuditService } from '../../../lib/audit';
import { StoreType, OrderStatus } from '@prisma/client';

jest.mock('../../../lib/prisma', () => ({
  $transaction: jest.fn((callback) => callback(prisma)),
  store: {
    findUnique: jest.fn(),
  },
  material: {
    findUnique: jest.fn(),
    findFirst: jest.fn(),
  },
  materialStock: {
    findUnique: jest.fn(),
    update: jest.fn(),
    upsert: jest.fn(),
  },
  materialBrandStock: {
    findUnique: jest.fn(),
    findMany: jest.fn().mockResolvedValue([]),
    upsert: jest.fn(),
  },
  serviceCategory: {
    findUnique: jest.fn(),
  },
  dailyStats: {
    upsert: jest.fn(),
  },
  order: {
    create: jest.fn(),
    findFirst: jest.fn(),
    findUnique: jest.fn(),
    findMany: jest.fn(),
    update: jest.fn(),
  },
  orderServiceLine: {
    findUnique: jest.fn(),
    update: jest.fn(),
    create: jest.fn(),
    delete: jest.fn(),
  },
  orderStandaloneItemLine: {
    findUnique: jest.fn(),
    update: jest.fn(),
    create: jest.fn(),
    delete: jest.fn(),
  },
  orderServiceMaterialDeduction: {
    create: jest.fn(),
  },
}));

jest.mock('../../customers-vehicles/customers-vehicles.service', () => ({
  CustomersVehiclesService: {
    resolveCustomerAndVehicle: jest.fn(),
  },
}));

jest.mock('../../../lib/audit', () => ({
  AuditService: {
    record: jest.fn(),
  },
}));

describe('OrdersService - createOrder stock validation', () => {
  beforeEach(() => {
    jest.clearAllMocks();

    (CustomersVehiclesService.resolveCustomerAndVehicle as jest.Mock).mockResolvedValue({
      customer: { id: 'cust-1' },
      vehicle: { id: 'veh-1' },
    });

    (prisma.store.findUnique as jest.Mock).mockResolvedValue({
      id: 'mini-store-1',
      type: StoreType.MINI,
    });
    
    (prisma.order.create as jest.Mock).mockResolvedValue({
      id: 'order-1',
      serviceLines: [{ id: 'sl-1' }],
      standaloneLines: [{ id: 'ml-1' }],
    });

    (prisma.dailyStats.upsert as jest.Mock).mockResolvedValue({});
    (prisma.material.findFirst as jest.Mock).mockImplementation((...args: any[]) => (prisma.material.findUnique as jest.Mock)(...args));
  });

  it('should throw an error if standalone material has insufficient stock', async () => {
    // Setup mock data where requested qty > available stock
    (prisma.material.findUnique as jest.Mock).mockResolvedValue({ nameEn: 'Leather' });
    (prisma.material.findFirst as jest.Mock).mockResolvedValue({ nameEn: 'Leather' });
    
    (prisma.materialStock.findUnique as jest.Mock).mockResolvedValue({
      quantity: { toNumber: () => 2 }, // Only 2 in stock
    });

    const orderData = {
      customerName: 'Test',
      customerPhone: '0911',
      plateNumber: 'A1234',
      serviceLines: [],
      standaloneLines: [
        { materialId: 'mat-1', quantity: 5, unitPrice: 100, discount: 0 },
      ],
      additionalDiscount: 0,
      taxRate: 0.15,
    };

    await expect(OrdersService.createOrder(orderData, 'user-1')).rejects.toThrow(
      'Insufficient stock:\nLeather: need 5, only 2 available'
    );
    
    // Ensure order was never created
    expect(prisma.order.create).not.toHaveBeenCalled();
  });

  it('should throw an error if a service category material usage has insufficient stock', async () => {
    // Service category that uses 4 units of Leather
    (prisma.serviceCategory.findUnique as jest.Mock).mockResolvedValue({
      id: 'cat-1',
      price: 1000,
      materialUsages: [
        {
          materialId: 'mat-1',
          quantityUsed: 4,
          material: { nameEn: 'Leather', currentPrice: 50 },
        },
      ],
    });

    (prisma.materialStock.findUnique as jest.Mock).mockResolvedValue({
      quantity: { toNumber: () => 1 }, // Only 1 in stock
    });

    const orderData = {
      customerName: 'Test',
      customerPhone: '0911',
      plateNumber: 'A1234',
      serviceLines: [
        { serviceCategoryId: 'cat-1', priceMultiplier: 1, discount: 0 },
      ],
      standaloneLines: [],
      additionalDiscount: 0,
      taxRate: 0.15,
    };

    await expect(OrdersService.createOrder(orderData, 'user-1')).rejects.toThrow(
      'Insufficient stock:\nLeather: need 4, only 1 available'
    );
    
    expect(prisma.order.create).not.toHaveBeenCalled();
  });

  it('should aggregate identical materials and throw if combined total exceeds stock', async () => {
    // Uses 3 units in service, plus 2 units standalone = 5 total needed
    (prisma.serviceCategory.findUnique as jest.Mock).mockResolvedValue({
      id: 'cat-1',
      price: 1000,
      materialUsages: [
        {
          materialId: 'mat-1', // Same material
          quantityUsed: 3,
          material: { nameEn: 'Leather', currentPrice: 50 },
        },
      ],
    });

    (prisma.material.findUnique as jest.Mock).mockResolvedValue({ nameEn: 'Leather' });

    (prisma.materialStock.findUnique as jest.Mock).mockResolvedValue({
      quantity: { toNumber: () => 4 }, // 4 in stock (less than 5 needed)
    });

    const orderData = {
      customerName: 'Test',
      customerPhone: '0911',
      plateNumber: 'A1234',
      serviceLines: [
        { serviceCategoryId: 'cat-1', priceMultiplier: 1, discount: 0 },
      ],
      standaloneLines: [
        { materialId: 'mat-1', quantity: 2, unitPrice: 100, discount: 0 },
      ],
      additionalDiscount: 0,
      taxRate: 0.15,
    };

    await expect(OrdersService.createOrder(orderData, 'user-1')).rejects.toThrow(
      'Insufficient stock:\nLeather: need 5, only 4 available'
    );
  });

  it('should create order and deduct stock if enough stock is available', async () => {
    (prisma.serviceCategory.findUnique as jest.Mock).mockResolvedValue({
      id: 'cat-1',
      price: 1000,
      materialUsages: [
        {
          materialId: 'mat-1',
          quantityUsed: 2,
          material: { nameEn: 'Leather', currentPrice: 50 },
        },
      ],
    });

    (prisma.material.findUnique as jest.Mock).mockResolvedValue({ nameEn: 'Plastic' });

    (prisma.materialStock.findUnique as jest.Mock).mockImplementation(({ where }) => {
      // 10 units of everything in stock
      return Promise.resolve({
        id: `stock-${where.materialId_storeId.materialId}`,
        quantity: { toNumber: () => 10 },
      });
    });

    const orderData = {
      customerName: 'Test',
      customerPhone: '0911',
      plateNumber: 'A1234',
      serviceLines: [
        { serviceCategoryId: 'cat-1', priceMultiplier: 1, discount: 0 },
      ],
      standaloneLines: [
        { materialId: 'mat-2', quantity: 3, unitPrice: 100, discount: 0 },
      ],
      additionalDiscount: 0,
      taxRate: 0.15,
    };

    const order = await OrdersService.createOrder(orderData, 'user-1');

    expect(order.id).toBe('order-1');
    expect(prisma.order.create).toHaveBeenCalled();
    
    // We expect stock to be deducted: once for service material usage, once for standalone line
    expect(prisma.materialStock.upsert).toHaveBeenCalledTimes(2);
    
    // Mat-1 (service): decrement by 2, from 10 to 8
    expect(prisma.materialStock.upsert).toHaveBeenCalledWith({
      where: { materialId_storeId: { materialId: 'mat-1', storeId: 'mini-store-1' } },
      update: { quantity: 8 },
      create: { materialId: 'mat-1', storeId: 'mini-store-1', quantity: 8 },
    });
    
    // Mat-2 (standalone): decrement by 3, from 10 to 7
    expect(prisma.materialStock.upsert).toHaveBeenCalledWith({
      where: { materialId_storeId: { materialId: 'mat-2', storeId: 'mini-store-1' } },
      update: { quantity: 7 },
      create: { materialId: 'mat-2', storeId: 'mini-store-1', quantity: 7 },
    });
  });
});

describe('OrdersService - FSR Number and Audit Lookups', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should store trimmed fsrNumber when provided on createOrder', async () => {
    (CustomersVehiclesService.resolveCustomerAndVehicle as jest.Mock).mockResolvedValue({
      customer: { id: 'cust-1' },
      vehicle: { id: 'veh-1' },
    });
    (prisma.store.findUnique as jest.Mock).mockResolvedValue({
      id: 'mini-store-1',
      type: StoreType.MINI,
    });
    (prisma.order.create as jest.Mock).mockResolvedValue({
      id: 'order-123',
      orderNumber: 'ORD-123456',
      fsrNumber: 'FSR-999',
      serviceLines: [],
      standaloneLines: [],
    });

    const orderData = {
      customerName: 'Abebe',
      customerPhone: '0911000000',
      plateNumber: 'A12345',
      serviceLines: [],
      standaloneLines: [],
      additionalDiscount: 0,
      taxRate: 0,
      fsrNumber: '   FSR-999   ',
    };

    const result = await OrdersService.createOrder(orderData, 'user-1');

    expect(prisma.order.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          fsrNumber: 'FSR-999',
        }),
      })
    );
    expect(result.fsrNumber).toBe('FSR-999');
  });

  it('should set fsrNumber to null when omitted on createOrder', async () => {
    (CustomersVehiclesService.resolveCustomerAndVehicle as jest.Mock).mockResolvedValue({
      customer: { id: 'cust-1' },
      vehicle: { id: 'veh-1' },
    });
    (prisma.store.findUnique as jest.Mock).mockResolvedValue({
      id: 'mini-store-1',
      type: StoreType.MINI,
    });
    (prisma.order.create as jest.Mock).mockResolvedValue({
      id: 'order-124',
      orderNumber: 'ORD-123457',
      fsrNumber: null,
      serviceLines: [],
      standaloneLines: [],
    });

    const orderData = {
      customerName: 'Abebe',
      customerPhone: '0911000000',
      plateNumber: 'A12345',
      serviceLines: [],
      standaloneLines: [],
      additionalDiscount: 0,
      taxRate: 0,
    };

    try {
      await OrdersService.createOrder(orderData, 'user-1');
    } catch (e) {
      console.error('CREATE ORDER ERROR:', e);
      throw e;
    }

    expect(prisma.order.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          fsrNumber: null,
        }),
      })
    );
  });

  it('should retrieve order by fsrNumber in getOrder', async () => {
    const mockOrder = {
      id: 'order-123',
      orderNumber: 'ORD-123456',
      fsrNumber: 'FSR-999',
      serviceLines: [],
      standaloneLines: [],
      additionalCharges: [],
      payments: [],
      carStatuses: [],
      assignments: [],
      discountAmount: 0,
      taxAmount: 0,
    };
    (prisma.order.findFirst as jest.Mock).mockResolvedValue(mockOrder);

    const found = await OrdersService.getOrder('FSR-999');

    expect(prisma.order.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          OR: [
            { id: 'FSR-999' },
            { orderNumber: 'FSR-999' },
            { fsrNumber: 'FSR-999' },
          ],
        },
      })
    );
    expect(found?.id).toBe('order-123');
    expect(found?.fsrNumber).toBe('FSR-999');
  });

  it('should search orders by fsrNumber in getOrders', async () => {
    (prisma.order.findMany as jest.Mock).mockResolvedValue([]);

    await OrdersService.getOrders({ search: 'FSR-888' });

    expect(prisma.order.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          OR: expect.arrayContaining([
            { fsrNumber: { contains: 'FSR-888', mode: 'insensitive' } },
          ]),
        }),
      })
    );
  });

  it('should filter orders explicitly by fsrNumber in getOrders', async () => {
    (prisma.order.findMany as jest.Mock).mockResolvedValue([]);

    await OrdersService.getOrders({ fsrNumber: 'FSR-777' });

    expect(prisma.order.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          fsrNumber: { contains: 'FSR-777', mode: 'insensitive' },
        }),
      })
    );
  });

  it('should update fsrNumber on an existing order and log audit', async () => {
    const existingOrder = {
      id: 'order-123',
      orderNumber: 'ORD-123456',
      fsrNumber: null,
    };
    (prisma.order.findFirst as jest.Mock).mockResolvedValue(existingOrder);
    (prisma.order.update as jest.Mock).mockResolvedValue({
      ...existingOrder,
      fsrNumber: 'FSR-555',
    });

    const updated = await OrdersService.updateFsrNumber('order-123', '  FSR-555  ', 'user-1');

    expect(prisma.order.update).toHaveBeenCalledWith({
      where: { id: 'order-123' },
      data: { fsrNumber: 'FSR-555' },
    });
    expect(AuditService.record).toHaveBeenCalledWith(
      'Order',
      'order-123',
      'UPDATE',
      'user-1',
      { fsrNumber: null },
      { fsrNumber: 'FSR-555' }
    );
    expect(updated.fsrNumber).toBe('FSR-555');
  });

  it('should reject order creation if standalone material has unallocated stock in Mini store', async () => {
    (prisma.material.findFirst as jest.Mock).mockResolvedValue({
      id: 'mat-branded',
      nameEn: 'Branded Polish',
      unit: 'PCS',
      currentPrice: 200,
      brands: [{ id: 'b1', name: 'Brand1' }],
    });
    (prisma.store.findUnique as jest.Mock).mockResolvedValue({
      id: 'mini-1',
      type: StoreType.MINI,
    });
    (prisma.materialStock.findUnique as jest.Mock).mockResolvedValue({
      quantity: 50,
    });
    (prisma.materialBrandStock.findMany as jest.Mock).mockResolvedValue([]);

    await expect(
      OrdersService.createOrder({
        customerName: 'Test',
        customerPhone: '0911223344',
        serviceLines: [],
        standaloneLines: [{ materialId: 'mat-branded', quantity: 1, unitPrice: 200 }],
        payments: [{ method: 'CASH', amount: 200 }],
      }, 'user-1')
    ).rejects.toThrow(/Cannot use material "Branded Polish". It has 50 unallocated/);
  });

  it('should update service fee and recalculate paymentStatus', async () => {
    const existingOrder = {
      id: 'order-fee-1',
      orderNumber: 'ORD-999',
      serviceFee: 0,
      discountAmount: 0,
      taxAmount: 0,
      serviceLines: [{ priceAtOrderTime: 1000 }],
      standaloneLines: [],
      additionalCharges: [],
      payments: [{ amount: 1000 }],
    };

    (prisma.order.findFirst as jest.Mock).mockResolvedValue(existingOrder);
    (prisma.order.update as jest.Mock).mockImplementation(({ data }: any) => Promise.resolve({
      ...existingOrder,
      serviceFee: data.serviceFee,
      paymentStatus: data.paymentStatus,
    }));

    // Order was paid (1000/1000). Adding 500 service fee makes total 1500, so status becomes PARTIALLY_PAID
    const updated = await OrdersService.updateServiceFee('order-fee-1', 500, 'user-1');

    expect(prisma.order.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'order-fee-1' },
        data: {
          serviceFee: 500,
          paymentStatus: 'PARTIALLY_PAID',
        },
      })
    );
    expect(AuditService.record).toHaveBeenCalledWith(
      'Order',
      'order-fee-1',
      'UPDATE',
      'user-1',
      { serviceFee: 0 },
      { serviceFee: 500 }
    );
    expect(updated.serviceFee).toBe(500);
    expect(updated.paymentStatus).toBe('PARTIALLY_PAID');
  });

  it('should update service line price (discounted) and recalculate order payment status', async () => {
    const existingOrder = {
      id: 'order-srv-1',
      orderStatus: 'OPEN',
      serviceFee: 0,
      discountAmount: 0,
      taxAmount: 0,
      serviceLines: [{ id: 'line-1', priceAtOrderTime: 800 }],
      standaloneLines: [],
      additionalCharges: [],
      payments: [{ amount: 800 }],
    };

    (prisma.order.findUnique as jest.Mock).mockResolvedValue(existingOrder);
    (prisma.orderServiceLine.findUnique as jest.Mock).mockResolvedValue({
      id: 'line-1',
      orderId: 'order-srv-1',
      priceAtOrderTime: 1000,
    });
    (prisma.orderServiceLine.update as jest.Mock).mockResolvedValue({
      id: 'line-1',
      priceAtOrderTime: 800,
    });
    (prisma.order.update as jest.Mock).mockResolvedValue({
      ...existingOrder,
      paymentStatus: 'PAID',
    });

    const result = await OrdersService.updateServiceLinePrice('order-srv-1', 'line-1', 800, 'user-1');
    expect(prisma.orderServiceLine.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'line-1' },
        data: { priceAtOrderTime: 800 },
      })
    );
    expect(AuditService.record).toHaveBeenCalledWith(
      'OrderServiceLine',
      'line-1',
      'UPDATE',
      'user-1',
      { priceAtOrderTime: 1000 },
      { priceAtOrderTime: 800 }
    );
    expect(result.priceAtOrderTime).toBe(800);
  });

  it('should update standalone line price (discounted) and audit the change', async () => {
    const existingOrder = {
      id: 'order-mat-1',
      orderStatus: 'OPEN',
      serviceFee: 0,
      discountAmount: 0,
      taxAmount: 0,
      serviceLines: [],
      standaloneLines: [{ id: 'mat-line-1', priceAtOrderTime: 800, quantity: 1 }],
      additionalCharges: [],
      payments: [{ amount: 800 }],
    };

    (prisma.order.findUnique as jest.Mock).mockResolvedValue(existingOrder);
    (prisma.orderStandaloneItemLine.findUnique as jest.Mock).mockResolvedValue({
      id: 'mat-line-1',
      orderId: 'order-mat-1',
      materialId: 'mat-1',
      priceAtOrderTime: 1000,
      quantity: 1,
      material: { nameEn: 'Leather', unit: 'PCS' },
    });
    (prisma.store.findUnique as jest.Mock).mockResolvedValue({
      id: 'mini-1',
      type: StoreType.MINI,
    });
    (prisma.orderStandaloneItemLine.update as jest.Mock).mockResolvedValue({
      id: 'mat-line-1',
      priceAtOrderTime: 800,
      quantity: 1,
    });
    (prisma.order.update as jest.Mock).mockResolvedValue({
      ...existingOrder,
      paymentStatus: 'PAID',
    });

    const result = await OrdersService.updateStandaloneLine(
      'order-mat-1',
      'mat-line-1',
      { priceAtOrderTime: 800 },
      'user-1'
    );
    expect(prisma.orderStandaloneItemLine.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'mat-line-1' },
        data: { priceAtOrderTime: 800 },
      })
    );
    expect(AuditService.record).toHaveBeenCalledWith(
      'OrderStandaloneItemLine',
      'mat-line-1',
      'UPDATE',
      'user-1',
      { priceAtOrderTime: 1000 },
      { priceAtOrderTime: 800 }
    );
    expect(result.priceAtOrderTime).toBe(800);
  });

  it('should require brand selection when a service required material has multiple brands', async () => {
    (prisma.serviceCategory.findUnique as jest.Mock).mockResolvedValue({
      id: 'cat-tint',
      nameEn: 'Tinting',
      price: 1500,
      materialUsages: [
        {
          materialId: 'mat-film',
          quantityUsed: 2,
          material: {
            nameEn: 'Window Film',
            brands: [
              { id: 'brand-abro', name: 'Abro' },
              { id: 'brand-flamingo', name: 'Flamingo' },
            ],
          },
        },
      ],
    });

    const orderData = {
      customerName: 'Abebe',
      customerPhone: '0911223344',
      plateNumber: 'A12345',
      serviceLines: [
        { serviceCategoryId: 'cat-tint', priceMultiplier: 1, discount: 0 },
      ],
      standaloneLines: [],
      additionalDiscount: 0,
      taxRate: 0,
    };

    await expect(OrdersService.createOrder(orderData, 'user-1')).rejects.toThrow(
      'Please specify a brand/variant for material "Window Film" required by service "Tinting".'
    );
  });

  it('should deduct brand stock and record brand in deduction when brand is specified', async () => {
    (prisma.serviceCategory.findUnique as jest.Mock).mockResolvedValue({
      id: 'cat-tint',
      nameEn: 'Tinting',
      price: 1500,
      materialUsages: [
        {
          materialId: 'mat-film',
          quantityUsed: 2,
          material: {
            nameEn: 'Window Film',
            brands: [
              { id: 'brand-abro', name: 'Abro', size: '500ml', color: 'Black', type: 'Premium', price: 200 },
              { id: 'brand-flamingo', name: 'Flamingo', size: '300ml', color: 'Dark', type: 'Standard', price: 150 },
            ],
          },
        },
      ],
    });

    (prisma.materialStock.findUnique as jest.Mock).mockResolvedValue({
      quantity: { toNumber: () => 19 },
    });
    (prisma.materialBrandStock.findMany as jest.Mock).mockResolvedValue([
      { materialBrandId: 'brand-abro', quantity: { toNumber: () => 10 } },
      { materialBrandId: 'brand-flamingo', quantity: { toNumber: () => 9 } },
    ]);
    (prisma.materialBrandStock.findUnique as jest.Mock).mockResolvedValue({
      quantity: { toNumber: () => 10 }, // Abro has 10
    });
    (prisma.order.create as jest.Mock).mockResolvedValue({
      id: 'order-test-brand',
      orderNumber: 'ORD-999999',
      serviceLines: [{ id: 'sl-1' }],
      standaloneLines: [],
    });

    const orderData = {
      customerName: 'Abebe',
      customerPhone: '0911223344',
      plateNumber: 'A12345',
      serviceLines: [
        {
          serviceCategoryId: 'cat-tint',
          priceMultiplier: 1,
          discount: 0,
          selectedMaterials: [
            { materialId: 'mat-film', materialBrandId: 'brand-abro' },
          ],
        },
      ],
      standaloneLines: [],
      additionalDiscount: 0,
      taxRate: 0,
    };

    try {
      await OrdersService.createOrder(orderData, 'user-1');
    } catch (e) {
      console.error('CREATE ORDER ERROR:', e);
      throw e;
    }

    expect(prisma.orderServiceMaterialDeduction.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          materialId: 'mat-film',
          materialBrandId: 'brand-abro',
          brandName: 'Abro',
          sizeName: '500ml',
          quantityDeducted: 2,
        }),
      })
    );

    // Verify brand stock was updated with -2 for brand-abro
    expect(prisma.materialBrandStock.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { materialBrandId_storeId: { materialBrandId: 'brand-abro', storeId: 'mini-1' } },
        update: { quantity: 8 },
      })
    );
  });
});

