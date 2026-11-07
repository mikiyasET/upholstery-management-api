import { Router } from 'express';
import { OrdersController } from './orders.controller';
import { requireAuth } from '../../middleware/auth';
import { validate } from '../../middleware/validate';
import { requirePermission, requireAnyPermission } from '../../middleware/permissions';
import * as schemas from './orders.schemas';

const router = Router();

router.use(requireAuth);

router.get('/', requirePermission('orders.view'), OrdersController.getOrders);
router.post('/', requirePermission('orders.create'), validate(schemas.createOrderSchema), OrdersController.createOrder);

router.get('/:id', requirePermission('orders.view'), OrdersController.getOrder);
router.patch('/:id/status', requireAnyPermission('orders.status', 'orders.edit', 'orders.view'), validate(schemas.updateOrderStatusSchema), OrdersController.updateOrderStatus);
router.patch('/:id/fsr-number', requireAnyPermission('orders.edit', 'orders.create'), validate(schemas.updateOrderFsrSchema), OrdersController.updateFsrNumber);
router.patch('/:id/service-fee', requireAnyPermission('orders.edit', 'orders.create'), validate(schemas.updateOrderServiceFeeSchema), OrdersController.updateServiceFee);
router.post('/:id/payments', requireAnyPermission('orders.payment', 'orders.edit', 'orders.view'), validate(schemas.addPaymentSchema), OrdersController.addPayment);
router.post('/:id/notify-telegram', requirePermission('orders.view'), OrdersController.notifyTelegram);

router.post('/:id/car-status', requireAnyPermission('orders.edit', 'orders.create'), validate(schemas.addCarStatusSchema), OrdersController.addCarStatus);
router.post('/:id/assignments', requireAnyPermission('orders.edit', 'orders.create'), validate(schemas.addAssignmentSchema), OrdersController.addAssignment);
router.post('/:id/services', requireAnyPermission('orders.edit', 'orders.create'), validate(schemas.addServiceLineSchema), OrdersController.addServiceLine);
router.patch('/:id/services/:lineId', requireAnyPermission('orders.edit', 'orders.create'), validate(schemas.updateServiceLineSchema), OrdersController.updateServiceLine);
router.delete('/:id/services/:lineId', requireAnyPermission('orders.delete', 'orders.edit', 'orders.create'), OrdersController.removeServiceLine);
router.post('/:id/standalone-items', requireAnyPermission('orders.edit', 'orders.create'), validate(schemas.addStandaloneLineSchema), OrdersController.addStandaloneLine);
router.patch('/:id/standalone-items/:lineId', requireAnyPermission('orders.edit', 'orders.create'), validate(schemas.updateStandaloneLineSchema), OrdersController.updateStandaloneLine);
router.delete('/:id/standalone-items/:lineId', requireAnyPermission('orders.delete', 'orders.edit', 'orders.create'), OrdersController.removeStandaloneLine);
router.post('/:id/additional-charges', requireAnyPermission('orders.edit', 'orders.create'), validate(schemas.addAdditionalChargeSchema), OrdersController.addAdditionalCharge);

export default router;
