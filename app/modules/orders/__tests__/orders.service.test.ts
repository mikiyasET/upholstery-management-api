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
  },
  materialStock: {
    findUnique: jest.fn(),
    update: jest.fn(),
    upsert: jest.fn(),
  },
  serviceCategory: {
    findUnique: jest.fn(),
  },
  order: {
    create: jest.fn(),
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
  });

  it('should throw an error if standalone material has insufficient stock', async () => {
    // Setup mock data where requested qty > available stock
    (prisma.material.findUnique as jest.Mock).mockResolvedValue({ nameEn: 'Leather' });
    
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
