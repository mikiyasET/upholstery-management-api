import prisma from '../../lib/prisma';
import { format, subDays, parseISO, eachDayOfInterval } from 'date-fns';

export class DailyStatsService {
  /**
   * Helper to format Date to 'yyyy-MM-dd' standard date key.
   */
  static formatDateKey(date?: Date | string): string {
    if (!date) return format(new Date(), 'yyyy-MM-dd');
    if (typeof date === 'string') {
      try {
        return format(parseISO(date), 'yyyy-MM-dd');
      } catch {
        return date.slice(0, 10);
      }
    }
    return format(date, 'yyyy-MM-dd');
  }

  /**
   * Record a new order in daily stats (increments orderCount and totalOrders).
   */
  static async recordOrderCreated(orderDate?: Date, tx?: any) {
    const client = tx || prisma;
    const dateStr = this.formatDateKey(orderDate);

    return client.dailyStats.upsert({
      where: { date: dateStr },
      update: {
        orderCount: { increment: 1 },
        totalOrders: { increment: 1 },
      },
      create: {
        date: dateStr,
        orderCount: 1,
        totalOrders: 1,
        orderRevenue: 0,
        directSaleRevenue: 0,
        totalRevenue: 0,
        directSaleCount: 0,
      },
    });
  }

  /**
   * Record an order payment (increments orderRevenue and totalRevenue).
   */
  static async recordOrderPayment(amount: number, paymentDate?: Date, tx?: any) {
    if (!amount || amount <= 0) return null;
    const client = tx || prisma;
    const dateStr = this.formatDateKey(paymentDate);

    return client.dailyStats.upsert({
      where: { date: dateStr },
      update: {
        orderRevenue: { increment: amount },
        totalRevenue: { increment: amount },
      },
      create: {
        date: dateStr,
        orderRevenue: amount,
        totalRevenue: amount,
        directSaleRevenue: 0,
        orderCount: 0,
        directSaleCount: 0,
        totalOrders: 0,
      },
    });
  }

  /**
   * Record a direct sale (increments directSaleCount, totalOrders, directSaleRevenue, totalRevenue).
   */
  static async recordDirectSale(amount: number, saleDate?: Date, tx?: any) {
    const client = tx || prisma;
    const dateStr = this.formatDateKey(saleDate);
    const validAmount = Number(amount) || 0;

    return client.dailyStats.upsert({
      where: { date: dateStr },
      update: {
        directSaleCount: { increment: 1 },
        totalOrders: { increment: 1 },
        directSaleRevenue: { increment: validAmount },
        totalRevenue: { increment: validAmount },
      },
      create: {
        date: dateStr,
        directSaleCount: 1,
        totalOrders: 1,
        directSaleRevenue: validAmount,
        totalRevenue: validAmount,
        orderRevenue: 0,
        orderCount: 0,
      },
    });
  }

  /**
   * Fetch daily revenue and order statistics for a timeframe.
   * Fills missing days in the range with zeros so the chart renders a continuous timeline.
   */
  static async getDailyStats(options: { days?: number; startDate?: string; endDate?: string } = {}) {
    const today = new Date();
    const days = options.days || 14;

    const endDateStr = options.endDate
      ? this.formatDateKey(options.endDate)
      : format(today, 'yyyy-MM-dd');

    const startDateStr = options.startDate
      ? this.formatDateKey(options.startDate)
      : format(subDays(today, days - 1), 'yyyy-MM-dd');

    // Fetch existing pre-calculated daily records
    const stored = await prisma.dailyStats.findMany({
      where: {
        date: {
          gte: startDateStr,
          lte: endDateStr,
        },
      },
      orderBy: { date: 'asc' },
    });

    const storedMap = new Map<string, any>();
    for (const record of stored) {
      storedMap.set(record.date, {
        date: record.date,
        totalRevenue: Number(record.totalRevenue),
        orderRevenue: Number(record.orderRevenue),
        directSaleRevenue: Number(record.directSaleRevenue),
        orderCount: record.orderCount,
        directSaleCount: record.directSaleCount,
        totalOrders: record.totalOrders,
      });
    }

    // Generate continuous range of calendar dates
    const dateInterval = eachDayOfInterval({
      start: parseISO(startDateStr),
      end: parseISO(endDateStr),
    });

    const result = dateInterval.map((d) => {
      const key = format(d, 'yyyy-MM-dd');
      if (storedMap.has(key)) {
        return storedMap.get(key);
      }
      return {
        date: key,
        totalRevenue: 0,
        orderRevenue: 0,
        directSaleRevenue: 0,
        orderCount: 0,
        directSaleCount: 0,
        totalOrders: 0,
      };
    });

    return result;
  }

