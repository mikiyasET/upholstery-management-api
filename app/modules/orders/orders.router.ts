import { Router } from 'express';
import { OrdersController } from './orders.controller';
import { requireAuth } from '../../middleware/auth';
import { validate } from '../../middleware/validate';
import { requirePermission } from '../../middleware/permissions';
import * as schemas from './orders.schemas';

const router = Router();

router.use(requireAuth);

router.get('/', requirePermission('orders.view'), OrdersController.getOrders);
router.post('/', requirePermission('orders.create'), validate(schemas.createOrderSchema), OrdersController.createOrder);

router.get('/:id', requirePermission('orders.view'), OrdersController.getOrder);
router.patch('/:id/status', requirePermission('orders.view'), validate(schemas.updateOrderStatusSchema), OrdersController.updateOrderStatus);
router.post('/:id/payments', requirePermission('orders.view'), validate(schemas.addPaymentSchema), OrdersController.addPayment);

router.post('/:id/car-status', requirePermission('orders.create'), validate(schemas.addCarStatusSchema), OrdersController.addCarStatus);
router.post('/:id/assignments', requirePermission('orders.create'), validate(schemas.addAssignmentSchema), OrdersController.addAssignment);
router.post('/:id/services', requirePermission('orders.create'), validate(schemas.addServiceLineSchema), OrdersController.addServiceLine);
router.delete('/:id/services/:lineId', requirePermission('orders.create'), OrdersController.removeServiceLine);
router.post('/:id/standalone-items', requirePermission('orders.create'), validate(schemas.addStandaloneLineSchema), OrdersController.addStandaloneLine);
router.delete('/:id/standalone-items/:lineId', requirePermission('orders.create'), OrdersController.removeStandaloneLine);
router.post('/:id/additional-charges', requirePermission('orders.create'), validate(schemas.addAdditionalChargeSchema), OrdersController.addAdditionalCharge);

export default router;
