import { Router } from 'express';
import { ReportsController } from './reports.controller';
import { requireAuth } from '../../middleware/auth';
import { validate } from '../../middleware/validate';
import { requirePermission, requireAnyPermission } from '../../middleware/permissions';
import * as schemas from './reports.schemas';

const router = Router();

router.use(requireAuth);

// Daily Pre-aggregated Revenue & Orders Statistics (Used by Dashboard Chart)
router.get(
  '/daily-stats',
  requireAnyPermission('reports.view', 'dashboard.view', 'orders.view', 'directSales.view'),
  ReportsController.getDailyStats
);
router.post(
  '/daily-stats/sync',
  requirePermission('reports.view'),
  ReportsController.syncDailyStats
);

router.get('/revenue', requirePermission('reports.view'), validate(schemas.dateRangeSchema), ReportsController.getRevenue);
router.get('/top-services', requirePermission('reports.view'), validate(schemas.dateRangeSchema), ReportsController.getTopServices);
router.get('/top-materials', requirePermission('reports.view'), validate(schemas.dateRangeSchema), ReportsController.getTopMaterials);
router.get('/inventory-valuation', requirePermission('reports.view'), ReportsController.getInventoryValuation);
router.get('/staff-workload', requirePermission('reports.view'), validate(schemas.dateRangeSchema), ReportsController.getStaffWorkload);
router.get('/store-transfers', requirePermission('reports.view'), validate(schemas.dateRangeSchema), ReportsController.getStoreTransfers);

// Audit logs strictly for Admin (no permission — role === ADMIN only)
router.get('/audit-logs', requirePermission('reports.view'), validate(schemas.paginationSchema), ReportsController.getAuditLogs);

export default router;

