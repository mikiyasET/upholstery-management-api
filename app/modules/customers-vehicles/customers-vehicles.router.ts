import { Router } from 'express';
import { CustomersVehiclesController } from './customers-vehicles.controller';
import { requireAuth } from '../../middleware/auth';
import { validate } from '../../middleware/validate';
import { requirePermission } from '../../middleware/permissions';
import * as schemas from './customers-vehicles.schemas';

const router = Router();

router.use(requireAuth);

router.get('/search', requirePermission('customers.view'), CustomersVehiclesController.searchCustomer);
router.get('/', requirePermission('customers.view'), CustomersVehiclesController.getCustomers);
router.get('/vehicles', requirePermission('customers.view'), CustomersVehiclesController.getVehicles);
router.get('/vehicles/:id/history', requirePermission('customers.view'), CustomersVehiclesController.getVehicleHistory);

router.post('/resolve', requirePermission('customers.edit'), validate(schemas.resolveCustomerVehicleSchema), CustomersVehiclesController.resolve);

router.get('/:id', requirePermission('customers.view'), CustomersVehiclesController.getCustomerById);

export default router;
