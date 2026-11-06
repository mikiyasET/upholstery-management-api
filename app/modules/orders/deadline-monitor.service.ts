import prisma from '../../lib/prisma';
import { OrderStatus } from '@prisma/client';
import { TelegramService } from '../../lib/telegram';

export class DeadlineMonitorService {
  private static timer: NodeJS.Timeout | null = null;
  private static isChecking = false;

  static startMonitoring(intervalMs = 60 * 1000): void {
    if (this.timer) return;

    // Run first check after a brief startup delay
    setTimeout(() => {
      this.checkDeadlines().catch((err) => {
        console.error('[DeadlineMonitor] Error in initial deadline check:', err);
      });
    }, 5000);

    // Schedule regular check
    this.timer = setInterval(() => {
      this.checkDeadlines().catch((err) => {
        console.error('[DeadlineMonitor] Error in periodic deadline check:', err);
      });
    }, intervalMs);

    if (this.timer.unref) {
      this.timer.unref();
    }

    console.log(`[DeadlineMonitor] Background deadline monitoring started (interval: ${intervalMs / 1000}s)`);
  }

  static stopMonitoring(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  static async checkDeadlines(): Promise<{ checked: number; warned: number }> {
    if (this.isChecking) return { checked: 0, warned: 0 };
    this.isChecking = true;

    try {
      const activeOrders = await prisma.order.findMany({
        where: {
          orderStatus: {
            in: [OrderStatus.OPEN, OrderStatus.IN_PROGRESS],
          },
          deadline: {
            not: null,
          },
          deadlineWarningSent: false,
        },
        include: {
          customer: true,
          vehicle: { include: { carModel: true } },
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
            },
          },
          assignments: {
            include: {
              employee: true,
            },
          },
          payments: true,
        },
      });

      let warnedCount = 0;
      const now = Date.now();

      for (const order of activeOrders) {
        if (!order.deadline) continue;

        const createdAt = order.createdAt.getTime();
        const deadline = order.deadline.getTime();
        const totalDuration = deadline - createdAt;

        if (totalDuration <= 0) continue;

        const elapsed = now - createdAt;
        const ratio = elapsed / totalDuration;

        // Check if 70% or more of the allotted time has elapsed
        if (ratio >= 0.7) {
          console.log(`[DeadlineMonitor] Order #${order.orderNumber} reached ${Math.round(ratio * 100)}% of deadline. Sending warning...`);

          await TelegramService.sendDeadlineWarningNotification(order, ratio);

          await prisma.order.update({
            where: { id: order.id },
            data: {
              deadlineWarningSent: true,
              deadlineWarningSentAt: new Date(),
            },
          });

          warnedCount++;
        }
      }

      return { checked: activeOrders.length, warned: warnedCount };
    } catch (err: any) {
      console.error('[DeadlineMonitor] Check failed:', err.message);
      return { checked: 0, warned: 0 };
    } finally {
      this.isChecking = false;
    }
  }
}
