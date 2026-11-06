import 'dotenv/config';
import app from './server';
import prisma from './lib/prisma';
import { DailyStatsService } from './modules/reports/daily-stats.service';
import { DeadlineMonitorService } from './modules/orders/deadline-monitor.service';

const PORT = process.env.PORT || 3000;

app.listen(PORT, async () => {
  console.log(`Server listening on port ${PORT}`);
  try {
    const statsCount = await prisma.dailyStats.count();
    if (statsCount === 0) {
      await DailyStatsService.syncAllHistoricalStats();
    }
  } catch (err) {
    console.error('Failed to initialize daily stats:', err);
  }

  // Start background monitoring for orders reaching 70% of their deadline
  DeadlineMonitorService.startMonitoring();
});

