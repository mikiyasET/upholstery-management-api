import prisma from '../../lib/prisma';
import { AuditService } from '../../lib/audit';
import { CustomersVehiclesService } from '../customers-vehicles/customers-vehicles.service';
import { StorageService } from '../storage/storage.service';
import { AuditAction, OrderStatus, StoreType } from '@prisma/client';
import { v4 as uuidv4 } from 'uuid';

export class OrdersService {
  static async createOrder(data: any, userId: string) {
    return prisma.$transaction(async (tx) => {
      // Resolve customer & vehicle
      const { customer, vehicle } = await CustomersVehiclesService.resolveCustomerAndVehicle({
        name: data.customerName,
        phone: data.customerPhone,
        plateNumber: data.plateNumber,
        carModelId: data.carModelId,
      });

      if (!vehicle) throw new Error('A vehicle is required to create an order');

      // Get Mini Store for stock operations
      const miniStore = await tx.store.findUnique({ where: { type: StoreType.MINI } });
      if (!miniStore) throw new Error('Mini store not found');

      // ======= Aggregate all material requirements =======
      // Map: materialId -> { totalNeeded, materialName }
      const materialRequirements = new Map<string, { totalNeeded: number; name: string }>();

      // 1. Collect materials required by service categories
      const serviceLineData: any[] = [];
      const serviceMaterialDeductions: { serviceTempIdx: number; materialId: string; qty: number; unitPrice: number | null }[] = [];

      for (let i = 0; i < data.serviceLines.length; i++) {
        const sl = data.serviceLines[i];
        const cat = await tx.serviceCategory.findUnique({
          where: { id: sl.serviceCategoryId },
          include: { materialUsages: { include: { material: true } } },
        });
        if (!cat) throw new Error(`ServiceCategory ${sl.serviceCategoryId} not found`);

        const price = Number(cat.price) * sl.priceMultiplier;

        serviceLineData.push({
          serviceCategoryId: sl.serviceCategoryId,
          priceAtTime: price,
          discount: sl.discount,
        });

        // Accumulate material requirements from this service
        for (const usage of cat.materialUsages) {
          const qtyNeeded = Number(usage.quantityUsed);
          const existing = materialRequirements.get(usage.materialId);
          if (existing) {
            existing.totalNeeded += qtyNeeded;
          } else {
            materialRequirements.set(usage.materialId, {
              totalNeeded: qtyNeeded,
              name: usage.material.nameEn,
            });
          }
          serviceMaterialDeductions.push({
            serviceTempIdx: i,
            materialId: usage.materialId,
            qty: qtyNeeded,
            unitPrice: usage.material.currentPrice ? Number(usage.material.currentPrice) : null,
          });
        }
      }

      // 2. Collect standalone material lines
      const standaloneLineData: any[] = [];
      for (const ml of data.standaloneLines) {
        standaloneLineData.push({
          materialId: ml.materialId,
          quantity: ml.quantity,
          unitPrice: ml.unitPrice,
          discount: ml.discount,
        });

        const mat = await tx.material.findUnique({ where: { id: ml.materialId } });
        if (!mat) throw new Error(`Material ${ml.materialId} not found`);

        const existing = materialRequirements.get(ml.materialId);
        if (existing) {
          existing.totalNeeded += ml.quantity;
        } else {
          materialRequirements.set(ml.materialId, {
            totalNeeded: ml.quantity,
            name: mat.nameEn,
          });
        }
      }

      // ======= Validate stock availability =======
      const insufficientItems: string[] = [];
      for (const [materialId, req] of materialRequirements) {
        const stock = await tx.materialStock.findUnique({
          where: { materialId_storeId: { materialId, storeId: miniStore.id } },
        });
        const available = stock?.quantity?.toNumber() || 0;
        if (available < req.totalNeeded) {
          insufficientItems.push(`${req.name}: need ${req.totalNeeded}, only ${available} available`);
        }
      }
      if (insufficientItems.length > 0) {
        throw new Error(`Insufficient stock:\n${insufficientItems.join('\n')}`);
      }

      // ======= Calculate totals =======
      let subtotal = 0;
      for (const sl of serviceLineData) {
        subtotal += sl.priceAtTime - sl.discount;
      }
      for (const ml of standaloneLineData) {
        subtotal += (ml.quantity * ml.unitPrice) - ml.discount;
      }

      const totalAfterDiscount = subtotal - data.additionalDiscount;
      const taxAmount = totalAfterDiscount * data.taxRate;

      const orderNumber = `ORD-${Date.now().toString().slice(-6)}`;

      const order = await tx.order.create({
        data: {
          orderNumber,
          customerId: customer.id,
          vehicleId: vehicle.id,
          createdById: userId,
          orderStatus: OrderStatus.OPEN,
          discountAmount: data.additionalDiscount,
          taxAmount,
          notes: data.notes,

          serviceLines: { create: serviceLineData },
          standaloneLines: { create: standaloneLineData },
        },
        include: { serviceLines: true, standaloneLines: true },
      });

      // ======= Deduct stock and record material deductions =======
      // Deduct for service material usages
      for (let i = 0; i < serviceMaterialDeductions.length; i++) {
        const deduction = serviceMaterialDeductions[i];
        const serviceLine = order.serviceLines[deduction.serviceTempIdx];
        if (serviceLine) {
          await tx.orderServiceMaterialDeduction.create({
            data: {
              orderServiceLineId: serviceLine.id,
              materialId: deduction.materialId,
              quantityDeducted: deduction.qty,
              unitPriceAtOrderTime: deduction.unitPrice,
            },
          });
        }
        await StorageService.updateMaterialStock(tx, deduction.materialId, miniStore.id, -deduction.qty);
      }

      // Deduct for standalone material lines
      for (const ml of data.standaloneLines) {
        await StorageService.updateMaterialStock(tx, ml.materialId, miniStore.id, -ml.quantity);
      }

      await AuditService.record('Order', order.id, AuditAction.CREATE, userId, null, order);
      return order;
    });
  }

