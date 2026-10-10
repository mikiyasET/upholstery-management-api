import { Router } from 'express';
import { ReportsController } from './reports.controller';
import { requireAuth } from '../../middleware/auth';
import { validate } from '../../middleware/validate';
import { requirePermission } from '../../middleware/permissions';
import * as schemas from './reports.schemas';

const router = Router();

router.use(requireAuth);

router.get('/revenue', requirePermission('reports.view'), validate(schemas.dateRangeSchema), ReportsController.getRevenue);
router.get('/top-services', requirePermission('reports.view'), validate(schemas.dateRangeSchema), ReportsController.getTopServices);
router.get('/top-materials', requirePermission('reports.view'), validate(schemas.dateRangeSchema), ReportsController.getTopMaterials);
router.get('/inventory-valuation', requirePermission('reports.view'), ReportsController.getInventoryValuation);
router.get('/staff-workload', requirePermission('reports.view'), validate(schemas.dateRangeSchema), ReportsController.getStaffWorkload);
router.get('/store-transfers', requirePermission('reports.view'), validate(schemas.dateRangeSchema), ReportsController.getStoreTransfers);

// Audit logs strictly for Admin (no permission — role === ADMIN only)
router.get('/audit-logs', requirePermission('reports.view'), validate(schemas.paginationSchema), ReportsController.getAuditLogs);

export default router;
