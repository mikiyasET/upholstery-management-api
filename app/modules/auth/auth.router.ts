import { Router } from 'express';
import { AuthController } from './auth.controller';
import { validate } from '../../middleware/validate';
import { loginSchema, refreshSchema, changePasswordSchema } from './auth.schemas';
import { requireAuth } from '../../middleware/auth';

const router = Router();

router.post('/login', validate(loginSchema), AuthController.login);
router.post('/refresh', validate(refreshSchema), AuthController.refresh);
router.post('/logout', requireAuth, AuthController.logout);
router.get('/me', requireAuth, AuthController.me);
router.post('/change-password', requireAuth, validate(changePasswordSchema), AuthController.changePassword);

export default router;