  static async updateOrderStatus(orderId: string, status: OrderStatus, notes: string | undefined, userId: string) {
    return prisma.$transaction(async (tx) => {
      const order = await tx.order.findUnique({
        where: { id: orderId },
        include: {
          serviceLines: { include: { serviceCategory: { include: { materialUsages: true } } } },
          standaloneLines: true,
        },
      });

      if (!order) throw new Error('Order not found');

      // Stock is now deducted immediately upon order creation or when adding lines,
      // so we no longer deduct here when transitioning to IN_PROGRESS.

      const updated = await tx.order.update({
        where: { id: orderId },
        data: { orderStatus: status },
      });

      // No OrderStatusHistory table in schema, so we just log it in AuditLog
      await AuditService.record('Order', orderId, AuditAction.UPDATE, userId, { orderStatus: order.orderStatus }, { orderStatus: status });
      return updated;
    });
  }

  static async addPayment(orderId: string, data: any, userId: string) {
    return prisma.$transaction(async (tx) => {
      const order = await tx.order.findUnique({ 
        where: { id: orderId }, 
        include: { 
          payments: true,
          serviceLines: true,
          standaloneLines: true,
          additionalCharges: true
        } 
      });
      if (!order) throw new Error('Order not found');

      const payment = await tx.orderPayment.create({
        data: {
          orderId,
          amount: data.amount,
          method: data.method,
          methodDetails: data.referenceNumber,
          recordedById: userId,
        },
      });

      let total = 0;
      for (const sl of order.serviceLines) {
        total += Number(sl.priceAtOrderTime);
      }
      for (const ml of order.standaloneLines) {
        total += Number(ml.priceAtOrderTime) * Number(ml.quantity);
      }
      for (const ac of order.additionalCharges) {
        total += Number(ac.price);
      }
      
      const totalAfterDiscount = total - Number(order.discountAmount);
      const grandTotal = totalAfterDiscount + Number(order.taxAmount);

      const totalPaid = order.payments.reduce((sum, p) => sum + Number(p.amount), 0) + Number(data.amount);
      const paymentStatus = totalPaid >= grandTotal ? 'PAID' : 'PARTIALLY_PAID';

      await tx.order.update({ where: { id: orderId }, data: { paymentStatus } });

      await AuditService.record('Payment', payment.id, AuditAction.CREATE, userId, null, payment);
      return payment;
    });
  }

  static async addCarStatus(orderId: string, data: { carStatusId?: string, customName?: string, customDescription?: string }) {
    const validCarStatusId = data.carStatusId && data.carStatusId !== 'none' ? data.carStatusId : undefined;
    return prisma.orderCarStatus.create({
      data: {
        orderId,
        carStatusId: validCarStatusId,
        customName: data.customName,
        customDescription: data.customDescription,
      }
    });
  }

  static async addAssignment(orderId: string, data: { employeeId: string, roleLabel: string }) {
    return prisma.orderAssignment.create({
      data: {
        orderId,
        employeeId: data.employeeId,
        roleLabel: data.roleLabel,
      }
    });
  }

