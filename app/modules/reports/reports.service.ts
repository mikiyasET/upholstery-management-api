import prisma from '../../lib/prisma';
import { OrderStatus, StoreType } from '@prisma/client';
import { format, startOfDay, endOfDay, startOfMonth, endOfMonth, parseISO } from 'date-fns';

export class ReportsService {
  static async getRevenue(startDate?: Date, endDate?: Date, group: 'day' | 'month' = 'day') {
    const start = startDate || new Date(new Date().setFullYear(new Date().getFullYear() - 1));
    const end = endDate || new Date();

    const orderPayments = await prisma.orderPayment.findMany({
      where: {
        paidAt: { gte: start, lte: end },
        order: { orderStatus: OrderStatus.DELIVERED },
      },
    });

    const directSales = await prisma.directSalePayment.findMany({
      where: { paidAt: { gte: start, lte: end } },
    });

    const aggregated: Record<string, { orderRevenue: number; directSaleRevenue: number }> = {};

    orderPayments.forEach(p => {
      const key = format(p.paidAt, group === 'day' ? 'yyyy-MM-dd' : 'yyyy-MM');
      if (!aggregated[key]) aggregated[key] = { orderRevenue: 0, directSaleRevenue: 0 };
      aggregated[key].orderRevenue += Number(p.amount);
    });

    directSales.forEach(p => {
      const key = format(p.paidAt, group === 'day' ? 'yyyy-MM-dd' : 'yyyy-MM');
      if (!aggregated[key]) aggregated[key] = { orderRevenue: 0, directSaleRevenue: 0 };
      aggregated[key].directSaleRevenue += Number(p.amount);
    });

    return Object.entries(aggregated)
      .map(([date, data]) => ({ date, ...data }))
      .sort((a, b) => a.date.localeCompare(b.date));
  }

  static async getTopServices(startDate?: Date, endDate?: Date) {
    const start = startDate || new Date(0);
    const end = endDate || new Date();

    const lines = await prisma.orderServiceLine.findMany({
      where: {
        order: { orderDateTime: { gte: start, lte: end } },
      },
      include: {
        serviceCategory: { include: { service: true } }
      }
    });

    const counts: Record<string, { name: string; nameEn: string; nameAm: string; count: number; revenue: number }> = {};

    lines.forEach(line => {
      const catId = line.serviceCategoryId;
      if (!counts[catId]) {
        const nameEn = `${line.serviceCategory.service.nameEn} - ${line.serviceCategory.nameEn}`;
        const nameAm = `${line.serviceCategory.service.nameAm || line.serviceCategory.service.nameEn} - ${line.serviceCategory.nameAm || line.serviceCategory.nameEn}`;
        counts[catId] = {
          name: nameEn,
          nameEn,
          nameAm,
          count: 0,
          revenue: 0,
        };
      }
      counts[catId].count += 1;
      counts[catId].revenue += Number(line.priceAtOrderTime);
    });

    return Object.values(counts).sort((a, b) => b.count - a.count).slice(0, 10);
  }

  static async getTopMaterials(startDate?: Date, endDate?: Date) {
    const start = startDate || new Date(0);
    const end = endDate || new Date();

    const orderLines = await prisma.orderStandaloneItemLine.findMany({
      where: { order: { orderDateTime: { gte: start, lte: end } } },
      include: { material: true }
    });

    const dsLines = await prisma.directSaleLine.findMany({
      where: { directSale: { saleDateTime: { gte: start, lte: end } } },
      include: { material: true }
    });

    const counts: Record<string, { name: string; nameEn: string; nameAm: string; count: number; revenue: number }> = {};

    orderLines.forEach(line => {
      const matId = line.materialId;
      if (!counts[matId]) {
        counts[matId] = {
          name: line.material.nameEn,
          nameEn: line.material.nameEn,
          nameAm: line.material.nameAm || line.material.nameEn,
          count: 0,
          revenue: 0,
        };
      }
      counts[matId].count += Number(line.quantity);
      counts[matId].revenue += (Number(line.quantity) * Number(line.priceAtOrderTime));
    });

    dsLines.forEach(line => {
      const matId = line.materialId;
      if (!counts[matId]) {
        counts[matId] = {
          name: line.material.nameEn,
          nameEn: line.material.nameEn,
          nameAm: line.material.nameAm || line.material.nameEn,
          count: 0,
          revenue: 0,
        };
      }
      counts[matId].count += Number(line.quantity);
      counts[matId].revenue += (Number(line.quantity) * Number(line.priceAtSaleTime));
    });

    return Object.values(counts).sort((a, b) => b.count - a.count).slice(0, 10);
  }

  static async getStockValuation() {
    const stocks = await prisma.materialStock.findMany({
      include: { material: true, store: true },
    });

    const valuationByStore: Record<string, { storeName: string; totalValue: number }> = {};
    const detailedStock: any[] = [];

    stocks.forEach(stock => {
      const storeKey = stock.store.type;
      const value = Number(stock.quantity) * Number(stock.material.currentPrice || 0);

      if (!valuationByStore[storeKey]) valuationByStore[storeKey] = { storeName: storeKey, totalValue: 0 };
      valuationByStore[storeKey].totalValue += value;

      detailedStock.push({
        materialName: stock.material.nameEn,
        materialNameEn: stock.material.nameEn,
        materialNameAm: stock.material.nameAm || stock.material.nameEn,
        storeType: storeKey,
        quantity: stock.quantity,
        unitPrice: Number(stock.material.currentPrice),
        totalValue: value,
      });
    });

    return {
      summary: Object.values(valuationByStore),
      details: detailedStock.sort((a, b) => b.totalValue - a.totalValue),
    };
  }

  static async getStaffWorkload(startDate?: Date, endDate?: Date) {
    const start = startDate || new Date(0);
    const end = endDate || new Date();

    const assignments = await prisma.orderAssignment.findMany({
      where: {
        assignedAt: { gte: start, lte: end }
      },
      include: { employee: true }
    });

    const counts: Record<string, { name: string; roles: Record<string, number>; total: number }> = {};

    assignments.forEach(a => {
      const empId = a.employeeId;
      if (!counts[empId]) counts[empId] = { name: a.employee.name, roles: {}, total: 0 };
      
      counts[empId].roles[a.roleLabel] = (counts[empId].roles[a.roleLabel] || 0) + 1;
      counts[empId].total += 1;
    });

    return Object.values(counts).sort((a, b) => b.total - a.total);
  }

  static async getStoreTransfers(startDate?: Date, endDate?: Date) {
    const start = startDate || new Date(0);
    const end = endDate || new Date();

    return prisma.storeTransfer.findMany({
      where: {
        transferDate: { gte: start, lte: end }
      },
      include: {
        material: true,
        fromStore: true,
        toStore: true,
        responsibleEmployee: { select: { name: true } },
        approvedBy: { select: { name: true } },
      },
      orderBy: { transferDate: 'desc' }
    });
  }

  static async getAuditLogs(page: number = 1, limit: number = 50) {
    const skip = (page - 1) * limit;
    
    const [total, logs] = await Promise.all([
      prisma.auditLog.count(),
      prisma.auditLog.findMany({
        skip,
        take: limit,
        orderBy: { timestamp: 'desc' },
        include: { changedBy: { select: { name: true } } },
      }),
    ]);

    return {
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
      data: logs,
    };
  }
}
