import { Router } from 'express';
import { StorageController } from './storage.controller';
import { requireAuth } from '../../middleware/auth';
import { validate } from '../../middleware/validate';
import { requirePermission } from '../../middleware/permissions';
import * as schemas from './storage.schemas';

const router = Router();

router.use(requireAuth);

router.get('/materials/low-stock', requirePermission('storage.view'), StorageController.getLowStockMaterials);

router.post('/materials/:id/restock', requirePermission('storage.edit'), validate(schemas.restockSchema), StorageController.restock);
router.post('/materials/:id/adjust', requirePermission('storage.edit'), validate(schemas.adjustStockSchema), StorageController.adjustStock);

router.post('/store-transfers', requirePermission('storage.edit'), validate(schemas.storeTransferSchema), StorageController.storeTransfer);

router.post('/stock-counts', requirePermission('storage.edit'), validate(schemas.stockCountSchema), StorageController.stockCount);

router.post('/materials/:id/allocate-brand-stock', requirePermission('storage.edit'), validate(schemas.allocateBrandStockSchema), StorageController.allocateBrandStock);

router.get('/history', requirePermission('storage.view'), StorageController.getAllStockHistory);
router.get('/materials/:id/history', requirePermission('storage.view'), StorageController.getMaterialHistory);

export default router;