  static async addServiceLine(orderId: string, data: { serviceCategoryId: string, priceMultiplier: number }) {
    return prisma.$transaction(async (tx) => {
      const order = await tx.order.findUnique({ where: { id: orderId } });
      if (!order) throw new Error('Order not found');
      if (order.orderStatus === OrderStatus.DELIVERED) {
        throw new Error('Cannot modify a completed order');
      }
      if (order.orderStatus === OrderStatus.CANCELLED) {
        throw new Error('Cannot modify a cancelled order');
      }

      const cat = await tx.serviceCategory.findUnique({
        where: { id: data.serviceCategoryId },
        include: { materialUsages: { include: { material: true } } }
      });
      if (!cat) throw new Error('ServiceCategory not found');

      const miniStore = await tx.store.findUnique({ where: { type: StoreType.MINI } });
      if (!miniStore) throw new Error('Mini store not found');

      // Deduct materials if order is not OPEN
      const deductions = [];
      for (const usage of cat.materialUsages) {
        // Find stock
        const stock = await tx.materialStock.findUnique({
          where: { materialId_storeId: { materialId: usage.materialId, storeId: miniStore.id } }
        });
        
        if (!stock || Number(stock.quantity) < Number(usage.quantityUsed)) {
          throw new Error(`Insufficient stock for ${usage.material.nameEn}. Needed: ${usage.quantityUsed}, Available: ${stock?.quantity || 0}`);
        }

        // Deduct
        await tx.materialStock.update({
          where: { id: stock.id },
          data: { quantity: { decrement: usage.quantityUsed } }
        });

        // Always record deductions so we can restore later
        deductions.push({
          materialId: usage.materialId,
          quantityDeducted: usage.quantityUsed,
        });
      }

      const price = Number(cat.price) * data.priceMultiplier;

      const serviceLine = await tx.orderServiceLine.create({
        data: {
          orderId,
          serviceCategoryId: data.serviceCategoryId,
          priceAtOrderTime: price,
          materialDeductions: {
            create: deductions,
          }
        }
      });
      return serviceLine;
    });
  }

  static async addStandaloneLine(orderId: string, data: { materialId: string, quantity: number }) {
    return prisma.$transaction(async (tx) => {
      const order = await tx.order.findUnique({ where: { id: orderId } });
      if (!order) throw new Error('Order not found');
      if (order.orderStatus === OrderStatus.DELIVERED) {
        throw new Error('Cannot modify a completed order');
      }
      if (order.orderStatus === OrderStatus.CANCELLED) {
        throw new Error('Cannot modify a cancelled order');
      }

      const material = await tx.material.findUnique({ where: { id: data.materialId } });
      if (!material) throw new Error('Material not found');

      const miniStore = await tx.store.findUnique({ where: { type: StoreType.MINI } });
      if (!miniStore) throw new Error('Mini store not found');

      const stock = await tx.materialStock.findUnique({
        where: { materialId_storeId: { materialId: data.materialId, storeId: miniStore.id } }
      });

      if (!stock || Number(stock.quantity) < data.quantity) {
        throw new Error(`Insufficient stock for ${material.nameEn}. Needed: ${data.quantity}, Available: ${stock?.quantity || 0}`);
      }

      await tx.materialStock.update({
        where: { id: stock.id },
        data: { quantity: { decrement: data.quantity } }
      });

      return tx.orderStandaloneItemLine.create({
        data: {
          orderId,
          materialId: data.materialId,
          quantity: data.quantity,
          priceAtOrderTime: material.currentPrice || 0,
        }
      });
    });
  }

  static async removeServiceLine(orderId: string, lineId: string) {
    return prisma.$transaction(async (tx) => {
      const order = await tx.order.findUnique({ where: { id: orderId } });
      if (!order) throw new Error('Order not found');
      if (order.orderStatus === OrderStatus.DELIVERED) {
        throw new Error('Cannot modify a completed order');
      }
      if (order.orderStatus === OrderStatus.CANCELLED) {
        throw new Error('Cannot modify a cancelled order');
      }

      const line = await tx.orderServiceLine.findUnique({
        where: { id: lineId },
        include: { materialDeductions: true }
      });
      if (!line) throw new Error('Service line not found');
      if (line.orderId !== orderId) throw new Error('Service line does not belong to this order');

      const miniStore = await tx.store.findUnique({ where: { type: StoreType.MINI } });
      if (!miniStore) throw new Error('Mini store not found');

      for (const deduction of line.materialDeductions) {
        const stock = await tx.materialStock.findUnique({
          where: { materialId_storeId: { materialId: deduction.materialId, storeId: miniStore.id } }
        });
        if (stock) {
          await tx.materialStock.update({
            where: { id: stock.id },
            data: { quantity: { increment: deduction.quantityDeducted } }
          });
        }
      }

      // Delete deductions and the line
      await tx.orderServiceMaterialDeduction.deleteMany({
        where: { orderServiceLineId: lineId }
      });

      return tx.orderServiceLine.delete({
        where: { id: lineId }
      });
    });
  }

