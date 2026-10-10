import prisma from '../../lib/prisma';
import { AuditService } from '../../lib/audit';
import { StorageService } from '../storage/storage.service';
import { CustomersVehiclesService } from '../customers-vehicles/customers-vehicles.service';
import { AuditAction, StoreType } from '@prisma/client';

export class DirectSalesService {
  static async createDirectSale(data: any, userId: string) {
    return prisma.$transaction(async (tx) => {
      let customerName = data.customerName || null;
      let customerPhone = data.customerPhone || null;
      if (customerName && customerPhone) {
        // Resolve customer to ensure it exists in db, but we only store name/phone on DirectSale
        await CustomersVehiclesService.resolveCustomerAndVehicle({
          name: customerName,
          phone: customerPhone,
        });
      }

      let subtotal = 0;
      const itemsData: any[] = [];

      // Validate stock availability in Mini Store
      const miniStore = await tx.store.findUnique({ where: { type: StoreType.MINI } });
      if (!miniStore) throw new Error('Mini store not found');

      const insufficientItems: string[] = [];
      for (const item of data.items) {
        const material = await tx.material.findUnique({ where: { id: item.materialId } });
        if (!material) throw new Error(`Material ${item.materialId} not found`);

        const stock = await tx.materialStock.findUnique({
          where: { materialId_storeId: { materialId: item.materialId, storeId: miniStore.id } },
        });
        const available = stock?.quantity?.toNumber() || 0;
        if (available < item.quantity) {
          insufficientItems.push(`${material.nameEn}: need ${item.quantity}, only ${available} available`);
        }
      }
      if (insufficientItems.length > 0) {
        throw new Error(`Insufficient stock:\n${insufficientItems.join('\n')}`);
      }

      for (const item of data.items) {
        const net = (item.quantity * item.unitPrice) - item.discount;
        subtotal += net;
        itemsData.push({
          materialId: item.materialId,
          quantity: item.quantity,
          priceAtSaleTime: item.unitPrice,
        });
      }

      const totalAfterDiscount = subtotal - data.additionalDiscount;
      const taxAmount = data.taxEnabled ? totalAfterDiscount * data.taxRate : 0;
      const grandTotal = totalAfterDiscount + taxAmount;

      // Validate that payments cover the total
      const totalPaid = (data.payments as any[]).reduce((sum: number, p: any) => sum + p.amount, 0);
      let paymentStatus: 'PAID' | 'PARTIALLY_PAID' | 'UNPAID' = 'UNPAID';
      if (totalPaid >= grandTotal) {
        paymentStatus = 'PAID';
      } else if (totalPaid > 0) {
        paymentStatus = 'PARTIALLY_PAID';
      }

      const saleNumber = `DS-${Date.now().toString().slice(-6)}`;

      const sale = await tx.directSale.create({
        data: {
          saleNumber,
          customerName,
          customerPhone,
          discountAmount: data.additionalDiscount,
          taxAmount,
          createdById: userId,
          paymentStatus,
          lines: { create: itemsData },
        },
        include: { lines: true },
      });

      // Create payment records for each split payment
      for (const payment of data.payments) {
        if (payment.amount > 0) {
          await tx.directSalePayment.create({
            data: {
              directSaleId: sale.id,
              amount: payment.amount,
              method: payment.method,
              methodDetails: payment.referenceNumber || null,
              recordedById: userId,
            }
          });
        }
      }

      // Deduct stock from MINI store (miniStore already fetched during validation)

      for (const item of data.items) {
        await StorageService.updateMaterialStock(tx, item.materialId, miniStore.id, -item.quantity);
      }

      // Re-fetch with payments included
      const fullSale = await tx.directSale.findUnique({
        where: { id: sale.id },
        include: {
          lines: { include: { material: true } },
          payments: true,
        },
      });

      await AuditService.record('DirectSale', sale.id, AuditAction.CREATE, userId, null, fullSale);
      return fullSale;
    });
  }

