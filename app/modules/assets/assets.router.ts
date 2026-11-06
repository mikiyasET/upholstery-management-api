import { Router } from 'express';
import { AssetsController } from './assets.controller';
import { requireAuth } from '../../middleware/auth';
import { validate } from '../../middleware/validate';
import { upload } from '../../lib/uploads';
import { requirePermission } from '../../middleware/permissions';
import * as schemas from './assets.schemas';

const router = Router();

// All assets routes require authentication
router.use(requireAuth);

router.get('/', requirePermission('assets.view'), AssetsController.getAssets);
router.get('/trash-summary', requirePermission('assets.view'), AssetsController.getTrashSummary);
router.get('/:id', requirePermission('assets.view'), AssetsController.getAssetById);

router.post(
  '/',
  requirePermission('assets.add'),
  upload.single('image'),
  validate(schemas.createAssetSchema),
  AssetsController.createAsset
);

router.patch(
  '/:id',
  requirePermission('assets.edit'),
  upload.single('image'),
  validate(schemas.updateAssetSchema),
  AssetsController.updateAsset
);

router.delete('/:id', requirePermission('assets.remove'), AssetsController.moveToTrash);
router.post('/:id/restore', requirePermission('assets.remove'), AssetsController.restoreFromTrash);
router.delete('/:id/permanent', requirePermission('assets.remove'), AssetsController.permanentDelete);

export default router;

