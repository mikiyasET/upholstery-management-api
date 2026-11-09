import prisma from '../../lib/prisma';
import { AuditService } from '../../lib/audit';
import { CustomersVehiclesService } from '../customers-vehicles/customers-vehicles.service';
import { StorageService } from '../storage/storage.service';
import { DailyStatsService } from '../reports/daily-stats.service';
import { AuditAction, OrderStatus, StoreType } from '@prisma/client';
import { v4 as uuidv4 } from 'uuid';
import { validateQuantityForUnit } from '../../lib/units';
import { checkMaterialBrandAllocation } from '../../lib/brand-stock';
import { TelegramService } from '../../lib/telegram';

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
      // Map: materialBrandId -> { totalNeeded, brandLabel }
      const brandRequirements = new Map<string, { totalNeeded: number; brandLabel: string }>();

      // 1. Collect materials required by service categories
      const serviceLineData: any[] = [];
      const serviceMaterialDeductions: {
        serviceTempIdx: number;
        materialId: string;
        materialBrandId?: string | null;
        brandName?: string | null;
        sizeName?: string | null;
        colorName?: string | null;
        typeName?: string | null;
        qty: number;
        unitPrice: number | null;
      }[] = [];

      for (let i = 0; i < data.serviceLines.length; i++) {
        const sl = data.serviceLines[i];
        const cat = await tx.serviceCategory.findUnique({
          where: { id: sl.serviceCategoryId },
          include: { materialUsages: { include: { material: { include: { brands: true } } } } },
        });
        if (!cat) throw new Error(`ServiceCategory ${sl.serviceCategoryId} not found`);

        const price = sl.customPrice !== undefined
          ? Number(sl.customPrice)
          : (sl.unitPrice !== undefined ? Number(sl.unitPrice) : Number(cat.price) * sl.priceMultiplier);

        serviceLineData.push({
          serviceCategoryId: sl.serviceCategoryId,
          priceAtOrderTime: price,
        });

        // Accumulate material requirements from this service
        for (const usage of cat.materialUsages) {
          const qtyNeeded = Number(usage.quantityUsed);
          const mat = usage.material;
          const brands = mat?.brands || [];

          let materialBrandId: string | null = null;
          let brandName: string | null = null;
          let sizeName: string | null = null;
          let colorName: string | null = null;
          let typeName: string | null = null;

          const selectedMat = sl.selectedMaterials?.find((sm: any) => sm.materialId === usage.materialId);
          if (selectedMat?.materialBrandId) {
            materialBrandId = selectedMat.materialBrandId;
          } else if (brands.length === 1) {
            materialBrandId = brands[0].id;
          }

          if (brands.length > 0) {
            if (!materialBrandId) {
              throw new Error(`Please specify a brand/variant for material "${mat.nameEn}" required by service "${cat.nameEn}".`);
            }
            const brand = brands.find((b: any) => b.id === materialBrandId);
            if (!brand) {
              throw new Error(`Selected brand not found for material "${mat.nameEn}".`);
            }
            brandName = brand.name;
            sizeName = brand.size || null;
            colorName = brand.color || null;
            typeName = brand.type || null;

            const brandKey = materialBrandId;
            const brandExisting = brandRequirements.get(brandKey);
            const brandLabel = sizeName ? `${brandName} (${sizeName})` : brandName;
            if (brandExisting) {
              brandExisting.totalNeeded += qtyNeeded;
            } else {
              brandRequirements.set(brandKey, {
                totalNeeded: qtyNeeded,
                brandLabel: `${mat.nameEn} - ${brandLabel}`,
              });
            }
          }

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
            materialBrandId,
            brandName,
            sizeName,
            colorName,
            typeName,
            qty: qtyNeeded,
            unitPrice: usage.material.currentPrice ? Number(usage.material.currentPrice) : null,
          });
        }
      }

      // 2. Collect standalone material lines
      const standaloneLineData: any[] = [];
      for (const ml of data.standaloneLines) {
        const mat = await tx.material.findFirst({
          where: {
            OR: [{ id: ml.materialId }, { itemCode: ml.materialId }],
          },
        });
        if (!mat) throw new Error(`Material ${ml.materialId} not found`);
        validateQuantityForUnit(ml.quantity, mat.unit, `Quantity for material "${mat.nameEn}"`);
        ml.materialId = mat.id || ml.materialId;
        await checkMaterialBrandAllocation(tx, ml.materialId, StoreType.MINI, 'use');

        let brandName = ml.brandName || null;
        let sizeName = ml.sizeName || null;
        if (ml.materialBrandId) {
          const b = await tx.materialBrand.findUnique({ where: { id: ml.materialBrandId } });
          if (b) {
            brandName = brandName || b.name;
            sizeName = sizeName || b.size;
          }
          const brandKey = ml.materialBrandId;
          const brandExisting = brandRequirements.get(brandKey);
          const brandLabel = sizeName ? `${brandName} (${sizeName})` : (brandName || mat.nameEn);
          if (brandExisting) {
            brandExisting.totalNeeded += ml.quantity;
          } else {
            brandRequirements.set(brandKey, {
              totalNeeded: ml.quantity,
              brandLabel: `${mat.nameEn} - ${brandLabel}`,
            });
          }
        }

        standaloneLineData.push({
          materialId: ml.materialId,
          materialBrandId: ml.materialBrandId || null,
          brandName,
          sizeName,
          quantity: ml.quantity,
          priceAtOrderTime: ml.unitPrice ?? (mat.currentPrice || 0),
        });

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
        await checkMaterialBrandAllocation(tx, materialId, StoreType.MINI, 'use');
        const stock = await tx.materialStock.findUnique({
          where: { materialId_storeId: { materialId, storeId: miniStore.id } },
        });
        const available = stock?.quantity?.toNumber() || 0;
        if (available < req.totalNeeded) {
          insufficientItems.push(`${req.name}: need ${req.totalNeeded}, only ${available} available in Mini Store`);
        }
      }
      for (const [brandId, req] of brandRequirements) {
        const brandStock = await tx.materialBrandStock.findUnique({
          where: { materialBrandId_storeId: { materialBrandId: brandId, storeId: miniStore.id } },
        });
        const available = brandStock?.quantity?.toNumber() || 0;
        if (available < req.totalNeeded) {
          insufficientItems.push(`${req.brandLabel}: need ${req.totalNeeded}, only ${available} available in Mini Store`);
        }
      }
      if (insufficientItems.length > 0) {
        throw new Error(`Insufficient stock:\n${insufficientItems.join('\n')}`);
      }

      // ======= Calculate totals =======
      let subtotal = 0;
      for (const sl of serviceLineData) {
        subtotal += Number(sl.priceAtOrderTime);
      }
      for (const ml of standaloneLineData) {
        subtotal += (Number(ml.quantity) * Number(ml.priceAtOrderTime));
      }
      const serviceFee = data.serviceFee ? Number(data.serviceFee) : 0;
      subtotal += serviceFee;

      const totalAfterDiscount = subtotal - data.additionalDiscount;
      const taxAmount = totalAfterDiscount * data.taxRate;

      const orderNumber = `ORD-${Date.now().toString().slice(-6)}`;

      const order = await tx.order.create({
        data: {
          orderNumber,
          fsrNumber: data.fsrNumber ? String(data.fsrNumber).trim() : null,
          customerId: customer.id,
          vehicleId: vehicle.id,
          createdById: userId,
          orderStatus: OrderStatus.OPEN,
          discountAmount: data.additionalDiscount,
          taxAmount,
          downPayment: data.downPayment ? Number(data.downPayment) : 0,
          serviceFee,
          deadline: data.deadline ? new Date(data.deadline) : null,
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
              materialBrandId: deduction.materialBrandId || null,
              brandName: deduction.brandName || null,
              sizeName: deduction.sizeName || null,
              colorName: deduction.colorName || null,
              typeName: deduction.typeName || null,
              quantityDeducted: deduction.qty,
              unitPriceAtOrderTime: deduction.unitPrice,
            },
          });
        }
        await StorageService.updateMaterialStock(tx, deduction.materialId, miniStore.id, -deduction.qty, deduction.materialBrandId);
      }

      // Deduct for standalone material lines
      for (const ml of data.standaloneLines) {
        await StorageService.updateMaterialStock(tx, ml.materialId, miniStore.id, -ml.quantity, ml.materialBrandId);
      }

      await AuditService.record('Order', order.id, AuditAction.CREATE, userId, null, order);
      await DailyStatsService.recordOrderCreated(order.orderDateTime, tx);
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
      total += Number(order.serviceFee || 0);
      
      const totalAfterDiscount = total - Number(order.discountAmount);
      const grandTotal = totalAfterDiscount + Number(order.taxAmount);

      const totalPaid = order.payments.reduce((sum, p) => sum + Number(p.amount), 0) + Number(data.amount);
      const paymentStatus = totalPaid >= grandTotal ? 'PAID' : 'PARTIALLY_PAID';

      await tx.order.update({ where: { id: orderId }, data: { paymentStatus } });

      await AuditService.record('Payment', payment.id, AuditAction.CREATE, userId, null, payment);
      await DailyStatsService.recordOrderPayment(Number(data.amount), payment.paidAt, tx);
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

  static async refreshOrderPaymentStatus(tx: any, orderId: string) {
    const order = await tx.order.findUnique({
      where: { id: orderId },
      include: {
        serviceLines: true,
        standaloneLines: true,
        additionalCharges: true,
        payments: true,
      },
    });
    if (!order) return;

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
    total += Number(order.serviceFee || 0);

    const totalAfterDiscount = total - Number(order.discountAmount);
    const grandTotal = totalAfterDiscount + Number(order.taxAmount);
    const totalPaid = order.payments.reduce((sum: number, p: any) => sum + Number(p.amount), 0);
    const paymentStatus = totalPaid >= grandTotal ? 'PAID' : (totalPaid > 0 ? 'PARTIALLY_PAID' : 'UNPAID');

    await tx.order.update({
      where: { id: orderId },
      data: { paymentStatus },
    });
  }

  static async addServiceLine(orderId: string, data: {
    serviceCategoryId: string;
    priceMultiplier?: number;
    unitPrice?: number;
    customPrice?: number;
    selectedMaterials?: { materialId: string; materialBrandId?: string | null }[];
  }, userId?: string) {
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
        include: { materialUsages: { include: { material: { include: { brands: true } } } } }
      });
      if (!cat) throw new Error('ServiceCategory not found');

      const miniStore = await tx.store.findUnique({ where: { type: StoreType.MINI } });
      if (!miniStore) throw new Error('Mini store not found');

      // Deduct materials
      const deductions = [];
      for (const usage of cat.materialUsages) {
        await checkMaterialBrandAllocation(tx, usage.materialId, StoreType.MINI, 'use');
        
        const mat = usage.material;
        const brands = mat?.brands || [];

        let materialBrandId: string | null = null;
        let brandName: string | null = null;
        let sizeName: string | null = null;
        let colorName: string | null = null;
        let typeName: string | null = null;

        const selectedMat = data.selectedMaterials?.find((sm: any) => sm.materialId === usage.materialId);
        if (selectedMat?.materialBrandId) {
          materialBrandId = selectedMat.materialBrandId;
        } else if (brands.length === 1) {
          materialBrandId = brands[0].id;
        }

        if (brands.length > 0) {
          if (!materialBrandId) {
            throw new Error(`Please specify a brand/variant for material "${mat.nameEn}" required by service "${cat.nameEn}".`);
          }
          const brand = brands.find((b: any) => b.id === materialBrandId);
          if (!brand) {
            throw new Error(`Selected brand not found for material "${mat.nameEn}".`);
          }
          brandName = brand.name;
          sizeName = brand.size || null;
          colorName = brand.color || null;
          typeName = brand.type || null;

          const brandStock = await tx.materialBrandStock.findUnique({
            where: { materialBrandId_storeId: { materialBrandId, storeId: miniStore.id } }
          });
          const availableBrand = brandStock?.quantity ? Number(brandStock.quantity) : 0;
          if (availableBrand < Number(usage.quantityUsed)) {
            const brandLabel = sizeName ? `${brandName} (${sizeName})` : brandName;
            throw new Error(`Insufficient stock for brand "${brandLabel}". Needed: ${usage.quantityUsed}, Available: ${availableBrand}`);
          }
        }

        // Find general stock
        const stock = await tx.materialStock.findUnique({
          where: { materialId_storeId: { materialId: usage.materialId, storeId: miniStore.id } }
        });
        
        if (!stock || Number(stock.quantity) < Number(usage.quantityUsed)) {
          throw new Error(`Insufficient stock for ${usage.material.nameEn}. Needed: ${usage.quantityUsed}, Available: ${stock?.quantity || 0}`);
        }

        // Deduct
        await StorageService.updateMaterialStock(tx, usage.materialId, miniStore.id, -Number(usage.quantityUsed), materialBrandId);

        // Always record deductions so we can restore later
        deductions.push({
          materialId: usage.materialId,
          materialBrandId,
          brandName,
          sizeName,
          colorName,
          typeName,
          quantityDeducted: usage.quantityUsed,
          unitPriceAtOrderTime: usage.material.currentPrice ? Number(usage.material.currentPrice) : null,
        });
      }

      const multiplier = data.priceMultiplier ?? 1;
      const price = data.customPrice !== undefined
        ? Number(data.customPrice)
        : (data.unitPrice !== undefined ? Number(data.unitPrice) : Number(cat.price) * multiplier);

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

      await OrdersService.refreshOrderPaymentStatus(tx, orderId);

      if (userId) {
        await AuditService.record('OrderServiceLine', serviceLine.id, AuditAction.CREATE, userId, null, serviceLine);
      }

      return serviceLine;
    });
  }

  static async addStandaloneLine(orderId: string, data: {
    materialId: string;
    quantity: number;
    unitPrice?: number;
    materialBrandId?: string | null;
    brandName?: string | null;
    sizeName?: string | null;
  }, userId?: string) {
    return prisma.$transaction(async (tx) => {
      const order = await tx.order.findUnique({ where: { id: orderId } });
      if (!order) throw new Error('Order not found');
      if (order.orderStatus === OrderStatus.DELIVERED) {
        throw new Error('Cannot modify a completed order');
      }
      if (order.orderStatus === OrderStatus.CANCELLED) {
        throw new Error('Cannot modify a cancelled order');
      }

      const material = await tx.material.findFirst({
        where: {
          OR: [{ id: data.materialId }, { itemCode: data.materialId }],
        },
      });
      if (!material) throw new Error('Material not found');
      validateQuantityForUnit(data.quantity, material.unit, `Quantity for material "${material.nameEn}"`);
      await checkMaterialBrandAllocation(tx, material.id, StoreType.MINI, 'use');
      data.materialId = material.id;

      let brandName = data.brandName || null;
      let sizeName = data.sizeName || null;
      if (data.materialBrandId) {
        const b = await tx.materialBrand.findUnique({ where: { id: data.materialBrandId } });
        if (b) {
          brandName = brandName || b.name;
          sizeName = sizeName || b.size;
        }
      }

      const miniStore = await tx.store.findUnique({ where: { type: StoreType.MINI } });
      if (!miniStore) throw new Error('Mini store not found');

      const stock = await tx.materialStock.findUnique({
        where: { materialId_storeId: { materialId: data.materialId, storeId: miniStore.id } }
      });

      if (!stock || Number(stock.quantity) < data.quantity) {
        throw new Error(`Insufficient stock for ${material.nameEn}. Needed: ${data.quantity}, Available: ${stock?.quantity || 0}`);
      }

      if (data.materialBrandId) {
        const brandStock = await tx.materialBrandStock.findUnique({
          where: { materialBrandId_storeId: { materialBrandId: data.materialBrandId, storeId: miniStore.id } }
        });
        if (!brandStock || Number(brandStock.quantity) < data.quantity) {
          const brandLabel = sizeName ? `${brandName} (${sizeName})` : (brandName || material.nameEn);
          throw new Error(`Insufficient stock for brand "${brandLabel}". Needed: ${data.quantity}, Available: ${brandStock?.quantity || 0}`);
        }
      }

      await StorageService.updateMaterialStock(tx, data.materialId, miniStore.id, -data.quantity, data.materialBrandId);

      const price = data.unitPrice !== undefined
        ? Number(data.unitPrice)
        : (material.currentPrice ? Number(material.currentPrice) : 0);

      const standaloneLine = await tx.orderStandaloneItemLine.create({
        data: {
          orderId,
          materialId: data.materialId,
          materialBrandId: data.materialBrandId || null,
          brandName,
          sizeName,
          quantity: data.quantity,
          priceAtOrderTime: price,
        }
      });

      await OrdersService.refreshOrderPaymentStatus(tx, orderId);

      if (userId) {
        await AuditService.record('OrderStandaloneItemLine', standaloneLine.id, AuditAction.CREATE, userId, null, standaloneLine);
      }

      return standaloneLine;
    });
  }

  static async updateServiceLinePrice(orderId: string, lineId: string, newPrice: number, userId: string) {
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
        include: { serviceCategory: true },
      });
      if (!line) throw new Error('Service line not found');
      if (line.orderId !== orderId) throw new Error('Service line does not belong to this order');

      const parsedPrice = Math.max(0, Number(newPrice) || 0);
      const oldPrice = Number(line.priceAtOrderTime);

      const updatedLine = await tx.orderServiceLine.update({
        where: { id: lineId },
        data: { priceAtOrderTime: parsedPrice },
        include: { serviceCategory: { include: { service: true } } },
      });

      await OrdersService.refreshOrderPaymentStatus(tx, orderId);

      await AuditService.record(
        'OrderServiceLine',
        lineId,
        AuditAction.UPDATE,
        userId,
        { priceAtOrderTime: oldPrice },
        { priceAtOrderTime: parsedPrice }
      );

      return updatedLine;
    });
  }

  static async updateStandaloneLine(
    orderId: string,
    lineId: string,
    data: { priceAtOrderTime?: number; quantity?: number },
    userId: string
  ) {
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
        where: { id: lineId },
        include: { material: true, materialBrand: true },
      });
      if (!line) throw new Error('Standalone item line not found');
      if (line.orderId !== orderId) throw new Error('Standalone item line does not belong to this order');

      const miniStore = await tx.store.findUnique({ where: { type: StoreType.MINI } });
      if (!miniStore) throw new Error('Mini store not found');

      const updateData: any = {};
      const oldValues: any = {};
      const newValues: any = {};

      if (data.priceAtOrderTime !== undefined) {
        const parsedPrice = Math.max(0, Number(data.priceAtOrderTime) || 0);
        updateData.priceAtOrderTime = parsedPrice;
        oldValues.priceAtOrderTime = Number(line.priceAtOrderTime);
        newValues.priceAtOrderTime = parsedPrice;
      }

      if (data.quantity !== undefined && data.quantity > 0) {
        const newQty = Number(data.quantity);
        const oldQty = Number(line.quantity);
        const qtyDiff = newQty - oldQty;

        if (qtyDiff !== 0) {
          validateQuantityForUnit(newQty, line.material.unit, `Quantity for material "${line.material.nameEn}"`);

          if (qtyDiff > 0) {
            const stock = await tx.materialStock.findUnique({
              where: { materialId_storeId: { materialId: line.materialId, storeId: miniStore.id } },
            });
            if (!stock || Number(stock.quantity) < qtyDiff) {
              throw new Error(`Insufficient stock for ${line.material.nameEn}. Additional needed: ${qtyDiff}, Available: ${stock?.quantity || 0}`);
            }
            if (line.materialBrandId) {
              const brandStock = await tx.materialBrandStock.findUnique({
                where: { materialBrandId_storeId: { materialBrandId: line.materialBrandId, storeId: miniStore.id } },
              });
              if (!brandStock || Number(brandStock.quantity) < qtyDiff) {
                throw new Error(`Insufficient stock for brand "${line.brandName || line.material.nameEn}". Additional needed: ${qtyDiff}, Available: ${brandStock?.quantity || 0}`);
              }
            }
          }

          await StorageService.updateMaterialStock(tx, line.materialId, miniStore.id, -qtyDiff, line.materialBrandId);

          updateData.quantity = newQty;
          oldValues.quantity = oldQty;
          newValues.quantity = newQty;
        }
      }

      const updatedLine = await tx.orderStandaloneItemLine.update({
        where: { id: lineId },
        data: updateData,
        include: { material: true, materialBrand: true },
      });

      await OrdersService.refreshOrderPaymentStatus(tx, orderId);

      await AuditService.record(
        'OrderStandaloneItemLine',
        lineId,
        AuditAction.UPDATE,
        userId,
        oldValues,
        newValues
      );

      return updatedLine;
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
        await StorageService.updateMaterialStock(
          tx,
          deduction.materialId,
          miniStore.id,
          Number(deduction.quantityDeducted),
          deduction.materialBrandId
        );
      }

      // Delete deductions and the line
      await tx.orderServiceMaterialDeduction.deleteMany({
        where: { orderServiceLineId: lineId }
      });

      const deleted = await tx.orderServiceLine.delete({
        where: { id: lineId }
      });

      await OrdersService.refreshOrderPaymentStatus(tx, orderId);

      return deleted;
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

      await StorageService.updateMaterialStock(tx, line.materialId, miniStore.id, Number(line.quantity), line.materialBrandId);

      const deleted = await tx.orderStandaloneItemLine.delete({
        where: { id: lineId }
      });

      await OrdersService.refreshOrderPaymentStatus(tx, orderId);

      return deleted;
    });
  }

  static async addAdditionalCharge(orderId: string, data: { name: string, price: number, description?: string }) {
    return prisma.$transaction(async (tx) => {
      const charge = await tx.orderAdditionalCharge.create({
        data: {
          orderId,
          name: data.name,
          price: data.price,
          description: data.description,
        }
      });

      await OrdersService.refreshOrderPaymentStatus(tx, orderId);

      return charge;
    });
  }

  static async getOrders(filters: any) {
    const where: any = {};
    if (filters.search) {
      where.OR = [
        { orderNumber: { contains: filters.search, mode: 'insensitive' } },
        { fsrNumber: { contains: filters.search, mode: 'insensitive' } },
        { customer: { name: { contains: filters.search, mode: 'insensitive' } } },
        { customer: { phone: { contains: filters.search } } },
        { vehicle: { plateNumber: { contains: filters.search, mode: 'insensitive' } } },
      ];
    }
    if (filters.fsrNumber) {
      where.fsrNumber = { contains: filters.fsrNumber, mode: 'insensitive' };
    }
    if (filters.status) {
      where.orderStatus = filters.status;
    }
    
    return prisma.order.findMany({
      where,
      include: {
        customer: true,
        vehicle: { include: { carModel: { include: { brand: true } } } },
        serviceLines: {
          include: {
            serviceCategory: { include: { service: true } },
            materialDeductions: { include: { material: true, materialBrand: true } },
          },
        },
        standaloneLines: { include: { material: true, materialBrand: true } },
      },
      orderBy: [
        { orderDateTime: 'desc' },
        { createdAt: 'desc' },
      ],
    });
  }

  static async getOrder(idOrIdentifier: string) {
    const order = await prisma.order.findFirst({
      where: {
        OR: [
          { id: idOrIdentifier },
          { orderNumber: idOrIdentifier },
          { fsrNumber: idOrIdentifier },
        ],
      },
      include: {
        customer: true,
        vehicle: { include: { carModel: { include: { brand: true } } } },
        serviceLines: {
          include: {
            serviceCategory: { include: { service: true } },
            materialDeductions: { include: { material: true, materialBrand: true } },
          },
        },
        standaloneLines: { include: { material: true, materialBrand: true } },
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

    const serviceFee = Number(order.serviceFee || 0);
    const subtotal = totalService + totalStandalone + totalAdditional + serviceFee;
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
      serviceFee,
      totalPrice: subtotal,
      totalDiscount,
      taxAmount,
      netPrice,
      totalPaid,
      balanceDue,
    };
  }

  static async updateFsrNumber(orderIdOrIdentifier: string, fsrNumber: string | null | undefined, userId: string) {
    const order = await prisma.order.findFirst({
      where: {
        OR: [
          { id: orderIdOrIdentifier },
          { orderNumber: orderIdOrIdentifier },
          { fsrNumber: orderIdOrIdentifier },
        ],
      },
    });

    if (!order) throw new Error('Order not found');

    const normalizedFsr = fsrNumber && typeof fsrNumber === 'string' && fsrNumber.trim().length > 0
      ? fsrNumber.trim()
      : null;

    const updated = await prisma.order.update({
      where: { id: order.id },
      data: { fsrNumber: normalizedFsr },
    });

    await AuditService.record(
      'Order',
      order.id,
      AuditAction.UPDATE,
      userId,
      { fsrNumber: order.fsrNumber },
      { fsrNumber: normalizedFsr }
    );

    return updated;
  }

  static async updateServiceFee(orderIdOrIdentifier: string, newServiceFee: number | null | undefined, userId: string) {
    return prisma.$transaction(async (tx) => {
      const order = await tx.order.findFirst({
        where: {
          OR: [
            { id: orderIdOrIdentifier },
            { orderNumber: orderIdOrIdentifier },
            { fsrNumber: orderIdOrIdentifier },
          ],
        },
        include: {
          serviceLines: true,
          standaloneLines: true,
          additionalCharges: true,
          payments: true,
        },
      });

      if (!order) throw new Error('Order not found');

      const parsedFee = Math.max(0, Number(newServiceFee) || 0);

      // Recalculate totals and payment status
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
      total += parsedFee;

      const totalAfterDiscount = total - Number(order.discountAmount);
      const grandTotal = totalAfterDiscount + Number(order.taxAmount);
      const totalPaid = order.payments.reduce((sum, p) => sum + Number(p.amount), 0);
      const paymentStatus = totalPaid >= grandTotal ? 'PAID' : (totalPaid > 0 ? 'PARTIALLY_PAID' : 'UNPAID');

      const updated = await tx.order.update({
        where: { id: order.id },
        data: {
          serviceFee: parsedFee,
          paymentStatus,
        },
        include: {
          customer: true,
          vehicle: { include: { carModel: { include: { brand: true } } } },
          serviceLines: {
          include: {
            serviceCategory: { include: { service: true } },
            materialDeductions: { include: { material: true, materialBrand: true } },
          },
        },
          standaloneLines: { include: { material: true, materialBrand: true } },
          additionalCharges: true,
          payments: true,
          carStatuses: { include: { carStatus: true } },
          assignments: { include: { employee: true } },
        },
      });

      await AuditService.record(
        'Order',
        order.id,
        AuditAction.UPDATE,
        userId,
        { serviceFee: Number(order.serviceFee || 0) },
        { serviceFee: parsedFee }
      );

      return updated;
    });
  }

  static async notifyOrderCreated(orderId: string): Promise<boolean> {
    const fullOrder = await prisma.order.findUnique({
      where: { id: orderId },
      include: {
        customer: true,
        vehicle: {
          include: {
            carModel: {
              include: { brand: true },
            },
          },
        },
        serviceLines: {
          include: {
            serviceCategory: {
              include: { service: true },
            },
          },
        },
        standaloneLines: {
          include: {
            material: true,
            materialBrand: true,
          },
        },
        assignments: {
          include: {
            employee: true,
          },
        },
        carStatuses: {
          include: {
            carStatus: true,
          },
        },
        additionalCharges: true,
        payments: true,
      },
    });

    if (!fullOrder) return false;
    return TelegramService.sendOrderCreatedNotification(fullOrder);
  }
}