  /**
   * Sync stats for a specific date (recalculates from sources of truth).
   */
  static async syncStatsForDate(dateStr: string, tx?: any) {
    const client = tx || prisma;
    const start = new Date(`${dateStr}T00:00:00.000Z`);
    const end = new Date(`${dateStr}T23:59:59.999Z`);

    const [orderCount, orderPayments, directSales, directSalePayments] = await Promise.all([
      client.order.count({
        where: { orderDateTime: { gte: start, lte: end } },
      }),
      client.orderPayment.findMany({
        where: { paidAt: { gte: start, lte: end } },
        select: { amount: true },
      }),
      client.directSale.count({
        where: { saleDateTime: { gte: start, lte: end } },
      }),
      client.directSalePayment.findMany({
        where: { paidAt: { gte: start, lte: end } },
        select: { amount: true },
      }),
    ]);

    const orderRevenue = orderPayments.reduce((acc: number, p: any) => acc + Number(p.amount), 0);
    const directSaleRevenue = directSalePayments.reduce((acc: number, p: any) => acc + Number(p.amount), 0);
    const totalRevenue = orderRevenue + directSaleRevenue;
    const totalOrders = orderCount + directSales;

    return client.dailyStats.upsert({
      where: { date: dateStr },
      update: {
        totalRevenue,
        orderRevenue,
        directSaleRevenue,
        orderCount,
        directSaleCount: directSales,
        totalOrders,
      },
      create: {
        date: dateStr,
        totalRevenue,
        orderRevenue,
        directSaleRevenue,
        orderCount,
        directSaleCount: directSales,
        totalOrders,
      },
    });
  }

  /**
   * Recalculate & sync all historical stats from Order, OrderPayment, DirectSale, DirectSalePayment.
   * Useful on startup, migration, or manual sync to guarantee accurate historical pre-calculated rows.
   */
  static async syncAllHistoricalStats() {
    console.log('[DailyStatsService] Syncing historical daily statistics...');

    // 1. Fetch all orders
    const orders = await prisma.order.findMany({
      select: { orderDateTime: true },
    });

    // 2. Fetch all order payments
    const orderPayments = await prisma.orderPayment.findMany({
      select: { paidAt: true, amount: true },
    });

    // 3. Fetch all direct sales and their payments
    const directSales = await prisma.directSale.findMany({
      select: {
        id: true,
        saleDateTime: true,
        payments: { select: { amount: true, paidAt: true } },
      },
    });

    // Map: dateStr -> aggregated values
    const dateData = new Map<
      string,
      {
        orderCount: number;
        orderRevenue: number;
        directSaleCount: number;
        directSaleRevenue: number;
      }
    >();

    const getOrCreate = (dateStr: string) => {
      if (!dateData.has(dateStr)) {
        dateData.set(dateStr, {
          orderCount: 0,
          orderRevenue: 0,
          directSaleCount: 0,
          directSaleRevenue: 0,
        });
      }
      return dateData.get(dateStr)!;
    };

    // Aggregate Orders
    for (const o of orders) {
      const d = this.formatDateKey(o.orderDateTime);
      getOrCreate(d).orderCount += 1;
    }

    // Aggregate Order Payments
    for (const p of orderPayments) {
      const d = this.formatDateKey(p.paidAt);
      getOrCreate(d).orderRevenue += Number(p.amount);
    }

    // Aggregate Direct Sales & Payments
    for (const ds of directSales) {
      const saleDate = this.formatDateKey(ds.saleDateTime);
      getOrCreate(saleDate).directSaleCount += 1;

      for (const p of ds.payments) {
        const paymentDate = this.formatDateKey(p.paidAt);
        getOrCreate(paymentDate).directSaleRevenue += Number(p.amount);
      }
    }

    // Write upserts to DailyStats
    for (const [date, data] of dateData.entries()) {
      const totalRevenue = data.orderRevenue + data.directSaleRevenue;
      const totalOrders = data.orderCount + data.directSaleCount;

      await prisma.dailyStats.upsert({
        where: { date },
        update: {
          totalRevenue,
          orderRevenue: data.orderRevenue,
          directSaleRevenue: data.directSaleRevenue,
          orderCount: data.orderCount,
          directSaleCount: data.directSaleCount,
          totalOrders,
        },
        create: {
          date,
          totalRevenue,
          orderRevenue: data.orderRevenue,
          directSaleRevenue: data.directSaleRevenue,
          orderCount: data.orderCount,
          directSaleCount: data.directSaleCount,
          totalOrders,
        },
      });
    }

    console.log(`[DailyStatsService] Successfully synced ${dateData.size} days of statistics.`);
    return { syncedDays: dateData.size };
  }
}
