import { Router } from 'express';
import { UsersController } from './users.controller';
import { requireAuth } from '../../middleware/auth';
import { validate } from '../../middleware/validate';
import { requirePermission } from '../../middleware/permissions';
import * as schemas from './users.schemas';

const router = Router();

router.use(requireAuth);

router.get('/', requirePermission('users.view'), UsersController.getUsers);
router.get('/permission-schema', requirePermission('users.view'), UsersController.getPermissionSchema);
router.post('/', requirePermission('users.edit'), validate(schemas.createUserSchema), UsersController.createUser);
router.patch('/:id', requirePermission('users.edit'), validate(schemas.updateUserSchema), UsersController.updateUser);

export default router;