  static async removeStandaloneLine(orderId: string, lineId: string) {
    return prisma.$transaction(async (tx) => {
      const order = await tx.order.findUnique({ where: { id: orderId } });
      if (!order) throw new Error('Order not found');
      if (order.orderStatus === OrderStatus.DELIVERED) {
        throw new Error('Cannot modify a completed order');
      }
      if (order.orderStatus === OrderStatus.CANCELLED) {
        throw new Error('Cannot modify a cancelled order');
      }

      const line = await tx.orderStandaloneItemLine.findUnique({
        where: { id: lineId }
      });
      if (!line) throw new Error('Material line not found');
      if (line.orderId !== orderId) throw new Error('Material line does not belong to this order');

      const miniStore = await tx.store.findUnique({ where: { type: StoreType.MINI } });
      if (!miniStore) throw new Error('Mini store not found');

      const stock = await tx.materialStock.findUnique({
        where: { materialId_storeId: { materialId: line.materialId, storeId: miniStore.id } }
      });
      if (stock) {
        await tx.materialStock.update({
          where: { id: stock.id },
          data: { quantity: { increment: line.quantity } }
        });
      }

      return tx.orderStandaloneItemLine.delete({
        where: { id: lineId }
      });
    });
  }

  static async addAdditionalCharge(orderId: string, data: { name: string, price: number, description?: string }) {
    return prisma.orderAdditionalCharge.create({
      data: {
        orderId,
        name: data.name,
        price: data.price,
        description: data.description,
      }
    });
  }

  static async getOrders(filters: any) {
    const where: any = {};
    if (filters.search) {
      where.OR = [
        { orderNumber: { contains: filters.search, mode: 'insensitive' } },
        { customer: { name: { contains: filters.search, mode: 'insensitive' } } },
        { customer: { phone: { contains: filters.search } } },
        { vehicle: { plateNumber: { contains: filters.search, mode: 'insensitive' } } },
      ];
    }
    if (filters.status) {
      where.orderStatus = filters.status;
    }
    
    return prisma.order.findMany({
      where,
      include: {
        customer: true,
        vehicle: { include: { carModel: { include: { brand: true } } } },
        serviceLines: { include: { serviceCategory: { include: { service: true } } } },
        standaloneLines: { include: { material: true } },
      },
      orderBy: { orderDateTime: 'desc' },
    });
  }

  static async getOrder(id: string) {
    const order = await prisma.order.findUnique({
      where: { id },
      include: {
        customer: true,
        vehicle: { include: { carModel: { include: { brand: true } } } },
        serviceLines: { include: { serviceCategory: { include: { service: true } } } },
        standaloneLines: { include: { material: true } },
        additionalCharges: true,
        payments: {
          include: { recordedBy: { select: { name: true } } },
          orderBy: { paidAt: 'desc' },
        },
        carStatuses: { include: { carStatus: true } },
        assignments: { include: { employee: true } },
      },
    });

    if (!order) return null;

    let totalService = 0;
    for (const sl of order.serviceLines) {
      totalService += Number(sl.priceAtOrderTime);
    }

    let totalStandalone = 0;
    for (const ml of order.standaloneLines) {
      totalStandalone += (Number(ml.quantity) * Number(ml.priceAtOrderTime));
    }

    let totalAdditional = 0;
    for (const ac of order.additionalCharges) {
      totalAdditional += Number(ac.price);
    }

    const subtotal = totalService + totalStandalone + totalAdditional;
    const totalDiscount = Number(order.discountAmount);
    const taxAmount = Number(order.taxAmount);
    const netPrice = subtotal - totalDiscount + taxAmount;

    let totalPaid = 0;
    for (const p of order.payments) {
      totalPaid += Number(p.amount);
    }

    const balanceDue = netPrice - totalPaid;

    return {
      ...order,
      totalPrice: subtotal,
      totalDiscount,
      taxAmount,
      netPrice,
      totalPaid,
      balanceDue,
    };
  }
}