  static async updateDirectSale(id: string, data: any, userId: string) {
    return prisma.$transaction(async (tx) => {
      const existingSale = await tx.directSale.findUnique({
        where: { id },
        include: { lines: true, payments: true }
      });
      if (!existingSale) throw new Error('Sale not found');

      const miniStore = await tx.store.findUnique({ where: { type: StoreType.MINI } });
      if (!miniStore) throw new Error('Mini store not found');

      // 1. Restore old stock
      for (const oldLine of existingSale.lines) {
        await StorageService.updateMaterialStock(tx, oldLine.materialId, miniStore.id, Number(oldLine.quantity));
      }

      // 2. Clear old lines and payments
      await tx.directSaleLine.deleteMany({ where: { directSaleId: id } });
      await tx.directSalePayment.deleteMany({ where: { directSaleId: id } });

      // 3. Process new data
      let customerName = data.customerName || null;
      let customerPhone = data.customerPhone || null;
      if (customerName && customerPhone) {
        await CustomersVehiclesService.resolveCustomerAndVehicle({ name: customerName, phone: customerPhone });
      }

      let subtotal = 0;
      const itemsData: any[] = [];
      const insufficientItems: string[] = [];

      // Validate stock availability in Mini Store
      for (const item of data.items) {
        const material = await tx.material.findUnique({ where: { id: item.materialId } });
        if (!material) throw new Error(`Material ${item.materialId} not found`);

        const stock = await tx.materialStock.findUnique({
          where: { materialId_storeId: { materialId: item.materialId, storeId: miniStore.id } },
        });
        const available = stock?.quantity?.toNumber() || 0;
        if (available < item.quantity) {
          insufficientItems.push(`${material.nameEn}: need ${item.quantity}, only ${available} available`);
        }
      }
      
      if (insufficientItems.length > 0) {
        throw new Error(`Insufficient stock:\n${insufficientItems.join('\n')}`);
      }

      for (const item of data.items) {
        const net = (item.quantity * item.unitPrice) - item.discount;
        subtotal += net;
        itemsData.push({
          materialId: item.materialId,
          quantity: item.quantity,
          priceAtSaleTime: item.unitPrice,
        });
      }

      const totalAfterDiscount = subtotal - data.additionalDiscount;
      const taxAmount = data.taxEnabled ? totalAfterDiscount * data.taxRate : 0;
      const grandTotal = totalAfterDiscount + taxAmount;

      const totalPaid = (data.payments as any[]).reduce((sum: number, p: any) => sum + p.amount, 0);
      let paymentStatus: 'PAID' | 'PARTIALLY_PAID' | 'UNPAID' = 'UNPAID';
      if (totalPaid >= grandTotal) {
        paymentStatus = 'PAID';
      } else if (totalPaid > 0) {
        paymentStatus = 'PARTIALLY_PAID';
      }

      const sale = await tx.directSale.update({
        where: { id },
        data: {
          customerName,
          customerPhone,
          discountAmount: data.additionalDiscount,
          taxAmount,
          paymentStatus,
          lines: { create: itemsData },
        },
      });

      for (const payment of data.payments) {
        if (payment.amount > 0) {
          await tx.directSalePayment.create({
            data: {
              directSaleId: sale.id,
              amount: payment.amount,
              method: payment.method,
              methodDetails: payment.referenceNumber || null,
              recordedById: userId,
            }
          });
        }
      }

      for (const item of data.items) {
        await StorageService.updateMaterialStock(tx, item.materialId, miniStore.id, -item.quantity);
      }

      const fullSale = await tx.directSale.findUnique({
        where: { id: sale.id },
        include: { lines: { include: { material: true } }, payments: true },
      });

      await AuditService.record('DirectSale', sale.id, AuditAction.UPDATE, userId, null, fullSale);
      return fullSale;
    });
  }

  static async getDirectSales() {
    return prisma.directSale.findMany({
      include: { 
        createdBy: { select: { name: true } },
        payments: { select: { amount: true } },
        _count: { select: { lines: true } }
      },
      orderBy: { saleDateTime: 'desc' },
    });
  }

  static async getDirectSale(id: string) {
    return prisma.directSale.findUnique({
      where: { id },
      include: {
        createdBy: { select: { name: true } },
        lines: { include: { material: true } },
        payments: true,
      },
    });
  }
}
