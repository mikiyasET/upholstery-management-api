import { Router } from 'express';
import { DirectSalesController } from './direct-sales.controller';
import { requireAuth } from '../../middleware/auth';
import { validate } from '../../middleware/validate';
import { requirePermission, requireAnyPermission } from '../../middleware/permissions';
import * as schemas from './direct-sales.schemas';

const router = Router();

router.use(requireAuth);

router.get('/', requirePermission('directSales.history'), DirectSalesController.getDirectSales);
router.post('/', requirePermission('directSales.create'), validate(schemas.createDirectSaleSchema), DirectSalesController.createDirectSale);
router.put('/:id', requirePermission('directSales.create'), validate(schemas.createDirectSaleSchema), DirectSalesController.updateDirectSale);
router.patch('/:id/fsr-number', requireAnyPermission('directSales.create', 'directSales.history'), validate(schemas.updateDirectSaleFsrSchema), DirectSalesController.updateFsrNumber);
router.get('/:id', requirePermission('directSales.view'), DirectSalesController.getDirectSale);

export default router;
