import prisma from '../../lib/prisma';
import { AuditService } from '../../lib/audit';
import { AuditAction, StoreType } from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';

export class StorageService {
  // Helper to upsert material stock safely
  static async updateMaterialStock(
    tx: any,
    materialId: string,
    storeId: string,
    quantityDelta: number
  ) {
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
      },
    });

    return materials.filter((m) => {
      const stock = m.materialStocks[0]?.quantity?.toNumber() || 0;
      return stock <= m.lowStockThreshold.toNumber();
    });
  }

  static async restock(materialId: string, data: any, userId: string) {
    return prisma.$transaction(async (tx) => {
      const material = await tx.material.findUnique({ where: { id: materialId } });
      if (!material) throw new Error('Material not found');

      const targetStoreType = material.isBulkTracked ? StoreType.MAIN : StoreType.MINI;
      const store = await tx.store.findUnique({ where: { type: targetStoreType } });
      if (!store) throw new Error(`${targetStoreType} store not found`);

      const restock = await tx.restock.create({
        data: {
          materialId,
          storeId: store.id,
          quantityAdded: data.quantityAdded,
          unitCost: data.unitCost,
          supplierId: data.supplierId,
          recordedById: userId,
        },
      });

      await this.updateMaterialStock(tx, materialId, store.id, data.quantityAdded);
      
      // Ensure we don't block the transaction with the audit call
      // using await outside the transaction logic or returning it as a promise is fine.
      // But inside a tx we should just await the tx.auditLog.create if we want transactional integrity.
      // However AuditService uses the global prisma client. For now, it's ok.
      await AuditService.record('Restock', restock.id, AuditAction.CREATE, userId, null, restock);

      return restock;
    });
  }

  static async adjustStock(materialId: string, data: any, userId: string) {
    return prisma.$transaction(async (tx) => {
      const adjustment = await tx.stockAdjustment.create({
        data: {
          materialId,
          storeId: data.storeId,
          quantityDelta: data.quantityDelta,
          reason: data.reason,
          notes: data.notes,
          adjustedById: userId,
        },
      });

      await this.updateMaterialStock(tx, materialId, data.storeId, data.quantityDelta);
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

      const fromStock = await tx.materialStock.findUnique({
        where: { materialId_storeId: { materialId: data.materialId, storeId: fromStore.id } },
      });

      const currentFromQuantity = fromStock?.quantity?.toNumber() || 0;
      if (currentFromQuantity < data.quantityTransferred) {
        throw new Error(`Insufficient stock in ${fromStore.type === 'MAIN' ? 'Main' : 'Mini'} Store for transfer. Available: ${currentFromQuantity}`);
      }

      const transfer = await tx.storeTransfer.create({
        data: {
          materialId: data.materialId,
          fromStoreId: fromStore.id,
          toStoreId: toStore.id,
          quantityTransferred: data.quantityTransferred,
          approvedById: userId,
          responsibleEmployeeId: data.responsibleEmployeeId,
          notes: data.notes,
        },
      });

      await this.updateMaterialStock(tx, data.materialId, fromStore.id, -data.quantityTransferred);
      await this.updateMaterialStock(tx, data.materialId, toStore.id, data.quantityTransferred);

      await AuditService.record('StoreTransfer', transfer.id, AuditAction.CREATE, userId, null, transfer);

      return transfer;
    });
  }

  static async stockCount(data: any, userId: string) {
    return prisma.$transaction(async (tx) => {
      const currentStock = await tx.materialStock.findUnique({
        where: { materialId_storeId: { materialId: data.materialId, storeId: data.storeId } },
      });
      const systemQty = currentStock?.quantity?.toNumber() || 0;
      const discrepancy = data.countedQuantity - systemQty;

      const count = await tx.stockCount.create({
        data: {
          storeId: data.storeId,
          materialId: data.materialId,
          countedQuantity: data.countedQuantity,
          systemQuantityAtCount: systemQty,
          discrepancy,
          countedById: userId,
          notes: data.notes,
        },
      });

      // Update the actual stock to match the counted quantity
      await tx.materialStock.upsert({
        where: { materialId_storeId: { materialId: data.materialId, storeId: data.storeId } },
        update: { quantity: data.countedQuantity },
        create: { materialId: data.materialId, storeId: data.storeId, quantity: data.countedQuantity },
      });

      await AuditService.record('StockCount', count.id, AuditAction.CREATE, userId, null, count);

      return count;
    });
  }

  static async getMaterialHistory(materialId: string) {
    const results = await Promise.all([
      prisma.restock.findMany({
        where: { materialId },
        include: { store: true, recordedBy: { select: { name: true } } },
        orderBy: { purchaseDate: 'desc' },
      }),
      prisma.stockAdjustment.findMany({
        where: { materialId },
        include: { store: true, adjustedBy: { select: { name: true } } },
        orderBy: { adjustedAt: 'desc' },
      }),
      prisma.storeTransfer.findMany({
        where: { materialId },
        include: {
          fromStore: true,
          toStore: true,
          approvedBy: { select: { name: true } },
        },
        orderBy: { transferDate: 'desc' },
      }),
      prisma.stockCount.findMany({
        where: { materialId },
        include: { store: true, countedBy: { select: { name: true } } },
        orderBy: { countedAt: 'desc' },
      }),
      prisma.directSaleLine.findMany({
        where: { materialId },
        include: { directSale: { include: { createdBy: { select: { name: true } } } } },
        orderBy: { directSale: { saleDateTime: 'desc' } }
      }),
      prisma.orderStandaloneItemLine.findMany({
        where: { materialId },
        include: { order: { include: { createdBy: { select: { name: true } }, customer: { select: { name: true, phoneNumber: true } } } } },
        orderBy: { order: { orderDateTime: 'desc' } }
      }),
      prisma.orderServiceMaterialDeduction.findMany({
        where: { materialId },
        include: { orderServiceLine: { include: { order: { include: { createdBy: { select: { name: true } }, customer: { select: { name: true, phoneNumber: true } } } } } } },
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
        store: 'MAIN',
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
        store: 'MAIN',
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
        store: 'MAIN',
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
