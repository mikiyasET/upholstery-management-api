import { Router } from 'express';
import { StorageController } from './storage.controller';
import { requireAuth } from '../../middleware/auth';
import { validate } from '../../middleware/validate';
import { requirePermission, requireAnyPermission } from '../../middleware/permissions';
import * as schemas from './storage.schemas';

const router = Router();

router.use(requireAuth);

router.get('/materials/low-stock', requireAnyPermission('storage.lowStock', 'storage.view'), StorageController.getLowStockMaterials);

router.post('/materials/:id/restock', requireAnyPermission('storage.restock', 'storage.edit'), validate(schemas.restockSchema), StorageController.restock);
router.post('/materials/:id/adjust', requireAnyPermission('storage.adjust', 'storage.edit'), validate(schemas.adjustStockSchema), StorageController.adjustStock);

router.post('/store-transfers', requireAnyPermission('storage.transfer', 'storage.edit'), validate(schemas.storeTransferSchema), StorageController.storeTransfer);

router.post('/stock-counts', requireAnyPermission('storage.count', 'storage.edit'), validate(schemas.stockCountSchema), StorageController.stockCount);

router.post('/materials/:id/allocate-brand-stock', requireAnyPermission('storage.allocate', 'storage.edit'), validate(schemas.allocateBrandStockSchema), StorageController.allocateBrandStock);

router.get('/history', requireAnyPermission('storage.history', 'storage.view'), StorageController.getAllStockHistory);
router.get('/materials/:id/history', requireAnyPermission('storage.history', 'storage.view'), StorageController.getMaterialHistory);

export default router;
